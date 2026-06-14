/**
 * Compute SHA-256 hash of an ArrayBuffer, return hex string.
 * This is used for chunk and full file integrity verification.
 * 
 * @param {ArrayBuffer} buffer - The buffer to hash.
 * @returns {Promise<string>} The hexadecimal hash string.
 */
export async function sha256(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Generate a new AES-GCM 256-bit key
 */
export async function generateKey() {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey to a Base64 URL-safe string for sharing via URL
 */
export async function exportKeyToBase64(key) {
  const rawKey = await crypto.subtle.exportKey('raw', key);
  const bytes = new Uint8Array(rawKey);
  const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  // Use standard base64 then make it url-safe
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Import a CryptoKey from a Base64 URL-safe string
 */
export async function importKeyFromBase64(base64) {
  // Revert url-safe base64 to standard
  let standardBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  while (standardBase64.length % 4) {
    standardBase64 += '=';
  }
  const binary = atob(standardBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return await crypto.subtle.importKey(
    'raw',
    bytes.buffer,
    'AES-GCM',
    false,
    ['decrypt'] // receiver only needs decrypt
  );
}

/**
 * Encrypt a chunk of data. Prepend the 12-byte IV to the ciphertext.
 */
export async function encryptChunk(key, arrayBuffer) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    arrayBuffer
  );
  
  const payload = new Uint8Array(iv.length + encrypted.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(encrypted), iv.length);
  
  return payload.buffer;
}

/**
 * Decrypt a chunk of data. Extract the 12-byte IV from the front.
 */
export async function decryptChunk(key, arrayBuffer) {
  const payload = new Uint8Array(arrayBuffer);
  const iv = payload.slice(0, 12);
  const encrypted = payload.slice(12);
  
  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
}
