const { query, getClient } = require('../config/database');
const logger = require('../utils/logger');

// Get full workspace data for a stage
exports.getWorkspace = async (req, res) => {
  try {
    const { stageId, projectId } = req.params;
    const evaluatorId = req.user.id;

    // Stage with criteria
    const stageResult = await query(
      `SELECT s.*, w.project_id, w.id as workflow_id,
        (SELECT current_stage_index FROM workflows WHERE id = s.workflow_id) as current_index
       FROM stages s
       JOIN workflows w ON s.workflow_id = w.id
       WHERE s.id = $1`,
      [stageId]
    );

    if (!stageResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Stage not found' });
    }
    const stage = stageResult.rows[0];

    const criteriaResult = await query(
      `SELECT * FROM criteria WHERE stage_id = $1 ORDER BY sort_order`,
      [stageId]
    );
    stage.criteria = criteriaResult.rows;

    // Active bidders
    const biddersResult = await query(
      `SELECT b.* FROM bidders b
       WHERE b.project_id = $1 AND b.status = 'active'
       ORDER BY b.bid_price ASC NULLS LAST`,
      [projectId]
    );

    // Existing evaluations for this evaluator
    const evalResult = await query(
      `SELECT * FROM evaluations 
       WHERE stage_id = $1 AND evaluator_id = $2`,
      [stageId, evaluatorId]
    );
    const evaluationMap = {};
    evalResult.rows.forEach(e => {
      if (!evaluationMap[e.bidder_id]) evaluationMap[e.bidder_id] = {};
      evaluationMap[e.bidder_id][e.criteria_id] = e;
    });

    // Comments
    const commentsResult = await query(
      `SELECT c.*, u.first_name || ' ' || u.last_name as user_name
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.stage_id = $1
       ORDER BY c.created_at DESC`,
      [stageId]
    );

    // Votes (if enabled)
    const votesResult = await query(
      `SELECT v.*, u.first_name || ' ' || u.last_name as voter_name
       FROM votes v
       JOIN users u ON v.voter_id = u.id
       WHERE v.stage_id = $1`,
      [stageId]
    );

    // Aggregate per-bidder evaluation summary across all evaluators
    const summaryResult = await query(
      `SELECT 
        e.bidder_id,
        AVG(e.score) as avg_score,
        COUNT(DISTINCT e.evaluator_id) as evaluator_count,
        SUM(CASE WHEN e.pass_fail = 'pass' THEN 1 ELSE 0 END) as pass_count,
        SUM(CASE WHEN e.pass_fail = 'fail' THEN 1 ELSE 0 END) as fail_count
       FROM evaluations e
       WHERE e.stage_id = $1
       GROUP BY e.bidder_id`,
      [stageId]
    );

    const summaryMap = {};
    summaryResult.rows.forEach(s => { summaryMap[s.bidder_id] = s; });

    res.json({
      success: true,
      data: {
        stage,
        bidders: biddersResult.rows,
        evaluations: evaluationMap,
        comments: commentsResult.rows,
        votes: votesResult.rows,
        summary: summaryMap
      }
    });
  } catch (err) {
    logger.error('Get workspace error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Submit/update evaluations for a bidder in a stage
exports.submitEvaluation = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { stageId, bidderId } = req.params;
    const { evaluations } = req.body; // [{ criteria_id, score, pass_fail, rank, compliance_status, response_value, is_deviation, deviation_description, is_minor_deviation }]
    const evaluatorId = req.user.id;

    for (const ev of evaluations) {
      await client.query(
        `INSERT INTO evaluations 
          (stage_id, bidder_id, evaluator_id, criteria_id, score, pass_fail, rank, 
           compliance_status, response_value, is_deviation, deviation_description, is_minor_deviation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (stage_id, bidder_id, evaluator_id, criteria_id)
         DO UPDATE SET score=$5, pass_fail=$6, rank=$7, compliance_status=$8,
           response_value=$9, is_deviation=$10, deviation_description=$11, 
           is_minor_deviation=$12, updated_at=NOW()`,
        [stageId, bidderId, evaluatorId, ev.criteria_id, ev.score, ev.pass_fail,
         ev.rank, ev.compliance_status, ev.response_value, ev.is_deviation || false,
         ev.deviation_description, ev.is_minor_deviation || false]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Evaluation saved' });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Submit evaluation error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

// Add comment
exports.addComment = async (req, res) => {
  try {
    const { stageId, bidderId } = req.params;
    const { comment, comment_type, is_private } = req.body;

    const result = await query(
      `INSERT INTO comments (stage_id, bidder_id, user_id, comment, comment_type, is_private)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [stageId, bidderId, req.user.id, comment, comment_type || 'general', is_private || false]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Submit vote
exports.submitVote = async (req, res) => {
  try {
    const { stageId, bidderId } = req.params;
    const { vote, justification } = req.body;

    await query(
      `INSERT INTO votes (stage_id, bidder_id, voter_id, vote, justification)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (stage_id, bidder_id, voter_id) DO UPDATE SET vote=$4, justification=$5`,
      [stageId, bidderId, req.user.id, vote, justification]
    );

    res.json({ success: true, message: 'Vote recorded' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Final decision submission
exports.submitFinalDecision = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { bidder_id, decision_method, decision, contract_amount, reasons } = req.body;

    const result = await query(
      `INSERT INTO final_decisions (project_id, bidder_id, decision_method, decision, 
        contract_amount, reasons, decided_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [projectId, bidder_id, decision_method, decision, contract_amount, reasons, req.user.id]
    );

    await query(
      `UPDATE projects SET status = 'awarded', updated_at = NOW() WHERE id = $1`,
      [projectId]
    );

    res.json({ success: true, data: result.rows[0], message: 'Final decision recorded' });
  } catch (err) {
    logger.error('Submit final decision error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getFinalDecision = async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await query(
      `SELECT fd.*, b.name as bidder_name, b.bid_price,
        u.first_name || ' ' || u.last_name as decided_by_name
       FROM final_decisions fd
       LEFT JOIN bidders b ON fd.bidder_id = b.id
       LEFT JOIN users u ON fd.decided_by = u.id
       WHERE fd.project_id = $1
       ORDER BY fd.created_at DESC
       LIMIT 1`,
      [projectId]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
