const { query, getClient } = require('../config/database');
const logger = require('../utils/logger');

exports.getByProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const workflowResult = await query(
      `SELECT * FROM workflows WHERE project_id = $1`,
      [projectId]
    );

    if (!workflowResult.rows.length) {
      return res.json({ success: true, data: null });
    }

    const workflow = workflowResult.rows[0];

    // Get stages with criteria
    const stagesResult = await query(
      `SELECT * FROM stages WHERE workflow_id = $1 ORDER BY stage_order`,
      [workflow.id]
    );

    for (const stage of stagesResult.rows) {
      const criteriaResult = await query(
        `SELECT * FROM criteria WHERE stage_id = $1 ORDER BY sort_order`,
        [stage.id]
      );
      stage.criteria = criteriaResult.rows;
    }

    workflow.stages = stagesResult.rows;

    res.json({ success: true, data: workflow });
  } catch (err) {
    logger.error('Get workflow error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { projectId } = req.params;
    const { name, description, final_decision_method, settings, stages } = req.body;

    // Remove existing workflow
    await client.query(`DELETE FROM workflows WHERE project_id = $1`, [projectId]);

    // Create workflow
    const workflowResult = await client.query(
      `INSERT INTO workflows (project_id, name, description, final_decision_method, settings)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [projectId, name, description, final_decision_method || 'ranking', JSON.stringify(settings || {})]
    );
    const workflow = workflowResult.rows[0];

    // Create stages
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const stageResult = await client.query(
        `INSERT INTO stages (
          workflow_id, name, description, stage_order, scoring_method, decision_method,
          is_voting_enabled, min_votes_required, is_comments_mandatory,
          required_documents, pass_threshold, auto_advance, settings
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [
          workflow.id, stage.name, stage.description, i,
          stage.scoring_method || 'pass_fail',
          stage.decision_method || 'accept_reject',
          stage.is_voting_enabled || false,
          stage.min_votes_required || 1,
          stage.is_comments_mandatory || false,
          JSON.stringify(stage.required_documents || []),
          stage.pass_threshold || 0,
          stage.auto_advance !== false,
          JSON.stringify(stage.settings || {})
        ]
      );
      const createdStage = stageResult.rows[0];

      // Create criteria
      if (stage.criteria && stage.criteria.length > 0) {
        for (let j = 0; j < stage.criteria.length; j++) {
          const criterion = stage.criteria[j];
          await client.query(
            `INSERT INTO criteria (stage_id, name, description, criteria_type, weight, max_score, is_mandatory, options, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              createdStage.id, criterion.name, criterion.description,
              criterion.criteria_type || 'pass_fail',
              criterion.weight || 1.0,
              criterion.max_score || 100,
              criterion.is_mandatory !== false,
              JSON.stringify(criterion.options || []),
              j
            ]
          );
        }
      }
    }

    // Update project status
    await client.query(
      `UPDATE projects SET status = 'workflow_configured', updated_at = NOW() WHERE id = $1`,
      [projectId]
    );

    await client.query('COMMIT');

    res.status(201).json({ success: true, message: 'Workflow created successfully', data: { id: workflow.id } });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Create workflow error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  } finally {
    client.release();
  }
};

exports.advanceStage = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { projectId } = req.params;

    const workflowResult = await client.query(
      `SELECT * FROM workflows WHERE project_id = $1`,
      [projectId]
    );
    if (!workflowResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }
    const workflow = workflowResult.rows[0];

    const stagesResult = await client.query(
      `SELECT * FROM stages WHERE workflow_id = $1 ORDER BY stage_order`,
      [workflow.id]
    );
    const stages = stagesResult.rows;

    const currentStage = stages[workflow.current_stage_index];
    if (!currentStage) {
      return res.status(400).json({ success: false, message: 'No current stage' });
    }

    // Mark current stage completed
    await client.query(
      `UPDATE stages SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [currentStage.id]
    );

    const nextIndex = workflow.current_stage_index + 1;

    if (nextIndex >= stages.length) {
      // All stages done
      await client.query(
        `UPDATE workflows SET current_stage_index = $1, updated_at = NOW() WHERE id = $2`,
        [nextIndex, workflow.id]
      );
      await client.query(
        `UPDATE projects SET status = 'evaluation_complete', updated_at = NOW() WHERE id = $1`,
        [projectId]
      );
    } else {
      // Advance to next stage
      await client.query(
        `UPDATE workflows SET current_stage_index = $1, updated_at = NOW() WHERE id = $2`,
        [nextIndex, workflow.id]
      );
      await client.query(
        `UPDATE stages SET status = 'active', started_at = NOW() WHERE id = $1`,
        [stages[nextIndex].id]
      );
      await client.query(
        `UPDATE projects SET status = 'in_evaluation', updated_at = NOW() WHERE id = $1`,
        [projectId]
      );

      // Auto-eliminate bidders who failed current stage
      const eliminatedBidders = await client.query(
        `SELECT DISTINCT bidder_id FROM evaluations 
         WHERE stage_id = $1 AND pass_fail = 'fail'`,
        [currentStage.id]
      );

      for (const row of eliminatedBidders.rows) {
        await client.query(
          `UPDATE bidders SET status = 'eliminated', elimination_stage_id = $1, 
           elimination_reason = 'Failed stage evaluation'
           WHERE id = $2 AND status = 'active'`,
          [currentStage.id, row.bidder_id]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Stage advanced successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Advance stage error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

exports.startEvaluation = async (req, res) => {
  try {
    const { projectId } = req.params;

    const workflowResult = await query(
      `SELECT w.*, 
        (SELECT id FROM stages WHERE workflow_id = w.id ORDER BY stage_order LIMIT 1) as first_stage_id
       FROM workflows w WHERE w.project_id = $1`,
      [projectId]
    );
    if (!workflowResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }
    const workflow = workflowResult.rows[0];

    await query(
      `UPDATE stages SET status = 'active', started_at = NOW() WHERE id = $1`,
      [workflow.first_stage_id]
    );
    await query(
      `UPDATE projects SET status = 'in_evaluation', updated_at = NOW() WHERE id = $1`,
      [projectId]
    );

    res.json({ success: true, message: 'Evaluation started' });
  } catch (err) {
    logger.error('Start evaluation error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
