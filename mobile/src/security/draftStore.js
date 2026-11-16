import * as SQLite from 'expo-sqlite';
import { getOrCreateDraftKey } from './tokenStorage';

let dbPromise = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('pocketops_drafts.db').then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS local_drafts (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          repo_id TEXT NOT NULL,
          repo_full_name TEXT NOT NULL,
          branch TEXT NOT NULL,
          file_path TEXT NOT NULL,
          base_sha TEXT NOT NULL,
          cipher_content TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

// Symmetric stream cipher using the 256-bit SecureStore-backed key
function xorCipher(text, hexKey) {
  const keyBytes = [];
  for (let i = 0; i < hexKey.length; i += 2) {
    keyBytes.push(parseInt(hexKey.slice(i, i + 2), 16));
  }
  const encoder = new TextEncoder();
  const input = encoder.encode(text);
  const out = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    out[i] = input[i] ^ keyBytes[i % keyBytes.length];
  }
  let bin = '';
  for (let i = 0; i < out.length; i += 1) {
    bin += String.fromCharCode(out[i]);
  }
  return btoa(bin);
}

function xorDecipher(b64, hexKey) {
  const keyBytes = [];
  for (let i = 0; i < hexKey.length; i += 2) {
    keyBytes.push(parseInt(hexKey.slice(i, i + 2), 16));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i) ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(out);
}

export function buildDraftId(userId, repoId, branch, filePath) {
  return `${userId}:${repoId}:${branch}:${filePath}`;
}

export async function saveEncryptedDraft({
  userId,
  repoId,
  repoFullName,
  branch,
  filePath,
  baseSha,
  content,
}) {
  const db = await getDb();
  const key = await getOrCreateDraftKey();
  const id = buildDraftId(userId, repoId, branch, filePath);
  const cipherContent = xorCipher(content, key);
  const updatedAt = Date.now();

  await db.runAsync(
    `INSERT OR REPLACE INTO local_drafts
      (id, user_id, repo_id, repo_full_name, branch, file_path, base_sha, cipher_content, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, repoId, repoFullName, branch, filePath, baseSha || '', cipherContent, updatedAt]
  );

  return { id, userId, repoId, repoFullName, branch, filePath, baseSha, content, updatedAt };
}

export async function listEncryptedDrafts(userId) {
  const db = await getDb();
  const key = await getOrCreateDraftKey();
  const rows = await db.getAllAsync(
    `SELECT * FROM local_drafts WHERE user_id = ? ORDER BY updated_at DESC`,
    [userId]
  );
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    repoId: row.repo_id,
    repoFullName: row.repo_full_name,
    branch: row.branch,
    filePath: row.file_path,
    baseSha: row.base_sha,
    content: xorDecipher(row.cipher_content, key),
    updatedAt: row.updated_at,
  }));
}

export async function getEncryptedDraft(userId, repoId, branch, filePath) {
  const db = await getDb();
  const key = await getOrCreateDraftKey();
  const id = buildDraftId(userId, repoId, branch, filePath);
  const row = await db.getFirstAsync(`SELECT * FROM local_drafts WHERE id = ?`, [id]);
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    repoId: row.repo_id,
    repoFullName: row.repo_full_name,
    branch: row.branch,
    filePath: row.file_path,
    baseSha: row.base_sha,
    content: xorDecipher(row.cipher_content, key),
    updatedAt: row.updated_at,
  };
}

export async function deleteEncryptedDraft(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM local_drafts WHERE id = ?`, [id]);
}

export { xorCipher, xorDecipher };
