// itemEvaluationController.js
// All evaluation tables following the exact PDF structure:
// 4.1 Bid Opening → 5.1 Preliminary Exam → 6.1 Clarifications →
// 7.1 Technical Departures → 8.1 Financial Evaluation → 8.1.1 Post-Qualification →
// 9.1 Contract Award Recommendation → Technical Spec Compliance → Summary Report

const { query, getClient } = require('../config/database');
const logger = require('../utils/logger');

// ── helpers ──────────────────────────────────────────────────────────────────

const getAcceptedBidders = (itemId) =>
  query(`SELECT b.*, ta.accepted FROM table51_acceptance ta
         JOIN bidders b ON ta.bidder_id = b.id
         WHERE ta.item_id=$1 AND ta.accepted=true`, [itemId]);

const getNonRejectedIds = async (itemId, acceptedIds) => {
  if (!acceptedIds.length) return [];
  const rej = await query(
    `SELECT DISTINCT bidder_id FROM table7_rows WHERE item_id=$1 AND bid_rejected=true`, [itemId]
  );
  const rejSet = new Set(rej.rows.map(r => r.bidder_id));
  return acceptedIds.filter(id => !rejSet.has(id));
};

const getFailedCriteria = async (itemId, bidderId) => {
  const r = await query(
    `SELECT field_label, values FROM table51_rows WHERE item_id=$1 ORDER BY sort_order`,
    [itemId]
  );
  const failed = [];
  for (const row of r.rows) {
    const v = (row.values || {})[bidderId];
    if (v === undefined || v === null || v === '') continue;
    const sv = String(v).trim().toLowerCase();
    if (sv === 'no' || sv === 'false' || sv === 'not complied' || sv === '0') {
      failed.push(row.field_label);
    }
  }
  return failed.length ? failed.join('; ') : 'See Preliminary Examination (5.1)';
};

// ── TABLE 4.1 ─────────────────────────────────────────────────────────────────

