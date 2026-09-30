const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { authenticate, authorize, requireItemAccess, requireSameOrigin, validateUploadedFile, auditLog } = require('../middleware/auth');

// Controllers
const tenderCreationController = require('../controllers/tenderCreationController');
const itemEvaluationController = require('../controllers/itemEvaluationController');
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
    const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('File type not allowed'));
  }
});

router.use(requireSameOrigin);

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
router.post('/projects', authenticate, authorize('admin'), auditLog('project_created', 'project'), projectsController.create);
router.put('/projects/:id', authenticate, authorize('admin'), auditLog('project_updated', 'project'), projectsController.update);
router.delete('/projects/:id', authenticate, authorize('admin'), auditLog('project_deleted', 'project'), projectsController.delete);
router.post('/projects/:id/evaluators', authenticate, authorize('admin'), auditLog('evaluators_assigned', 'project'), projectsController.assignEvaluators);
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
router.post('/documents/upload', authenticate, upload.single('file'), validateUploadedFile, documentsController.upload);
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

// ===================== TENDER CREATION ENGINE =====================
// Global bidder pool
router.get('/projects/:projectId/global-bidders', authenticate, tenderCreationController.getGlobalBidders);
router.post('/projects/:projectId/global-bidders', authenticate, authorize('admin'), auditLog('bidder_created', 'bidder'), tenderCreationController.createGlobalBidder);

// Tender-level file import
router.post('/projects/:projectId/import/tender', authenticate, authorize('admin'), upload.single('file'), validateUploadedFile, auditLog('tender_file_imported', 'document'), tenderCreationController.importTenderFile);

// Work packages
router.get('/projects/:projectId/work-packages', authenticate, tenderCreationController.getWorkPackages);
router.post('/projects/:projectId/work-packages', authenticate, authorize('admin'), tenderCreationController.createWorkPackage);
router.put('/work-packages/:id', authenticate, authorize('admin'), tenderCreationController.updateWorkPackage);
router.delete('/work-packages/:id', authenticate, authorize('admin'), tenderCreationController.deleteWorkPackage);
router.post('/projects/:projectId/work-packages/:wpId/import', authenticate, authorize('admin'), upload.single('file'), validateUploadedFile, auditLog('work_package_file_imported', 'document'), tenderCreationController.importWorkPackageFile);

// Items
router.get('/projects/:projectId/items', authenticate, tenderCreationController.getItems);
router.get('/items/:id', authenticate, requireItemAccess, tenderCreationController.getItemById);
router.post('/projects/:projectId/items', authenticate, authorize('admin'), tenderCreationController.createItem);
router.put('/items/:id', authenticate, authorize('admin'), tenderCreationController.updateItem);
router.delete('/items/:id', authenticate, authorize('admin'), tenderCreationController.deleteItem);
router.post('/projects/:projectId/items/:itemId/import', authenticate, authorize('admin'), upload.single('file'), validateUploadedFile, auditLog('item_file_imported', 'document'), tenderCreationController.importItemFile);
router.delete('/projects/:projectId/imports/:documentId', authenticate, authorize('admin'), tenderCreationController.deleteImportFile);
router.post('/items/:itemId/assign-bidder', authenticate, authorize('admin'), tenderCreationController.assignBidderToItem);
router.post('/items/:itemId/begin-evaluation', authenticate, requireItemAccess, tenderCreationController.beginEvaluation);
router.post('/items/:itemId/advance-evaluation-step', authenticate, requireItemAccess, auditLog('evaluation_step_confirmed', 'item'), tenderCreationController.advanceEvaluationStep);

