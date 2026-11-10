import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Derives a 32-byte Buffer key from the ENCRYPTION_KEY environment variable.
 */
function getKey() {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY must be set in production');
    }
    // Deterministic 32-byte fallback for development/test only
    return crypto.scryptSync('volunteerhub_dev_key_fallback', 'salt', 32);
  }

  if (envKey.length === 64) {
    return Buffer.from(envKey, 'hex');
  }

  return crypto.scryptSync(envKey, 'volunteerhub_salt', 32);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: "iv:authTag:ciphertext" in hex encoding.
 */
export function encrypt(text) {
  if (!text || typeof text !== 'string') return '';

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM formatted string ("iv:authTag:ciphertext").
 * Returns plaintext or original text if not formatted as ciphertext.
 */
export function decrypt(encryptedText) {
  if (!encryptedText || typeof encryptedText !== 'string') return '';

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    // Return as-is if not in encrypted format (e.g., legacy unencrypted records)
    return encryptedText;
  }

  try {
    const [ivHex, authTagHex, cipherHex] = parts;
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[Crypto] Decryption failed:', err.message);
    return '';
  }
}

/**
 * Masks a UPI ID to protect financial PII from shoulder-surfing or volunteer-side leakage.
 * Example: "aarav@okicici" -> "aa***@okicici"
 * Example: "user@okhdfcbank" -> "us***@okhdfcbank"
 */
export function maskUpi(upiId) {
  if (!upiId || typeof upiId !== 'string') return '';

  // Plaintext may need decrypting if caller passed the stored ciphertext
  const plain = upiId.includes(':') ? decrypt(upiId) : upiId;
  if (!plain) return '';

  const parts = plain.split('@');
  if (parts.length !== 2) {
    return '***';
  }

  const [username, handle] = parts;
  if (username.length <= 2) {
    return `${username[0] || '*'}***@${handle}`;
  }

  return `${username.slice(0, 2)}***@${handle}`;
}

