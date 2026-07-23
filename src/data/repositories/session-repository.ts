/** Encrypts OAuth transaction and session secrets before an atomic persistence boundary. */
import { sql } from "drizzle-orm";
import {
  MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS,
  parseCipherEnvelope,
  serializeCipherEnvelope,
  type CipherEnvelope,
} from "../../crypto/envelope";
import type { KeyProvider } from "../../crypto/key-provider";
import {
  decryptProtectedFields,
  encryptProtectedFields,
} from "../../crypto/protected-fields";
import type { VisionDatabase } from "../db";

/** Ciphertext-only row for one short-lived, single-use OAuth transaction. */
export interface OAuthTransactionRow {
  stateHash: string;
  admissionKeyHash: string;
  admissionSlot: number;
  verifierEnvelope: Uint8Array;
  nonceEnvelope: Uint8Array;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
}

/** Ciphertext-only row for one revocable opaque browser session. */
export interface ServerSessionRow {
  sessionIdHash: string;
  ownerId: string;
  googleSubject: string;
  emailEnvelope: Uint8Array;
  csrfTokenEnvelope: Uint8Array;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** Atomic persistence operations required for OAuth replay protection and session revocation. */
export interface SessionStore {
  cleanupOAuthState(cleanedAt: Date, staleWindowAt: Date, limit: number): Promise<OAuthCleanupResult>;
  admitOAuthStart(admissionKeyHash: string, admittedAt: Date, windowMs: number, maximum: number): Promise<boolean>;
  insertOAuthTransaction(row: Omit<OAuthTransactionRow, "admissionSlot">): Promise<boolean>;
  consumeOAuthTransaction(stateHash: string, consumedAt: Date): Promise<OAuthTransactionRow | undefined>;
  insertSession(row: ServerSessionRow): Promise<void>;
  findSession(sessionIdHash: string, activeAt: Date): Promise<ServerSessionRow | undefined>;
  revokeSession(sessionIdHash: string, revokedAt: Date): Promise<boolean>;
}

/** Bounded physical cleanup counts returned without row identifiers or secret material. */
export interface OAuthCleanupResult {
  readonly transactionsDeleted: number;
  readonly windowsDeleted: number;
}

/** Strict server-side auth-start resource policy. */
export const OAUTH_START_WINDOW_MS = 10 * 60 * 1_000;
export const OAUTH_START_MAXIMUM = 5;
export const OAUTH_OUTSTANDING_MAXIMUM = 3;
export const OAUTH_CLEANUP_BATCH_SIZE = 100;

/** Neon/Drizzle adapter using parameterized SQL and atomic single-use/revocation statements. */
export class DrizzleSessionStore implements SessionStore {
  /** Binds the store to Vision's least-privileged typed database client. */
  constructor(private readonly database: VisionDatabase) {}

