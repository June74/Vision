/** Protects retained Google OAuth tokens behind owner-scoped ciphertext persistence. */
import { sql } from "drizzle-orm";
import {
  parseCipherEnvelope,
  serializeCipherEnvelope,
  type CipherEnvelope,
} from "../../crypto/envelope";
import {
  type KeyProvider,
  type WrappedDataKeyRecord,
  type WrappedDataKeyStore,
} from "../../crypto/key-provider";
import {
  decryptProtectedFields,
  encryptProtectedFields,
} from "../../crypto/protected-fields";
import type { VisionDatabase } from "../db";

/** Complete raw Google token row; provider token fields are ciphertext bytes only. */
export interface GoogleTokenRow {
  ownerId: string;
  googleSubject: string;
  refreshTokenEnvelope: Uint8Array;
  accessTokenEnvelope: Uint8Array | null;
  accessExpiresAt: Date;
  grantedScopes: string;
  tokenVersion: number;
  updatedAt: Date;
}

/** Parameterized owner-scoped persistence operations for encrypted Google token rows. */
export interface TokenStore {
  find(ownerId: string, googleSubject: string): Promise<GoogleTokenRow | undefined>;
  upsert(row: Omit<GoogleTokenRow, "tokenVersion">): Promise<GoogleTokenRow>;
}

/** Durable wrapped-key store supporting per-owner/domain keys and monotonic rotation state. */
export class DrizzleWrappedDataKeyStore implements WrappedDataKeyStore {
  /** Binds key metadata and ciphertext to Vision's authoritative database. */
  constructor(private readonly database: VisionDatabase) {}

  /** Returns one exact already-wrapped owner/domain/version key. */
  async get(
    ownerId: string,
    domain: WrappedDataKeyRecord["domain"],
    keyVersion: number,
  ): Promise<WrappedDataKeyRecord | undefined> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      select
        owner_id as "ownerId",
        domain,
        key_version as "keyVersion",
        iv,
        wrapped_key as "wrappedKey"
      from wrapped_data_keys
      where owner_id = ${ownerId}
        and domain = ${domain}
        and key_version = ${keyVersion}
      limit 1
    `);
    return result.rows[0] ? decodeWrappedKeyRow(result.rows[0]) : undefined;
  }

  /** Inserts a wrapped key once and returns the authoritative conflict winner. */
  async putIfAbsent(record: WrappedDataKeyRecord): Promise<WrappedDataKeyRecord> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      insert into wrapped_data_keys (
        owner_id, domain, key_version, iv, wrapped_key
      ) values (
        ${record.ownerId}, ${record.domain}, ${record.keyVersion},
        ${record.iv}, ${record.wrappedKey}
      )
      on conflict (owner_id, domain, key_version) do nothing
      returning
        owner_id as "ownerId",
        domain,
        key_version as "keyVersion",
        iv,
        wrapped_key as "wrappedKey"
    `);
    if (result.rows[0]) return decodeWrappedKeyRow(result.rows[0]);
    const winner = await this.get(
      record.ownerId,
      record.domain,
      record.keyVersion,
    );
    if (!winner) {
      throw new Error("Wrapped key conflict winner was unavailable.");
    }
    return winner;
  }

  /** Reads the single authoritative active data-key version. */
  async getActiveKeyVersion(): Promise<number | undefined> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      select active_key_version as "activeKeyVersion"
      from data_key_state
      where id = 'primary'
      limit 1
    `);
    return result.rows[0]
      ? readPositiveInteger(result.rows[0].activeKeyVersion)
      : undefined;
  }

  /** Atomically creates or monotonically advances the active data-key version. */
  async activateKeyVersion(candidate: number): Promise<number> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      insert into data_key_state (id, active_key_version)
      values ('primary', ${candidate})
      on conflict (id) do update set
        active_key_version = greatest(
          data_key_state.active_key_version,
          excluded.active_key_version
        )
      returning active_key_version as "activeKeyVersion"
    `);
    if (!result.rows[0]) {
      throw new Error("Data-key version activation failed.");
    }
    return readPositiveInteger(result.rows[0].activeKeyVersion);
  }
}

