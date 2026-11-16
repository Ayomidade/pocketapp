const crypto = require('crypto');
const env = require('../config/env');

function getEncryptionKey() {
  const raw = env.CREDENTIALS_ENCRYPTION_KEY;
  const buf = Buffer.from(raw, 'base64');
  if (buf.length === 32) {
    return buf;
  }
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptSecret(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

function decryptSecret(payload) {
  if (!payload) return null;
  const parts = String(payload).split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted secret payload');
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function generatePkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

function generateStateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function verifyGithubSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const sigBuf = Buffer.from(signatureHeader);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

module.exports = {
  encryptSecret,
  decryptSecret,
  sha256Hex,
  generatePkcePair,
  generateStateToken,
  verifyGithubSignature,
};