  /** Physically deletes one bounded batch of expired/consumed transactions and stale admission windows. */
  async cleanupOAuthState(
    cleanedAt: Date,
    staleWindowAt: Date,
    limit: number,
  ): Promise<OAuthCleanupResult> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      with transaction_candidates as (
        select state_hash
        from oauth_transactions
        where expires_at <= ${cleanedAt}
          or consumed_at is not null
        order by expires_at, state_hash
        limit ${limit}
      ),
      deleted_transactions as (
        delete from oauth_transactions as persisted
        using transaction_candidates as candidate
        where persisted.state_hash = candidate.state_hash
        returning persisted.state_hash
      ),
      window_candidates as (
        select admission_key_hash
        from oauth_admission_windows
        where window_started_at <= ${staleWindowAt}
        order by window_started_at, admission_key_hash
        limit ${limit}
      ),
      deleted_windows as (
        delete from oauth_admission_windows as persisted
        using window_candidates as candidate
        where persisted.admission_key_hash = candidate.admission_key_hash
        returning persisted.admission_key_hash
      )
      select
        (select count(*) from deleted_transactions) as "transactionsDeleted",
        (select count(*) from deleted_windows) as "windowsDeleted"
    `);
    const row = result.rows[0];
    if (!row) throw new AuthPersistenceError();
    return {
      transactionsDeleted: readNonnegativeInteger(row.transactionsDeleted),
      windowsDeleted: readNonnegativeInteger(row.windowsDeleted),
    };
  }

  /** Atomically admits one request into a fixed per-key window or returns false at the exact bound. */
  async admitOAuthStart(
    admissionKeyHash: string,
    admittedAt: Date,
    windowMs: number,
    maximum: number,
  ): Promise<boolean> {
    const resetBefore = new Date(admittedAt.getTime() - windowMs);
    const result = await this.database.execute<Record<string, unknown>>(sql`
      insert into oauth_admission_windows (
        admission_key_hash, window_started_at, request_count
      ) values (
        ${admissionKeyHash}, ${admittedAt}, 1
      )
      on conflict (admission_key_hash) do update set
        window_started_at = case
          when oauth_admission_windows.window_started_at <= ${resetBefore}
          then ${admittedAt}
          else oauth_admission_windows.window_started_at
        end,
        request_count = case
          when oauth_admission_windows.window_started_at <= ${resetBefore}
          then 1
          else oauth_admission_windows.request_count + 1
        end
      where oauth_admission_windows.window_started_at <= ${resetBefore}
        or oauth_admission_windows.request_count < ${maximum}
      returning admission_key_hash as "admissionKeyHash"
    `);
    return result.rows[0]?.admissionKeyHash === admissionKeyHash;
  }

  /** Claims one of three unique per-key outstanding slots using bounded conflict retries. */
  async insertOAuthTransaction(
    row: Omit<OAuthTransactionRow, "admissionSlot">,
  ): Promise<boolean> {
    for (let slot = 1; slot <= OAUTH_OUTSTANDING_MAXIMUM; slot += 1) {
      const result = await this.database.execute<Record<string, unknown>>(sql`
        insert into oauth_transactions (
          state_hash, admission_key_hash, admission_slot, verifier_envelope,
          nonce_envelope, created_at, expires_at, consumed_at
        ) values (
          ${row.stateHash}, ${row.admissionKeyHash}, ${slot},
          ${row.verifierEnvelope}::bytea, ${row.nonceEnvelope}::bytea,
          ${row.createdAt}, ${row.expiresAt}, null
        )
        on conflict do nothing
        returning state_hash as "stateHash"
      `);
      if (result.rows[0]?.stateHash === row.stateHash) return true;
    }
    return false;
  }

  /** Atomically deletes one matching unexpired transaction and returns its ciphertext exactly once. */
  async consumeOAuthTransaction(
    stateHash: string,
    consumedAt: Date,
  ): Promise<OAuthTransactionRow | undefined> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      delete from oauth_transactions
      where state_hash = ${stateHash}
        and consumed_at is null
        and expires_at > ${consumedAt}
      returning
        state_hash as "stateHash",
        admission_key_hash as "admissionKeyHash",
        admission_slot as "admissionSlot",
        verifier_envelope as "verifierEnvelope",
        nonce_envelope as "nonceEnvelope",
        created_at as "createdAt",
        expires_at as "expiresAt",
        ${consumedAt} as "consumedAt"
    `);
    return result.rows[0] ? decodeOAuthTransactionRow(result.rows[0]) : undefined;
  }

  /** Inserts a hashed session bearer and encrypted email/CSRF fields. */
  async insertSession(row: ServerSessionRow): Promise<void> {
    await this.database.execute(sql`
      insert into auth_sessions (
        session_id_hash, owner_id, google_subject, email_envelope, csrf_token_envelope,
        created_at, expires_at, revoked_at
      ) values (
        ${row.sessionIdHash}, ${row.ownerId}, ${row.googleSubject},
        ${row.emailEnvelope}::bytea, ${row.csrfTokenEnvelope}::bytea,
        ${row.createdAt}, ${row.expiresAt}, null
      )
    `);
  }

  /** Selects one active session by its hash without accepting a caller-supplied owner override. */
  async findSession(
    sessionIdHash: string,
    activeAt: Date,
  ): Promise<ServerSessionRow | undefined> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      select
        session_id_hash as "sessionIdHash",
        owner_id as "ownerId",
        google_subject as "googleSubject",
        email_envelope as "emailEnvelope",
        csrf_token_envelope as "csrfTokenEnvelope",
        created_at as "createdAt",
        expires_at as "expiresAt",
        revoked_at as "revokedAt"
      from auth_sessions
      where session_id_hash = ${sessionIdHash}
        and revoked_at is null
        and expires_at > ${activeAt}
      limit 1
    `);
    return result.rows[0] ? decodeServerSessionRow(result.rows[0]) : undefined;
  }

  /** Revokes at most one still-active hashed session in a single statement. */
  async revokeSession(sessionIdHash: string, revokedAt: Date): Promise<boolean> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      update auth_sessions
      set revoked_at = ${revokedAt}
      where session_id_hash = ${sessionIdHash}
        and revoked_at is null
      returning session_id_hash as "sessionIdHash"
    `);
    return result.rows[0]?.sessionIdHash === sessionIdHash;
  }
}

