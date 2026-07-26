/** Runs the preview-only operator restore command without printing protected inputs. */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { encodeBase64Url } from "../src/crypto/envelope";
import { importBackupEncryptionKey } from "../src/crypto/backup-key";
import {
  createNeonBackupRestoreTarget,
  type ManagedBackupRestoreTarget,
} from "../src/data/backup/neon-adapter";
import { importBackup } from "../src/data/backup/import-backup";
import {
  BACKUP_OBJECT_PREFIX,
  readVerifiedStoredBackup,
  type BackupObjectHead,
  type BackupObjectReader,
} from "../src/jobs/create-daily-backup";
import {
  parseBackupEnvironment,
  parseVisionDatabaseUrl,
} from "../src/server/env";

/** Exact destructive-action phrase required before a disposable preview target is opened. */
export const RESTORE_DISPOSABLE_CONFIRMATION =
  "RESTORE PREVIEW DISPOSABLE TARGET" as const;

/** Fixed isolated bucket read by the preview-only recovery command. */
export const PREVIEW_BACKUP_BUCKET = "vision-preview-backups" as const;

/** Replaceable process boundaries used by tests and the production operator entry. */
export interface RestoreBackupCommandDependencies {
  readonly backupStore: BackupObjectReader;
  readonly createTarget: (input: {
    readonly databaseUrl: string;
    readonly targetId: string;
  }) => Promise<ManagedBackupRestoreTarget>;
  readonly writeOutput: (line: string) => void;
}

interface RestoreArguments {
  readonly objectKey: string;
  readonly createdDate: string;
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

  const backupKey = await importBackupEncryptionKey(
    backupConfiguration.BACKUP_ENCRYPTION_KEY,
    backupConfiguration.BACKUP_KEY_VERSION,
  );
  let verified: Awaited<ReturnType<typeof readVerifiedStoredBackup>>;
  try {
    verified = await readVerifiedStoredBackup(
      dependencies.backupStore,
      argumentsValue.objectKey,
      argumentsValue.createdDate,
      backupKey,
    );
  } catch {
    throw new Error("Backup object verification failed.");
  }
  const managed = await dependencies.createTarget({ databaseUrl, targetId });
  try {
    const report = await importBackup(
      verified.encrypted,
      backupKey,
      managed.target,
      {
      replaceDisposableTarget: argumentsValue.replaceDisposableTarget,
      assertedEnvironment: "preview",
      assertedTargetId: argumentsValue.assertedTargetId,
      },
    );
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
    createdDate: objectKey.slice(
      BACKUP_OBJECT_PREFIX.length,
      BACKUP_OBJECT_PREFIX.length + 10,
    ).replaceAll("/", "-"),
    replaceDisposableTarget: values.has("--replace-disposable-target"),
    ...(typeof assertedTargetId === "string" ? { assertedTargetId } : {}),
  });
}

interface CloudflareR2ReaderInput {
  readonly accountId: string;
  readonly apiToken: string;
  readonly bucketName: string;
}

const MAX_BACKUP_OBJECT_BYTES = 128 * 1024 * 1024;
const METADATA_HEADER_NAMES = Object.freeze({
  format: "format",
  createddate: "createdDate",
  ciphertextsha256: "ciphertextSha256",
  keyversion: "keyVersion",
} satisfies Readonly<Record<string, string>>);

