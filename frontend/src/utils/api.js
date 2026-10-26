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
  delete: (id) => api.delete(`/projects/${id}`),
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

// Tender Creation Engine
export const tenderAPI = {
  // Global bidder pool
  getGlobalBidders: (projectId) => api.get(`/projects/${projectId}/global-bidders`),
  createGlobalBidder: (projectId, data) => api.post(`/projects/${projectId}/global-bidders`, data),

  // Tender-level file import
  importTenderFile: (projectId, formData) =>
    api.post(`/projects/${projectId}/import/tender`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getImports: (projectId) => api.get(`/projects/${projectId}/documents?importsOnly=true`),
  deleteImport: (projectId, documentId) => api.delete(`/projects/${projectId}/imports/${documentId}`),

  // Work packages
  getWorkPackages: (projectId) => api.get(`/projects/${projectId}/work-packages`),
  createWorkPackage: (projectId, data) => api.post(`/projects/${projectId}/work-packages`, data),
  updateWorkPackage: (id, data) => api.put(`/work-packages/${id}`, data),
  deleteWorkPackage: (id) => api.delete(`/work-packages/${id}`),
  importWorkPackageFile: (projectId, wpId, formData) =>
    api.post(`/projects/${projectId}/work-packages/${wpId}/import`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  // Items
  getItems: (projectId, workPackageId) =>
    api.get(`/projects/${projectId}/items${workPackageId ? `?workPackageId=${workPackageId}` : ''}`),
  getItemById: (id) => api.get(`/items/${id}`),
  createItem: (projectId, data) => api.post(`/projects/${projectId}/items`, data),
  updateItem: (id, data) => api.put(`/items/${id}`, data),
  deleteItem: (id) => api.delete(`/items/${id}`),
  importItemFile: (projectId, itemId, formData) =>
    api.post(`/projects/${projectId}/items/${itemId}/import`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  assignBidderToItem: (itemId, data) => api.post(`/items/${itemId}/assign-bidder`, data),
  beginEvaluation: (itemId) => api.post(`/items/${itemId}/begin-evaluation`),
  advanceEvaluationStep: (itemId, data) => api.post(`/items/${itemId}/advance-evaluation-step`, data),
};

// Item Evaluation Tables — exact PDF order
export const itemEvalAPI = {
  getDashboard: (itemId) => api.get(`/items/${itemId}/dashboard`),

  // Summary Report meta (editable)
  getSummaryReport: (itemId) => api.get(`/items/${itemId}/summary-report`),
  saveSummaryReport: (itemId, data) => api.put(`/items/${itemId}/summary-report`, data),

  // 4.1 Bid Opening
  getTable41: (itemId) => api.get(`/items/${itemId}/table41`),
  addTable41Row: (itemId, data) => api.post(`/items/${itemId}/table41`, data),
  updateTable41Row: (id, data) => api.put(`/table41/${id}`, data),
  deleteTable41Row: (id) => api.delete(`/table41/${id}`),

  // 5.1 Preliminary Examination
  getTable51: (itemId) => api.get(`/items/${itemId}/table51`),
  updateTable51Cell: (rowId, data) => api.put(`/table51/${rowId}/cell`, data),
  addTable51CustomRow: (itemId, data) => api.post(`/items/${itemId}/table51/custom-row`, data),
  deleteTable51Row: (id) => api.delete(`/table51/${id}`),
  setTable51Acceptance: (itemId, data) => api.post(`/items/${itemId}/table51/acceptance`, data),

  // Technical Specification Compliance
  getTechSpec: (itemId) => api.get(`/items/${itemId}/techspec`),
  addTechSpecRow: (itemId, data) => api.post(`/items/${itemId}/techspec`, data),
  updateTechSpecCell: (rowId, data) => api.put(`/techspec/${rowId}/cell`, data),
  deleteTechSpecRow: (id) => api.delete(`/techspec/${id}`),

  // 6.1 Clarifications
  getTable6: (itemId) => api.get(`/items/${itemId}/table6`),
  addTable6Row: (itemId, data) => api.post(`/items/${itemId}/table6`, data),
  updateTable6Row: (id, data) => api.put(`/table6/${id}`, data),
  deleteTable6Row: (id) => api.delete(`/table6/${id}`),

  // 7.1 Technical Departures
  getTable7: (itemId) => api.get(`/items/${itemId}/table7`),
  addTable7Row: (itemId, data) => api.post(`/items/${itemId}/table7`, data),
  updateTable7Row: (id, data) => api.put(`/table7/${id}`, data),
  deleteTable7Row: (id) => api.delete(`/table7/${id}`),

  // 8.1 Evaluation of Responsive Bids
  getTable81: (itemId) => api.get(`/items/${itemId}/table81`),
  upsertTable81Row: (itemId, data) => api.put(`/items/${itemId}/table81`, data),

  // 8.1.1 Post-Qualification
  getTable811: (itemId) => api.get(`/items/${itemId}/table811`),
  addTable811Row: (itemId, data) => api.post(`/items/${itemId}/table811`, data),
  updateTable811Row: (id, data) => api.put(`/table811/${id}`, data),

  // 9.1 Contract Award Recommendation
  getContractAward: (itemId) => api.get(`/items/${itemId}/contract-award`),
  upsertContractAward: (itemId, data) => api.put(`/items/${itemId}/contract-award`, data),
};

export default api;