/** Plain one-time values recovered only after an atomic transaction consume succeeds. */
export interface ConsumedOAuthTransaction {
  readonly pkceVerifier: string;
  readonly nonce: string;
}

/** Plain inputs accepted at the trusted side of the OAuth transaction repository. */
export interface NewOAuthTransaction {
  readonly state: string;
  readonly admissionKey: string;
  readonly pkceVerifier: string;
  readonly nonce: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

/** Trusted plaintext inputs used to create one server-side browser session. */
export interface NewServerSession {
  readonly sessionId: string;
  readonly ownerId: string;
  readonly googleSubject: string;
  readonly email: string;
  readonly csrfToken: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

/** Authenticated session recovered only from an unexpired, unrevoked hashed server row. */
export interface PersistedServerSession {
  readonly ownerId: string;
  readonly googleSubject: string;
  readonly email: string;
  readonly csrfToken: string;
  readonly expiresAt: Date;
}

/** Auth persistence failure with no retained secret or low-level database detail. */
export class AuthPersistenceError extends Error {
  constructor() {
    super("AUTH_PERSISTENCE_FAILED");
    this.name = "AuthPersistenceError";
  }
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const PREAUTH_OWNER_ID = "oauth_preauth";

/** Repository that keeps every verifier, nonce, email, and CSRF token encrypted at rest. */
export class EncryptedSessionRepository {
  /** Connects a ciphertext store to the existing protected-fields encryption boundary. */
  constructor(
    private readonly store: SessionStore,
    private readonly keyProvider: KeyProvider,
  ) {}

  /** Hashes state for lookup and encrypts verifier and nonce before the first store call. */
  async createOAuthTransaction(transaction: NewOAuthTransaction): Promise<boolean> {
    try {
      const admissionKeyHash = await hashOpaqueSecret(transaction.admissionKey);
      const staleWindowAt = new Date(
        transaction.createdAt.getTime() - OAUTH_START_WINDOW_MS,
      );
      await this.store.cleanupOAuthState(
        transaction.createdAt,
        staleWindowAt,
        OAUTH_CLEANUP_BATCH_SIZE,
      );
      if (
        !(await this.store.admitOAuthStart(
          admissionKeyHash,
          transaction.createdAt,
          OAUTH_START_WINDOW_MS,
          OAUTH_START_MAXIMUM,
        ))
      ) {
        return false;
      }
      const stateHash = await hashOpaqueSecret(transaction.state);
      const encrypted = await encryptProtectedFields(
        this.keyProvider,
        {
          ownerId: PREAUTH_OWNER_ID,
          nodeId: stateHash,
          domain: "unresolved",
        },
        {
          pkceVerifier: transaction.pkceVerifier,
          nonce: transaction.nonce,
        },
      );
      return await this.store.insertOAuthTransaction({
        stateHash,
        admissionKeyHash,
        verifierEnvelope: encodeEnvelope(encrypted.pkceVerifier),
        nonceEnvelope: encodeEnvelope(encrypted.nonce),
        createdAt: new Date(transaction.createdAt),
        expiresAt: new Date(transaction.expiresAt),
        consumedAt: null,
      });
    } catch {
      throw new AuthPersistenceError();
    }
  }