/** Reads body and metadata through Cloudflare's authenticated object API. */
export function createCloudflareR2BackupObjectReader(
  input: CloudflareR2ReaderInput,
  fetchImplementation: typeof fetch = fetch,
): BackupObjectReader {
  if (
    !/^[a-f0-9]{32}$/iu.test(input.accountId) ||
    !/^[\x21-\x7e]{20,512}$/u.test(input.apiToken) ||
    input.bucketName !== PREVIEW_BACKUP_BUCKET
  ) {
    throw new Error("Cloudflare backup reader configuration is invalid.");
  }
  const baseUrl =
    `https://api.cloudflare.com/client/v4/accounts/${input.accountId}` +
    `/r2/buckets/${input.bucketName}/objects/`;

  /** Performs one authenticated object read and owns the optional body bytes. */
  async function read(
    key: string,
    includeBody: boolean,
  ): Promise<
    | BackupObjectHead
    | (BackupObjectHead & { readonly body: Uint8Array })
    | null
  > {
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    const response = await fetchImplementation(`${baseUrl}${encodedKey}`, {
      method: "GET",
      headers: { authorization: `Bearer ${input.apiToken}` },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Cloudflare backup object read failed.");
    const head = parseCloudflareObjectHeaders(key, response.headers);
    if (!includeBody) {
      await response.body?.cancel();
      return head;
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_BACKUP_OBJECT_BYTES
    ) {
      throw new Error("Cloudflare backup object is too large.");
    }
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > MAX_BACKUP_OBJECT_BYTES) {
      body.fill(0);
      throw new Error("Cloudflare backup object is too large.");
    }
    return Object.freeze({ ...head, body });
  }

  return Object.freeze({
    /** Reads an independent identity and metadata view without retaining the body. */
    async head(key: string) {
      return (await read(key, false)) as BackupObjectHead | null;
    },
    /** Reads the object body together with the same identity and metadata fields. */
    async get(key: string) {
      return (await read(key, true)) as
        | (BackupObjectHead & { readonly body: Uint8Array })
        | null;
    },
  });
}

/** Maps the object API's closed metadata/header contract to the shared verifier. */
function parseCloudflareObjectHeaders(
  key: string,
  headers: Headers,
): BackupObjectHead {
  const quotedEtag = headers.get("etag");
  if (!quotedEtag || !/^"[^"\r\n]{1,256}"$/u.test(quotedEtag)) {
    throw new Error("Cloudflare backup object ETag is invalid.");
  }
  const customMetadata: Record<string, string> = {};
  for (const [name, value] of headers.entries()) {
    if (!name.startsWith("x-amz-meta-")) continue;
    const suffix = name.slice("x-amz-meta-".length).toLowerCase();
    customMetadata[
      METADATA_HEADER_NAMES[
        suffix as keyof typeof METADATA_HEADER_NAMES
      ] ?? suffix
    ] = value;
  }
  const checksumHeaders = [
    headers.get("x-amz-checksum-sha256"),
    headers.get("cf-r2-checksum-sha256"),
  ].filter((value): value is string => value !== null);
  const checksums = checksumHeaders.map(parseNativeSha256);
  if (
    checksums.length === 0 ||
    checksums.some((value) => value !== checksums[0])
  ) {
    throw new Error("Cloudflare backup object checksum is invalid.");
  }
  return Object.freeze({
    key,
    etag: quotedEtag.slice(1, -1),
    customMetadata: Object.freeze(customMetadata),
    bodySha256: checksums[0],
  });
}

/** Converts one strict standard-base64 native checksum to Vision base64url. */
function parseNativeSha256(value: string): string {
  if (!/^[A-Za-z0-9+/]{43}=$/u.test(value)) {
    throw new Error("Cloudflare backup object checksum is invalid.");
  }
  const decoded = Buffer.from(value, "base64");
  if (
    decoded.byteLength !== 32 ||
    decoded.toString("base64") !== value
  ) {
    throw new Error("Cloudflare backup object checksum is invalid.");
  }
  return encodeBase64Url(decoded);
}

/** Constructs the production command dependencies without exposing database or key values. */
function productionDependencies(): RestoreBackupCommandDependencies {
  return {
    backupStore: createCloudflareR2BackupObjectReader({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
      apiToken: process.env.CLOUDFLARE_API_TOKEN ?? "",
      bucketName: PREVIEW_BACKUP_BUCKET,
    }),
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
