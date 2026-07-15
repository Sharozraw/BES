const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const reportsDir = path.join(process.env.UPLOAD_PATH || './uploads', 'reports');
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

const generateBESReport = async (projectId, reportType, params) => {
  const doc = new PDFDocument({ 
    margin: 60, 
    size: 'A4',
    font: 'Times-Roman',
    compress: true
  });
  const fileName = `report_${reportType}_${projectId}_${Date.now()}.pdf`;
  const filePath = path.join(reportsDir, fileName);
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Handle stream errors
  stream.on('error', (err) => {
    logger.error('PDF stream error', { err: err.message, filePath });
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const centerX = doc.page.margins.left + pageWidth / 2;

  // ===== HEADER SECTION =====
  doc.font('Times-Roman')
     .fontSize(10)
     .fillColor('#000000')
     .text('GOVERNMENT OF SRI LANKA', { align: 'center' });
  
  doc.moveDown(0.3);
  doc.font('Times-Bold')
     .fontSize(16)
     .text('BID EVALUATION SYSTEM', { align: 'center' });
  
  doc.moveDown(0.2);
  doc.font('Times-Roman')
     .fontSize(11)
     .text('OFFICIAL PROCUREMENT EVALUATION REPORT', { align: 'center' });
  
  doc.moveDown(0.8);
  
  doc.moveTo(doc.page.margins.left, doc.y)
     .lineTo(doc.page.width - doc.page.margins.right, doc.y)
     .strokeColor('#000000')
     .lineWidth(0.5)
     .stroke();
  
  doc.moveDown(0.8);

  // ===== PROJECT INFORMATION =====
  const projectResult = await query(
    `SELECT p.*, u.first_name || ' ' || u.last_name as created_by_name
     FROM projects p LEFT JOIN users u ON p.created_by = u.id WHERE p.id = $1`,
    [projectId]
  );
  if (!projectResult.rows.length) throw new Error('Project not found');
  const project = projectResult.rows[0];

  doc.font('Times-Bold')
     .fontSize(13)
     .fillColor('#000000')
     .text('1. PROJECT INFORMATION');
  doc.moveDown(0.4);

  const leftCol = doc.page.margins.left + 20;
  const valueX = leftCol + 150;
  
  const projectFields = [
    ['File Number:', project.file_no || 'N/A'],
    ['Project Title:', project.title || 'N/A'],
    ['Department:', project.department || 'N/A'],
    ['Estimated Amount:', project.estimated_amount ? `Rs. ${Number(project.estimated_amount).toLocaleString()}` : 'N/A'],
    ['Procurement Method:', project.procurement_method || 'N/A'],
    ['Source of Financing:', project.source_of_financing || 'N/A'],
    ['Report Type:', reportType.toUpperCase().replace(/_/g, ' ')],
    ['Generated On:', new Date().toLocaleString()]
  ];

  projectFields.forEach(([label, value]) => {
    doc.font('Times-Bold')
       .fontSize(10)
       .fillColor('#000000')
       .text(label, leftCol, doc.y, { width: 140 });
    
    doc.font('Times-Roman')
       .fontSize(10)
       .fillColor('#000000')
       .text(value, valueX, doc.y - doc.currentLineHeight(), { 
         width: pageWidth - (valueX - doc.page.margins.left)
       });
    
    doc.moveDown(0.2);
  });

  doc.moveDown(0.5);
  doc.moveTo(doc.page.margins.left, doc.y)
     .lineTo(doc.page.width - doc.page.margins.right, doc.y)
     .strokeColor('#000000')
     .lineWidth(0.5)
     .stroke();
  doc.moveDown(0.8);

  // ===== BIDDERS SUMMARY =====
  const biddersResult = await query(
    `SELECT b.*, 
      AVG(e.score) as avg_score,
      COUNT(DISTINCT e.evaluator_id) as eval_count
     FROM bidders b
     LEFT JOIN evaluations e ON e.bidder_id = b.id
     WHERE b.project_id = $1
     GROUP BY b.id
     ORDER BY b.bid_price ASC NULLS LAST`,
    [projectId]
  );

  doc.font('Times-Bold')
     .fontSize(13)
     .fillColor('#000000')
     .text('2. BID EVALUATION SUMMARY');
  doc.moveDown(0.5);

  const tableTop = doc.y;
  const col1 = doc.page.margins.left;
  const col2 = col1 + 30;
  const col3 = col2 + 170;
  const col4 = col3 + 100;
  const col5 = col4 + 80;
  const col6 = col5 + 60;
  
  const headerY = tableTop;
  doc.rect(col1, headerY, pageWidth, 20)
     .fillColor('#f0f0f0')
     .fill();
  
  const headers = ['#', 'Bidder Name', 'Bid Price (Rs.)', 'Eval. Price (Rs.)', 'Status', 'Rank'];
  const headerPositions = [col1, col2, col3, col4, col5, col6];
  
  headers.forEach((h, i) => {
    doc.font('Times-Bold')
       .fontSize(9)
       .fillColor('#000000')
       .text(h, headerPositions[i] + 5, headerY + 4, { 
         width: i === 0 ? 25 : i === 1 ? 165 : i === 2 ? 95 : i === 3 ? 75 : i === 4 ? 55 : 40
       });
  });

  let currentY = headerY + 20;

  biddersResult.rows.forEach((bidder, idx) => {
    const rowY = currentY;
    
    if (idx % 2 === 0) {
      doc.rect(col1, rowY, pageWidth, 18)
         .fillColor('#f8f8f8')
         .fill();
    }
    
    const rowData = [
      String(idx + 1),
      bidder.name || 'N/A',
      bidder.bid_price ? Number(bidder.bid_price).toLocaleString() : 'N/A',
      bidder.bid_price ? Number(bidder.bid_price).toLocaleString() : 'N/A',
      bidder.status ? bidder.status.toUpperCase() : 'PENDING',
      bidder.status === 'eliminated' ? '-' : String(idx + 1)
    ];
    
    rowData.forEach((d, i) => {
      const isEliminated = bidder.status === 'eliminated';
      doc.font(isEliminated ? 'Times-Italic' : 'Times-Roman')
         .fontSize(9)
         .fillColor('#000000')
         .text(d, headerPositions[i] + 5, rowY + 2, { 
           width: i === 0 ? 25 : i === 1 ? 165 : i === 2 ? 95 : i === 3 ? 75 : i === 4 ? 55 : 40
         });
    });
    
    currentY += 18;
  });

  doc.y = currentY + 5;
  doc.moveDown(0.5);
  
  doc.moveTo(doc.page.margins.left, doc.y)
     .lineTo(doc.page.width - doc.page.margins.right, doc.y)
     .strokeColor('#000000')
     .lineWidth(0.5)
     .stroke();
  doc.moveDown(0.8);

  // ===== EVALUATION WORKFLOW (FIXED WRAPPING) =====
  const workflowResult = await query(
    `SELECT w.*, 
      json_agg(s.* ORDER BY s.stage_order) as stages
     FROM workflows w
     LEFT JOIN stages s ON s.workflow_id = w.id
     WHERE w.project_id = $1
     GROUP BY w.id`,
    [projectId]
  );

  doc.font('Times-Bold')
     .fontSize(13)
     .fillColor('#000000')
     .text('3. EVALUATION WORKFLOW');
  doc.moveDown(0.4);
  
  if (workflowResult.rows.length) {
    const stages = workflowResult.rows[0].stages || [];
    
    if (stages.length === 0) {
      doc.font('Times-Roman')
         .fontSize(10)
         .fillColor('#000000')
         .text('No workflow stages defined for this project.');
    } else {
      stages.filter(Boolean).forEach((stage, i) => {
        const statusText = (stage.status || 'pending').toUpperCase();
        const stageNumber = i + 1;
        
        // --- FIX: Render stage header WITHOUT allowing extreme word wrap ---
        // We calculate the exact available width and use word spacing to prevent breaks
        const availableWidth = pageWidth - 20;
        const headerText = `Stage ${stageNumber}: ${stage.name}`;
        
        // Check if the header + status fits in one line
        const statusBracket = ` [${statusText}]`;
        const totalHeaderText = headerText + statusBracket;
        
        // If total text fits, render in one line
        doc.font('Times-Bold')
           .fontSize(11)
           .fillColor('#000000');

        // Try to measure width - if too long, put status on next line
        const headerWidth = doc.widthOfString(headerText);
        const statusWidth = doc.widthOfString(statusBracket);
        
        if (headerWidth + statusWidth < availableWidth) {
          // Render on one line
          doc.text(headerText, { continued: true });
          doc.font('Times-Roman')
             .fontSize(11)
             .fillColor('#000000')
             .text(statusBracket);
        } else {
          // Render on two lines to avoid ugly wrapping
          doc.text(headerText);
          doc.font('Times-Roman')
             .fontSize(11)
             .fillColor('#000000')
             .text(`  Status: ${statusText}`, { indent: 10 });
        }
        
        // Stage details
        doc.font('Times-Roman')
           .fontSize(9)
           .fillColor('#444444')
           .text(`  Scoring Method: ${stage.scoring_method || 'Not specified'}`);
        
        doc.font('Times-Roman')
           .fontSize(9)
           .fillColor('#444444')
           .text(`  Decision Method: ${stage.decision_method || 'Not specified'}`);
        
        if (stage.description) {
          doc.font('Times-Italic')
             .fontSize(9)
             .fillColor('#555555')
             .text(`  Description: ${stage.description}`);
        }
        
        doc.moveDown(0.4);
      });
    }
  } else {
    doc.font('Times-Roman')
       .fontSize(10)
       .fillColor('#000000')
       .text('No workflow defined for this project.');
  }
  
  doc.moveDown(0.3);

  // ===== CONTRACT AWARD RECOMMENDATION =====
  doc.moveTo(doc.page.margins.left, doc.y)
     .lineTo(doc.page.width - doc.page.margins.right, doc.y)
     .strokeColor('#000000')
     .lineWidth(0.5)
     .stroke();
  doc.moveDown(0.5);

  doc.font('Times-Bold')
     .fontSize(13)
     .fillColor('#000000')
     .text('4. CONTRACT AWARD RECOMMENDATION');
  doc.moveDown(0.4);

  const finalDecision = await query(
    `SELECT fd.*, b.name as bidder_name, b.bid_price
     FROM final_decisions fd
     LEFT JOIN bidders b ON fd.bidder_id = b.id
     WHERE fd.project_id = $1
     ORDER BY fd.created_at DESC LIMIT 1`,
    [projectId]
  );

  if (finalDecision.rows.length) {
    const fd = finalDecision.rows[0];
    
    // Box for recommendation
    const boxY = doc.y;
    const boxPadding = 15;
    const boxWidth = pageWidth - 40;
    const boxHeight = 80;
    
    doc.rect(doc.page.margins.left + 20, boxY, boxWidth, boxHeight)
       .strokeColor('#000000')
       .lineWidth(0.5)
       .stroke();
    
    const textX = doc.page.margins.left + 35;
    let textY = boxY + boxPadding;
    
    doc.font('Times-Bold')
       .fontSize(11)
       .fillColor('#000000')
       .text('Recommended Bidder:', textX, textY);
    
    textY += 20;
    doc.font('Times-Roman')
       .fontSize(11)
       .fillColor('#000000')
       .text(fd.bidder_name || 'Not specified', textX, textY);
    
    textY += 18;
    doc.font('Times-Roman')
       .fontSize(10)
       .fillColor('#000000')
       .text(`Contract Amount: Rs. ${Number(fd.contract_amount || fd.bid_price).toLocaleString()}`, textX, textY);
    
    if (fd.reasons) {
      textY += 18;
      doc.font('Times-Italic')
         .fontSize(9)
         .fillColor('#333333')
         .text(`Reason: ${fd.reasons}`, textX, textY);
    }
    
    doc.y = boxY + boxHeight + 10;
  } else {
    doc.font('Times-Roman')
       .fontSize(10)
       .fillColor('#000000')
       .text('No final decision has been recorded for this project.');
  }

  doc.moveDown(0.5);
  
  // ===== SIGNATURE SECTION =====
  doc.moveTo(doc.page.margins.left, doc.y)
     .lineTo(doc.page.width - doc.page.margins.right, doc.y)
     .strokeColor('#000000')
     .lineWidth(0.5)
     .stroke();
  doc.moveDown(0.5);
  
  doc.font('Times-Bold')
     .fontSize(11)
     .fillColor('#000000')
     .text('5. CERTIFICATION');
  doc.moveDown(0.3);
  
  doc.font('Times-Roman')
     .fontSize(9)
     .fillColor('#000000')
     .text('I hereby certify that this evaluation report has been prepared in accordance with the')
     .text('procurement guidelines and all evaluations were conducted fairly and transparently.')
     .text('The recommendation is based on the evaluation criteria established for this procurement.');
  
  doc.moveDown(0.8);
  
  // Signature lines
  const sigY = doc.y;
  const sigWidth = 200;
  const sigX1 = doc.page.margins.left + 50;
  const sigX2 = doc.page.width - doc.page.margins.right - 50 - sigWidth;
  
  // Left signature
  doc.moveTo(sigX1, sigY + 30)
     .lineTo(sigX1 + sigWidth, sigY + 30)
     .strokeColor('#000000')
     .lineWidth(0.5)
     .stroke();
  
  doc.font('Times-Roman')
     .fontSize(8)
     .fillColor('#000000')
     .text('Chairperson - Evaluation Committee', sigX1, sigY + 35, { width: sigWidth, align: 'center' });
  
  // Right signature
  doc.moveTo(sigX2, sigY + 30)
     .lineTo(sigX2 + sigWidth, sigY + 30)
     .strokeColor('#000000')
     .lineWidth(0.5)
     .stroke();
  
  doc.font('Times-Roman')
     .fontSize(8)
     .fillColor('#000000')
     .text('Date', sigX2, sigY + 35, { width: sigWidth, align: 'center' });

  // ===== FOOTER =====
  const footerY = doc.page.height - 60;
  doc.moveTo(doc.page.margins.left, footerY)
     .lineTo(doc.page.width - doc.page.margins.right, footerY)
     .strokeColor('#999999')
     .lineWidth(0.3)
     .stroke();
  
  doc.font('Times-Roman')
     .fontSize(7)
     .fillColor('#666666')
     .text(
       'This is a computer-generated report from the Bid Evaluation System (BES).',
       doc.page.margins.left,
       footerY + 5,
       { align: 'center' }
     )
     .text(
       `Generated on: ${new Date().toISOString()} | Confidential - Government Use Only`,
       { align: 'center' }
     );

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve({ fileName, filePath }));
    stream.on('error', reject);
  });
};

