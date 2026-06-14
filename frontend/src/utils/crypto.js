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
