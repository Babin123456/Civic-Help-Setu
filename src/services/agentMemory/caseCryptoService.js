/**
 * Web Crypto AES-GCM Service with PBKDF2 Key Derivation
 *
 * Provides client-side field-level encryption for sensitive memory records.
 * Uses Web Crypto API (SubtleCrypto) natively available in modern browsers and Node 18+.
 */

const PBKDF2_ITERATIONS = 100000;
const AES_KEY_LENGTH = 256;
const IV_LENGTH_BYTES = 12; // 96 bits for AES-GCM
const SALT_LENGTH_BYTES = 16; // 128 bits

// Text encoder / decoder instances
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Helper to convert Uint8Array to base64
const bufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Helper to convert base64 to Uint8Array
const base64ToBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Gets the active SubtleCrypto instance
 */
const getSubtleCrypto = () => {
  const cryptoInstance = globalThis.crypto || globalThis.window?.crypto;
  if (!cryptoInstance?.subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is not available in this environment');
  }
  return cryptoInstance.subtle;
};

/**
 * Derives an AES-GCM CryptoKey from a case seed and salt using PBKDF2
 */
export const deriveCaseKey = async (tenantId, caseId, saltBytes, customSecret = '') => {
  const subtle = getSubtleCrypto();
  // Compound key material prevents key collision between cases
  const rawKeyMaterial = textEncoder.encode(`CHSETU-AGENT-MEM:${tenantId}:${caseId}:${customSecret}`);

  const importedBaseKey = await subtle.importKey(
    'raw',
    rawKeyMaterial,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    importedBaseKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypts a JavaScript object/value using AES-GCM-256
 * Returns an envelope with base64 encoded ciphertext, iv, and salt.
 */
export const encryptPayload = async (data, tenantId, caseId, customSecret = '') => {
  const subtle = getSubtleCrypto();
  const serialized = JSON.stringify(data);
  const plaintextBytes = textEncoder.encode(serialized);

  const saltBytes = new Uint8Array(SALT_LENGTH_BYTES);
  const ivBytes = new Uint8Array(IV_LENGTH_BYTES);
  globalThis.crypto.getRandomValues(saltBytes);
  globalThis.crypto.getRandomValues(ivBytes);

  const key = await deriveCaseKey(tenantId, caseId, saltBytes, customSecret);

  const ciphertextBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
      tagLength: 128,
    },
    key,
    plaintextBytes
  );

  return {
    algorithm: 'AES-GCM-256',
    salt: bufferToBase64(saltBytes),
    iv: bufferToBase64(ivBytes),
    ciphertext: bufferToBase64(ciphertextBuffer),
  };
};

/**
 * Decrypts an AES-GCM-256 encrypted envelope back into the original data.
 * Throws if the envelope is invalid, corrupted, or decrypted with the wrong case context.
 */
export const decryptPayload = async (envelope, tenantId, caseId, customSecret = '') => {
  if (!envelope || envelope.algorithm !== 'AES-GCM-256' || !envelope.ciphertext || !envelope.iv || !envelope.salt) {
    throw new Error('Invalid or unsupported encryption envelope');
  }

  const subtle = getSubtleCrypto();
  const saltBytes = base64ToBuffer(envelope.salt);
  const ivBytes = base64ToBuffer(envelope.iv);
  const ciphertextBytes = base64ToBuffer(envelope.ciphertext);

  const key = await deriveCaseKey(tenantId, caseId, saltBytes, customSecret);

  try {
    const decryptedBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
        tagLength: 128,
      },
      key,
      ciphertextBytes
    );

    const decryptedText = textDecoder.decode(decryptedBuffer);
    return JSON.parse(decryptedText);
  } catch (err) {
    throw new Error(
      `Decryption failed: possible tampering, corrupted data, or wrong case key context: ${err.message}`,
      { cause: err }
    );
  }
};
