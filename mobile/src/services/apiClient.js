import * as Crypto from 'expo-crypto';
import {
  getAccessToken,
  getRefreshToken,
  saveTokens,
  clearTokens,
} from '../security/tokenStorage';
import { useAuthStore } from '../store/useAuthStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

let refreshPromise = null;

export class ApiError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function refreshSessionTokens() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return null;

      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        await clearTokens();
        await useAuthStore.getState().signOutLocal();
        return null;
      }

      const data = await res.json();
      await saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return data.accessToken;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function apiRequest(path, { method = 'GET', body, idempotent = false, skipAuth = false } = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (!skipAuth) {
    const token = await getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  if (idempotent) {
    headers['Idempotency-Key'] = Crypto.randomUUID();
  }

  const execFetch = (hdrs) =>
    fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: hdrs,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await execFetch(headers);

  if (res.status === 401 && !skipAuth) {
    const newAccessToken = await refreshSessionTokens();
    if (newAccessToken) {
      headers.Authorization = `Bearer ${newAccessToken}`;
      res = await execFetch(headers);
    }
  }

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errObj = payload?.error || {};
    throw new ApiError(
      res.status,
      errObj.code || 'API_ERROR',
      errObj.message || `Request failed with status ${res.status}`,
      errObj.details || null
    );
  }

  return payload;
}

export { API_BASE_URL };
