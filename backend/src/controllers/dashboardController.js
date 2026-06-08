const { query } = require('../config/database');

exports.getAdminStats = async (req, res) => {
  try {
    const stats = await query(`
      SELECT
        (SELECT COUNT(*) FROM projects) as total_projects,
        (SELECT COUNT(*) FROM projects WHERE status = 'in_evaluation') as active_evaluations,
        (SELECT COUNT(*) FROM projects WHERE status = 'awarded') as awarded_projects,
        (SELECT COUNT(*) FROM users WHERE is_active = TRUE) as total_users,
        (SELECT COUNT(*) FROM bidders) as total_bidders,
        (SELECT COUNT(*) FROM documents) as total_documents,
        (SELECT COUNT(*) FROM projects WHERE status = 'draft') as draft_projects,
        (SELECT COUNT(*) FROM projects WHERE status = 'workflow_configured') as pending_start
    `);

    const recentProjects = await query(`
      SELECT p.id, p.file_no, p.title, p.status, p.created_at,
        (SELECT COUNT(*) FROM bidders WHERE project_id = p.id) as bidder_count
      FROM projects p ORDER BY p.created_at DESC LIMIT 5
    `);

    const recentActivity = await query(`
      SELECT al.action, al.entity_type, al.created_at,
        u.first_name || ' ' || u.last_name as user_name,
        p.title as project_title
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN projects p ON al.project_id = p.id
      ORDER BY al.created_at DESC LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        stats: stats.rows[0],
        recentProjects: recentProjects.rows,
        recentActivity: recentActivity.rows
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getEvaluatorStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await query(`
      SELECT
        (SELECT COUNT(DISTINCT project_id) FROM project_evaluators WHERE user_id = $1) as assigned_projects,
        (SELECT COUNT(DISTINCT project_id) FROM project_evaluators pe 
         JOIN projects p ON pe.project_id = p.id
         WHERE pe.user_id = $1 AND p.status = 'in_evaluation') as active_evaluations,
        (SELECT COUNT(*) FROM evaluations WHERE evaluator_id = $1) as total_evaluations,
        (SELECT COUNT(DISTINCT n.id) FROM notifications n WHERE n.user_id = $1 AND n.is_read = FALSE) as unread_notifications
    `, [userId]);

    const myProjects = await query(`
      SELECT p.id, p.file_no, p.title, p.status, pe.role,
        (SELECT COUNT(*) FROM bidders WHERE project_id = p.id) as bidder_count,
        w.current_stage_index,
        (SELECT name FROM stages WHERE workflow_id = w.id AND stage_order = w.current_stage_index LIMIT 1) as current_stage
      FROM project_evaluators pe
      JOIN projects p ON pe.project_id = p.id
      LEFT JOIN workflows w ON w.project_id = p.id
      WHERE pe.user_id = $1
      ORDER BY p.updated_at DESC
      LIMIT 10
    `, [userId]);

    res.json({
      success: true,
      data: {
        stats: stats.rows[0],
        myProjects: myProjects.rows
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND id = $2`,
      [req.user.id, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
