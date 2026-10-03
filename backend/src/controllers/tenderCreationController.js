// backend/src/controllers/tenderCreationController.js
//
// Handles: global bidder pool, work packages, items, evaluator assignment,
// and file-import triggers at all three scopes.

const { query, getClient } = require('../config/database');
const logger = require('../utils/logger');
const DataImportService = require('../services/DataImportService');

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL BIDDER POOL (project level)
// ─────────────────────────────────────────────────────────────────────────────

exports.getGlobalBidders = async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await query(
      `SELECT b.*,
         (SELECT json_agg(DISTINCT i.id) FROM item_bidders ib JOIN items i ON ib.item_id=i.id
          WHERE ib.bidder_id = b.id AND i.project_id = $1) as item_ids
       FROM bidders b
       WHERE b.project_id = $1
       ORDER BY b.created_at`,
      [projectId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('getGlobalBidders', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createGlobalBidder = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, address, email, phone, registration_no, item_ids } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const bRes = await client.query(
        `INSERT INTO bidders (project_id, name, address, email, phone, registration_no, status)
         VALUES ($1,$2,$3,$4,$5,$6,'active') RETURNING *`,
        [projectId, name.trim(), address || null, email || null, phone || null, registration_no || null]
      );
      const bidder = bRes.rows[0];

      // Map to selected items
      if (item_ids && item_ids.length) {
        for (let i = 0; i < item_ids.length; i++) {
          const itemId = item_ids[i];
          const countRes = await client.query(
            `SELECT COUNT(*) FROM item_bidders WHERE item_id=$1`, [itemId]
          );
          const no = parseInt(countRes.rows[0].count) + 1;

          await client.query(
            `INSERT INTO item_bidders (item_id, bidder_id, bidder_no)
             VALUES ($1,$2,$3) ON CONFLICT (item_id, bidder_id) DO NOTHING`,
            [itemId, bidder.id, no]
          );
          // Seed Table 4.1 row
          await client.query(
            `INSERT INTO table41_rows (item_id, item_bidder_id, bidder_no, bidder_name, address, sort_order)
             SELECT $1, ib.id, $2, $3, $4, $2
             FROM item_bidders ib
             WHERE ib.item_id=$1 AND ib.bidder_id=$5
               AND NOT EXISTS (SELECT 1 FROM table41_rows WHERE item_id=$1 AND item_bidder_id=ib.id)`,
            [itemId, no, bidder.name, bidder.address, bidder.id]
          );
          // Seed 5.1 acceptance
          await client.query(
            `INSERT INTO table51_acceptance (item_id, bidder_id, accepted)
             VALUES ($1,$2,true) ON CONFLICT DO NOTHING`,
            [itemId, bidder.id]
          );
        }
      }

      await client.query('COMMIT');
      res.status(201).json({ success: true, data: bidder });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('createGlobalBidder', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// WORK PACKAGES
// ─────────────────────────────────────────────────────────────────────────────

exports.getWorkPackages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await query(
      `SELECT wp.*,
         u.first_name || ' ' || u.last_name as evaluator_name,
         (SELECT COUNT(*) FROM items WHERE work_package_id = wp.id) as item_count
       FROM work_packages wp
       LEFT JOIN users u ON wp.evaluator_id = u.id
       WHERE wp.project_id = $1
         AND ($2 = 'admin' OR wp.evaluator_id = $3 OR EXISTS (
          SELECT 1 FROM project_evaluators pe WHERE pe.project_id=wp.project_id AND pe.user_id=$3
        ) OR EXISTS (
          SELECT 1 FROM items i WHERE i.work_package_id=wp.id AND i.evaluator_id=$3
        ))
       ORDER BY wp.sort_order, wp.created_at`,
      [projectId, req.user.role_name, req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('getWorkPackages', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createWorkPackage = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description, evaluator_id } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });

    // Fallback: if no evaluator assigned, use current admin
    const effectiveEvaluator = evaluator_id || req.user.id;

    const result = await query(
      `INSERT INTO work_packages (project_id, name, description, evaluator_id, source)
       VALUES ($1,$2,$3,$4,'manual') RETURNING *`,
      [projectId, name.trim(), description || null, effectiveEvaluator]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('createWorkPackage', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateWorkPackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, evaluator_id } = req.body;
    const result = await query(
      `UPDATE work_packages SET name=$1, description=$2, evaluator_id=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [name, description || null, evaluator_id || null, id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteWorkPackage = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const docs = await client.query(`SELECT file_path FROM documents WHERE target_work_package_id=$1`, [req.params.id]);
    const result = await client.query(`DELETE FROM work_packages WHERE id=$1 RETURNING id`, [req.params.id]);
    if (!result.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Work package not found' }); }
    await client.query(`DELETE FROM documents WHERE target_work_package_id=$1`, [req.params.id]);
    await client.query('COMMIT');
    const fs = require('fs');
    docs.rows.forEach(doc => { if (doc.file_path) fs.rmSync(doc.file_path, { force: true }); });
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: 'Server error' });
  } finally { client.release(); }
};

// File import at Work Package level
exports.importWorkPackageFile = async (req, res) => {
  try {
    const { projectId, wpId } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: 'No file' });
    const docRes = await query(
      `INSERT INTO documents (project_id, uploaded_by, file_name, original_name, file_path, file_size, mime_type, document_type, target_work_package_id, extraction_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'work_package_import',$8,'pending') RETURNING id`,
      [projectId, req.user.id, req.file.filename, req.file.originalname, req.file.path, req.file.size, req.file.mimetype, wpId]
    );
    const sourceDocumentId = docRes.rows[0].id;
    const result = await DataImportService.importWorkPackageFile(
      projectId, wpId, req.file.path, req.user.id, sourceDocumentId
    );
    await query(`UPDATE documents SET extraction_status=$1 WHERE id=$2`, [result.success ? 'completed' : 'failed', sourceDocumentId]);
    if (!result.success) return res.status(422).json({ success: false, message: result.error, summary: result.summary });
    res.json({ success: true, documentId: sourceDocumentId, summary: result.summary });
  } catch (err) {
    logger.error('importWorkPackageFile', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ITEMS
// ─────────────────────────────────────────────────────────────────────────────

exports.getItems = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { workPackageId } = req.query;

    let sql = `
      SELECT i.*,
        wp.name as work_package_name,
        (SELECT COUNT(*) FROM item_bidders WHERE item_id = i.id) as bidder_count
      FROM items i
      LEFT JOIN work_packages wp ON i.work_package_id = wp.id
      WHERE i.project_id = $1
          AND ($2 = 'admin' OR i.evaluator_id=$3 OR wp.evaluator_id=$3 OR EXISTS (
            SELECT 1 FROM project_evaluators pe WHERE pe.project_id=i.project_id AND pe.user_id=$3
          ))
    `;
    const params = [projectId, req.user.role_name, req.user.id];
    if (workPackageId) {
      sql += ` AND i.work_package_id = $4`;
      params.push(workPackageId);
    }
    sql += ` ORDER BY i.sort_order, i.created_at`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('getItems', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT i.*, wp.name as work_package_name, i.evaluator_id,
         COALESCE(i.evaluator_id, wp.evaluator_id, p.created_by) as effective_evaluator_id,
         u.first_name || ' ' || u.last_name as evaluator_name
       FROM items i
       LEFT JOIN work_packages wp ON i.work_package_id = wp.id
       JOIN projects p ON p.id=i.project_id
       LEFT JOIN users u ON u.id=COALESCE(i.evaluator_id, wp.evaluator_id, p.created_by)
       WHERE i.id = $1`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createItem = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { work_package_id, item_no, description, unit, quantity, evaluator_id } = req.body;
    if (!description) return res.status(400).json({ success: false, message: 'Description required' });

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO items (project_id, work_package_id, item_no, description, unit, quantity, evaluator_id, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'manual') RETURNING *`,
        [projectId, work_package_id || null, item_no || null, description.trim(), unit || null, quantity || null, evaluator_id || null]
      );
      const item = result.rows[0];
      // Seed system 5.1 rows immediately
      const systemRows = [
        { key: 'form_signed', label: 'Form of Bid Filled & Signed', type: 'yesno', order: 1 },
        { key: 'manufacturer_auth', label: 'Manufacturer Authorization', type: 'yesno', order: 2 },
        { key: 'bid_security', label: 'Bid Security Submitted', type: 'yesno', order: 3 },
        { key: 'bid_security_days', label: 'Bid Security Validity (Days)', type: 'number', order: 4 },
        { key: 'business_registration', label: 'Business Registration Submitted', type: 'yesno', order: 5 },
        { key: 'substantial_responsiveness', label: 'Substantial Responsiveness', type: 'yesno', order: 6 },
      ];
      for (const r of systemRows) {
        await client.query(
          `INSERT INTO table51_rows (item_id, field_key, field_label, field_type, is_system, sort_order)
           VALUES ($1,$2,$3,$4,true,$5) ON CONFLICT (item_id, field_key) DO NOTHING`,
          [item.id, r.key, r.label, r.type, r.order]
        );
      }
      await client.query('COMMIT');
      res.status(201).json({ success: true, data: item });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('createItem', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { item_no, description, unit, quantity, evaluator_id } = req.body;
    const result = await query(
      `UPDATE items SET item_no=$1, description=$2, unit=$3, quantity=$4, evaluator_id=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [item_no || null, description, unit || null, quantity || null, evaluator_id || null, id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteItem = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const docs = await client.query(`SELECT file_path FROM documents WHERE target_item_id=$1`, [req.params.id]);
    const result = await client.query(`DELETE FROM items WHERE id=$1 RETURNING id`, [req.params.id]);
    if (!result.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Item not found' }); }
    await client.query(`DELETE FROM documents WHERE target_item_id=$1`, [req.params.id]);
    await client.query('COMMIT');
    const fs = require('fs');
    docs.rows.forEach(doc => { if (doc.file_path) fs.rmSync(doc.file_path, { force: true }); });
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: 'Server error' });
  } finally { client.release(); }
};

// File import at Item level
exports.importItemFile = async (req, res) => {
  try {
    const { projectId, itemId } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: 'No file' });
    const docRes = await query(
      `INSERT INTO documents (project_id, uploaded_by, file_name, original_name, file_path, file_size, mime_type, document_type, target_item_id, extraction_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'item_import',$8,'pending') RETURNING id`,
      [projectId, req.user.id, req.file.filename, req.file.originalname, req.file.path, req.file.size, req.file.mimetype, itemId]
    );
    const sourceDocumentId = docRes.rows[0].id;
    const result = await DataImportService.importItemFile(projectId, itemId, req.file.path, req.user.id, sourceDocumentId);
    await query(`UPDATE documents SET extraction_status=$1 WHERE id=$2`, [result.success ? 'completed' : 'failed', sourceDocumentId]);
    if (!result.success) return res.status(422).json({ success: false, message: result.error, summary: result.summary });
    res.json({ success: true, documentId: sourceDocumentId, summary: result.summary });
  } catch (err) {
    logger.error('importItemFile', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteImportFile = async (req, res) => {
  const client = await getClient();
  try {
    const { projectId, documentId } = req.params;
    await client.query('BEGIN');
    const doc = await client.query(
      `SELECT * FROM documents WHERE id=$1 AND project_id=$2 AND document_type IN ('tender_import','work_package_import','item_import') FOR UPDATE`,
      [documentId, projectId]
    );
    if (!doc.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Import file not found' });
    }

    const source = documentId;
    const workPackages = await client.query(`SELECT id FROM work_packages WHERE source_document_id=$1`, [source]);
    const items = await client.query(`SELECT id FROM items WHERE source_document_id=$1`, [source]);
    const legacyItems = doc.rows[0].target_item_id
      ? await client.query(
        `SELECT id FROM items WHERE id=$1 AND created_at >= $2`,
        [doc.rows[0].target_item_id, doc.rows[0].created_at]
      )
      : doc.rows[0].target_work_package_id
        ? await client.query(
          `SELECT id FROM items WHERE work_package_id=$1 AND created_at >= $2`,
          [doc.rows[0].target_work_package_id, doc.rows[0].created_at]
        )
        : { rows: [] };
    const allItemIds = [...new Set([...items.rows.map(row => row.id), ...legacyItems.rows.map(row => row.id)])];
    const itemIds = allItemIds;
    await client.query(`DELETE FROM table51_rows WHERE source_document_id=$1`, [source]);
    await client.query(`DELETE FROM table41_rows WHERE source_document_id=$1`, [source]);
    await client.query(`DELETE FROM table51_acceptance WHERE source_document_id=$1`, [source]);
    await client.query(`DELETE FROM item_bidders WHERE source_document_id=$1`, [source]);
    if (doc.rows[0].target_item_id) {
      await client.query(
        `DELETE FROM table41_rows WHERE item_id=$1 AND source_document_id IS NULL AND created_at >= $2`,
        [doc.rows[0].target_item_id, doc.rows[0].created_at]
      );
      await client.query(
        `DELETE FROM table51_acceptance WHERE item_id=$1 AND source_document_id IS NULL AND updated_at >= $2`,
        [doc.rows[0].target_item_id, doc.rows[0].created_at]
      );
      await client.query(
        `DELETE FROM item_bidders WHERE item_id=$1 AND source_document_id IS NULL AND created_at >= $2`,
        [doc.rows[0].target_item_id, doc.rows[0].created_at]
      );
    }
    if (itemIds.length) {
      await client.query(`DELETE FROM items WHERE id = ANY($1::uuid[])`, [itemIds]);
    }
    if (doc.rows[0].target_item_id) {
      await client.query(
        `DELETE FROM table51_rows WHERE item_id=$1 AND is_system=false AND source_document_id IS NULL AND created_at >= $2`,
        [doc.rows[0].target_item_id, doc.rows[0].created_at]
      );
    }
    if (workPackages.rows.length) {
      await client.query(
        `DELETE FROM work_packages wp WHERE wp.source_document_id=$1
         AND NOT EXISTS (SELECT 1 FROM items i WHERE i.work_package_id=wp.id)`, [source]
      );
    }
    await client.query(`DELETE FROM bidders WHERE source_document_id=$1 AND NOT EXISTS (SELECT 1 FROM item_bidders ib WHERE ib.bidder_id=bidders.id)`, [source]);
    await client.query(`DELETE FROM documents WHERE id=$1`, [source]);
    await client.query('COMMIT');
    const fs = require('fs');
    if (doc.rows[0].file_path) fs.rmSync(doc.rows[0].file_path, { force: true });
    res.json({ success: true, message: 'Imported data deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('deleteImportFile', { err: err.message, stack: err.stack });
    res.status(500).json({ success: false, message: `Failed to delete imported data: ${err.message}` });
  } finally { client.release(); }
};

// Global tender file import
exports.importTenderFile = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: 'No file' });

    // Save document record
    const docRes = await query(
      `INSERT INTO documents (project_id, uploaded_by, file_name, original_name, file_path,
         file_size, mime_type, document_type, extraction_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'tender_import','pending') RETURNING id`,
      [projectId, req.user.id, req.file.filename, req.file.originalname,
       req.file.path, req.file.size, req.file.mimetype]
    );
    const docId = docRes.rows[0].id;

    const result = await DataImportService.importTenderFile(projectId, req.file.path, req.user.id, docId);
    await query(
      `UPDATE documents SET extraction_status=$1 WHERE id=$2`,
      [result.success ? 'completed' : 'failed', docId]
    );

    if (!result.success) return res.status(422).json({ success: false, message: result.error, summary: result.summary });
    res.json({ success: true, summary: result.summary });
  } catch (err) {
    logger.error('importTenderFile', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Assign bidder to item (manual mapping)
exports.assignBidderToItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { bidder_id, readout_price, remarks } = req.body;

    const item = await query(`SELECT project_id FROM items WHERE id=$1`, [itemId]);
    if (!item.rows.length) return res.status(404).json({ success: false, message: 'Item not found' });

    const bidder = await query(
      `SELECT b.* FROM bidders b
       JOIN items i ON i.project_id=b.project_id
       WHERE b.id=$1 AND i.id=$2`,
      [bidder_id, itemId]
    );
    if (!bidder.rows.length) return res.status(404).json({ success: false, message: 'Bidder not found' });

    const countRes = await query(`SELECT COUNT(*) FROM item_bidders WHERE item_id=$1`, [itemId]);
    const bidderNo = parseInt(countRes.rows[0].count) + 1;

    const client = await getClient();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO item_bidders (item_id, bidder_id, bidder_no, readout_price, remarks)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (item_id, bidder_id) DO UPDATE
         SET readout_price=$4, remarks=$5`,
        [itemId, bidder_id, bidderNo, readout_price || null, remarks || null]
      );

      // Sync Table 4.1
      const jRes = await client.query(
        `SELECT id FROM item_bidders WHERE item_id=$1 AND bidder_id=$2`, [itemId, bidder_id]
      );
      const b = bidder.rows[0];
      await client.query(
        `INSERT INTO table41_rows (item_id, item_bidder_id, bidder_no, bidder_name, address, readout_price, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$3)
         ON CONFLICT DO NOTHING`,
        [itemId, jRes.rows[0].id, bidderNo, b.name, b.address, readout_price || null]
      );

      await client.query(
        `INSERT INTO table51_acceptance (item_id, bidder_id, accepted)
         VALUES ($1,$2,true) ON CONFLICT DO NOTHING`,
        [itemId, bidder_id]
      );

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('assignBidderToItem', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Begin Evaluation — switches item from 'creation' to 'evaluation'
exports.beginEvaluation = async (req, res) => {
  try {
    const { itemId } = req.params;
    const result = await query(
      `UPDATE items SET eval_status='evaluation', evaluation_step=0, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [itemId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.advanceEvaluationStep = async (req, res) => {
  try {
    const { itemId } = req.params;
    const currentStep = Number(req.body.current_step);
    if (!Number.isInteger(currentStep) || currentStep < 0) {
      return res.status(400).json({ success: false, message: 'Invalid evaluation step' });
    }
    const result = await query(
      `UPDATE items SET evaluation_step=evaluation_step + 1, updated_at=NOW()
       WHERE id=$1 AND eval_status='evaluation' AND evaluation_step=$2
       RETURNING *`,
      [itemId, currentStep]
    );
    if (!result.rows.length) {
      return res.status(409).json({ success: false, message: 'Evaluation step is no longer current' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('advanceEvaluationStep', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
