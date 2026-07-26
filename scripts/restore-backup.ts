/** Runs the preview-only operator restore command without printing protected inputs. */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  parseEncryptedBackup,
} from "../src/crypto/backup-envelope";
import { importBackupEncryptionKey } from "../src/crypto/backup-key";
import {
  createNeonBackupRestoreTarget,
  type ManagedBackupRestoreTarget,
} from "../src/data/backup/neon-adapter";
import { importBackup } from "../src/data/backup/import-backup";
import {
  BACKUP_OBJECT_PREFIX,
} from "../src/jobs/create-daily-backup";
import {
  parseBackupEnvironment,
  parseVisionDatabaseUrl,
} from "../src/server/env";

/** Exact destructive-action phrase required before a disposable preview target is opened. */
export const RESTORE_DISPOSABLE_CONFIRMATION =
  "RESTORE PREVIEW DISPOSABLE TARGET" as const;

/** Replaceable process boundaries used by tests and the production operator entry. */
export interface RestoreBackupCommandDependencies {
  readonly readBackupObject: (objectKey: string) => Promise<string>;
  readonly createTarget: (input: {
    readonly databaseUrl: string;
    readonly targetId: string;
  }) => Promise<ManagedBackupRestoreTarget>;
  readonly writeOutput: (line: string) => void;
}

interface RestoreArguments {
  readonly objectKey: string;
  readonly replaceDisposableTarget: boolean;
  readonly assertedTargetId?: string;
}

const OBJECT_KEY_PATTERN =
  /^backups\/v1\/\d{4}\/\d{2}\/\d{2}\/[A-Za-z0-9_-]{43}\.vision-backup$/u;

/** Validates operator policy, retrieves one object, restores, and prints only counts/checksum. */
export async function runRestoreBackupCommand(
  arguments_: readonly string[],
  processEnvironment: Readonly<Record<string, string | undefined>>,
  dependencies: RestoreBackupCommandDependencies,
): Promise<void> {
  const argumentsValue = parseArguments(arguments_);
  let backupConfiguration: ReturnType<typeof parseBackupEnvironment>;
  let databaseUrl: string;
  let targetId: string;
  try {
    backupConfiguration = parseBackupEnvironment(processEnvironment);
    databaseUrl = parseVisionDatabaseUrl(
      processEnvironment.PREVIEW_RESTORE_DATABASE_URL,
    );
    targetId = processEnvironment.PREVIEW_RESTORE_TARGET_ID ?? "";
    if (!/^[A-Za-z0-9_-]{1,128}$/u.test(targetId)) {
      throw new Error("Invalid target identity.");
    }
  } catch {
    throw new Error("Backup restore configuration is invalid.");
  }

  let serialized: string;
  try {
    serialized = await dependencies.readBackupObject(argumentsValue.objectKey);
  } catch {
    throw new Error("Backup object retrieval failed.");
  }
  const encrypted = parseEncryptedBackup(serialized);
  const backupKey = await importBackupEncryptionKey(
    backupConfiguration.BACKUP_ENCRYPTION_KEY,
    backupConfiguration.BACKUP_KEY_VERSION,
  );
  const managed = await dependencies.createTarget({ databaseUrl, targetId });
  try {
    const report = await importBackup(encrypted, backupKey, managed.target, {
      replaceDisposableTarget: argumentsValue.replaceDisposableTarget,
      assertedEnvironment: "preview",
      assertedTargetId: argumentsValue.assertedTargetId,
    });
    dependencies.writeOutput(
      JSON.stringify({
        plaintextSha256: report.plaintextSha256,
        rowCounts: report.rowCounts,
        replacedExisting: report.replacedExisting,
      }),
    );
  } finally {
    await managed.close();
  }
}

/** Parses a closed preview-only CLI grammar before any external or secret-bearing work. */
function parseArguments(arguments_: readonly string[]): RestoreArguments {
  const values = new Map<string, string | true>();
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]!;
    if (argument === "--replace-disposable-target") {
      if (values.has(argument)) throw new Error("Restore argument is duplicated.");
      values.set(argument, true);
      continue;
    }
    if (
      ![
        "--object",
        "--target",
        "--confirm-disposable-target",
        "--assert-target-id",
      ].includes(argument)
    ) {
      throw new Error("Restore argument is unsupported.");
    }
    if (values.has(argument) || index + 1 >= arguments_.length) {
      throw new Error("Restore argument is missing or duplicated.");
    }
    values.set(argument, arguments_[++index]!);
  }
  const objectKey = values.get("--object");
  if (
    typeof objectKey !== "string" ||
    !objectKey.startsWith(BACKUP_OBJECT_PREFIX) ||
    !OBJECT_KEY_PATTERN.test(objectKey)
  ) {
    throw new Error("Restore object key is invalid.");
  }
  if (values.get("--target") !== "preview") {
    throw new Error("Backup restore target must be preview.");
  }
  if (
    values.get("--confirm-disposable-target") !==
    RESTORE_DISPOSABLE_CONFIRMATION
  ) {
    throw new Error("Backup restore disposable-target confirmation is invalid.");
  }
  const assertedTargetId = values.get("--assert-target-id");
  if (
    assertedTargetId !== undefined &&
    (typeof assertedTargetId !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/u.test(assertedTargetId))
  ) {
    throw new Error("Backup restore target assertion is invalid.");
  }
  return Object.freeze({
    objectKey,
    replaceDisposableTarget: values.has("--replace-disposable-target"),
    ...(typeof assertedTargetId === "string" ? { assertedTargetId } : {}),
  });
}

/** Downloads one encrypted object through Wrangler into an owned temporary directory. */
async function readBackupObjectWithWrangler(objectKey: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "vision-restore-"));
  const file = join(directory, "backup.vision-backup");
  const executable =
    process.platform === "win32"
      ? resolve("node_modules/.bin/wrangler.cmd")
      : resolve("node_modules/.bin/wrangler");
  try {
    await promisify(execFile)(
      executable,
      [
        "r2",
        "object",
        "get",
        `vision-preview-backups/${objectKey}`,
        "--remote",
        "--file",
        file,
      ],
      { windowsHide: true, maxBuffer: 1024 * 1024 },
    );
    return await readFile(file, "utf8");
  } finally {
    if (directory.startsWith(`${tmpdir()}${process.platform === "win32" ? "\\" : "/"}`)) {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

/** Constructs the production command dependencies without exposing database or key values. */
function productionDependencies(): RestoreBackupCommandDependencies {
  return {
    readBackupObject: readBackupObjectWithWrangler,
    /** Opens only the explicitly identified disposable preview target. */
    async createTarget({ databaseUrl, targetId }) {
      return createNeonBackupRestoreTarget(databaseUrl, {
        environment: "preview",
        targetId,
        disposable: true,
      });
    },
    /** Emits the already-redacted restore report as one JSON line. */
    writeOutput(line) {
      process.stdout.write(`${line}\n`);
    },
  };
}

/** Process entry point; failures emit one safe category and a nonzero status. */
async function main(): Promise<void> {
  try {
    await runRestoreBackupCommand(
      process.argv.slice(2),
      process.env,
      productionDependencies(),
    );
  } catch {
    process.stderr.write("Backup restore failed.\n");
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
