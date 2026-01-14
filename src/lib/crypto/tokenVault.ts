import crypto from "crypto";

const KEY_ENV = "TOKEN_ENCRYPTION_KEY";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const rawKey = process.env[KEY_ENV];
  if (!rawKey) {
    throw new Error(`${KEY_ENV} is required for token encryption.`);
  }

  let key: Buffer;
  try {
    if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
      key = Buffer.from(rawKey, "hex");
    } else {
      key = Buffer.from(rawKey, "base64");
    }
  } catch {
    throw new Error(`${KEY_ENV} must be a 32-byte key (base64 or hex).`);
  }

  if (key.length !== 32) {
    throw new Error(`${KEY_ENV} must be a 32-byte key (base64 or hex).`);
  }

  return key;
}

export function encryptToken(raw: string): string {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error("Token to encrypt must be a non-empty string.");
  }

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptToken(enc: string): string {
  if (typeof enc !== "string" || enc.length === 0) {
    throw new Error("Encrypted token must be a non-empty string.");
  }

  const key = getKey();
  const payload = Buffer.from(enc, "base64");
  if (payload.length <= IV_LENGTH + TAG_LENGTH) {
    throw new Error("Encrypted token payload is invalid.");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return plaintext.toString("utf8");
}
