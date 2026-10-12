import axios from 'axios';

export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'cabconnect.token';

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage unavailable */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } },
};

const api = axios.create({ baseURL: `${API_BASE}/api`, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

/**
 * Normalizes every failure into an Error with a human-readable message,
 * `status` and field-level `details` (from the API's { error } envelope).
 */
api.interceptors.response.use(
  (res) => {
    if (res.data && typeof res.data === 'object' && 'success' in res.data) return res;
    if (res.config.responseType === 'blob') return res;
    return Promise.reject(Object.assign(new Error('Unexpected response from server'), { status: res.status }));
  },
  async (err) => {
    // Blob requests (e.g. receipt PDF) get the JSON error body as a Blob – parse it.
    if (err.response?.data instanceof Blob && err.response.data.type?.includes('json')) {
      try { err.response.data = JSON.parse(await err.response.data.text()); } catch { /* keep generic message */ }
    }
    const status = err.response?.status;
    let message = err.response?.data?.error?.message;
    if (!message) {
      if (err.code === 'ECONNABORTED') message = 'The request timed out. Check your connection and try again.';
      else if (!err.response) message = 'Cannot reach the server. Is the API running?';
      else message = `Request failed (${status})`;
    }
    if (status === 401 && tokenStore.get() && !err.config?.url?.startsWith('/auth/login')) onUnauthorized();
    return Promise.reject(Object.assign(new Error(message), { status, details: err.response?.data?.error?.details }));
  },
);

/** Unwraps { success, data, meta } -> { data, meta }. */
const unwrap = (p) => p.then((r) => ({ data: r.data.data, meta: r.data.meta }));

export const http = {
  get: (url, params) => unwrap(api.get(url, { params })),
  post: (url, body, config) => unwrap(api.post(url, body, config)),
  put: (url, body) => unwrap(api.put(url, body)),
  patch: (url, body) => unwrap(api.patch(url, body)),
  delete: (url) => unwrap(api.delete(url)),
};

/** Downloads a binary endpoint (e.g. a PDF receipt) and triggers a browser save. */
export async function downloadFile(url, filename) {
  const res = await api.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Resolves a server-relative asset (e.g. /uploads/x.png) to a full URL. */
export const assetUrl = (p) => (!p ? undefined : p.startsWith('http') ? p : `${API_BASE}${p}`);

export default api;