  /** Atomically consumes one unexpired state hash before decrypting its PKCE verifier and nonce. */
  async consumeOAuthTransaction(
    state: string,
    consumedAt: Date,
  ): Promise<ConsumedOAuthTransaction | undefined> {
    try {
      const stateHash = await hashOpaqueSecret(state);
      const row = await this.store.consumeOAuthTransaction(stateHash, consumedAt);
      if (!row) {
        return undefined;
      }
      const decrypted = await decryptProtectedFields(
        this.keyProvider,
        {
          ownerId: PREAUTH_OWNER_ID,
          nodeId: stateHash,
          domain: "unresolved",
        },
        {
          pkceVerifier: decodeEnvelope(row.verifierEnvelope),
          nonce: decodeEnvelope(row.nonceEnvelope),
        },
      );
      return {
        pkceVerifier: decrypted.pkceVerifier as string,
        nonce: decrypted.nonce as string,
      };
    } catch {
      throw new AuthPersistenceError();
    }
  }

  /** Hashes the opaque session ID and encrypts browser identity and CSRF data before storage. */
  async createSession(session: NewServerSession): Promise<void> {
    try {
      const sessionIdHash = await hashOpaqueSecret(session.sessionId);
      const encrypted = await encryptProtectedFields(
        this.keyProvider,
        {
          ownerId: session.ownerId,
          nodeId: sessionIdHash,
          domain: "unresolved",
        },
        {
          email: session.email,
          csrfToken: session.csrfToken,
        },
      );
      await this.store.insertSession({
        sessionIdHash,
        ownerId: session.ownerId,
        googleSubject: session.googleSubject,
        emailEnvelope: encodeEnvelope(encrypted.email),
        csrfTokenEnvelope: encodeEnvelope(encrypted.csrfToken),
        createdAt: new Date(session.createdAt),
        expiresAt: new Date(session.expiresAt),
        revokedAt: null,
      });
    } catch {
      throw new AuthPersistenceError();
    }
  }

  /** Resolves a browser session by hash, then decrypts only its bounded server-owned display and CSRF fields. */
  async findSession(
    sessionId: string,
    activeAt: Date,
  ): Promise<PersistedServerSession | undefined> {
    try {
      const sessionIdHash = await hashOpaqueSecret(sessionId);
      const row = await this.store.findSession(sessionIdHash, activeAt);
      if (!row || row.sessionIdHash !== sessionIdHash) {
        return undefined;
      }
      const decrypted = await decryptProtectedFields(
        this.keyProvider,
        {
          ownerId: row.ownerId,
          nodeId: sessionIdHash,
          domain: "unresolved",
        },
        {
          email: decodeEnvelope(row.emailEnvelope),
          csrfToken: decodeEnvelope(row.csrfTokenEnvelope),
        },
      );
      if (
        typeof decrypted.email !== "string" ||
        typeof decrypted.csrfToken !== "string"
      ) {
        throw new AuthPersistenceError();
      }
      return {
        ownerId: row.ownerId,
        googleSubject: row.googleSubject,
        email: decrypted.email,
        csrfToken: decrypted.csrfToken,
        expiresAt: new Date(row.expiresAt),
      };
    } catch {
      throw new AuthPersistenceError();
    }
  }

