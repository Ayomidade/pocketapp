import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { encryptDraftContent, decryptDraftContent } from './draftCrypto';
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

async function decryptRow(db, row, key) {
  const { content, legacy } = decryptDraftContent(row.cipher_content, key, row.id, row.base_sha);
  if (legacy) {
    const nonce = await Crypto.getRandomBytesAsync(24);
    const encrypted = encryptDraftContent(content, key, nonce, row.id, row.base_sha);
    // Do not replace a draft that changed since it was read.
    await db.runAsync('UPDATE local_drafts SET cipher_content = ? WHERE id = ? AND cipher_content = ?', [encrypted, row.id, row.cipher_content]);
  }
  return content;
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
  const nonce = await Crypto.getRandomBytesAsync(24);
  const cipherContent = encryptDraftContent(content, key, nonce, id, baseSha || '');
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
  return Promise.all(rows.map(async (row) => ({
    id: row.id,
    userId: row.user_id,
    repoId: row.repo_id,
    repoFullName: row.repo_full_name,
    branch: row.branch,
    filePath: row.file_path,
    baseSha: row.base_sha,
    content: await decryptRow(db, row, key),
    updatedAt: row.updated_at,
  })));
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
    content: await decryptRow(db, row, key),
    updatedAt: row.updated_at,
  };
}

export async function deleteEncryptedDraft(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM local_drafts WHERE id = ?`, [id]);
}
