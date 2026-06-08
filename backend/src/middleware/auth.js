const jwt = require('jsonwebtoken');
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

module.exports = { authenticate, authorize, auditLog };