  /** Revokes the hashed server session and never passes its raw bearer ID to storage. */
  async revokeSession(sessionId: string, revokedAt: Date): Promise<boolean> {
    try {
      return await this.store.revokeSession(
        await hashOpaqueSecret(sessionId),
        revokedAt,
      );
    } catch {
      throw new AuthPersistenceError();
    }
  }
}

/** Hashes an opaque browser bearer value into canonical base64url for server-side lookup. */
export async function hashOpaqueSecret(secret: string): Promise<string> {
  if (typeof secret !== "string" || secret.length < 32 || secret.length > 256) {
    throw new AuthPersistenceError();
  }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(secret)));
  return encodeBase64Url(digest);
}

/** Encodes bytes as canonical unpadded base64url without routing them through logs or errors. */
function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

/** Serializes a non-null protected-field envelope for binary database storage. */
function encodeEnvelope(envelope: CipherEnvelope | null): Uint8Array {
  if (envelope === null) throw new AuthPersistenceError();
  return textEncoder.encode(serializeCipherEnvelope(envelope));
}

/** Parses one bounded binary database envelope before decryption. */
function decodeEnvelope(envelope: Uint8Array): CipherEnvelope {
  return parseCipherEnvelope(textDecoder.decode(envelope));
}

/** Strictly decodes an OAuth transaction row returned by Neon. */
function decodeOAuthTransactionRow(row: Record<string, unknown>): OAuthTransactionRow {
  return {
    stateHash: readDatabaseText(row.stateHash, 128),
    admissionKeyHash: readDatabaseText(row.admissionKeyHash, 128),
    admissionSlot: readPositiveInteger(row.admissionSlot),
    verifierEnvelope: readDatabaseBytes(row.verifierEnvelope),
    nonceEnvelope: readDatabaseBytes(row.nonceEnvelope),
    createdAt: readDatabaseDate(row.createdAt),
    expiresAt: readDatabaseDate(row.expiresAt),
    consumedAt: row.consumedAt === null ? null : readDatabaseDate(row.consumedAt),
  };
}

/** Reads one positive safe integer database cell. */
function readPositiveInteger(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^[1-9]\d*$/u.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new AuthPersistenceError();
  }
  return parsed;
}

/** Reads one nonnegative safe integer aggregate cell. */
function readNonnegativeInteger(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "bigint"
        ? Number(value)
        : typeof value === "string" && /^(?:0|[1-9]\d*)$/u.test(value)
          ? Number(value)
          : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new AuthPersistenceError();
  }
  return parsed;
}

/** Strictly decodes an active server-session row returned by Neon. */
function decodeServerSessionRow(row: Record<string, unknown>): ServerSessionRow {
  return {
    sessionIdHash: readDatabaseText(row.sessionIdHash, 128),
    ownerId: readDatabaseText(row.ownerId, 128),
    googleSubject: readDatabaseText(row.googleSubject, 255),
    emailEnvelope: readDatabaseBytes(row.emailEnvelope),
    csrfTokenEnvelope: readDatabaseBytes(row.csrfTokenEnvelope),
    createdAt: readDatabaseDate(row.createdAt),
    expiresAt: readDatabaseDate(row.expiresAt),
    revokedAt: row.revokedAt === null ? null : readDatabaseDate(row.revokedAt),
  };
}

/** Reads one bounded non-empty text cell without coercion. */
function readDatabaseText(value: unknown, maximum: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) {
    throw new AuthPersistenceError();
  }
  return value;
}

/** Reads canonical PostgreSQL bytea hex or an already-decoded byte array. */
function readDatabaseBytes(value: unknown): Uint8Array {
  try {
    if (Object.getPrototypeOf(value) === Uint8Array.prototype) {
      const copied = Uint8Array.prototype.slice.call(value) as Uint8Array;
      if (
        copied.byteLength === 0 ||
        copied.byteLength > MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS
      ) {
        throw new AuthPersistenceError();
      }
      return copied;
    }
  } catch {
    throw new AuthPersistenceError();
  }
  if (
    typeof value !== "string" ||
    !/^\\x(?:[0-9a-f]{2})+$/u.test(value) ||
    (value.length - 2) / 2 > MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS
  ) {
    throw new AuthPersistenceError();
  }
  const bytes = new Uint8Array((value.length - 2) / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(2 + index * 2, 4 + index * 2), 16);
  }
  return bytes;
}

/** Reads one finite timezone-aware timestamp cell without accepting a date-only value. */
function readDatabaseDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(Date.prototype.getTime.call(value))) {
    return new Date(Date.prototype.getTime.call(value));
  }
  if (
    typeof value !== "string" ||
    !/(?:z|[+-]\d{2}:\d{2})$/iu.test(value)
  ) {
    throw new AuthPersistenceError();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new AuthPersistenceError();
  return parsed;
}
