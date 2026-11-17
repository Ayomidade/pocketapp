import { xchacha20poly1305 } from '@noble/ciphers/chacha';

const PREFIX = 'v2:';
function encodeUtf8(value) {
  const encoded = encodeURIComponent(value);
  const bytes = [];
  for (let i = 0; i < encoded.length; i += 1) {
    if (encoded[i] === '%') { bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16)); i += 2; }
    else bytes.push(encoded.charCodeAt(i));
  }
  return Uint8Array.from(bytes);
}
function decodeUtf8(bytes) {
  let encoded = '';
  for (const byte of bytes) encoded += `%${byte.toString(16).padStart(2, '0')}`;
  return decodeURIComponent(encoded);
}

function fromHex(hex) {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('Invalid draft encryption key');
  return Uint8Array.from(hex.match(/../g), (part) => parseInt(part, 16));
}
function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function fromBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function associatedData(id, baseSha) {
  return encodeUtf8(JSON.stringify([id, baseSha || '']));
}

export function encryptDraftContent(content, key, nonce, id, baseSha) {
  if (!(nonce instanceof Uint8Array) || nonce.length !== 24) throw new Error('Invalid draft nonce');
  const ciphertext = xchacha20poly1305(fromHex(key), nonce, associatedData(id, baseSha)).encrypt(encodeUtf8(content));
  return `${PREFIX}${toBase64(nonce)}:${toBase64(ciphertext)}`;
}

export function decryptDraftContent(payload, key, id, baseSha) {
  if (!payload.startsWith(PREFIX)) {
    const bytes = fromBase64(payload);
    const keyBytes = fromHex(key);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] ^= keyBytes[i % keyBytes.length];
    return { content: decodeUtf8(bytes), legacy: true };
  }
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted draft');
  const nonce = fromBase64(parts[1]);
  const ciphertext = fromBase64(parts[2]);
  const content = xchacha20poly1305(fromHex(key), nonce, associatedData(id, baseSha)).decrypt(ciphertext);
  return { content: decodeUtf8(content), legacy: false };
}