exports.generate = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { reportType = 'full_evaluation' } = req.body;

    // Validate report type
    const validTypes = ['full_evaluation', 'summary', 'detailed', 'financial'];
    if (!validTypes.includes(reportType)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid report type. Valid types: ${validTypes.join(', ')}` 
      });
    }

    const { fileName, filePath } = await generateBESReport(projectId, reportType, req.body);

    const result = await query(
      `INSERT INTO reports (project_id, report_type, title, file_path, generated_by, status)
       VALUES ($1,$2,$3,$4,$5,'completed') RETURNING id`,
      [projectId, reportType, `${reportType} - ${new Date().toLocaleDateString()}`, filePath, req.user.id]
    );

    res.json({ 
      success: true, 
      data: { 
        id: result.rows[0].id, 
        fileName, 
        downloadUrl: `/api/reports/download/${result.rows[0].id}` 
      } 
    });
  } catch (err) {
    logger.error('Generate report error', { 
      err: err.message, 
      projectId, 
      reportType: req.body.reportType,
      userId: req.user.id
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate report: ' + err.message 
    });
  }
};

exports.download = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`SELECT * FROM reports WHERE id = $1`, [id]);
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const report = result.rows[0];
    
    // Security: Ensure file is within reports directory
    const safePath = path.normalize(report.file_path);
    if (!safePath.startsWith(reportsDir)) {
      return res.status(403).json({ success: false, message: 'Invalid file path' });
    }

    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ success: false, message: 'Report file not found' });
    }

    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(safePath)}"`);

    res.download(safePath, path.basename(safePath));
  } catch (err) {
    logger.error('Download report error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await query(
      `SELECT r.*, u.first_name || ' ' || u.last_name as generated_by_name
       FROM reports r LEFT JOIN users u ON r.generated_by = u.id
       WHERE r.project_id = $1 ORDER BY r.created_at DESC`,
      [projectId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Get reports error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};