/** Neon/Drizzle token adapter whose every read and write is explicitly owner-scoped. */
export class DrizzleTokenStore implements TokenStore {
  /** Binds encrypted provider-token storage to Vision's typed database. */
  constructor(private readonly database: VisionDatabase) {}

  /** Reads one exact owner and Google-subject row. */
  async find(
    ownerId: string,
    googleSubject: string,
  ): Promise<GoogleTokenRow | undefined> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      select
        owner_id as "ownerId",
        google_subject as "googleSubject",
        refresh_token_envelope as "refreshTokenEnvelope",
        access_token_envelope as "accessTokenEnvelope",
        access_expires_at as "accessExpiresAt",
        granted_scopes as "grantedScopes",
        token_version as "tokenVersion",
        updated_at as "updatedAt"
      from google_oauth_tokens
      where owner_id = ${ownerId}
        and google_subject = ${googleSubject}
      limit 1
    `);
    return result.rows[0] ? decodeGoogleTokenRow(result.rows[0]) : undefined;
  }

  /** Atomically inserts or rotates ciphertext while advancing queryable token version metadata. */
  async upsert(
    row: Omit<GoogleTokenRow, "tokenVersion">,
  ): Promise<GoogleTokenRow> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      insert into google_oauth_tokens as persisted (
        owner_id, google_subject, refresh_token_envelope, access_token_envelope,
        access_expires_at, granted_scopes, token_version, updated_at
      ) values (
        ${row.ownerId}, ${row.googleSubject}, ${row.refreshTokenEnvelope}::bytea,
        ${row.accessTokenEnvelope}::bytea, ${row.accessExpiresAt},
        ${row.grantedScopes}, 1, ${row.updatedAt}
      )
      on conflict (owner_id) do update set
        google_subject = excluded.google_subject,
        refresh_token_envelope = excluded.refresh_token_envelope,
        access_token_envelope = excluded.access_token_envelope,
        access_expires_at = excluded.access_expires_at,
        granted_scopes = excluded.granted_scopes,
        token_version = persisted.token_version + 1,
        updated_at = excluded.updated_at
      where persisted.google_subject = excluded.google_subject
      returning
        owner_id as "ownerId",
        google_subject as "googleSubject",
        refresh_token_envelope as "refreshTokenEnvelope",
        access_token_envelope as "accessTokenEnvelope",
        access_expires_at as "accessExpiresAt",
        granted_scopes as "grantedScopes",
        token_version as "tokenVersion",
        updated_at as "updatedAt"
    `);
    if (!result.rows[0]) {
      throw new Error("Token upsert lost owner-subject scope.");
    }
    return decodeGoogleTokenRow(result.rows[0]);
  }
}

/** Minimum server-side token repository surface needed to choose first-consent behavior. */
export interface TokenRepositoryPort {
  hasRefreshToken(googleSubject: string): Promise<boolean>;
  getGoogleTokens(googleSubject: string): Promise<RetainedGoogleTokens | undefined>;
  saveGoogleTokens(tokens: NewGoogleTokens): Promise<RetainedGoogleTokens>;
}

/** Plain retained tokens that may exist only inside the trusted repository caller. */
export interface RetainedGoogleTokens {
  readonly refreshToken: string;
  readonly accessToken: string | null;
  readonly accessExpiresAt: Date;
  readonly grantedScopes: readonly string[];
  readonly tokenVersion: number;
}

