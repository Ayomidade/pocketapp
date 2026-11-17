/** @jest-environment node */
import { encryptDraftContent, decryptDraftContent } from '../src/security/draftCrypto';

const key = '42'.repeat(32);
const id = 'user:repo:main:readme.md';
const sha = 'abc123';

test('encrypts Unicode drafts and detects changed ciphertext or metadata', () => {
  const content = 'Hello 🌍\nconst count = 1;';
  const encrypted = encryptDraftContent(content, key, new Uint8Array(24).fill(7), id, sha);
  expect(encrypted).not.toContain(content);
  expect(decryptDraftContent(encrypted, key, id, sha)).toEqual({ content, legacy: false });
  expect(() => decryptDraftContent(encrypted, key, id, 'different-sha')).toThrow();
  const parts = encrypted.split(':');
  const ciphertext = Buffer.from(parts[2], 'base64');
  ciphertext[0] ^= 1;
  expect(() => decryptDraftContent(`${parts[0]}:${parts[1]}:${ciphertext.toString('base64')}`, key, id, sha)).toThrow();
});

test('reads drafts saved by the legacy XOR format', () => {
  const plain = Buffer.from('Existing draft 🌍');
  const keyBytes = Buffer.from(key, 'hex');
  const legacy = Buffer.from(plain.map((value, i) => value ^ keyBytes[i % keyBytes.length])).toString('base64');
  expect(decryptDraftContent(legacy, key, id, sha)).toEqual({ content: 'Existing draft 🌍', legacy: true });
});
