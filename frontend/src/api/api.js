import axios from 'axios';

// Base URL for the embedded backend. Overridable at build time via
// VITE_API_BASE_URL; defaults to the local backend the Electron app starts.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Resolve a possibly-relative image path (e.g. "/uploads/x.jpg") returned by
// the backend into a fully-qualified URL the renderer can load.
export const resolveImageUrl = (imageUrl) => {
  if (!imageUrl) return '';
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${API_BASE_URL}${imageUrl}`;
};

// Pull a human-readable message out of an axios error, preferring the
// backend's structured `{ error, details }` payload.
export const apiErrorMessage = (error, fallback = 'Something went wrong') => {
  const data = error?.response?.data;
  if (data?.details && Array.isArray(data.details)) return data.details.join('. ');
  if (data?.error) return data.error;
  if (error?.message) return error.message;
  return fallback;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Backend health. `damaged` is non-null when the data file exists but cannot
// be read: the server then refuses every write with 503 (see server.js).
export async function fetchBackendStatus() {
  const res = await api.get('/');
  return { status: res.data?.status || 'unknown', damaged: res.data?.damaged || null };
}

export default api;