exports.getTable41 = async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM table41_rows WHERE item_id=$1 ORDER BY sort_order, bidder_no NULLS LAST, created_at`,
      [req.params.itemId]
    );
    res.json({ success: true, data: rows.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addTable41Row = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { bidder_id, bidder_no, bidder_name, address, readout_price, currency, remarks } = req.body;
    if (!bidder_name && !bidder_id) return res.status(400).json({ success: false, message: 'Bidder required' });

    const itemRes = await query(`SELECT project_id FROM items WHERE id=$1`, [itemId]);
    if (!itemRes.rows.length) return res.status(404).json({ success: false, message: 'Item not found' });
    let bidder = null;
    if (bidder_id) {
      const bidderRes = await query(`SELECT * FROM bidders WHERE id=$1 AND project_id=$2`, [bidder_id, itemRes.rows[0].project_id]);
      if (!bidderRes.rows.length) return res.status(400).json({ success: false, message: 'Bidder does not belong to this tender' });
      bidder = bidderRes.rows[0];
    }

    let itemBidderId = null;
    if (bidder) {
      const link = await query(
        `INSERT INTO item_bidders (item_id, bidder_id, bidder_no, readout_price, remarks)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (item_id, bidder_id) DO UPDATE SET
           bidder_no=COALESCE(EXCLUDED.bidder_no,item_bidders.bidder_no),
           readout_price=COALESCE(EXCLUDED.readout_price,item_bidders.readout_price),
           remarks=COALESCE(EXCLUDED.remarks,item_bidders.remarks)
         RETURNING id`,
        [itemId, bidder.id, bidder_no || null, readout_price || null, remarks || null]
      );
      itemBidderId = link.rows[0].id;
      const existingRow = await query(`SELECT * FROM table41_rows WHERE item_id=$1 AND item_bidder_id=$2 LIMIT 1`, [itemId, itemBidderId]);
      if (existingRow.rows.length) {
        const updated = await query(
          `UPDATE table41_rows SET bidder_no=COALESCE($3,bidder_no), address=COALESCE($4,address),
             readout_price=COALESCE($5,readout_price), currency=$6, remarks=COALESCE($7,remarks), updated_at=NOW()
           WHERE id=$1 AND item_id=$2 RETURNING *`,
          [existingRow.rows[0].id, itemId, bidder_no || null, address || bidder.address || null,
           readout_price || null, currency || 'LKR', remarks || null]
        );
        return res.json({ success: true, data: updated.rows[0], existing: true });
      }
    }

    const countRes = await query(`SELECT COUNT(*) FROM table41_rows WHERE item_id=$1`, [itemId]);
    const no = bidder_no || parseInt(countRes.rows[0].count) + 1;

    const result = await query(
      `INSERT INTO table41_rows (item_id, item_bidder_id, bidder_no, bidder_name, address, readout_price, currency, remarks, is_manual_addition, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$3) RETURNING *`,
      [itemId, itemBidderId, no, (bidder?.name || bidder_name).trim(), address || bidder?.address || null,
       readout_price || null, currency || 'LKR', remarks || null]
    );

    if (itemRes.rows.length) {
      const existing = await query(
        `SELECT id FROM bidders WHERE project_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1`,
        [itemRes.rows[0].project_id, bidder?.name || bidder_name]
      );
      let bidderId;
      if (existing.rows.length) {
        bidderId = existing.rows[0].id;
      } else {
        const nb = await query(
          `INSERT INTO bidders (project_id, name, address, bid_price) VALUES ($1,$2,$3,$4) RETURNING id`,
          [itemRes.rows[0].project_id, (bidder_name || bidder.name).trim(), address || bidder?.address || null, readout_price || null]
        );
        bidderId = nb.rows[0].id;
      }
      await query(
        `INSERT INTO table51_acceptance (item_id, bidder_id, accepted) VALUES ($1,$2,true) ON CONFLICT DO NOTHING`,
        [itemId, bidderId]
      );
    }
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('addTable41Row', { err: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateTable41Row = async (req, res) => {
  try {
    const { id } = req.params;
    const { bidder_no, bidder_name, address, readout_price, currency, remarks } = req.body;
    const r = await query(
      `UPDATE table41_rows SET bidder_no=$1, bidder_name=$2, address=$3, readout_price=$4, currency=$5, remarks=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [bidder_no, bidder_name, address, readout_price, currency || 'LKR', remarks, id]
    );
    res.json({ success: true, data: r.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteTable41Row = async (req, res) => {
  try {
    await query(`DELETE FROM table41_rows WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── TABLE 5.1 ─────────────────────────────────────────────────────────────────

exports.getTable51 = async (req, res) => {
  try {
    const { itemId } = req.params;
    const [rows, acc] = await Promise.all([
      query(`SELECT * FROM table51_rows WHERE item_id=$1 ORDER BY sort_order`, [itemId]),
      query(`SELECT ta.*, b.name as bidder_name, b.id as bidder_id FROM table51_acceptance ta
             JOIN bidders b ON ta.bidder_id=b.id WHERE ta.item_id=$1`, [itemId]),
    ]);
    res.json({ success: true, data: { rows: rows.rows, acceptance: acc.rows } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateTable51Cell = async (req, res) => {
  try {
    const { rowId } = req.params;
    const { bidder_id, value } = req.body;
    await query(
      `UPDATE table51_rows SET values=jsonb_set(COALESCE(values,'{}'),$1,$2::jsonb,true), updated_at=NOW() WHERE id=$3`,
      [`{${bidder_id}}`, JSON.stringify(value), rowId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addTable51CustomRow = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { field_label, field_type } = req.body;
    if (!field_label) return res.status(400).json({ success: false, message: 'Label required' });
    const fieldKey = `custom_${Date.now()}_${field_label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const m = await query(`SELECT MAX(sort_order) as m FROM table51_rows WHERE item_id=$1`, [itemId]);
    const order = (parseInt(m.rows[0].m) || 0) + 1;
    const r = await query(
      `INSERT INTO table51_rows (item_id, field_key, field_label, field_type, is_system, sort_order)
       VALUES ($1,$2,$3,$4,false,$5) RETURNING *`,
      [itemId, fieldKey, field_label.trim(), field_type || 'text', order]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteTable51Row = async (req, res) => {
  try {
    const row = await query(`SELECT is_system FROM table51_rows WHERE id=$1`, [req.params.id]);
    if (row.rows[0]?.is_system) return res.status(400).json({ success: false, message: 'Cannot delete system rows' });
    await query(`DELETE FROM table51_rows WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.setTable51Acceptance = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { bidder_id, accepted, reason } = req.body;
    await query(
      `INSERT INTO table51_acceptance (item_id, bidder_id, accepted, reason, updated_at) VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (item_id, bidder_id) DO UPDATE SET accepted=$3, reason=$4, updated_at=NOW()`,
      [itemId, bidder_id, accepted, reason || null]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── TECHNICAL SPEC ────────────────────────────────────────────────────────────

exports.getTechSpec = async (req, res) => {
  try {
    const { itemId } = req.params;
    const [rows, bidders] = await Promise.all([
      query(`SELECT * FROM technical_spec_rows WHERE item_id=$1 ORDER BY sort_order`, [itemId]),
      query(`SELECT ta.*, b.name as bidder_name FROM table51_acceptance ta
             JOIN bidders b ON ta.bidder_id=b.id WHERE ta.item_id=$1`, [itemId]),
    ]);
    res.json({ success: true, data: { rows: rows.rows, bidders: bidders.rows } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addTechSpecRow = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { feature, requirement } = req.body;
    if (!feature) return res.status(400).json({ success: false, message: 'Feature required' });
    const m = await query(`SELECT MAX(sort_order) as m FROM technical_spec_rows WHERE item_id=$1`, [itemId]);
    const order = (parseInt(m.rows[0].m) || 0) + 1;
    const r = await query(
      `INSERT INTO technical_spec_rows (item_id, feature, requirement, sort_order) VALUES ($1,$2,$3,$4) RETURNING *`,
      [itemId, feature.trim(), requirement || null, order]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateTechSpecCell = async (req, res) => {
  try {
    const { rowId } = req.params;
    const { bidder_id, value } = req.body;
    await query(
      `UPDATE technical_spec_rows SET values=jsonb_set(COALESCE(values,'{}'),$1,$2::jsonb,true), updated_at=NOW() WHERE id=$3`,
      [`{${bidder_id}}`, JSON.stringify(value), rowId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteTechSpecRow = async (req, res) => {
  try {
    await query(`DELETE FROM technical_spec_rows WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── TABLE 6.1 ─────────────────────────────────────────────────────────────────

exports.getTable6 = async (req, res) => {
  try {
    const { itemId } = req.params;
    const [rows, accepted] = await Promise.all([
      query(`SELECT t6.*, b.name as bidder_name FROM table6_rows t6
             LEFT JOIN bidders b ON t6.bidder_id=b.id WHERE t6.item_id=$1 ORDER BY t6.sort_order`, [itemId]),
      getAcceptedBidders(itemId),
    ]);
    res.json({ success: true, data: { rows: rows.rows, responsive_bidders: accepted.rows } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addTable6Row = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { bidder_id, subject, query_text, response_text, custom_fields } = req.body;
    const c = await query(`SELECT COUNT(*) FROM table6_rows WHERE item_id=$1`, [itemId]);
    const no = parseInt(c.rows[0].count) + 1;
    const r = await query(
      `INSERT INTO table6_rows (item_id, bidder_id, clarification_no, subject, query_text, response_text, custom_fields, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$3) RETURNING *`,
      [itemId, bidder_id || null, no, subject || null, query_text || null, response_text || null, JSON.stringify(custom_fields || {})]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateTable6Row = async (req, res) => {
  try {
    const { id } = req.params;
    const { bidder_id, subject, query_text, response_text, custom_fields } = req.body;
    const r = await query(
      `UPDATE table6_rows SET bidder_id=$1, subject=$2, query_text=$3, response_text=$4, custom_fields=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [bidder_id, subject, query_text, response_text, JSON.stringify(custom_fields || {}), id]
    );
    res.json({ success: true, data: r.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteTable6Row = async (req, res) => {
  try {
    await query(`DELETE FROM table6_rows WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── TABLE 7.1 ─────────────────────────────────────────────────────────────────

exports.getTable7 = async (req, res) => {
  try {
    const { itemId } = req.params;
    const accepted = await query(
      `SELECT ta.*, b.name as bidder_name, b.id as bidder_id FROM table51_acceptance ta
       JOIN bidders b ON ta.bidder_id=b.id WHERE ta.item_id=$1`, [itemId]
    );
    const item = await query(`SELECT description FROM items WHERE id=$1`, [itemId]);

    await query(
      `DELETE FROM table7_rows
       WHERE item_id=$1
         AND is_auto_populated=true
         AND bidder_id NOT IN (
           SELECT bidder_id FROM table51_acceptance
           WHERE item_id=$1 AND accepted=false
         )`,
      [itemId]
    );

    for (const bidder of accepted.rows.filter(row => row.accepted === false)) {
      const failedCriteria = await getFailedCriteria(itemId, bidder.bidder_id);

      const existing = await query(
        `SELECT id FROM table7_rows WHERE item_id=$1 AND bidder_id=$2 LIMIT 1`,
        [itemId, bidder.bidder_id]
      );

      if (existing.rows.length) {
        await query(
          `UPDATE table7_rows SET requirement=$3, offered=$4, updated_at=NOW() WHERE id=$1 AND item_id=$2`,
          [existing.rows[0].id, itemId, failedCriteria, 'Not offered']
        );
      } else {
        await query(
          `INSERT INTO table7_rows (item_id, bidder_id, item_description, requirement, offered, bid_rejected, is_auto_populated, sort_order)
           VALUES ($1,$2,$3,$4,$5,true,true,
             COALESCE((SELECT MAX(sort_order) FROM table7_rows WHERE item_id=$1),0)+1)`,
          [itemId, bidder.bidder_id, item.rows[0]?.description || null, failedCriteria, 'Not offered']
        );
      }
    }

    const rows = await query(`SELECT t7.*, b.name as bidder_name FROM table7_rows t7
             LEFT JOIN bidders b ON t7.bidder_id=b.id WHERE t7.item_id=$1 ORDER BY t7.sort_order`, [itemId]);
    res.json({ success: true, data: { rows: rows.rows, responsive_bidders: accepted.rows } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addTable7Row = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { bidder_id, item_description, requirement, offered, bid_rejected, is_minor, loading_amount } = req.body;
    const c = await query(`SELECT COUNT(*) FROM table7_rows WHERE item_id=$1`, [itemId]);
    const r = await query(
      `INSERT INTO table7_rows (item_id, bidder_id, item_description, requirement, offered, bid_rejected, is_minor, is_auto_populated, loading_amount, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8,$9) RETURNING *`,
      [itemId, bidder_id || null, item_description || null, requirement || null, offered || null,
       bid_rejected || false, is_minor || false, loading_amount || 0, parseInt(c.rows[0].count) + 1]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateTable7Row = async (req, res) => {
  try {
    const { id } = req.params;
    const { bidder_id, item_description, requirement, offered, bid_rejected, is_minor, loading_amount } = req.body;
    const r = await query(
      `UPDATE table7_rows SET bidder_id=$1, item_description=$2, requirement=$3, offered=$4,
       bid_rejected=$5, is_minor=$6, loading_amount=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,
      [bidder_id, item_description, requirement, offered, bid_rejected || false, is_minor || false, loading_amount || 0, id]
    );
    res.json({ success: true, data: r.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteTable7Row = async (req, res) => {
  try {
    await query(`DELETE FROM table7_rows WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── TABLE 8.1 ─────────────────────────────────────────────────────────────────

exports.getTable81 = async (req, res) => {
  try {
    const { itemId } = req.params;
    const acc = await getAcceptedBidders(itemId);
    const validIds = await getNonRejectedIds(itemId, acc.rows.map(b => b.id));
    await query(
      `INSERT INTO table81_rows (item_id, bidder_id, bid_price, quantity)
       SELECT $1, a.bidder_id, t.readout_price, i.quantity
       FROM table51_acceptance a
       JOIN items i ON i.id=$1
       LEFT JOIN LATERAL (
         SELECT tr.readout_price
         FROM table41_rows tr
         LEFT JOIN item_bidders ib ON ib.id=tr.item_bidder_id
         WHERE tr.item_id=$1 AND (ib.bidder_id=a.bidder_id OR LOWER(tr.bidder_name)=LOWER((SELECT name FROM bidders WHERE id=a.bidder_id)))
         ORDER BY tr.sort_order LIMIT 1
       ) t ON true
       WHERE a.item_id=$1 AND a.accepted=true
       ON CONFLICT (item_id, bidder_id) DO NOTHING`,
      [itemId]
    );
    const rows = await query(
      `SELECT t.*, b.name as bidder_name,
         COALESCE((SELECT tr.bidder_no FROM table41_rows tr WHERE tr.item_id=t.item_id AND tr.item_bidder_id IN
           (SELECT ib.id FROM item_bidders ib WHERE ib.item_id=t.item_id AND ib.bidder_id=t.bidder_id) LIMIT 1), t.rank) as bidder_no
       FROM table81_rows t
       JOIN bidders b ON t.bidder_id=b.id WHERE t.item_id=$1
       ORDER BY t.evaluated_bid_price ASC NULLS LAST`, [itemId]
    );
    const ranked = rows.rows.map(r => ({ ...r, rank: null }));
    let rank = 1;
    ranked
      .filter(row => validIds.includes(row.bidder_id))
      .sort((a, b) => Number(a.evaluated_bid_price || 0) - Number(b.evaluated_bid_price || 0))
      .forEach(row => { row.rank = rank++; });
    const ordered = [
      ...ranked.filter(row => validIds.includes(row.bidder_id)).sort((a, b) => (a.rank || 0) - (b.rank || 0)),
      ...ranked.filter(row => !validIds.includes(row.bidder_id)),
    ];
    res.json({ success: true, data: { rows: ordered, valid_bidder_ids: validIds } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.upsertTable81Row = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { bidder_id, bid_price, arithmetic_errors, discounts, additions_omissions, quantity } = req.body;
    const bp = parseFloat(bid_price) || 0;
    const ae = parseFloat(arithmetic_errors) || 0;
    const disc = parseFloat(discounts) || 0;
    const ao = parseFloat(additions_omissions) || 0;
    const qty = parseFloat(quantity) || 1;
    const evaluated = bp + ae - disc + ao;
    const old = await query(`SELECT * FROM table81_rows WHERE item_id=$1 AND bidder_id=$2`, [itemId, bidder_id]);
    const context = await query(`SELECT i.project_id, i.quantity, p.estimated_amount FROM items i JOIN projects p ON p.id=i.project_id WHERE i.id=$1`, [itemId]);
    const estimatedAmount = Number(context.rows[0]?.estimated_amount || 0);
    const complianceWarnings = estimatedAmount > 0 && evaluated > estimatedAmount
      ? [`Evaluated bid price exceeds the tender pre-bid estimate of ${estimatedAmount}`]
      : [];

    const r = await query(
      `INSERT INTO table81_rows (item_id, bidder_id, bid_price, arithmetic_errors, discounts, additions_omissions, evaluated_bid_price, quantity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (item_id, bidder_id) DO UPDATE SET
         bid_price=$3, arithmetic_errors=$4, discounts=$5, additions_omissions=$6,
         evaluated_bid_price=$7, quantity=$8, updated_at=NOW()
       RETURNING *`,
      [itemId, bidder_id, bp, ae, disc, ao, evaluated, qty]
    );
    await query(
      `INSERT INTO item_revisions (item_id, entity_type, entity_id, changed_by, old_values, new_values)
       VALUES ($1,'financial_evaluation',$2,$3,$4,$5)`,
      [itemId, r.rows[0].id, req.user.id, JSON.stringify(old.rows[0] || null), JSON.stringify(r.rows[0])]
    );
    await query(
      `INSERT INTO audit_logs (user_id, project_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1,$2,'financial_evaluation_updated','table81',$3,$4,$5,$6,$7)`,
      [req.user.id, context.rows[0]?.project_id, r.rows[0].id, JSON.stringify(old.rows[0] || null), JSON.stringify(r.rows[0]), req.ip, req.get('user-agent')]
    );

    await query(
      `WITH ranked AS (
         SELECT t.id, ROW_NUMBER() OVER (ORDER BY t.evaluated_bid_price ASC NULLS LAST) as rn
         FROM table81_rows t
         WHERE t.item_id=$1
           AND EXISTS (SELECT 1 FROM table51_acceptance a WHERE a.item_id=t.item_id AND a.bidder_id=t.bidder_id AND a.accepted=true)
           AND NOT EXISTS (SELECT 1 FROM table7_rows d WHERE d.item_id=t.item_id AND d.bidder_id=t.bidder_id AND d.bid_rejected=true)
       )
       UPDATE table81_rows t SET rank=r.rn FROM ranked r WHERE t.id=r.id`,
      [itemId]
    );

    const rank1 = await query(
      `SELECT t.*, b.name as bidder_name FROM table81_rows t JOIN bidders b ON t.bidder_id=b.id
       WHERE t.item_id=$1
         AND EXISTS (SELECT 1 FROM table51_acceptance a WHERE a.item_id=t.item_id AND a.bidder_id=t.bidder_id AND a.accepted=true)
         AND NOT EXISTS (SELECT 1 FROM table7_rows d WHERE d.item_id=t.item_id AND d.bidder_id=t.bidder_id AND d.bid_rejected=true)
       ORDER BY t.evaluated_bid_price ASC NULLS LAST LIMIT 1`, [itemId]
    );
    if (rank1.rows.length) {
      const bId = rank1.rows[0].bidder_id;
      const defaults = [
        'Submit evidence of status, obligations, power of attorney and authorization to bid on behalf of the manufacturer.',
        'Technical Capacity: Previous experience of at least 3–10 years in relevant industry; list of major clients for last three years.',
        'Financial capability: Last three years audited financial accounts.',
      ];
      for (let i = 0; i < defaults.length; i++) {
        await query(
          `INSERT INTO table811_rows (item_id, bidder_id, criteria_label, sort_order)
           VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
          [itemId, bId, defaults[i], i + 1]
        );
      }
    }

    res.json({ success: true, data: r.rows[0], compliance_warnings: complianceWarnings });
  } catch (err) {
    logger.error('upsertTable81Row', { err: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── TABLE 8.1.1 ───────────────────────────────────────────────────────────────

exports.getTable811 = async (req, res) => {
  try {
    const rows = await query(
      `SELECT t.*, b.name as bidder_name FROM table811_rows t
       LEFT JOIN bidders b ON t.bidder_id=b.id WHERE t.item_id=$1 ORDER BY t.sort_order`,
      [req.params.itemId]
    );
    res.json({ success: true, data: rows.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addTable811Row = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { criteria_label, bidder_id } = req.body;
    const m = await query(`SELECT MAX(sort_order) as m FROM table811_rows WHERE item_id=$1`, [itemId]);
    const r = await query(
      `INSERT INTO table811_rows (item_id, bidder_id, criteria_label, sort_order) VALUES ($1,$2,$3,$4) RETURNING *`,
      [itemId, bidder_id || null, criteria_label, (parseInt(m.rows[0].m) || 0) + 1]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateTable811Row = async (req, res) => {
  try {
    const { id } = req.params;
    const { complied, accepted, notes } = req.body;
    const r = await query(
      `UPDATE table811_rows SET complied=$1, accepted=$2, notes=$3, updated_at=NOW() WHERE id=$4 RETURNING *`,
      [complied, accepted, notes || null, id]
    );
    res.json({ success: true, data: r.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── 9.1 CONTRACT AWARD RECOMMENDATION ────────────────────────────────────────

exports.getContractAward = async (req, res) => {
  try {
    const { itemId } = req.params;

    const saved = await query(
      `SELECT c.*, COALESCE(c.address, b.address) as bidder_address, b.name as bidder_name
       FROM contract_award_recommendations c
       LEFT JOIN bidders b ON c.bidder_id=b.id
       WHERE c.item_id=$1`,
      [itemId]
    );

    const biRes = await query(
      `SELECT
         b.id           AS bidder_id,
         b.name         AS bidder_name,
         b.address      AS bidder_address,
         ib.brand_model AS offered_brand,
         ib.warranty    AS warranty,
         COALESCE(t81.evaluated_bid_price, t81.bid_price, b.bid_price) AS evaluated_bid_price,
         COALESCE(t81.quantity, i.quantity, 1) AS evaluated_quantity,
         t81.rank       AS evaluated_rank,
         t81.bid_price  AS table81_bid_price
       FROM bidders b
       JOIN items i ON i.id = $1
       LEFT JOIN item_bidders ib
         ON ib.item_id = $1 AND ib.bidder_id = b.id
       LEFT JOIN table81_rows t81
         ON t81.item_id = $1 AND t81.bidder_id = b.id
       WHERE b.id IN (
         SELECT bidder_id FROM table51_acceptance WHERE item_id=$1
         UNION
         SELECT bidder_id FROM item_bidders      WHERE item_id=$1
         UNION
         SELECT bidder_id FROM table81_rows      WHERE item_id=$1
         UNION
         SELECT b2.id FROM table41_rows t41
           JOIN bidders b2 ON LOWER(b2.name) = LOWER(t41.bidder_name)
           WHERE t41.item_id = $1
       )
       ORDER BY t81.rank ASC NULLS LAST, b.name`,
      [itemId]
    );

    res.json({
      success: true,
      data: {
        award: saved.rows[0] || null,
        bidder_info: biRes.rows,
      },
    });
  } catch (err) {
    logger.error('getContractAward', { err: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.upsertContractAward = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { bidder_id, address, contract_amount, brand_model, warranty, rejection_reasons, comments, signatures, award_date } = req.body;
    const previous = await query(`SELECT * FROM contract_award_recommendations WHERE item_id=$1`, [itemId]);
    const r = await query(
      `INSERT INTO contract_award_recommendations (item_id, bidder_id, address, contract_amount, brand_model, warranty, rejection_reasons, comments, signatures, award_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (item_id) DO UPDATE SET
         bidder_id=$2, address=$3, contract_amount=$4, brand_model=$5, warranty=$6,
         rejection_reasons=$7, comments=$8, signatures=$9, award_date=$10, updated_at=NOW()
       RETURNING *`,
      [itemId, bidder_id || null, address || null, contract_amount || null, brand_model || null,
       warranty || null, JSON.stringify(rejection_reasons || []), comments || null,
       JSON.stringify(signatures || []), award_date || null]
    );
    const item = await query(`SELECT project_id FROM items WHERE id=$1`, [itemId]);
    await query(
      `INSERT INTO audit_logs (user_id, project_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1,$2,'contract_award_signed','contract_award',$3,$4,$5,$6,$7)`,
      [req.user.id, item.rows[0]?.project_id, r.rows[0].id, JSON.stringify(previous.rows[0] || null), JSON.stringify(r.rows[0]), req.ip, req.get('user-agent')]
    );
    res.json({ success: true, data: r.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getSummaryReport = async (req, res) => {
  try {
    const { itemId } = req.params;

    const itemRes = await query(
      `SELECT i.id, i.work_package_id, i.pre_bid_estimate,
              wp.name AS work_package_name,
              p.title AS project_title,
              p.source_of_financing,
              p.estimated_amount,
              p.procurement_method,
              p.department
       FROM items i
       LEFT JOIN work_packages wp ON i.work_package_id = wp.id
       LEFT JOIN projects p ON i.project_id = p.id
       WHERE i.id = $1`,
      [itemId]
    );
    if (!itemRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    const row = itemRes.rows[0];

    // Per-item override (only title and financing now)
    const ovRes = await query(
      `SELECT * FROM item_summary_overrides WHERE item_id = $1`, [itemId]
    );
    const override = ovRes.rows[0] || {};

    // Count of distinct bidders in this work package (fallback: item-level)
    let bidderCount = 0;
    try {
      const cntRes = row.work_package_id
        ? await query(
            `SELECT COUNT(DISTINCT ib.bidder_id) AS cnt
             FROM item_bidders ib
             JOIN items i ON i.id = ib.item_id
             WHERE i.work_package_id = $1`,
            [row.work_package_id]
          )
        : await query(
            `SELECT COUNT(DISTINCT bidder_id) AS cnt
             FROM item_bidders WHERE item_id = $1`,
            [itemId]
          );
      bidderCount = parseInt(cntRes.rows[0]?.cnt || 0);
    } catch (e) {
      logger.warn('getSummaryReport bidder count failed', { err: e.message });
    }

    // Pre-bid estimate: item's value first, fallback to project's estimated_amount
    const preBid = row.pre_bid_estimate != null ? row.pre_bid_estimate : row.estimated_amount;

    res.json({
      success: true,
      data: {
        project: {
          title: row.project_title,
          source_of_financing: row.source_of_financing,
          procurement_method: row.procurement_method,
          department: row.department,
          work_package_name: row.work_package_name,
        },
        override: {
          procurement_title: override.procurement_title ?? null,
          source_of_financing: override.source_of_financing ?? null,
        },
        pre_bid_estimate: preBid,
        bidding_docs_issued: bidderCount,
      },
    });
  } catch (err) {
    logger.error('getSummaryReport', { err: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.upsertSummaryReport = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { procurement_title, source_of_financing } = req.body;

    await query(
      `INSERT INTO item_summary_overrides
         (item_id, procurement_title, source_of_financing, updated_at)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (item_id) DO UPDATE SET
         procurement_title   = EXCLUDED.procurement_title,
         source_of_financing = EXCLUDED.source_of_financing,
         updated_at          = NOW()`,
      [
        itemId,
        procurement_title || null,
        source_of_financing || null,
      ]
    );

    res.json({ success: true });
  } catch (err) {
    logger.error('upsertSummaryReport', { err: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};
// ── FULL ITEM DASHBOARD ───────────────────────────────────────────────────────

exports.getItemDashboard = async (req, res) => {
  try {
    const { itemId } = req.params;
    const itemRes = await query(
      `SELECT i.*, wp.name as work_package_name, wp.evaluator_id,
         u.first_name||' '||u.last_name as evaluator_name
       FROM items i
       LEFT JOIN work_packages wp ON i.work_package_id=wp.id
       LEFT JOIN users u ON wp.evaluator_id=u.id
       WHERE i.id=$1`, [itemId]
    );
    if (!itemRes.rows.length) return res.status(404).json({ success: false, message: 'Item not found' });

    const [t41, t51r, t51a, tspec, t6, t7, t81, t811, car] = await Promise.all([
      query(`SELECT * FROM table41_rows WHERE item_id=$1 ORDER BY sort_order, bidder_no NULLS LAST`, [itemId]),
      query(`SELECT * FROM table51_rows WHERE item_id=$1 ORDER BY sort_order`, [itemId]),
      query(`SELECT ta.*, b.name as bidder_name, b.id as bidder_id FROM table51_acceptance ta JOIN bidders b ON ta.bidder_id=b.id WHERE ta.item_id=$1`, [itemId]),
      query(`SELECT * FROM technical_spec_rows WHERE item_id=$1 ORDER BY sort_order`, [itemId]),
      query(`SELECT t6.*, b.name as bidder_name FROM table6_rows t6 LEFT JOIN bidders b ON t6.bidder_id=b.id WHERE t6.item_id=$1 ORDER BY t6.sort_order`, [itemId]),
      query(`SELECT t7.*, b.name as bidder_name FROM table7_rows t7 LEFT JOIN bidders b ON t7.bidder_id=b.id WHERE t7.item_id=$1 ORDER BY t7.sort_order`, [itemId]),
      query(`SELECT t.*, b.name as bidder_name FROM table81_rows t JOIN bidders b ON t.bidder_id=b.id WHERE t.item_id=$1 ORDER BY t.evaluated_bid_price ASC NULLS LAST`, [itemId]),
      query(`SELECT t.*, b.name as bidder_name FROM table811_rows t LEFT JOIN bidders b ON t.bidder_id=b.id WHERE t.item_id=$1 ORDER BY t.sort_order`, [itemId]),
      query(`SELECT c.*, b.name as bidder_name FROM contract_award_recommendations c LEFT JOIN bidders b ON c.bidder_id=b.id WHERE c.item_id=$1`, [itemId]),
    ]);

    res.json({
      success: true,
      data: {
        item: itemRes.rows[0],
        table41: t41.rows,
        table51: { rows: t51r.rows, acceptance: t51a.rows },
        techSpec: { rows: tspec.rows, bidders: t51a.rows },
        table6: t6.rows,
        table7: t7.rows,
        table81: t81.rows.map((r, i) => ({ ...r, rank: i + 1 })),
        table811: t811.rows,
        contractAward: car.rows[0] || null,
      }
    });
  } catch (err) {
    logger.error('getItemDashboard', { err: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};