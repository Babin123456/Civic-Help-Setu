/**
 * Client-Side Document Vault Cryptography Service
 *
 * Provides authenticated encryption for Document Vault backups and at-rest local
 * storage using the standard Web Crypto API:
 * - Key derivation: PBKDF2-HMAC-SHA256 with a fresh 16-byte random salt per payload
 * - Cipher: AES-256-GCM with a fresh 12-byte random IV and AAD header binding
 *
 * Passphrases and derived CryptoKeys are never persisted to browser storage.
 */

export const VAULT_CRYPTO_FORMAT = 'civicbridge-vault-encrypted';
export const VAULT_CRYPTO_VERSION = 1;
export const DEFAULT_PBKDF2_ITERATIONS = 210000;
export const MIN_PBKDF2_ITERATIONS = 100000;
export const SALT_BYTE_LENGTH = 16;
export const IV_BYTE_LENGTH = 12;
export const MIN_PASSPHRASE_LENGTH = 8;

export const VAULT_CRYPTO_ERROR_CODE = {
  CRYPTO_UNAVAILABLE: 'CRYPTO_UNAVAILABLE',
  WEAK_PASSPHRASE: 'WEAK_PASSPHRASE',
  INVALID_ENVELOPE: 'INVALID_ENVELOPE',
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
  WRONG_PASSPHRASE_OR_TAMPERED: 'WRONG_PASSPHRASE_OR_TAMPERED',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
};

export class VaultCryptoError extends Error {
  constructor(message, code, options = {}) {
    super(message, options);
    this.name = 'VaultCryptoError';
    this.code = code;
  }
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const getWebCrypto = () => {
  const cryptoObj = globalThis?.crypto;
  if (!cryptoObj?.subtle || typeof cryptoObj.getRandomValues !== 'function') {
    throw new VaultCryptoError(
      'Web Crypto API is unavailable in this environment. Encrypted vault operations require a secure context.',
      VAULT_CRYPTO_ERROR_CODE.CRYPTO_UNAVAILABLE
    );
  }
  return cryptoObj;
};

export const isWebCryptoAvailable = () => {
  const cryptoObj = globalThis?.crypto;
  return Boolean(cryptoObj?.subtle && typeof cryptoObj.getRandomValues === 'function');
};

const bytesToBase64 = (bytes) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const base64ToBytes = (base64) => {
  if (typeof base64 !== 'string' || !base64.trim()) {
    throw new VaultCryptoError('Invalid base64 cryptographic field.', VAULT_CRYPTO_ERROR_CODE.INVALID_ENVELOPE);
  }
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    throw new VaultCryptoError('Malformed base64 cryptographic payload.', VAULT_CRYPTO_ERROR_CODE.INVALID_ENVELOPE, {
      cause: err,
    });
  }
};

/**
 * Validates passphrase suitability and evaluates advisory strength.
 * Never logs or persists the passphrase.
 */
export function validateVaultPassphrase(passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length === 0) {
    return { valid: false, error: 'Passphrase is required.', strength: 'weak' };
  }
  if (passphrase.trim().length === 0) {
    return { valid: false, error: 'Passphrase cannot be whitespace only.', strength: 'weak' };
  }
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return {
      valid: false,
      error: `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters long.`,
      strength: 'weak',
    };
  }

  let categories = 0;
  if (/[a-z]/.test(passphrase)) categories += 1;
  if (/[A-Z]/.test(passphrase)) categories += 1;
  if (/\d/.test(passphrase)) categories += 1;
  if (/[^A-Za-z0-9]/.test(passphrase)) categories += 1;

  const strength =
    passphrase.length >= 12 && categories >= 3
      ? 'strong'
      : passphrase.length >= 10 && categories >= 2
        ? 'fair'
        : 'moderate';

  return { valid: true, error: null, strength };
}

/**
 * Checks whether a value (object or JSON string) matches the v1 encrypted vault envelope schema.
 */