// ===================== ITEM EVALUATION DASHBOARD =====================
router.get('/items/:itemId/dashboard', authenticate, requireItemAccess, itemEvaluationController.getItemDashboard);
// Summary Report (editable meta + auto bidder count)
router.get('/items/:itemId/summary-report', authenticate, requireItemAccess, itemEvaluationController.getSummaryReport);
router.put('/items/:itemId/summary-report', authenticate, requireItemAccess, authorize('admin'), itemEvaluationController.upsertSummaryReport);
// 4.1 Bid Opening
router.get('/items/:itemId/table41', authenticate, requireItemAccess, itemEvaluationController.getTable41);
router.post('/items/:itemId/table41', authenticate, requireItemAccess, itemEvaluationController.addTable41Row);
router.put('/table41/:id', authenticate, requireItemAccess, itemEvaluationController.updateTable41Row);
router.delete('/table41/:id', authenticate, requireItemAccess, authorize('admin'), itemEvaluationController.deleteTable41Row);

// 5.1 Preliminary Examination
router.get('/items/:itemId/table51', authenticate, requireItemAccess, itemEvaluationController.getTable51);
router.put('/table51/:rowId/cell', authenticate, requireItemAccess, itemEvaluationController.updateTable51Cell);
router.post('/items/:itemId/table51/custom-row', authenticate, requireItemAccess, authorize('admin'), itemEvaluationController.addTable51CustomRow);
router.delete('/table51/:id', authenticate, requireItemAccess, authorize('admin'), itemEvaluationController.deleteTable51Row);
router.post('/items/:itemId/table51/acceptance', authenticate, requireItemAccess, itemEvaluationController.setTable51Acceptance);

// Technical Specification Compliance
router.get('/items/:itemId/techspec', authenticate, requireItemAccess, itemEvaluationController.getTechSpec);
router.post('/items/:itemId/techspec', authenticate, requireItemAccess, itemEvaluationController.addTechSpecRow);
router.put('/techspec/:rowId/cell', authenticate, requireItemAccess, itemEvaluationController.updateTechSpecCell);
router.delete('/techspec/:id', authenticate, requireItemAccess, authorize('admin'), itemEvaluationController.deleteTechSpecRow);

// 6.1 Clarifications
router.get('/items/:itemId/table6', authenticate, requireItemAccess, itemEvaluationController.getTable6);
router.post('/items/:itemId/table6', authenticate, requireItemAccess, itemEvaluationController.addTable6Row);
router.put('/table6/:id', authenticate, requireItemAccess, itemEvaluationController.updateTable6Row);
router.delete('/table6/:id', authenticate, requireItemAccess, authorize('admin'), itemEvaluationController.deleteTable6Row);

// 7.1 Technical Departures
router.get('/items/:itemId/table7', authenticate, requireItemAccess, itemEvaluationController.getTable7);
router.post('/items/:itemId/table7', authenticate, requireItemAccess, itemEvaluationController.addTable7Row);
router.put('/table7/:id', authenticate, requireItemAccess, itemEvaluationController.updateTable7Row);
router.delete('/table7/:id', authenticate, requireItemAccess, authorize('admin'), itemEvaluationController.deleteTable7Row);

// 8.1 Evaluation of Responsive Bids (Financial Ranking)
router.get('/items/:itemId/table81', authenticate, requireItemAccess, itemEvaluationController.getTable81);
router.put('/items/:itemId/table81', authenticate, requireItemAccess, itemEvaluationController.upsertTable81Row);

// 8.1.1 Post-Qualification
router.get('/items/:itemId/table811', authenticate, requireItemAccess, itemEvaluationController.getTable811);
router.post('/items/:itemId/table811', authenticate, requireItemAccess, itemEvaluationController.addTable811Row);
router.put('/table811/:id', authenticate, requireItemAccess, itemEvaluationController.updateTable811Row);

// 9.1 Contract Award Recommendation
router.get('/items/:itemId/contract-award', authenticate, requireItemAccess, itemEvaluationController.getContractAward);
router.put('/items/:itemId/contract-award', authenticate, requireItemAccess, authorize('admin'), itemEvaluationController.upsertContractAward);

module.exports = router;
