const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      `SELECT u.*, r.name as role_name, r.permissions 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = $1 AND u.is_active = TRUE`,
      [decoded.userId]
    );

    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    logger.error('Auth middleware error', { err: err.message });
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role_name)) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Required roles: ${roles.join(', ')}` 
      });
    }
    next();
  };
};

const requireItemAccess = async (req, res, next) => {
  try {
    if (req.user.role_name === 'admin') return next();
    let itemId = req.params.itemId;
    const rowId = req.params.id || req.params.rowId;
    if (!itemId && rowId) {
      const rowTables = {
        table41: 'table41_rows', table51: 'table51_rows', techspec: 'technical_spec_rows',
        table6: 'table6_rows', table7: 'table7_rows', table811: 'table811_rows'
      };
      const tableKey = Object.keys(rowTables).find(key => req.path.startsWith(`/${key}/`));
      if (tableKey) {
        const row = await query(`SELECT item_id FROM ${rowTables[tableKey]} WHERE id=$1`, [rowId]);
        itemId = row.rows[0]?.item_id;
      }
    }
    if (!itemId) return res.status(400).json({ success: false, message: 'Item context is required' });
    const result = await query(
      `SELECT i.id, i.evaluator_id, i.project_id, wp.evaluator_id AS wp_evaluator_id,
         p.created_by,
         EXISTS (SELECT 1 FROM project_evaluators pe WHERE pe.project_id=i.project_id AND pe.user_id=$2) AS project_assigned
       FROM items i
       LEFT JOIN work_packages wp ON wp.id=i.work_package_id
       JOIN projects p ON p.id=i.project_id
       WHERE i.id=$1`,
      [itemId, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Item not found' });
    const item = result.rows[0];
    const allowed = item.evaluator_id === req.user.id
      || item.wp_evaluator_id === req.user.id
      || item.project_assigned;
    if (!allowed) return res.status(403).json({ success: false, message: 'You are not assigned to this item' });
    next();
  } catch (err) {
    logger.error('Item access check failed', { err: err.message });
    res.status(500).json({ success: false, message: 'Access check failed' });
  }
};

const auditLog = (action, entityType) => async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = async (data) => {
    if (data.success !== false) {
      try {
        await query(
          `INSERT INTO audit_logs (user_id, project_id, action, entity_type, entity_id, new_values, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            req.user?.id, 
            req.params?.projectId || req.body?.projectId,
            action,
            entityType,
            data.data?.id || req.params?.id,
            JSON.stringify(req.body),
            req.ip,
            req.headers['user-agent']
          ]
        );
      } catch (e) { /* audit failures shouldn't break response */ }
    }
    return originalJson(data);
  };
  next();
};

const requireSameOrigin = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  const expected = process.env.FRONTEND_URL || 'http://localhost:3000';
  if (origin && origin !== expected) return res.status(403).json({ success: false, message: 'Origin rejected' });
  next();
};

const validateUploadedFile = (req, res, next) => {
  if (!req.file) return next();
  const ext = path.extname(req.file.originalname).toLowerCase();
  const allowed = new Set(['.xlsx', '.xls', '.csv', '.pdf']);
  if (!allowed.has(ext)) return res.status(400).json({ success: false, message: 'Only Excel, CSV, and PDF files are allowed' });
  const sample = fs.readFileSync(req.file.path).subarray(0, 1024 * 1024).toString('latin1');
  if (sample.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE') || /<script[\s>]/i.test(sample)) {
    fs.rmSync(req.file.path, { force: true });
    return res.status(400).json({ success: false, message: 'Uploaded file failed malware screening' });
  }
  next();
};

module.exports = { authenticate, authorize, requireItemAccess, auditLog, requireSameOrigin, validateUploadedFile };
