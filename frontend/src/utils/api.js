import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor - add JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bes_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('bes_refresh_token');
      if (refreshToken && !error.config._retry) {
        error.config._retry = true;
        try {
          const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          const { accessToken } = res.data.data;
          localStorage.setItem('bes_token', accessToken);
          error.config.headers.Authorization = `Bearer ${accessToken}`;
          return api(error.config);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      } else {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    const message = error.response?.data?.message || 'An error occurred';
    return Promise.reject({ message, status: error.response?.status });
  }
);

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  refreshToken: (data) => api.post('/auth/refresh', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// Users
export const usersAPI = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  getEvaluators: () => api.get('/users/evaluators'),
  getRoles: () => api.get('/users/roles'),
};

// Dashboard
export const dashboardAPI = {
  getAdminStats: () => api.get('/dashboard/admin'),
  getEvaluatorStats: () => api.get('/dashboard/evaluator'),
  getNotifications: () => api.get('/notifications'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
};

// Projects
export const projectsAPI = {
  getAll: () => api.get('/projects'),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  assignEvaluators: (id, data) => api.post(`/projects/${id}/evaluators`, data),
  getStats: (id) => api.get(`/projects/${id}/stats`),
};

// Workflows
export const workflowsAPI = {
  getByProject: (projectId) => api.get(`/projects/${projectId}/workflow`),
  create: (projectId, data) => api.post(`/projects/${projectId}/workflow`, data),
  start: (projectId) => api.post(`/projects/${projectId}/workflow/start`),
  advance: (projectId) => api.post(`/projects/${projectId}/workflow/advance`),
};

// Bidders
export const biddersAPI = {
  getByProject: (projectId) => api.get(`/projects/${projectId}/bidders`),
  create: (projectId, data) => api.post(`/projects/${projectId}/bidders`, data),
  update: (id, data) => api.put(`/bidders/${id}`, data),
  delete: (id) => api.delete(`/bidders/${id}`),
  getEvaluationSummary: (projectId, stageId) => 
    api.get(`/projects/${projectId}/bidders/evaluation-summary${stageId ? `?stageId=${stageId}` : ''}`),
};

// Documents
export const documentsAPI = {
  getByProject: (projectId) => api.get(`/projects/${projectId}/documents`),
  upload: (formData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getExtracted: (id) => api.get(`/documents/${id}/extracted`),
  delete: (id) => api.delete(`/documents/${id}`),
};

// Evaluations
export const evaluationsAPI = {
  getWorkspace: (projectId, stageId) => api.get(`/projects/${projectId}/stages/${stageId}/workspace`),
  submitEvaluation: (stageId, bidderId, data) => api.post(`/stages/${stageId}/bidders/${bidderId}/evaluate`, data),
  addComment: (stageId, bidderId, data) => api.post(`/stages/${stageId}/bidders/${bidderId}/comment`, data),
  submitVote: (stageId, bidderId, data) => api.post(`/stages/${stageId}/bidders/${bidderId}/vote`, data),
  submitFinalDecision: (projectId, data) => api.post(`/projects/${projectId}/final-decision`, data),
  getFinalDecision: (projectId) => api.get(`/projects/${projectId}/final-decision`),
};

// Reports
export const reportsAPI = {
  getByProject: (projectId) => api.get(`/projects/${projectId}/reports`),
  generate: (projectId, data) => api.post(`/projects/${projectId}/reports/generate`, data),
  download: (id) => `${API_URL}/reports/download/${id}`,
};

export default api;
