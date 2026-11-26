/**
 * src/services/civicCryptoService.js
 * Cryptographic utility service using Web Crypto API (SubtleCrypto)
 * Supports browser and Node 18+ environments natively.
 * Implements canonical SHA-256 digests, ECDSA P-256 key generation,
 * signing, verification, and key serialization.
 */

import { canonicalizeJson } from '../data/civicReleaseProvenanceContract.js';

// Resolve Web Crypto SubtleCrypto in browser or Node
export function getSubtleCrypto() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API (crypto.subtle) is not available in the current environment.');
}

/**
 * Converts ArrayBuffer or Uint8Array to hex string.
 */
export function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts hex string to Uint8Array.
 */
export function hexToBuffer(hexString) {
  if (typeof hexString !== 'string' || hexString.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Computes canonical SHA-256 hex digest for arbitrary string, object, or buffer.
 */
export async function computeSha256Hex(data) {
  const subtle = getSubtleCrypto();
  let encoded;
  if (typeof data === 'string') {
    encoded = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
    encoded = data;
  } else if (typeof data === 'object' && data !== null) {
    const canonicalStr = canonicalizeJson(data);
    encoded = new TextEncoder().encode(canonicalStr);
  } else {
    encoded = new TextEncoder().encode(String(data));
  }

  const hashBuffer = await subtle.digest('SHA-256', encoded);
  return bufferToHex(hashBuffer);
}

/**
 * Generates an ECDSA P-256 keypair with an optional human identifier.
 */
export async function generateSigningKeyPair(keyId, metadata = {}) {
  const subtle = getSubtleCrypto();
  const keyPair = await subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true, // extractable
    ['sign', 'verify']
  );

  const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await subtle.exportKey('jwk', keyPair.privateKey);

  const fingerprint = await computeSha256Hex(publicKeyJwk);

  return {
    keyId: keyId || `key-${Date.now()}-${fingerprint.slice(0, 8)}`,
    algorithm: 'ECDSA-P256-SHA256',
    curve: 'P-256',
    fingerprint,
    publicKeyJwk,
    privateKeyJwk,
    status: 'active',
    createdAt: new Date().toISOString(),
    revokedAt: null,
    revocationReason: null,
    metadata,
  };
}

/**
 * Signs data using ECDSA P-256 private key JWK.
 * Returns signature as hex string.
 */
export async function signData(privateKeyJwk, data) {
  const subtle = getSubtleCrypto();
  const privateKey = await subtle.importKey(
    'jwk',
    privateKeyJwk,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false,
    ['sign']
  );

  let encoded;
  if (typeof data === 'string') {
    encoded = new TextEncoder().encode(data);
  } else if (typeof data === 'object' && data !== null) {
    encoded = new TextEncoder().encode(canonicalizeJson(data));
  } else {
    encoded = new TextEncoder().encode(String(data));
  }

  const signatureBuffer = await subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    privateKey,
    encoded
  );

  return bufferToHex(signatureBuffer);
}

/**
 * Verifies ECDSA P-256 signature against data using public key JWK.
 * Returns boolean.
 */
export async function verifySignature(publicKeyJwk, signatureHex, data) {
  try {
    const subtle = getSubtleCrypto();
    const publicKey = await subtle.importKey(
      'jwk',
      publicKeyJwk,
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      false,
      ['verify']
    );

    let encoded;
    if (typeof data === 'string') {
      encoded = new TextEncoder().encode(data);
    } else if (typeof data === 'object' && data !== null) {
      encoded = new TextEncoder().encode(canonicalizeJson(data));
    } else {
      encoded = new TextEncoder().encode(String(data));
    }

    const signatureBuffer = hexToBuffer(signatureHex);

    return await subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      publicKey,
      signatureBuffer,
      encoded
    );
  } catch {
    return false;
  }
}