export function isEncryptedVaultEnvelope(candidate) {
  let obj = candidate;
  if (typeof candidate === 'string') {
    try {
      obj = JSON.parse(candidate);
    } catch {
      return false;
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  if (obj.format !== VAULT_CRYPTO_FORMAT) return false;
  if (typeof obj.version !== 'number') return false;
  if (!obj.kdf || typeof obj.kdf !== 'object') return false;
  if (!obj.cipher || typeof obj.cipher !== 'object') return false;
  if (typeof obj.ciphertext !== 'string' || !obj.ciphertext.trim()) return false;
  if (typeof obj.kdf.salt !== 'string' || typeof obj.cipher.iv !== 'string') return false;
  return true;
}

const buildAdditionalData = ({ format, version, iterations, salt, iv }) =>
  textEncoder.encode(`${format}|v${version}|${iterations}|${salt}|${iv}`);

/**
 * Derives a non-extractable AES-256-GCM CryptoKey from a user passphrase using PBKDF2-SHA256.
 */
export async function deriveVaultKey(passphrase, saltBytes, iterations = DEFAULT_PBKDF2_ITERATIONS) {
  const cryptoObj = getWebCrypto();
  const validation = validateVaultPassphrase(passphrase);
  if (!validation.valid) {
    throw new VaultCryptoError(validation.error, VAULT_CRYPTO_ERROR_CODE.WEAK_PASSPHRASE);
  }
  if (!Number.isInteger(iterations) || iterations < MIN_PBKDF2_ITERATIONS) {
    throw new VaultCryptoError(
      `PBKDF2 iterations must be an integer >= ${MIN_PBKDF2_ITERATIONS}.`,
      VAULT_CRYPTO_ERROR_CODE.INVALID_ENVELOPE
    );
  }
  if (!(saltBytes instanceof Uint8Array) || saltBytes.byteLength < SALT_BYTE_LENGTH) {
    throw new VaultCryptoError(
      `Salt must be at least ${SALT_BYTE_LENGTH} bytes.`,
      VAULT_CRYPTO_ERROR_CODE.INVALID_ENVELOPE
    );
  }

  const baseKey = await cryptoObj.subtle.importKey(
    'raw',
    textEncoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return cryptoObj.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a JSON-serializable payload into a versioned AES-256-GCM vault envelope.
 */
export async function encryptVaultPayload(payload, passphrase, options = {}) {
  const cryptoObj = getWebCrypto();
  if (payload === undefined) {
    throw new VaultCryptoError('Cannot encrypt undefined payload.', VAULT_CRYPTO_ERROR_CODE.INVALID_PAYLOAD);
  }

  const iterations = options.iterations ?? DEFAULT_PBKDF2_ITERATIONS;
  const saltBytes = cryptoObj.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));
  const ivBytes = cryptoObj.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
  const key = await deriveVaultKey(passphrase, saltBytes, iterations);

  const salt = bytesToBase64(saltBytes);
  const iv = bytesToBase64(ivBytes);
  const additionalData = buildAdditionalData({
    format: VAULT_CRYPTO_FORMAT,
    version: VAULT_CRYPTO_VERSION,
    iterations,
    salt,
    iv,
  });

  let serialized;
  try {
    serialized = JSON.stringify(payload);
  } catch (err) {
    throw new VaultCryptoError('Payload is not JSON-serializable.', VAULT_CRYPTO_ERROR_CODE.INVALID_PAYLOAD, {
      cause: err,
    });
  }

  const ciphertextBuffer = await cryptoObj.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
      additionalData,
      tagLength: 128,
    },
    key,
    textEncoder.encode(serialized)
  );

  return {
    format: VAULT_CRYPTO_FORMAT,
    version: VAULT_CRYPTO_VERSION,
    kdf: {
      algorithm: 'PBKDF2',
      hash: 'SHA-256',
      iterations,
      salt,
    },
    cipher: {
      algorithm: 'AES-GCM',
      keyLength: 256,
      iv,
    },
    createdAt: new Date().toISOString(),
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
  };
}

/**
 * Decrypts and authenticates a versioned vault envelope using the supplied passphrase.
 */
