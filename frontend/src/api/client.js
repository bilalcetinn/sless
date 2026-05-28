import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 120000,
});

// ── Request Interceptor: Token varsa header'a ekle ──
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('sless_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response Interceptor: 401 gelirse token sil ──
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('sless_token');
      localStorage.removeItem('sless_user');
    }
    return Promise.reject(error);
  }
);

// ══════════════════════════════════════════════════════════════
// Model API
// ══════════════════════════════════════════════════════════════

export async function fetchModels() {
  const res = await API.get('/api/models');
  return res.data;
}

export async function addModel(formData) {
  const res = await API.post('/api/models', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function deleteModel(id) {
  const res = await API.delete(`/api/models/${id}`);
  return res.data;
}

// ══════════════════════════════════════════════════════════════
// Audio API
// ══════════════════════════════════════════════════════════════

export async function uploadAudio(formData, onUploadProgress) {
  const res = await API.post('/api/audio/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onUploadProgress && e.total) {
        const pct = Math.round((e.loaded * 100) / e.total);
        onUploadProgress(pct);
      }
    },
  });
  return res.data;
}

export async function processAudio(recordId) {
  const res = await API.post(`/api/audio/process/${recordId}`);
  return res.data;
}

export async function processWithModel(recordId, modelId, noiseLevel, sensitivity) {
  const res = await API.post('/api/audio/process-with-model', {
    record_id: recordId,
    model_id: modelId,
    noise_level: noiseLevel,
    filter_sensitivity: sensitivity,
  });
  return res.data;
}

export async function getStatus(recordId) {
  const res = await API.get(`/api/audio/status/${recordId}`);
  return res.data;
}

export async function downloadAudio(recordId) {
  const res = await API.get(`/api/audio/download/${recordId}`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `sless_cleaned_${recordId}.wav`);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function getHistory() {
  const res = await API.get('/api/audio/history');
  return res.data;
}

// ══════════════════════════════════════════════════════════════
// Auth API
// ══════════════════════════════════════════════════════════════

export async function register(data) {
  const res = await API.post('/api/auth/register', data);
  return res.data;
}

export async function login(data) {
  const res = await API.post('/api/auth/login', data);
  return res.data;
}

export async function getMe() {
  const res = await API.get('/api/auth/me');
  return res.data;
}

export default API;
