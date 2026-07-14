const { query } = require('../config/database');
const logger = require('../utils/logger');

exports.getAll = async (req, res) => {
  try {
    const userId = req.user.id;
    const roleName = req.user.role_name;

    let sql, params;

    if (roleName === 'admin') {
      sql = `
        SELECT p.*, u.first_name || ' ' || u.last_name as created_by_name,
          (SELECT COUNT(*) FROM bidders WHERE project_id = p.id) as bidder_count,
          (SELECT COUNT(*) FROM project_evaluators WHERE project_id = p.id) as evaluator_count,
          w.current_stage_index, w.id as workflow_id,
          (SELECT name FROM stages WHERE workflow_id = w.id AND stage_order = w.current_stage_index LIMIT 1) as current_stage_name
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN workflows w ON w.project_id = p.id
        ORDER BY p.created_at DESC
      `;
      params = [];
    } else {
      sql = `
        SELECT p.*, u.first_name || ' ' || u.last_name as created_by_name,
          (SELECT COUNT(*) FROM bidders WHERE project_id = p.id) as bidder_count,
          w.current_stage_index, w.id as workflow_id,
          (SELECT name FROM stages WHERE workflow_id = w.id AND stage_order = w.current_stage_index LIMIT 1) as current_stage_name
        FROM projects p
        JOIN project_evaluators pe ON pe.project_id = p.id AND pe.user_id = $1
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN workflows w ON w.project_id = p.id
        ORDER BY p.created_at DESC
      `;
      params = [userId];
    }

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Get all projects error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT p.*, u.first_name || ' ' || u.last_name as created_by_name,
        (SELECT COUNT(*) FROM bidders WHERE project_id = p.id) as bidder_count
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.id = $1`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const project = result.rows[0];

    // Get evaluators
    const evaluators = await query(
      `SELECT pe.*, u.first_name, u.last_name, u.email, u.designation, u.department, r.name as role_name
       FROM project_evaluators pe
       JOIN users u ON pe.user_id = u.id
       JOIN roles r ON u.role_id = r.id
       WHERE pe.project_id = $1`,
      [id]
    );
    project.evaluators = evaluators.rows;

    // Get workflow summary
    const workflow = await query(
      `SELECT w.*, 
        (SELECT COUNT(*) FROM stages WHERE workflow_id = w.id) as stage_count
       FROM workflows w WHERE w.project_id = $1`,
      [id]
    );
    project.workflow = workflow.rows[0] || null;

    res.json({ success: true, data: project });
  } catch (err) {
    logger.error('Get project error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      file_no, title, description, department, estimated_amount, currency,
      source_of_financing, procurement_method, invitation_date, bid_close_date,
      bid_open_date, pre_bid_date, document_sale_date, document_price, metadata
    } = req.body;

    const existing = await query(`SELECT id FROM projects WHERE file_no = $1`, [file_no]);
    if (existing.rows.length) {
      return res.status(400).json({ success: false, message: 'File number already exists' });
    }

    const result = await query(
      `INSERT INTO projects (
        file_no, title, description, department, estimated_amount, currency,
        source_of_financing, procurement_method, invitation_date, bid_close_date,
        bid_open_date, pre_bid_date, document_sale_date, document_price,
        metadata, created_by, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'draft')
       RETURNING *`,
      [file_no, title, description, department, estimated_amount, currency,
       source_of_financing, procurement_method, invitation_date, bid_close_date,
       bid_open_date, pre_bid_date, document_sale_date, document_price,
       JSON.stringify(metadata || {}), req.user.id]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: 'Project created successfully' });
  } catch (err) {
    logger.error('Create project error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, department, estimated_amount, currency,
      source_of_financing, procurement_method, invitation_date, bid_close_date,
      bid_open_date, pre_bid_date, document_sale_date, document_price, status
    } = req.body;

    const result = await query(
      `UPDATE projects SET
        title=$1, description=$2, department=$3, estimated_amount=$4, currency=$5,
        source_of_financing=$6, procurement_method=$7, invitation_date=$8,
        bid_close_date=$9, bid_open_date=$10, pre_bid_date=$11,
        document_sale_date=$12, document_price=$13, status=$14, updated_at=NOW()
       WHERE id=$15 RETURNING *`,
      [title, description, department, estimated_amount, currency,
       source_of_financing, procurement_method, invitation_date, bid_close_date,
       bid_open_date, pre_bid_date, document_sale_date, document_price, status, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.json({ success: true, data: result.rows[0], message: 'Project updated' });
  } catch (err) {
    logger.error('Update project error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.assignEvaluators = async (req, res) => {
  try {
    const { id } = req.params;
    const { evaluators } = req.body; // [{ user_id, role }]

    // Remove existing
    await query(`DELETE FROM project_evaluators WHERE project_id = $1`, [id]);

    // Insert new
    for (const ev of evaluators) {
      await query(
        `INSERT INTO project_evaluators (project_id, user_id, role, assigned_by)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [id, ev.user_id, ev.role || 'member', req.user.id]
      );
    }

    res.json({ success: true, message: 'Evaluators assigned successfully' });
  } catch (err) {
    logger.error('Assign evaluators error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const { id } = req.params;

    const bidderStats = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'eliminated') as eliminated,
        MIN(bid_price) as lowest_bid,
        MAX(bid_price) as highest_bid,
        AVG(bid_price) as avg_bid
       FROM bidders WHERE project_id = $1`,
      [id]
    );

    const stageProgress = await query(
      `SELECT s.id, s.name, s.stage_order, s.status,
        COUNT(DISTINCT e.bidder_id) as evaluated_count
       FROM stages s
       JOIN workflows w ON s.workflow_id = w.id
       LEFT JOIN evaluations e ON e.stage_id = s.id
       WHERE w.project_id = $1
       GROUP BY s.id, s.name, s.stage_order, s.status
       ORDER BY s.stage_order`,
      [id]
    );

    res.json({
      success: true,
      data: {
        bidders: bidderStats.rows[0],
        stages: stageProgress.rows
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
