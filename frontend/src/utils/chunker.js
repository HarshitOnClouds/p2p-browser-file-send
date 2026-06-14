/**
 * Reads a File object and returns an ArrayBuffer.
 * 
 * @param {File} file - The file to read.
 * @returns {Promise<ArrayBuffer>} A promise that resolves to the file's ArrayBuffer.
 */
export function fileToArrayBuffer(file) {
  return file.arrayBuffer();
}

/**
 * Given an ArrayBuffer, this could be used to split it into chunks, 
 * but for performance and memory, we typically slice the ArrayBuffer directly in the transfer loop.
 * This is kept for utility purposes.
 */
export const CHUNK_SIZE = 64 * 1024; // 64KB per chunk
