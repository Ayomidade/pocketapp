import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const ACCESS_TOKEN_KEY = 'pocketops_access_token';
const REFRESH_TOKEN_KEY = 'pocketops_refresh_token';
const DRAFT_SECRET_KEY = 'pocketops_draft_cipher_key';

export async function saveTokens({ accessToken, refreshToken }) {
  if (accessToken) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function getOrCreateDraftKey() {
  let key = await SecureStore.getItemAsync(DRAFT_SECRET_KEY);
  if (!key) {
    const bytes = await Crypto.getRandomBytesAsync(32);
    key = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await SecureStore.setItemAsync(DRAFT_SECRET_KEY, key);
  }
  return key;
}
