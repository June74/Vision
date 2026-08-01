import { readFile, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PROTECTED_RELEASE_SENTINEL,
  scanR2DeletionCapabilities,
  scanRelease,
} from "../../scripts/scan-release";
import {
  createCleanReleaseFixture,
  writeFixtureFile,
} from "./release-test-fixture";

const fixtureRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    fixtureRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

const EXPECTED_CAPABILITIES = [
  {
    path: "src/data/backup/r2-object-store.ts",
    capability: "adapter",
  },
  {
    path: "src/jobs/create-daily-backup.ts",
    capability: "failed_verification_cleanup",
  },
  {
    path: "src/jobs/purge-expired-backups.ts",
    capability: "validated_retention",
  },
] as const;

async function collectFiles(
  root: string,
  relativeDirectory: string,
  sources: Map<string, string>,
): Promise<void> {
  const directory = resolve(root, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = `${relativeDirectory}/${entry.name}`.replaceAll("\\", "/");
    if (entry.isDirectory()) {
      await collectFiles(root, relativePath, sources);
    } else if (
      entry.isFile() &&
      (/\.(?:ts|tsx|jsonc?)$/u.test(entry.name) || /\.ya?ml$/u.test(entry.name))
    ) {
      sources.set(relativePath, await readFile(resolve(root, relativePath), "utf8"));
    }
  }
}

async function currentProductionSources(): Promise<ReadonlyMap<string, string>> {
  const root = resolve(import.meta.dirname, "../..");
  const sources = new Map<string, string>();
  await collectFiles(root, "src", sources);
  await collectFiles(root, "scripts", sources);
  await collectFiles(root, ".github/workflows", sources);
  for (const path of ["package.json", "wrangler.jsonc"]) {
    sources.set(path, await readFile(resolve(root, path), "utf8"));
  }
  return sources;
}

function sameInvocationCleanupSource(
  catchBody: string,
  verificationKey = "objectKey",
  verificationBody?: string,
): string {
  const exactVerificationReturn = `return await verifyStoredBackup(
          dependencies.store,
          ${verificationKey},
          createdDate,
          dependencies.backupKey,
          created ? "created" : "existing",
        );`;
  return `interface BackupObjectStore {
      putIfAbsent(key: string): Promise<boolean>;
      delete(key: string): Promise<void>;
    }
    declare function utcDate(now: Date): string;
    declare function dailyObjectKey(createdDate: string): Promise<string>;
    declare function verifyStoredBackup(
      store: BackupObjectStore,
      key: string,
      createdDate: string,
      backupKey: string,
      status: "created" | "existing",
    ): Promise<unknown>;
    export async function createDailyBackup(
      now: Date,
      dependencies: { store: BackupObjectStore; backupKey: string },
      replacement: string,
    ) {
      const createdDate = utcDate(now);
      const objectKey = await dailyObjectKey(createdDate);
       let created: boolean;
       created = await dependencies.store.putIfAbsent(objectKey);
       try {
         ${verificationBody ?? exactVerificationReturn}
       } catch {
         ${catchBody}
      }
    }`;
}

function retentionCleanupSource(options: {
  readonly beforeFunction?: string;
  readonly insideFunction?: string;
  readonly beforeGuard?: string;
  readonly deleteBody?: string;
} = {}): string {
  return `${options.beforeFunction ?? "export const BACKUP_RETENTION_DAYS = 30;"}
    const DAY_MILLISECONDS = 86_400_000;
    interface BackupObjectStore { delete(key: string): Promise<void> }
    declare function utcDateMilliseconds(now: Date): number;
    declare function validatedBackupObjectDate(
      object: { key: string },
    ): number | undefined;
    export async function purgeExpiredBackups(
      now: Date,
      dependencies: { store: BackupObjectStore },
      objects: readonly { key: string }[],
      replacement: { key: string },
    ) {
      const today = utcDateMilliseconds(now);
      ${options.insideFunction ?? ""}
      for (const object of objects) {
        const createdDate = validatedBackupObjectDate(object);
        if (createdDate === undefined) { continue; }
        const ageDays = (today - createdDate) / DAY_MILLISECONDS;
        ${options.beforeGuard ?? ""}
        if (ageDays >= BACKUP_RETENTION_DAYS) {
          ${options.deleteBody ?? "await dependencies.store.delete(object.key);"}
        }
      }
    }`;
}

