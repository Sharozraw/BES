const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { authenticate, authorize } = require('../middleware/auth');

// Controllers
const authController = require('../controllers/authController');
const usersController = require('../controllers/usersController');
const projectsController = require('../controllers/projectsController');
const workflowsController = require('../controllers/workflowsController');
const biddersController = require('../controllers/biddersController');
const documentsController = require('../controllers/documentsController');
const evaluationsController = require('../controllers/evaluationsController');
const reportsController = require('../controllers/reportsController');
const dashboardController = require('../controllers/dashboardController');

// Multer setup
const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('File type not allowed'));
  }
});

// ===================== AUTH =====================
router.post('/auth/login', authController.login);
router.post('/auth/refresh', authController.refreshToken);
router.get('/auth/me', authenticate, authController.getMe);
router.put('/auth/change-password', authenticate, authController.changePassword);

// ===================== USERS =====================
router.get('/users', authenticate, authorize('admin'), usersController.getAll);
router.post('/users', authenticate, authorize('admin'), usersController.create);
router.put('/users/:id', authenticate, authorize('admin'), usersController.update);
router.get('/users/evaluators', authenticate, usersController.getEvaluators);
router.get('/users/roles', authenticate, usersController.getRoles);

// ===================== DASHBOARD =====================
router.get('/dashboard/admin', authenticate, authorize('admin'), dashboardController.getAdminStats);
router.get('/dashboard/evaluator', authenticate, dashboardController.getEvaluatorStats);
router.get('/notifications', authenticate, dashboardController.getNotifications);
router.put('/notifications/:id/read', authenticate, dashboardController.markNotificationRead);

// ===================== PROJECTS =====================
router.get('/projects', authenticate, projectsController.getAll);
router.get('/projects/:id', authenticate, projectsController.getById);
router.post('/projects', authenticate, authorize('admin'), projectsController.create);
router.put('/projects/:id', authenticate, authorize('admin'), projectsController.update);
router.post('/projects/:id/evaluators', authenticate, authorize('admin'), projectsController.assignEvaluators);
router.get('/projects/:id/stats', authenticate, projectsController.getStats);

// ===================== WORKFLOWS =====================
router.get('/projects/:projectId/workflow', authenticate, workflowsController.getByProject);
router.post('/projects/:projectId/workflow', authenticate, authorize('admin'), workflowsController.create);
router.post('/projects/:projectId/workflow/start', authenticate, authorize('admin'), workflowsController.startEvaluation);
router.post('/projects/:projectId/workflow/advance', authenticate, authorize('admin'), workflowsController.advanceStage);

// ===================== BIDDERS =====================
router.get('/projects/:projectId/bidders', authenticate, biddersController.getByProject);
router.post('/projects/:projectId/bidders', authenticate, authorize('admin'), biddersController.create);
router.put('/bidders/:id', authenticate, authorize('admin'), biddersController.update);
router.delete('/bidders/:id', authenticate, authorize('admin'), biddersController.delete);
router.get('/projects/:projectId/bidders/evaluation-summary', authenticate, biddersController.getEvaluationSummary);

// ===================== DOCUMENTS =====================
router.get('/projects/:projectId/documents', authenticate, documentsController.getByProject);
router.post('/documents/upload', authenticate, upload.single('file'), documentsController.upload);
router.get('/documents/:id/extracted', authenticate, documentsController.getExtracted);
router.delete('/documents/:id', authenticate, authorize('admin'), documentsController.delete);

// ===================== EVALUATIONS =====================
router.get('/projects/:projectId/stages/:stageId/workspace', authenticate, evaluationsController.getWorkspace);
router.post('/stages/:stageId/bidders/:bidderId/evaluate', authenticate, evaluationsController.submitEvaluation);
router.post('/stages/:stageId/bidders/:bidderId/comment', authenticate, evaluationsController.addComment);
router.post('/stages/:stageId/bidders/:bidderId/vote', authenticate, evaluationsController.submitVote);

// ===================== FINAL DECISION =====================
router.post('/projects/:projectId/final-decision', authenticate, authorize('admin'), evaluationsController.submitFinalDecision);
router.get('/projects/:projectId/final-decision', authenticate, evaluationsController.getFinalDecision);

// ===================== REPORTS =====================
router.get('/projects/:projectId/reports', authenticate, reportsController.getByProject);
router.post('/projects/:projectId/reports/generate', authenticate, reportsController.generate);
router.get('/reports/download/:id', authenticate, reportsController.download);

module.exports = router;
