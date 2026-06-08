const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const logger = require('../utils/logger');

exports.getAll = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.department, u.designation, 
              u.phone, u.is_active, u.last_login, u.created_at,
              r.name as role_name
       FROM users u JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Get all users error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { email, password, first_name, last_name, role_id, department, phone, designation } = req.body;

    const existing = await query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
    if (existing.rows.length) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password || 'Change@1234', 12);

    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, department, phone, designation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, email, first_name, last_name, created_at`,
      [email.toLowerCase(), hashedPassword, first_name, last_name, role_id, department, phone, designation]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: 'User created successfully' });
  } catch (err) {
    logger.error('Create user error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, role_id, department, phone, designation, is_active } = req.body;

    const result = await query(
      `UPDATE users SET first_name=$1, last_name=$2, role_id=$3, department=$4, 
       phone=$5, designation=$6, is_active=$7, updated_at=NOW()
       WHERE id=$8 RETURNING id, email, first_name, last_name`,
      [first_name, last_name, role_id, department, phone, designation, is_active, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: result.rows[0], message: 'User updated successfully' });
  } catch (err) {
    logger.error('Update user error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getEvaluators = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.department, u.designation,
              r.name as role_name
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE r.name IN ('evaluator', 'admin') AND u.is_active = TRUE
       ORDER BY u.first_name`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getRoles = async (req, res) => {
  try {
    const result = await query(`SELECT * FROM roles ORDER BY name`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