describe("R2 deletion capability boundary", () => {
  it("makes the actual release scan reject an unexpected R2 capability", async () => {
    const root = await createCleanReleaseFixture();
    fixtureRoots.push(root);
    await writeFixtureFile(
      root,
      "src/jobs/temporary-r2-destroy.ts",
      `export async function destroy(bucket: R2Bucket, key: string) {
        await bucket.delete(key);
      }`,
    );

    const result = await scanRelease({
      projectRoot: root,
      protectedSentinel: PROTECTED_RELEASE_SENTINEL,
    });

    expect(result.violations).toContainEqual({
      category: "r2-deletion-capability",
      file: "src/jobs/temporary-r2-destroy.ts",
      reason: "R2 deletion capability is outside the exact release allowlist",
    });
  });

  it("finds only the shared adapter and the two approved permanent callers", async () => {
    expect(scanR2DeletionCapabilities(await currentProductionSources())).toEqual(
      EXPECTED_CAPABILITIES,
    );
  });

  it("accepts canonical synthetic same-invocation and retention lifecycles", () => {
    const createSource = sameInvocationCleanupSource(`
      if (created) await dependencies.store.delete(objectKey);
      throw new Error("Backup verification failed.");
    `);
    const retentionSource = retentionCleanupSource();

    expect(
      scanR2DeletionCapabilities(
        new Map([
          ["src/jobs/create-daily-backup.ts", createSource],
          ["src/jobs/purge-expired-backups.ts", retentionSource],
        ]),
      ),
    ).toEqual([
      {
        path: "src/jobs/create-daily-backup.ts",
        capability: "failed_verification_cleanup",
      },
      {
        path: "src/jobs/purge-expired-backups.ts",
        capability: "validated_retention",
      },
    ]);
  });

  it("follows an imported factory through a renamed import into a temporary module", () => {
    const sources = new Map([
      [
        "src/data/temporary-r2-delete-factory.ts",
        `export function makeRemoval(bucket: R2Bucket) {
          return (key: string) => bucket.delete(key);
        }`,
      ],
      [
        "src/jobs/temporary-preview-fault.ts",
        `import { makeRemoval as buildCallback } from "../data/temporary-r2-delete-factory.js";
        export const prepare = buildCallback;`,
      ],
    ]);

    expect(scanR2DeletionCapabilities(sources)).toEqual([
      {
        path: "src/data/temporary-r2-delete-factory.ts",
        capability: "unexpected",
      },
      {
        path: "src/jobs/temporary-preview-fault.ts",
        capability: "unexpected",
      },
    ]);
  });

  it("detects renamed dependencies, destructured methods, and callbacks", () => {
    const sources = new Map([
      [
        "src/jobs/temporary-preview-restore.ts",
        `interface Port { delete(key: string): Promise<void> }
        export async function run(dependencies: { store: Port }, key: string) {
          const { delete: erase } = dependencies.store;
          const callback = (value: string) => erase(value);
          await callback(key);
        }`,
      ],
      [
        "scripts/temporary-cleanup-helper.ts",
        `export function callback(bucket: R2Bucket) {
          const remove = bucket.delete.bind(bucket);
          return remove;
        }`,
      ],
    ]);

    expect(scanR2DeletionCapabilities(sources)).toEqual([
      {
        path: "scripts/temporary-cleanup-helper.ts",
        capability: "unexpected",
      },
      {
        path: "src/jobs/temporary-preview-restore.ts",
        capability: "unexpected",
      },
    ]);
  });

  it.each([
    [
      ".github/workflows/preview.yml",
      "jobs:\n  cleanup:\n    steps:\n      - run: wrangler r2 object delete backups/v1/example",
    ],
    [
      "wrangler.acceptance.json",
      JSON.stringify({ command: "r2-object-delete", module: "temporary" }),
    ],
    [
      "wrangler.generated.json",
      JSON.stringify(
        { operation: { command: "delete-object", resource: "r2" } },
        null,
        2,
      ),
    ],
  ])("rejects deletion capability hidden in workflow or config %s", (path, text) => {
    expect(scanR2DeletionCapabilities(new Map([[path, text]]))).toEqual([
      { path, capability: "unexpected" },
    ]);
  });

  it("rejects a temporary module importing the shared deletion adapter", () => {
    const sources = new Map([
      [
        "src/jobs/temporary-preview-fault.ts",
        `import { createR2BackupObjectStore as makeStore } from
          "../data/backup/r2-object-store";
        export const prepare = makeStore;`,
      ],
    ]);

    expect(scanR2DeletionCapabilities(sources)).toEqual([
      {
        path: "src/jobs/temporary-preview-fault.ts",
        capability: "unexpected",
      },
    ]);
  });

  it("does not confuse ordinary Map or database deletion with R2 deletion", () => {
    const sources = new Map([
      [
        "src/domain/example.ts",
        `export function forget(seen: Map<string, string>, key: string) {
          seen.delete(key);
          return transaction.delete(records).where(eq(records.id, key));
        }`,
      ],
    ]);

    expect(scanR2DeletionCapabilities(sources)).toEqual([]);
  });

  it("fails closed when an approved caller loses its required deletion guard", () => {
    const sources = new Map([
      [
        "src/jobs/create-daily-backup.ts",
        `interface BackupObjectStore { delete(key: string): Promise<void> }
        export async function createDailyBackup(
          dependencies: { store: BackupObjectStore },
          objectKey: string,
        ) {
          await dependencies.store.delete(objectKey);
        }`,
      ],
      [
        "src/jobs/purge-expired-backups.ts",
        `interface BackupObjectStore { delete(key: string): Promise<void> }
        export async function purgeExpiredBackups(
          dependencies: { store: BackupObjectStore },
          object: { key: string },
        ) {
          await dependencies.store.delete(object.key);
        }`,
      ],
    ]);

    expect(scanR2DeletionCapabilities(sources)).toEqual([
      { path: "src/jobs/create-daily-backup.ts", capability: "unexpected" },
      { path: "src/jobs/purge-expired-backups.ts", capability: "unexpected" },
    ]);
  });

  it.each(["!created", "created || override"])(
    "rejects failed-verification cleanup guarded by %s",
    (condition) => {
      const source = `interface BackupObjectStore { delete(key: string): Promise<void> }
        export async function createDailyBackup(
          dependencies: { store: BackupObjectStore },
          objectKey: string,
          created: boolean,
          override: boolean,
        ) {
          try { throw new Error("verification"); } catch {
            if (${condition}) await dependencies.store.delete(objectKey);
          }
        }`;

      expect(
        scanR2DeletionCapabilities(
          new Map([["src/jobs/create-daily-backup.ts", source]]),
        ),
      ).toEqual([
        { path: "src/jobs/create-daily-backup.ts", capability: "unexpected" },
      ]);
    },
  );

  it("rejects reassignment of creation state inside the verification catch", () => {
    const source = `interface BackupObjectStore {
        putIfAbsent(key: string): Promise<boolean>;
        delete(key: string): Promise<void>;
      }
      declare function utcDate(now: Date): string;
      declare function dailyObjectKey(createdDate: string): Promise<string>;
      export async function createDailyBackup(
        now: Date,
        dependencies: { store: BackupObjectStore },
      ) {
        const createdDate = utcDate(now);
        const objectKey = await dailyObjectKey(createdDate);
        let created: boolean;
        created = await dependencies.store.putIfAbsent(objectKey);
        try { throw new Error("verification"); } catch {
          created = true;
          if (created) await dependencies.store.delete(objectKey);
        }
      }`;

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/create-daily-backup.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/create-daily-backup.ts", capability: "unexpected" },
    ]);
  });

  it("rejects reassignment of the same-invocation backup key", () => {
    const source = `interface BackupObjectStore {
        putIfAbsent(key: string): Promise<boolean>;
        delete(key: string): Promise<void>;
      }
      declare function utcDate(now: Date): string;
      declare function dailyObjectKey(createdDate: string): Promise<string>;
      export async function createDailyBackup(
        now: Date,
        dependencies: { store: BackupObjectStore },
        replacement: string,
      ) {
        const createdDate = utcDate(now);
        let objectKey = await dailyObjectKey(createdDate);
        let created: boolean;
        created = await dependencies.store.putIfAbsent(objectKey);
        objectKey = replacement;
        try { throw new Error("verification"); } catch {
          if (created) await dependencies.store.delete(objectKey);
        }
      }`;

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/create-daily-backup.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/create-daily-backup.ts", capability: "unexpected" },
    ]);
  });

  it("rejects a catch-local objectKey shadow instead of the created key", () => {
    const source = sameInvocationCleanupSource(`
      const objectKey = replacement;
      if (created) await dependencies.store.delete(objectKey);
      throw new Error("Backup verification failed.");
    `);

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/create-daily-backup.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/create-daily-backup.ts", capability: "unexpected" },
    ]);
  });

  it("rejects a catch-local created shadow instead of the put result", () => {
    const source = sameInvocationCleanupSource(`
      const created = true;
      if (created) await dependencies.store.delete(objectKey);
      throw new Error("Backup verification failed.");
    `);

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/create-daily-backup.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/create-daily-backup.ts", capability: "unexpected" },
    ]);
  });

  it("rejects cleanup that is not reached from verification of the created key", () => {
    const source = sameInvocationCleanupSource(
      `if (created) await dependencies.store.delete(objectKey);
       throw new Error("Backup verification failed.");`,
      "replacement",
    );

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/create-daily-backup.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/create-daily-backup.ts", capability: "unexpected" },
    ]);
  });

  it("rejects a created-path throw that conditionally avoids verification", () => {
    const source = sameInvocationCleanupSource(
      `if (created) await dependencies.store.delete(objectKey);
       throw new Error("Backup verification failed.");`,
      "objectKey",
      `return created
        ? await (() => { throw new Error("Created object was not verified."); })()
        : await verifyStoredBackup(
            dependencies.store,
            objectKey,
            createdDate,
            dependencies.backupKey,
            created ? "created" : "existing",
          );`,
    );

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/create-daily-backup.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/create-daily-backup.ts", capability: "unexpected" },
    ]);
  });

  it("rejects an extra throwing verification argument before the backup key", () => {
    const source = sameInvocationCleanupSource(
      `if (created) await dependencies.store.delete(objectKey);
       throw new Error("Backup verification failed.");`,
      "objectKey",
      `return await verifyStoredBackup(
        dependencies.store,
        objectKey,
        createdDate,
        (() => { throw new Error("Verification arguments failed."); })(),
        dependencies.backupKey,
        created ? "created" : "existing",
      );`,
    );

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/create-daily-backup.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/create-daily-backup.ts", capability: "unexpected" },
    ]);
  });

  it("rejects a throwing fourth argument instead of the production backup key", () => {
    const source = sameInvocationCleanupSource(
      `if (created) await dependencies.store.delete(objectKey);
       throw new Error("Backup verification failed.");`,
      "objectKey",
      `return await verifyStoredBackup(
        dependencies.store,
        objectKey,
        createdDate,
        (() => { throw new Error("Backup key argument failed."); })(),
        created ? "created" : "existing",
      );`,
    );

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/create-daily-backup.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/create-daily-backup.ts", capability: "unexpected" },
    ]);
  });

  it("rejects an optional verification call with canonical arguments", () => {
    const source = sameInvocationCleanupSource(
      `if (created) await dependencies.store.delete(objectKey);
       throw new Error("Backup verification failed.");`,
      "objectKey",
      `return await verifyStoredBackup?.(
        dependencies.store,
        objectKey,
        createdDate,
        dependencies.backupKey,
        created ? "created" : "existing",
      );`,
    );

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/create-daily-backup.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/create-daily-backup.ts", capability: "unexpected" },
    ]);
  });

  it.each([
    "created = false;",
    "objectKey = replacement;",
    "createdDate = utcDate(new Date(0));",
  ])("rejects prior same-invocation lifecycle mutation %s", (mutation) => {
    const source = sameInvocationCleanupSource(`
      ${mutation}
      if (created) await dependencies.store.delete(objectKey);
      throw new Error("Backup verification failed.");
    `);

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/create-daily-backup.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/create-daily-backup.ts", capability: "unexpected" },
    ]);
  });

  it.each([
    "ageDays >= BACKUP_RETENTION_DAYS || force",
    "!(ageDays < BACKUP_RETENTION_DAYS)",
  ])("rejects permissive or negated retention guard %s", (condition) => {
    const source = `const BACKUP_RETENTION_DAYS = 30;
      interface BackupObjectStore { delete(key: string): Promise<void> }
      declare function validatedBackupObjectDate(object: { key: string }): number | undefined;
      export async function purgeExpiredBackups(
        dependencies: { store: BackupObjectStore },
        objects: readonly { key: string }[],
        today: number,
        force: boolean,
      ) {
        for (const object of objects) {
          const createdDate = validatedBackupObjectDate(object);
          if (createdDate === undefined) { continue; }
          const ageDays = (today - createdDate) / 86_400_000;
          if (${condition}) await dependencies.store.delete(object.key);
        }
      }`;

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/purge-expired-backups.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/purge-expired-backups.ts", capability: "unexpected" },
    ]);
  });

  it("rejects a distant validation call unrelated to the deleted object", () => {
    const source = `const BACKUP_RETENTION_DAYS = 30;
      interface BackupObjectStore { delete(key: string): Promise<void> }
      declare function validatedBackupObjectDate(object: { key: string }): number | undefined;
      export async function purgeExpiredBackups(
        dependencies: { store: BackupObjectStore },
        objects: readonly { key: string }[],
        other: { key: string },
      ) {
        validatedBackupObjectDate(other);
        for (const object of objects) {
          const ageDays = 31;
          if (ageDays >= BACKUP_RETENTION_DAYS) {
            await dependencies.store.delete(object.key);
          }
        }
      }`;

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/purge-expired-backups.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/purge-expired-backups.ts", capability: "unexpected" },
    ]);
  });

  it("rejects reassignment of independently derived retention age", () => {
    const source = `const BACKUP_RETENTION_DAYS = 30;
      const DAY_MILLISECONDS = 86_400_000;
      interface BackupObjectStore { delete(key: string): Promise<void> }
      declare function validatedBackupObjectDate(object: { key: string }): number | undefined;
      export async function purgeExpiredBackups(
        dependencies: { store: BackupObjectStore },
        objects: readonly { key: string }[],
        today: number,
      ) {
        for (const object of objects) {
          const createdDate = validatedBackupObjectDate(object);
          if (createdDate === undefined) { continue; }
          let ageDays = (today - createdDate) / DAY_MILLISECONDS;
          ageDays = 31;
          if (ageDays >= BACKUP_RETENTION_DAYS) {
            await dependencies.store.delete(object.key);
          }
        }
      }`;

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/purge-expired-backups.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/purge-expired-backups.ts", capability: "unexpected" },
    ]);
  });

  it("rejects mutation of the validated retention object's deletion key", () => {
    const source = `const BACKUP_RETENTION_DAYS = 30;
      const DAY_MILLISECONDS = 86_400_000;
      interface BackupObjectStore { delete(key: string): Promise<void> }
      declare function validatedBackupObjectDate(object: { key: string }): number | undefined;
      export async function purgeExpiredBackups(
        dependencies: { store: BackupObjectStore },
        objects: { key: string }[],
        replacement: string,
        today: number,
      ) {
        for (const object of objects) {
          const createdDate = validatedBackupObjectDate(object);
          if (createdDate === undefined) { continue; }
          const ageDays = (today - createdDate) / DAY_MILLISECONDS;
          object.key = replacement;
          if (ageDays >= BACKUP_RETENTION_DAYS) {
            await dependencies.store.delete(object.key);
          }
        }
      }`;

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/purge-expired-backups.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/purge-expired-backups.ts", capability: "unexpected" },
    ]);
  });

  it("rejects a shadowed object instead of the validated loop object", () => {
    const source = retentionCleanupSource({
      deleteBody: `const object = replacement;
        await dependencies.store.delete(object.key);`,
    });

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/purge-expired-backups.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/purge-expired-backups.ts", capability: "unexpected" },
    ]);
  });

  it("rejects mutation through an alias of the validated loop object", () => {
    const source = retentionCleanupSource({
      beforeGuard: `const alias = object;
        alias.key = replacement.key;`,
    });

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/purge-expired-backups.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/purge-expired-backups.ts", capability: "unexpected" },
    ]);
  });

  it.each([
    {
      name: "mutable retention binding",
      options: { beforeFunction: "export let BACKUP_RETENTION_DAYS = 30;" },
    },
    {
      name: "reassigned retention binding",
      options: {
        beforeFunction: "export let BACKUP_RETENTION_DAYS = 30;",
        insideFunction: "BACKUP_RETENTION_DAYS = 1;",
      },
    },
    {
      name: "shadowed retention binding",
      options: { insideFunction: "const BACKUP_RETENTION_DAYS = 0;" },
    },
  ])("rejects $name", ({ options }) => {
    const source = retentionCleanupSource(options);

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/purge-expired-backups.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/purge-expired-backups.ts", capability: "unexpected" },
    ]);
  });

  it.each([
    "createdDate = 0;",
    "ageDays = 31;",
    "object.key = replacement.key;",
  ])("rejects prior retention-state mutation %s", (mutation) => {
    const source = retentionCleanupSource({ beforeGuard: mutation });

    expect(
      scanR2DeletionCapabilities(
        new Map([["src/jobs/purge-expired-backups.ts", source]]),
      ),
    ).toEqual([
      { path: "src/jobs/purge-expired-backups.ts", capability: "unexpected" },
    ]);
  });

  it("detects delete capability returned, passed, or assigned after declaration", () => {
    const sources = new Map([
      [
        "src/jobs/temporary-return.ts",
        `export function expose(bucket: R2Bucket) { return bucket.delete; }`,
      ],
      [
        "src/jobs/temporary-pass.ts",
        `declare function receive(callback: (key: string) => Promise<void>): void;
        export function expose(bucket: R2Bucket) { receive(bucket.delete); }`,
      ],
      [
        "src/jobs/temporary-reassign.ts",
        `export function expose(bucket: R2Bucket) {
          let remove: ((key: string) => Promise<void>) | undefined;
          remove = bucket.delete.bind(bucket);
          return remove;
        }`,
      ],
    ]);

    expect(scanR2DeletionCapabilities(sources)).toEqual([
      { path: "src/jobs/temporary-pass.ts", capability: "unexpected" },
      { path: "src/jobs/temporary-reassign.ts", capability: "unexpected" },
      { path: "src/jobs/temporary-return.ts", capability: "unexpected" },
    ]);
  });

  it("propagates a default-exported bound delete through a renamed re-export", () => {
    const sources = new Map([
      [
        "src/data/delete-factory.ts",
        `export default function build(bucket: R2Bucket) {
          return bucket.delete.bind(bucket);
        }`,
      ],
      [
        "src/data/re-export.ts",
        `export { default as destroy } from "./delete-factory.js";`,
      ],
      [
        "src/jobs/temporary-import.ts",
        `import { destroy as erase } from "../data/re-export.js";
        export const exposed = erase;`,
      ],
    ]);

    expect(scanR2DeletionCapabilities(sources)).toEqual([
      { path: "src/data/delete-factory.ts", capability: "unexpected" },
      { path: "src/data/re-export.ts", capability: "unexpected" },
      { path: "src/jobs/temporary-import.ts", capability: "unexpected" },
    ]);
  });

  it.each(["delete", "cleanup", "purge", "destroy"])(
    "detects multiline workflow R2 %s commands",
    (operation) => {
      const source = `jobs:
        candidate:
          steps:
            - run: |
                wrangler
                  r2
                  object
                  ${operation}`;

      expect(
        scanR2DeletionCapabilities(
          new Map([[".github/workflows/preview.yml", source]]),
        ),
      ).toEqual([
        { path: ".github/workflows/preview.yml", capability: "unexpected" },
      ]);
    },
  );

  it.each(["run: >-", "run: |+", '"run": |'])(
    "detects valid multiline YAML scalar form %s",
    (runKey) => {
      const source = `jobs:
        candidate:
          steps:
            - ${runKey}
                wrangler
                  r2
                  object
                  delete`;

      expect(
        scanR2DeletionCapabilities(
          new Map([[".github/workflows/preview.yml", source]]),
        ),
      ).toEqual([
        { path: ".github/workflows/preview.yml", capability: "unexpected" },
      ]);
    },
  );

  it.each([
    'run: "wrangler r2 object delete backups/v1/example"',
    "'run': 'wrangler r2 object delete backups/v1/example'",
    '"run": >-',
  ])("detects quoted or unquoted workflow run scalar %s", (runKey) => {
    const source = runKey.endsWith(">-")
      ? `jobs:\n  candidate:\n    steps:\n      - ${runKey}\n          wrangler r2 object delete backups/v1/example`
      : `jobs:\n  candidate:\n    steps:\n      - ${runKey}`;

    expect(
      scanR2DeletionCapabilities(
        new Map([[".github/workflows/preview.yml", source]]),
      ),
    ).toEqual([
      { path: ".github/workflows/preview.yml", capability: "unexpected" },
    ]);
  });

  it("does not merge sibling YAML fields into a multiline run scalar", () => {
    const source = `jobs:
      candidate:
        steps:
          - run: |
              echo cleanup
            env:
              R2_OPERATION: delete`;

    expect(
      scanR2DeletionCapabilities(
        new Map([[".github/workflows/preview.yml", source]]),
      ),
    ).toEqual([]);
  });
});