export async function decryptVaultPayload(envelopeOrJson, passphrase) {
  const cryptoObj = getWebCrypto();
  if (typeof passphrase !== 'string' || !passphrase) {
    throw new VaultCryptoError(
      'A passphrase is required to decrypt this vault payload.',
      VAULT_CRYPTO_ERROR_CODE.WEAK_PASSPHRASE
    );
  }

  let envelope = envelopeOrJson;
  if (typeof envelopeOrJson === 'string') {
    try {
      envelope = JSON.parse(envelopeOrJson);
    } catch (err) {
      throw new VaultCryptoError('Encrypted payload is not valid JSON.', VAULT_CRYPTO_ERROR_CODE.INVALID_ENVELOPE, {
        cause: err,
      });
    }
  }

  if (!isEncryptedVaultEnvelope(envelope)) {
    throw new VaultCryptoError(
      'Payload does not match the CivicBridge encrypted vault envelope format.',
      VAULT_CRYPTO_ERROR_CODE.INVALID_ENVELOPE
    );
  }

  if (envelope.version !== VAULT_CRYPTO_VERSION) {
    throw new VaultCryptoError(
      `Unsupported encrypted vault envelope version: ${envelope.version}.`,
      VAULT_CRYPTO_ERROR_CODE.UNSUPPORTED_VERSION
    );
  }

  if (
    envelope.kdf.algorithm !== 'PBKDF2' ||
    envelope.kdf.hash !== 'SHA-256' ||
    envelope.cipher.algorithm !== 'AES-GCM' ||
    envelope.cipher.keyLength !== 256
  ) {
    throw new VaultCryptoError(
      'Unsupported cryptographic algorithm parameters in vault envelope.',
      VAULT_CRYPTO_ERROR_CODE.INVALID_ENVELOPE
    );
  }

  const saltBytes = base64ToBytes(envelope.kdf.salt);
  const ivBytes = base64ToBytes(envelope.cipher.iv);
  const ciphertextBytes = base64ToBytes(envelope.ciphertext);

  if (ivBytes.byteLength !== IV_BYTE_LENGTH) {
    throw new VaultCryptoError('Invalid AES-GCM IV length.', VAULT_CRYPTO_ERROR_CODE.INVALID_ENVELOPE);
  }

  // Validate passphrase shape minimally before deriving so deriveVaultKey enforces iteration floor too.
  let baseKey;
  if (!Number.isInteger(envelope.kdf.iterations) || envelope.kdf.iterations < MIN_PBKDF2_ITERATIONS) {
    throw new VaultCryptoError(
      `Unsupported PBKDF2 iteration count: ${envelope.kdf.iterations}.`,
      VAULT_CRYPTO_ERROR_CODE.INVALID_ENVELOPE
    );
  }
  if (saltBytes.byteLength < SALT_BYTE_LENGTH) {
    throw new VaultCryptoError('Invalid PBKDF2 salt length.', VAULT_CRYPTO_ERROR_CODE.INVALID_ENVELOPE);
  }

  baseKey = await cryptoObj.subtle.importKey(
    'raw',
    textEncoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await cryptoObj.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: envelope.kdf.iterations,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['decrypt']
  );

  const additionalData = buildAdditionalData({
    format: envelope.format,
    version: envelope.version,
    iterations: envelope.kdf.iterations,
    salt: envelope.kdf.salt,
    iv: envelope.cipher.iv,
  });

  let plaintextBuffer;
  try {
    plaintextBuffer = await cryptoObj.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
        additionalData,
        tagLength: 128,
      },
      key,
      ciphertextBytes
    );
  } catch (err) {
    throw new VaultCryptoError(
      'Decryption failed: incorrect passphrase or the encrypted payload was modified.',
      VAULT_CRYPTO_ERROR_CODE.WRONG_PASSPHRASE_OR_TAMPERED,
      { cause: err }
    );
  }

  try {
    return JSON.parse(textDecoder.decode(plaintextBuffer));
  } catch (err) {
    throw new VaultCryptoError('Decrypted vault payload is corrupted.', VAULT_CRYPTO_ERROR_CODE.INVALID_PAYLOAD, {
      cause: err,
    });
  }
}

/**
 * Rotates an encrypted envelope to a new passphrase using a fresh random salt and IV.
 */
export async function rotateEncryptedEnvelope(envelopeOrJson, currentPassphrase, newPassphrase, options = {}) {
  const newCheck = validateVaultPassphrase(newPassphrase);
  if (!newCheck.valid) {
    throw new VaultCryptoError(newCheck.error, VAULT_CRYPTO_ERROR_CODE.WEAK_PASSPHRASE);
  }
  const plaintextPayload = await decryptVaultPayload(envelopeOrJson, currentPassphrase);
  return encryptVaultPayload(plaintextPayload, newPassphrase, options);
}