/** Validated provider-token inputs accepted after identity authorization. */
export interface NewGoogleTokens {
  readonly googleSubject: string;
  readonly refreshToken: string;
  readonly accessToken: string | null;
  readonly accessExpiresAt: Date;
  readonly grantedScopes: readonly string[];
  readonly updatedAt: Date;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

/** Owner-scoped token repository that never accepts a caller-supplied owner per operation. */
export class EncryptedTokenRepository implements TokenRepositoryPort {
  /** Binds every token operation to one authenticated Vision owner. */
  constructor(
    private readonly store: TokenStore,
    private readonly keyProvider: KeyProvider,
    private readonly ownerId: string,
  ) {}

  /** Reports only whether an encrypted refresh-token envelope exists for the exact Google subject. */
  async hasRefreshToken(googleSubject: string): Promise<boolean> {
    if (
      typeof googleSubject !== "string" ||
      googleSubject.length === 0 ||
      googleSubject.length > 255 ||
      this.ownerId.length === 0 ||
      !this.keyProvider
    ) {
      return false;
    }
    const row = await this.store.find(this.ownerId, googleSubject);
    return (
      row?.ownerId === this.ownerId &&
      row.googleSubject === googleSubject &&
      row.refreshTokenEnvelope instanceof Uint8Array &&
      row.refreshTokenEnvelope.byteLength > 0
    );
  }

  /** Decrypts one exact subject's retained tokens only inside the owner-scoped repository. */
  async getGoogleTokens(
    googleSubject: string,
  ): Promise<RetainedGoogleTokens | undefined> {
    const row = await this.store.find(this.ownerId, googleSubject);
    if (
      !row ||
      row.ownerId !== this.ownerId ||
      row.googleSubject !== googleSubject ||
      !Number.isSafeInteger(row.tokenVersion) ||
      row.tokenVersion <= 0
    ) {
      return undefined;
    }
    const decrypted = await decryptProtectedFields(
      this.keyProvider,
      tokenContext(this.ownerId),
      {
        refreshToken: decodeEnvelope(row.refreshTokenEnvelope),
        accessToken: row.accessTokenEnvelope
          ? decodeEnvelope(row.accessTokenEnvelope)
          : null,
      },
    );
    return {
      refreshToken: decrypted.refreshToken as string,
      accessToken: decrypted.accessToken,
      accessExpiresAt: new Date(row.accessExpiresAt),
      grantedScopes: parseScopes(row.grantedScopes),
      tokenVersion: row.tokenVersion,
    };
  }

