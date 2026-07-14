const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { query } = require('../config/database');
const logger = require('../utils/logger');

exports.upload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { projectId, bidderId, documentType } = req.body;
    const file = req.file;

    const result = await query(
      `INSERT INTO documents (project_id, bidder_id, uploaded_by, file_name, original_name, 
        file_path, file_size, mime_type, document_type, extraction_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending') RETURNING *`,
      [projectId, bidderId || null, req.user.id, file.filename, file.originalname,
       file.path, file.size, file.mimetype, documentType || 'bid_document']
    );

    const doc = result.rows[0];

    // Async PDF extraction
    if (file.mimetype === 'application/pdf') {
      extractPdfData(doc.id, file.path, projectId, bidderId).catch(err => {
        logger.error('PDF extraction failed', { err: err.message, docId: doc.id });
      });
    }

    res.status(201).json({ success: true, data: doc, message: 'File uploaded successfully' });
  } catch (err) {
    logger.error('Upload error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const extractPdfData = async (docId, filePath, projectId, bidderId) => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;

    const parsedData = parseNCBReport(text);

    await query(
      `UPDATE documents SET extracted_text=$1, parsed_data=$2, extraction_status='completed'
       WHERE id=$3`,
      [text, JSON.stringify(parsedData), docId]
    );

    // Auto-populate project/bidders if this is a TEC report
    if (parsedData.project && projectId) {
      await autoPopulateFromPDF(projectId, parsedData);
    }

    logger.info('PDF extracted successfully', { docId });
  } catch (err) {
    await query(
      `UPDATE documents SET extraction_status='failed' WHERE id=$1`,
      [docId]
    );
    throw err;
  }
};

const parseNCBReport = (text) => {
  const parsed = { project: {}, bidders: [], committee: [], items: [] };

  // Extract file number
  const fileNoMatch = text.match(/File\s*No[.:]?\s*([\w\/\-]+)/i);
  if (fileNoMatch) parsed.project.file_no = fileNoMatch[1];

  // Extract department
  const deptMatch = text.match(/Department\s+(.*?)(?:\n|Brief)/is);
  if (deptMatch) parsed.project.department = deptMatch[1].trim();

  // Extract estimated amount
  const amountMatch = text.match(/Estimated\s+Amount\s+Rs[.\s]*([\d,]+)/i);
  if (amountMatch) parsed.project.estimated_amount = parseFloat(amountMatch[1].replace(/,/g, ''));

  // Extract bid prices and bidder names
  const bidderPattern = /(\d+)\s+([\w\s().,']+(?:Ltd|PLC|Pvt\.?\s*Ltd|Solutions|Associates)?)\s+(?:No\.\s*[\d\w,.\s]+)\s+([\d,]+\.?\d*)/gi;
  let match;
  while ((match = bidderPattern.exec(text)) !== null) {
    const price = parseFloat(match[3].replace(/,/g, ''));
    if (price > 0 && price < 1000000000) {
      parsed.bidders.push({
        name: match[2].trim(),
        bid_price: price
      });
    }
  }

  // Extract invitation date
  const invMatch = text.match(/Date\s+of\s+Invitation\s+Letter[:\s]+([\d\/]+)/i);
  if (invMatch) parsed.project.invitation_date = invMatch[1];

  // Extract bid close date
  const closeMatch = text.match(/Date\s+and\s+time\s+of\s+bid\s+close\s+([\d\/]+)/i);
  if (closeMatch) parsed.project.bid_close_date = closeMatch[1];

  // Extract committee members
  const committeePattern = /(\d+)\s+(Dr\.|Mr\.|Ms\.|Mrs\.)?\s*([\w\s.]+?)\s+(Head|Senior|Director|Lecturer|Bursar|Probationary)\s*[\/\s]*([\w\s\/]+)/gi;
  while ((match = committeePattern.exec(text)) !== null) {
    parsed.committee.push({
      name: ((match[2] || '') + ' ' + match[3]).trim(),
      designation: match[4] + ' ' + (match[5] || ''),
    });
  }

  return parsed;
};

const autoPopulateFromPDF = async (projectId, parsedData) => {
  try {
    // Update project metadata
    if (parsedData.project.estimated_amount) {
      await query(
        `UPDATE projects SET 
          estimated_amount = COALESCE(estimated_amount, $1),
          metadata = metadata || $2::jsonb,
          updated_at = NOW()
         WHERE id = $3`,
        [parsedData.project.estimated_amount, JSON.stringify({ pdf_extracted: true }), projectId]
      );
    }

    // Auto-create bidders if extracted
    if (parsedData.bidders && parsedData.bidders.length > 0) {
      const existing = await query(`SELECT name FROM bidders WHERE project_id = $1`, [projectId]);
      const existingNames = existing.rows.map(r => r.name.toLowerCase());

      for (const bidder of parsedData.bidders) {
        if (!existingNames.includes(bidder.name.toLowerCase())) {
          await query(
            `INSERT INTO bidders (project_id, name, bid_price) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [projectId, bidder.name, bidder.bid_price]
          );
        }
      }
    }
  } catch (err) {
    logger.error('Auto-populate error', { err: err.message });
  }
};

exports.getByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await query(
      `SELECT d.*, u.first_name || ' ' || u.last_name as uploaded_by_name,
        b.name as bidder_name
       FROM documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       LEFT JOIN bidders b ON d.bidder_id = b.id
       WHERE d.project_id = $1
       ORDER BY d.created_at DESC`,
      [projectId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getExtracted = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT extracted_text, parsed_data, extraction_status FROM documents WHERE id = $1`,
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`SELECT file_path FROM documents WHERE id = $1`, [id]);
    if (result.rows.length && result.rows[0].file_path) {
      try { fs.unlinkSync(result.rows[0].file_path); } catch (e) {}
    }
    await query(`DELETE FROM documents WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
