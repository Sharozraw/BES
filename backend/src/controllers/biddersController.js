const { query } = require('../config/database');
const logger = require('../utils/logger');

exports.getByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await query(
      `SELECT b.*, 
        (SELECT COUNT(*) FROM documents WHERE bidder_id = b.id) as document_count
       FROM bidders b
       WHERE b.project_id = $1
       ORDER BY b.bid_price ASC NULLS LAST`,
      [projectId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, address, contact_person, email, phone, bid_price, currency, 
            bid_price_with_vat, registration_no, extracted_data } = req.body;

    const result = await query(
      `INSERT INTO bidders (project_id, name, address, contact_person, email, phone, 
        bid_price, currency, bid_price_with_vat, registration_no, extracted_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [projectId, name, address, contact_person, email, phone,
       bid_price, currency || 'LKR', bid_price_with_vat, registration_no,
       JSON.stringify(extracted_data || {})]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Create bidder error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, contact_person, email, phone, bid_price, currency, 
            bid_price_with_vat, registration_no, extracted_data } = req.body;

    const result = await query(
      `UPDATE bidders SET name=$1, address=$2, contact_person=$3, email=$4, phone=$5,
        bid_price=$6, currency=$7, bid_price_with_vat=$8, registration_no=$9,
        extracted_data=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [name, address, contact_person, email, phone, bid_price, currency,
       bid_price_with_vat, registration_no, JSON.stringify(extracted_data || {}), id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Bidder not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    await query(`DELETE FROM bidders WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Bidder removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getEvaluationSummary = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { stageId } = req.query;

    let sql = `
      SELECT b.id, b.name, b.bid_price, b.status,
        AVG(e.score) as avg_score,
        COUNT(DISTINCT e.evaluator_id) as evaluator_count,
        COUNT(CASE WHEN e.pass_fail = 'pass' THEN 1 END) as pass_count,
        COUNT(CASE WHEN e.pass_fail = 'fail' THEN 1 END) as fail_count,
        MIN(e.rank) as min_rank,
        COUNT(DISTINCT v.voter_id) FILTER (WHERE v.vote = 'approve') as approve_votes,
        COUNT(DISTINCT v.voter_id) FILTER (WHERE v.vote = 'reject') as reject_votes
      FROM bidders b
      LEFT JOIN evaluations e ON e.bidder_id = b.id ${stageId ? 'AND e.stage_id = $2' : ''}
      LEFT JOIN votes v ON v.bidder_id = b.id ${stageId ? 'AND v.stage_id = $2' : ''}
      WHERE b.project_id = $1
      GROUP BY b.id, b.name, b.bid_price, b.status
      ORDER BY avg_score DESC NULLS LAST, b.bid_price ASC
    `;

    const params = stageId ? [projectId, stageId] : [projectId];
    const result = await query(sql, params);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Evaluation summary error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