  /** Encrypts both retained provider tokens before the owner-scoped atomic upsert. */
  async saveGoogleTokens(tokens: NewGoogleTokens): Promise<RetainedGoogleTokens> {
    const grantedScopes = validateScopes(tokens.grantedScopes);
    const encrypted = await encryptProtectedFields(
      this.keyProvider,
      tokenContext(this.ownerId),
      {
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
      },
    );
    const persisted = await this.store.upsert({
      ownerId: this.ownerId,
      googleSubject: tokens.googleSubject,
      refreshTokenEnvelope: encodeEnvelope(encrypted.refreshToken),
      accessTokenEnvelope: encrypted.accessToken
        ? encodeEnvelope(encrypted.accessToken)
        : null,
      accessExpiresAt: new Date(tokens.accessExpiresAt),
      grantedScopes: grantedScopes.join(" "),
      updatedAt: new Date(tokens.updatedAt),
    });
    if (
      persisted.ownerId !== this.ownerId ||
      persisted.googleSubject !== tokens.googleSubject
    ) {
      throw new Error("Token persistence returned an invalid owner-bound row.");
    }
    return {
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      accessExpiresAt: new Date(tokens.accessExpiresAt),
      grantedScopes,
      tokenVersion: persisted.tokenVersion,
    };
  }
}

/** Binds provider token ciphertext to a stable owner-specific protected-field node. */
function tokenContext(ownerId: string) {
  return {
    ownerId,
    nodeId: `google-token:${ownerId}`,
    domain: "unresolved" as const,
  };
}

/** Validates and snapshots a bounded unique provider scope set. */
function validateScopes(scopes: readonly string[]): string[] {
  if (!Array.isArray(scopes) || scopes.length === 0 || scopes.length > 32) {
    throw new Error("Invalid granted scope set.");
  }
  const snapshot = [...scopes];
  if (
    snapshot.some(
      (scope) =>
        typeof scope !== "string" ||
        scope.length === 0 ||
        scope.length > 256 ||
        /\s/u.test(scope),
    ) ||
    new Set(snapshot).size !== snapshot.length
  ) {
    throw new Error("Invalid granted scope set.");
  }
  return snapshot;
}

/** Parses the queryable space-delimited scope metadata through the same strict validator. */
function parseScopes(scopes: string): string[] {
  return validateScopes(scopes.split(" "));
}

/** Serializes a non-null protected token envelope for binary persistence. */
function encodeEnvelope(envelope: CipherEnvelope | null): Uint8Array {
  if (envelope === null) throw new Error("Missing protected token envelope.");
  return textEncoder.encode(serializeCipherEnvelope(envelope));
}

/** Parses one bounded protected token envelope from raw binary storage. */
function decodeEnvelope(envelope: Uint8Array): CipherEnvelope {
  return parseCipherEnvelope(textDecoder.decode(envelope));
}

/** Strictly decodes one raw Google token row without coercing secret metadata. */
function decodeGoogleTokenRow(row: Record<string, unknown>): GoogleTokenRow {
  return {
    ownerId: readText(row.ownerId, 128),
    googleSubject: readText(row.googleSubject, 255),
    refreshTokenEnvelope: readBytes(row.refreshTokenEnvelope),
    accessTokenEnvelope:
      row.accessTokenEnvelope === null ? null : readBytes(row.accessTokenEnvelope),
    accessExpiresAt: readDate(row.accessExpiresAt),
    grantedScopes: readText(row.grantedScopes, 8 * 1024),
    tokenVersion: readPositiveInteger(row.tokenVersion),
    updatedAt: readDate(row.updatedAt),
  };
}

/** Reads one bounded non-empty text database cell. */
function readText(value: unknown, maximum: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) {
    throw new Error("Invalid Google token database row.");
  }
  return value;
}

/** Reads canonical PostgreSQL bytea hex or copies a decoded byte array. */
function readBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (
    typeof value !== "string" ||
    !/^\\x(?:[0-9a-f]{2})+$/u.test(value) ||
    value.length > 256 * 1024
  ) {
    throw new Error("Invalid Google token database row.");
  }
  const bytes = new Uint8Array((value.length - 2) / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(2 + index * 2, 4 + index * 2), 16);
  }
  return bytes;
}

/** Reads a positive safe integer from Neon number or canonical decimal text output. */
function readPositiveInteger(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^[1-9]\d*$/u.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("Invalid Google token database row.");
  }
  return parsed;
}

/** Reads one valid timezone-aware database timestamp. */
function readDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
  }
  if (
    typeof value !== "string" ||
    !/(?:z|[+-]\d{2}:\d{2})$/iu.test(value)
  ) {
    throw new Error("Invalid Google token database row.");
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid Google token database row.");
  }
  return parsed;
}

/** Strictly decodes one wrapped per-owner/domain data-key ciphertext row. */
function decodeWrappedKeyRow(
  row: Record<string, unknown>,
): WrappedDataKeyRecord {
  const domain = readText(row.domain, 32);
  if (!["school", "work", "personal", "unresolved"].includes(domain)) {
    throw new Error("Invalid wrapped data-key row.");
  }
  return {
    version: 1,
    algorithm: "A256GCM",
    ownerId: readText(row.ownerId, 128),
    domain: domain as WrappedDataKeyRecord["domain"],
    keyVersion: readPositiveInteger(row.keyVersion),
    iv: readText(row.iv, 16),
    wrappedKey: readText(row.wrappedKey, 64),
  };
}
