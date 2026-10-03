// reportsController.js
// Item-level Bid Evaluation Report — Times New Roman family, classic
// government document style. Matches the official NCB sample PDF layout.
// Sections: Cover → 1.0 → Committee → 2.0 → 3.0 → 4.0 → 4.1 → 5.1 →
//           6.1 → 7.1 → 8.1 → 8.1.1 → 9.1 → Summary Report

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const reportsDir = path.join(process.env.UPLOAD_PATH || './uploads', 'reports');
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const MARGIN    = 45;
const PAGE_W    = 595.28;
const PAGE_H    = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM    = PAGE_H - MARGIN - 25;

const FONT      = 'Times-Roman';
const FONT_BOLD = 'Times-Bold';
const FONT_OBLQ = 'Times-Italic';

const SZ_TITLE    = 11;
const SZ_SUBTITLE = 9;
const SZ_HEADER   = 8;
const SZ_BODY     = 8;
const SZ_NOTE     = 8;
const SZ_LABEL    = 9;

const BLACK = '#000000';
const LINE_W_OUT = 0.8;
const LINE_W_IN  = 0.4;

const PAD_X = 4;
const PAD_Y = 4;

// ═══════════════════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════

const fmt = (n) => {
  if (n === null || n === undefined || n === '') return '-';
  const num = Number(n);
  if (isNaN(num) || num === 0) return '-';
  return num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtInt = (n) => {
  if (n === null || n === undefined || n === '') return '-';
  const num = Number(n);
  if (isNaN(num)) return '-';
  return num.toLocaleString('en-LK');
};

const dateStr = (d) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('en-GB'); } catch { return '-'; }
};

const dateTimeStr = (d) => {
  if (!d) return '-';
  try {
    const dt = new Date(d);
    return `${dt.toLocaleDateString('en-GB')} ${dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  } catch { return '-'; }
};

const cell = (v) => (v === null || v === undefined || v === '' ? '-' : String(v));

// ═══════════════════════════════════════════════════════════════════════════
// PAGE TRACKING — prevents blank pages
// ═══════════════════════════════════════════════════════════════════════════

const addPage = (doc) => {
  doc.addPage();
  doc._pageHasContent = false;
};

const markContent = (doc) => {
  doc._pageHasContent = true;
};

// ═══════════════════════════════════════════════════════════════════════════
// MEASUREMENT
// ═══════════════════════════════════════════════════════════════════════════

const cellHeight = (doc, text, width, font, size) => {
  doc.font(font).fontSize(size);
  const inner = Math.max(width - PAD_X * 2, 8);
  return doc.heightOfString(String(text ?? '-'), { width: inner, align: 'left' });
};

const measureRowHeight = (doc, values, colWidths, font, size) => {
  let maxH = 0;
  values.forEach((v, i) => {
    const h = cellHeight(doc, v, colWidths[i], font, size);
    if (h > maxH) maxH = h;
  });
  return maxH + PAD_Y * 2;
};

// ═══════════════════════════════════════════════════════════════════════════
// PAGE GUARDS
// ═══════════════════════════════════════════════════════════════════════════

const ensureRoom = (doc, height) => {
  if (doc.y + height > BOTTOM) {
    addPage(doc);
    doc.y = MARGIN;
    return true;
  }
  return false;
};

const drawRunningHeader = (doc, project) => {
  doc.font(FONT).fontSize(7).fillColor('#555')
     .text(`IFB No: ${project?.file_no || '-'}`, MARGIN, MARGIN - 22, {
       width: CONTENT_W, align: 'right', lineBreak: false,
     });
};

// Only add a new page if the current page already has real content on it.
const startFreshPage = (doc, project) => {
  if (doc._pageHasContent === true) {
    addPage(doc);
  }
  doc.y = MARGIN;
  drawRunningHeader(doc, project);
  // Note: do NOT mark content here — the running header alone shouldn't
  // cause the next startFreshPage call to add yet another page.
};

// ═══════════════════════════════════════════════════════════════════════════
// DRAWING HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const drawCellRect = (doc, x, y, w, h, lineWidth = LINE_W_IN) => {
  doc.lineWidth(lineWidth).strokeColor(BLACK).rect(x, y, w, h).stroke();
};

const drawCellText = (doc, text, x, y, w, h, {
  font = FONT, size = SZ_BODY, align = 'left',
} = {}) => {
  doc.font(font).fontSize(size).fillColor(BLACK)
     .text(String(text ?? '-'), x + PAD_X, y + PAD_Y, {
       width: Math.max(w - PAD_X * 2, 8),
       height: h - PAD_Y * 2,
       align,
       lineBreak: true,
       ellipsis: false,
     });
};

// ═══════════════════════════════════════════════════════════════════════════
// TABLE RENDERER
// ═══════════════════════════════════════════════════════════════════════════

const drawTable = (doc, { title, subtitle, headers, rows, colWidths, align = [] }) => {
  const sum = colWidths.reduce((a, b) => a + b, 0);
  const cols = colWidths.map((w) => (w / sum) * CONTENT_W);

  const titleRowH  = title ? (subtitle ? 30 : 20) : 0;
  const headerRowH = headers && headers.length
    ? measureRowHeight(doc, headers, cols, FONT_BOLD, SZ_HEADER) + 2
    : 0;

  const dataRowHs = (rows || []).map((row) =>
    measureRowHeight(doc, row, cols, FONT, SZ_BODY) + 2
  );

  const tableH = titleRowH + headerRowH + dataRowHs.reduce((a, b) => a + b, 0);

  // If the table starts near the bottom AND fits on a fresh page, move it
  if (
    doc.y + Math.min(tableH, 60) > BOTTOM &&
    tableH < (BOTTOM - MARGIN - 20)
  ) {
    addPage(doc);
    doc.y = MARGIN;
    drawRunningHeader(doc, doc._project);
  }

  const x0 = MARGIN;
  let y = doc.y;
  let pageStartY = y;

  if (title) {
    drawCellRect(doc, x0, y, CONTENT_W, titleRowH, LINE_W_IN);

    if (subtitle) {
      doc.font(FONT_BOLD).fontSize(SZ_TITLE).fillColor(BLACK)
         .text(title, x0, y + 4, { width: CONTENT_W, align: 'center', lineBreak: false });
      doc.lineWidth(LINE_W_IN).strokeColor(BLACK)
         .moveTo(x0, y + 20).lineTo(x0 + CONTENT_W, y + 20).stroke();
      doc.font(FONT_BOLD).fontSize(SZ_SUBTITLE).fillColor(BLACK)
         .text(subtitle, x0 + PAD_X, y + 20 + 3, {
           width: CONTENT_W - PAD_X * 2, align: 'left', lineBreak: false,
         });
    } else {
      doc.font(FONT_BOLD).fontSize(SZ_TITLE).fillColor(BLACK)
         .text(title, x0, y + (titleRowH - SZ_TITLE) / 2, {
           width: CONTENT_W, align: 'center', lineBreak: false,
         });
    }
    y += titleRowH;
  }

  const paintHeader = (yy) => {
    let cx = x0;
    headers.forEach((_, i) => {
      drawCellRect(doc, cx, yy, cols[i], headerRowH, LINE_W_IN);
      cx += cols[i];
    });
    cx = x0;
    headers.forEach((h, i) => {
      drawCellText(doc, h, cx, yy, cols[i], headerRowH, {
        font: FONT_BOLD, size: SZ_HEADER, align: 'center',
      });
      cx += cols[i];
    });
  };

  if (headerRowH > 0) {
    paintHeader(y);
    y += headerRowH;
  }

  (rows || []).forEach((row, ri) => {
    const rh = dataRowHs[ri];

    if (y + rh > BOTTOM) {
      doc.lineWidth(LINE_W_OUT).strokeColor(BLACK)
         .rect(x0, pageStartY, CONTENT_W, y - pageStartY).stroke();

      addPage(doc);
      doc.y = MARGIN;
      drawRunningHeader(doc, doc._project);
      y = doc.y;
      pageStartY = y;

      if (headerRowH > 0) {
        paintHeader(y);
        y += headerRowH;
      }
    }

    let cx = x0;
    row.forEach((_, i) => {
      drawCellRect(doc, cx, y, cols[i], rh, LINE_W_IN);
      cx += cols[i];
    });

    cx = x0;
    row.forEach((val, i) => {
      const a = align[i] || 'left';
      drawCellText(doc, val, cx, y, cols[i], rh, { font: FONT, size: SZ_BODY, align: a });
      cx += cols[i];
    });

    y += rh;
  });

  doc.lineWidth(LINE_W_OUT).strokeColor(BLACK)
     .rect(x0, pageStartY, CONTENT_W, y - pageStartY).stroke();

  doc.y = y + 8;
  markContent(doc);
};

// ═══════════════════════════════════════════════════════════════════════════
// LOOSE TEXT HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const smallHeading = (doc, text) => {
  ensureRoom(doc, 20);
  doc.font(FONT_BOLD).fontSize(SZ_LABEL).fillColor(BLACK)
     .text(text, MARGIN + 2, doc.y, { width: CONTENT_W - 4, lineBreak: false });
  doc.moveDown(0.35);
  markContent(doc);
};

const noteLine = (doc, text, { italic = false } = {}) => {
  ensureRoom(doc, 14);
  doc.font(italic ? FONT_OBLQ : FONT).fontSize(SZ_NOTE).fillColor(BLACK)
     .text(text, MARGIN + 2, doc.y, { width: CONTENT_W - 4, lineBreak: false });
  doc.moveDown(0.2);
  markContent(doc);
};

const bidderList = (doc, lines) => {
  lines.forEach((line) => {
    ensureRoom(doc, 14);
    doc.font(FONT).fontSize(SZ_BODY).fillColor(BLACK)
       .text(line, MARGIN + 6, doc.y, { width: CONTENT_W - 6, lineBreak: false });
  });
  doc.moveDown(0.4);
  markContent(doc);
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

const generateItemReport = async (projectId, itemId) => {
  const [projRes, itemRes, committeeRes, allBiddersRes] = await Promise.all([
    query(`SELECT p.* FROM projects p WHERE p.id = $1`, [projectId]),
    query(`SELECT i.*, wp.name AS wp_name FROM items i
           LEFT JOIN work_packages wp ON i.work_package_id = wp.id
           WHERE i.id = $1`, [itemId]),
    query(`SELECT pe.*, u.first_name||' '||u.last_name AS name, u.designation
           FROM project_evaluators pe JOIN users u ON pe.user_id = u.id
           WHERE pe.project_id = $1 ORDER BY pe.id`, [projectId]),
    query(`SELECT * FROM bidders WHERE project_id = $1 ORDER BY created_at`, [projectId]),
  ]);

  const project    = projRes.rows[0] || {};
  const item       = itemRes.rows[0];
  const committee  = committeeRes.rows || [];
  const allBidders = allBiddersRes.rows || [];
  if (!item) throw new Error('Item not found');

  const [
    t41AllRes, t41Res, t51Res, t51aRes, t6Res, t7Res, t81Res, t811Res, carRes,
  ] = await Promise.all([
    query(`SELECT DISTINCT ON (bidder_name) * FROM table41_rows
           WHERE item_id IN (SELECT id FROM items WHERE project_id = $1)
           ORDER BY bidder_name, id`, [projectId]),
    query(`SELECT * FROM table41_rows WHERE item_id = $1
           ORDER BY sort_order, bidder_no NULLS LAST`, [itemId]),
    query(`SELECT * FROM table51_rows WHERE item_id = $1 ORDER BY sort_order`, [itemId]),
    query(`SELECT ta.*, b.name AS bidder_name, b.id AS bidder_id
           FROM table51_acceptance ta JOIN bidders b ON ta.bidder_id = b.id
           WHERE ta.item_id = $1 ORDER BY b.name`, [itemId]),
    query(`SELECT t6.*, b.name AS bidder_name FROM table6_rows t6
           LEFT JOIN bidders b ON t6.bidder_id = b.id
           WHERE t6.item_id = $1 ORDER BY t6.sort_order`, [itemId]),
    query(`SELECT t7.*, b.name AS bidder_name FROM table7_rows t7
           LEFT JOIN bidders b ON t7.bidder_id = b.id
           WHERE t7.item_id = $1 ORDER BY t7.sort_order`, [itemId]),
    query(`SELECT t.*, b.name AS bidder_name FROM table81_rows t
           JOIN bidders b ON t.bidder_id = b.id WHERE t.item_id = $1
           ORDER BY t.rank NULLS LAST, t.evaluated_bid_price ASC NULLS LAST`, [itemId]),
    query(`SELECT t.*, b.name AS bidder_name FROM table811_rows t
           LEFT JOIN bidders b ON t.bidder_id = b.id
           WHERE t.item_id = $1 ORDER BY t.sort_order`, [itemId]),
    query(`SELECT c.*, b.name AS bidder_name, b.address AS bidder_address
           FROM contract_award_recommendations c
           LEFT JOIN bidders b ON c.bidder_id = b.id WHERE c.item_id = $1`, [itemId]),
  ]);

  // ── Summary Report data ────────────────────────────────────────────────
  let summaryOverride = {};
  try {
    const ovRes = await query(`SELECT * FROM item_summary_overrides WHERE item_id = $1`, [itemId]);
    summaryOverride = ovRes.rows[0] || {};
  } catch (e) { /* table may not exist */ }

  let bidderCount = 0;
  try {
    const cntRes = item.work_package_id
      ? await query(
          `SELECT COUNT(DISTINCT ib.bidder_id) AS cnt
           FROM item_bidders ib
           JOIN items i ON i.id = ib.item_id
           WHERE i.work_package_id = $1`,
          [item.work_package_id]
        )
      : await query(
          `SELECT COUNT(DISTINCT bidder_id) AS cnt
           FROM item_bidders WHERE item_id = $1`,
          [itemId]
        );
    bidderCount = parseInt(cntRes.rows[0]?.cnt || 0);
  } catch (e) { /* ignore */ }

  const fileName = `BES_Item_${item.item_no || 'item'}_${Date.now()}.pdf`;
  const filePath = path.join(reportsDir, fileName);

  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    autoFirstPage: false,
    bufferPages: true,
    info: {
      Title: `Bid Evaluation Report — ${item.description}`,
      Author: 'BES — Bid Evaluation System',
    },
  });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);
  doc._project = project;
  doc._pageHasContent = false;

  const itemSub = `Item No. ${item.item_no || '-'}. — ${item.description || '-'}${
    item.quantity ? ` — ${String(item.quantity).padStart(2, '0')} ${item.unit || 'Nos'}.` : ''
  }`;

  // ══════════════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ══════════════════════════════════════════════════════════════════════════
  addPage(doc);

  doc.font(FONT).fontSize(12).fillColor(BLACK)
     .text('FACULTY OF ENGINEERING', MARGIN, 100, { width: CONTENT_W, align: 'center' });
  doc.font(FONT_BOLD).fontSize(16).fillColor(BLACK)
     .text('UNIVERSITY OF RUHUNA', MARGIN, 120, { width: CONTENT_W, align: 'center' });

  doc.moveTo(MARGIN + 40, 150).lineTo(PAGE_W - MARGIN - 40, 150)
     .lineWidth(LINE_W_OUT).strokeColor(BLACK).stroke();

  doc.font(FONT_BOLD).fontSize(22).fillColor(BLACK)
     .text('Bid Evaluation Report', MARGIN, 220, { width: CONTENT_W, align: 'center' });
  doc.font(FONT).fontSize(13).fillColor(BLACK)
     .text('(National Competitive Bidding)', MARGIN, 255, { width: CONTENT_W, align: 'center' });

  doc.font(FONT_BOLD).fontSize(12).fillColor(BLACK)
     .text(`IFB No: ${project.file_no || '-'}`, MARGIN, 340, { width: CONTENT_W, align: 'center' });
  doc.font(FONT).fontSize(11).fillColor(BLACK)
     .text(
       `Package No. 01: ${project.title || 'Supply, Delivery, Installation, Commissioning, Testing and Maintenance'}`,
       MARGIN + 30, 365, { width: CONTENT_W - 60, align: 'center' }
     );

  markContent(doc);

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — 1.0 + Committee + 2.0 + 3.0 + Bidders
  // ══════════════════════════════════════════════════════════════════════════
  startFreshPage(doc, project);

  drawTable(doc, {
    title: '1.0 Background',
    headers: null,
    rows: [
      ['File No.',                 cell(project.file_no)],
      ['Department',               cell(project.department)],
      ['Brief Description of Goods',
        `Purchasing of ${project.title || item.description || '-'}`],
      ['Estimated Amount',
        project.estimated_amount ? `Rs. ${fmtInt(project.estimated_amount)}` : '-'],
      ['Date', dateStr(project.invitation_date)],
    ],
    colWidths: [180, 335],
  });

  smallHeading(doc, 'Names of Evaluation Committee Members');

  const cmRows = committee.length > 0
    ? committee.map((c, i) => [
        String(i + 1).padStart(2, '0'),
        cell(c.name),
        cell(c.designation),
        c.role || (i === 0 ? 'Chairperson'
          : i === committee.length - 1 ? 'Member/Convener'
          : 'Member'),
      ])
    : [['-', '-', '-', '-']];

  drawTable(doc, {
    headers: ['No', 'Name', 'Designation', 'Capacity'],
    rows: cmRows,
    colWidths: [30, 175, 180, 130],
    align: ['center', 'left', 'left', 'left'],
  });

  drawTable(doc, {
    title: '2.0 Bidding Documents',
    headers: null,
    rows: [
      ['Were any variations introduced to the format and contents? If yes list the variations', 'No'],
      ['Were drawings and specifications provided?', 'Yes'],
    ],
    colWidths: [380, 135],
  });

  drawTable(doc, {
    title: '3.0 Bidding Process',
    headers: null,
    rows: [
      ['Date of Invitation Letter',                 dateStr(project.invitation_date)],
      ['Date on which the documents were made available for sale', dateStr(project.document_sale_date)],
      ['Price of a set of documents',
        project.document_price ? `Rs. ${fmtInt(project.document_price)}` : '-'],
      ['Date of pre-bid meeting (if any) (Attach minutes & any resulting amendments to the documents)',
        dateStr(project.pre_bid_date)],
      ['Date and time of bid close',                dateTimeStr(project.bid_close_date)],
      ['Date and time of bid opening',              dateTimeStr(project.bid_open_date)],
    ],
    colWidths: [340, 175],
  });

  smallHeading(doc, 'Names of Bidders who have taken the Bidding Documents');

  if (allBidders.length === 0) {
    ensureRoom(doc, 14);
    doc.font(FONT).fontSize(SZ_BODY).fillColor(BLACK)
       .text('None', MARGIN + 6, doc.y, { width: CONTENT_W, lineBreak: false });
    doc.moveDown(0.4);
    markContent(doc);
  } else {
    bidderList(
      doc,
      allBidders.map((b, i) =>
        `${String(i + 1).padStart(2, '0')}. ${b.name}${b.address ? ' — ' + b.address : ''}`
      )
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 3 — 4.0 Bid Opening (all) + 4.1 Bid Opening (item)
  // ══════════════════════════════════════════════════════════════════════════
  startFreshPage(doc, project);

  drawTable(doc, {
    title: '4.0 Bid Opening',
    headers: ['Bidder No', 'Name', 'Address',
              'Bid Prices as Read-out (Without VAT)', 'Remarks'],
    rows: t41AllRes.rows.length > 0
      ? t41AllRes.rows.map((r) => [
          cell(r.bidder_no),
          cell(r.bidder_name),
          cell(r.address),
          fmt(r.readout_price),
          cell(r.remarks),
        ])
      : [['-', '-', '-', '-', '-']],
    colWidths: [45, 120, 160, 110, 80],
    align: ['center', 'left', 'left', 'right', 'center'],
  });
  noteLine(doc, 'Late Bids (returned unopened) - None', { italic: true });

  drawTable(doc, {
    title: '4.1 Bid Opening',
    subtitle: itemSub,
    headers: ['Bidder No', 'Name', 'Address',
              'Bid Price as Read-out (Without VAT)', 'Remarks'],
    rows: t41Res.rows.length > 0
      ? t41Res.rows.map((r) => [
          cell(r.bidder_no),
          cell(r.bidder_name),
          cell(r.address),
          fmt(r.readout_price),
          cell(r.remarks),
        ])
      : [['-', '-', '-', '-', '-']],
    colWidths: [45, 120, 160, 110, 80],
    align: ['center', 'left', 'left', 'right', 'center'],
  });
  noteLine(doc, 'Late Bids (returned unopened) - None', { italic: true });

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 4 — 5.1 + 6.1 + 7.1
  // ══════════════════════════════════════════════════════════════════════════
  startFreshPage(doc, project);

  const acceptedBidders = t51aRes.rows;
  const criteriaRows    = t51Res.rows;

  const fixedWidths = [45, 110];
  const dynCount    = criteriaRows.length + 1;
  const remaining   = CONTENT_W - fixedWidths[0] - fixedWidths[1];
  const dynW        = dynCount > 0 ? remaining / dynCount : remaining;
  const colWidths51 = [...fixedWidths, ...new Array(dynCount).fill(dynW)];

  const headerLabels51 = [
    'Bidder No',
    'Name',
    ...criteriaRows.map((r) => r.field_label),
    'Accepted for Detailed Evaluation',
  ];

  const prelimRows = acceptedBidders.length > 0
    ? acceptedBidders.map((b, idx) => {
        const row = [
          cell(b.bidder_no || String(idx + 1).padStart(2, '0')),
          cell(b.bidder_name),
        ];
        criteriaRows.forEach((crit) => {
          const v = (crit.values || {})[b.bidder_id];
          row.push(v === undefined || v === null || v === '' ? 'N/A' : String(v));
        });
        row.push(b.accepted !== false ? 'Yes' : 'No');
        return row;
      })
    : [new Array(headerLabels51.length).fill('-')];

  drawTable(doc, {
    title: '5.1 Preliminary Examination of Bids (Mark as "YES" or "NO")',
    subtitle: itemSub,
    headers: headerLabels51,
    rows: prelimRows,
    colWidths: colWidths51,
    align: headerLabels51.map((_, i) => (i < 2 ? 'left' : 'center')),
  });

  drawTable(doc, {
    title: '6.1 Clarifications sought from bidders (if any)',
    subtitle: itemSub,
    headers: ['Bidder', 'Nature of Clarification'],
    rows: t6Res.rows.length > 0
      ? t6Res.rows.map((r) => [cell(r.bidder_name), cell(r.query_text || 'None')])
      : [['-', 'None']],
    colWidths: [200, 315],
    align: ['left', 'left'],
  });

  drawTable(doc, {
    title: '7.1 Departures from Technical Specifications',
    subtitle: itemSub,
    headers: [
      'Bidder No', 'Name', 'Item Descriptions',
      'Requirement', 'Offered',
      'Bid Rejected as non-responsive (Yes/No)?',
    ],
    rows: t7Res.rows.length > 0
      ? t7Res.rows.map((r, i) => [
          cell(r.bidder_no || String(i + 1).padStart(2, '0')),
          cell(r.bidder_name),
          cell(r.item_description),
          cell(r.requirement),
          cell(r.offered),
          r.bid_rejected ? 'Yes' : 'No',
        ])
      : [['-', '-', '-', '-', '-', '-']],
    colWidths: [45, 100, 90, 95, 95, 90],
    align: ['center', 'left', 'left', 'left', 'left', 'center'],
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 5 — 8.1 + 8.1.1
  // ══════════════════════════════════════════════════════════════════════════
  startFreshPage(doc, project);

  drawTable(doc, {
    title: '8.1 Evaluation of Responsive Bids',
    subtitle: itemSub,
    headers: [
      'Bidder No', 'Name', 'Bid Price Rs.',
      'Arithmetical errors (+/-)', 'Discounts',
      'Additions / omissions', 'Qty',
      'Evaluated bid price Rs. (Without VAT)', 'Rank',
    ],
    rows: t81Res.rows.length > 0
      ? t81Res.rows.map((r, i) => [
          cell(r.bidder_no || String(i + 1).padStart(2, '0')),
          cell(r.bidder_name),
          fmtInt(r.bid_price),
          r.arithmetic_errors ? fmtInt(r.arithmetic_errors) : '-',
          r.discounts ? fmtInt(r.discounts) : '-',
          r.additions_omissions ? fmtInt(r.additions_omissions) : '-',
          cell(r.quantity || '1'),
          fmtInt(r.evaluated_bid_price),
          String(r.rank || i + 1),
        ])
      : [['-', '-', '-', '-', '-', '-', '-', '-', '-']],
    colWidths: [40, 95, 60, 60, 55, 60, 30, 80, 35],
    align: ['center', 'left', 'right', 'right', 'right', 'right', 'center', 'right', 'center'],
  });

  if (t811Res.rows.length > 0) {
    const rank1     = t81Res.rows[0];
    const allPassed = t811Res.rows.every((r) => r.complied && r.accepted);

    drawTable(doc, {
      title: '8.1.1 Post Qualification Verification',
      headers: null,
      rows: [
        ['Item Description',
          `${item.description}${item.quantity
            ? ` — ${String(item.quantity).padStart(2, '0')} ${item.unit || 'Nos'}.`
            : ''}`],
        ['Lowest Evaluated Bidder', cell(rank1?.bidder_name)],
      ],
      colWidths: [160, 355],
      align: ['left', 'left'],
    });

    drawTable(doc, {
      headers: [
        'Requirements as per ITB 37.2 Bidders Qualification Acceptability',
        'Bidders Qualification',
        'Acceptability',
      ],
      rows: [
        ...t811Res.rows.map((r) => [
          cell(r.criteria_label),
          r.complied === true ? 'Complied'
            : r.complied === false ? 'Not Complied' : '-',
          r.accepted === true ? 'Accepted'
            : r.accepted === false ? 'Not Accepted' : '-',
        ]),
        ['Recommended for Award', allPassed ? 'Yes' : 'No', ''],
      ],
      colWidths: [300, 110, 105],
      align: ['left', 'left', 'left'],
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 6 — 9.1
  // ══════════════════════════════════════════════════════════════════════════
  startFreshPage(doc, project);

  const carData  = carRes.rows[0] || {};
  const t81Rank1 = t81Res.rows[0];

  const contractAmount = carData.contract_amount
    || (t81Rank1 ? `Rs. ${fmtInt(t81Rank1.evaluated_bid_price)} + (VAT)` : '-');

  drawTable(doc, {
    title: '9.1 Contract Award Recommendation',
    subtitle: itemSub,
    headers: null,
    rows: [
      ['Name of Contractor / Supplier',
        cell(carData.bidder_name || t81Rank1?.bidder_name)],
      ['Address',              cell(carData.bidder_address)],
      ['Contract Amount (Rs)', contractAmount],
      ['Brand/Model',          cell(carData.brand_model)],
      ['Warranty',             cell(carData.warranty)],
    ],
    colWidths: [180, 335],
    align: ['left', 'left'],
  });

  drawTable(doc, {
    title: 'Reasons for Rejecting any Bid',
    headers: ['Bidder', 'Reason'],
    rows: (carData.rejection_reasons && carData.rejection_reasons.length > 0)
      ? carData.rejection_reasons.map((r) => [cell(r.bidder), cell(r.reason)])
      : [['-', '-']],
    colWidths: [200, 315],
    align: ['left', 'left'],
  });

  drawTable(doc, {
    title: 'ANY OTHER COMMENTS',
    headers: null,
    rows: [[cell(carData.comments)]],
    colWidths: [CONTENT_W],
    align: ['left'],
  });

  const sigs = (carData.signatures || []).slice(0, 6);

  if (sigs.length > 0) {
    const labelW = 70;
    const eachW  = Math.floor((CONTENT_W - labelW) / sigs.length);
    const sigCols = [labelW, ...new Array(sigs.length).fill(eachW)];
    const sigHeaders = ['', ...sigs.map((_, i) => `Signatory ${i + 1}`)];

    const sigRows = [
      ['Signature',   ...sigs.map(() => '')],
      ['Name',        ...sigs.map((s) => cell(s.name))],
      ['Designation', ...sigs.map((s) => cell(s.designation))],
      ['Date',        ...sigs.map((s) => cell(s.date))],
    ];

    drawTable(doc, {
      title: 'Agree with above decisions (Yes/No) — Signatures',
      headers: sigHeaders,
      rows: sigRows,
      colWidths: sigCols,
      align: sigCols.map(() => 'center'),
    });
  } else {
    drawTable(doc, {
      title: 'Agree with above decisions (Yes/No) — Signatures',
      headers: null,
      rows: [['No signatures recorded.']],
      colWidths: [CONTENT_W],
      align: ['left'],
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 7 — BID EVALUATION SUMMARY REPORT
  // ══════════════════════════════════════════════════════════════════════════
  startFreshPage(doc, project);

  const effectiveTitle     = summaryOverride.procurement_title   || project.title               || '-';
  const effectiveFinancing = summaryOverride.source_of_financing || project.source_of_financing || '-';
  const preBidEstimate     = (item.pre_bid_estimate != null) ? item.pre_bid_estimate : project.estimated_amount;

  const substantivelyResponsive = t51aRes.rows.filter((a) => a.accepted).length;
  const rank1                   = t81Res.rows[0];
  const isLowestRecommended     = carData.bidder_id && rank1 && carData.bidder_id === rank1.bidder_id;
  const t41Rank1                = t41Res.rows.find((r) => r.bidder_name === rank1?.bidder_name);

  const summaryRows = [
    ['01', 'Name of the Procuring Entity',
      cell(project.department || item.wp_name)],
    ['02', 'Title of the Procurement',
      cell(effectiveTitle)],
    ['03', 'Source of Financing',
      cell(effectiveFinancing)],
    ['04', 'Pre-bid Estimated Amount of the Procuring Entity',
      preBidEstimate ? `Rs. ${fmtInt(preBidEstimate)}` : '-'],
    ['05', 'Method of Procurement',
      cell(project.procurement_method || 'NCB')],
    ['06', 'Number of Bidding Documents Issued',
      String(bidderCount)],
    ['07', 'Number of Bids Received',
      String(t41Res.rows.length)],
    ['08', 'Number of Bids Determined as Substantially Responsive',
      String(substantivelyResponsive)],
    ['09', 'Any Common Reason/s Found for Determining Many Bids as Non-Responsive',
      t51aRes.rows.filter((a) => !a.accepted).length > 0 ? 'See Table 5.1' : '-'],
    ['10', 'Was the Lowest Evaluated Bidder Recommended for Contract Award? (Yes / No)',
      isLowestRecommended ? 'Yes' : carData.bidder_id ? 'No' : '-'],
    ['11', 'If Answer for "10" Above is "No", Give Reason/s for Not Recommending',
      !isLowestRecommended && carData.bidder_id ? 'See Contract Award Section' : '-'],
    ['12', 'What is the Recommended Contract Award Price?',
      carData.contract_amount || (rank1 ? `Rs. ${fmtInt(rank1.evaluated_bid_price)} + (VAT)` : '-')],
    ['13', 'What was the Bid Price of the Recommended Bidder at the Bid Opening?',
      t41Rank1?.readout_price ? `Rs. ${fmtInt(t41Rank1.readout_price)} + (VAT)` : '-'],
    ['14', 'If There is a Difference Between "12" and "13" Above, What are the Reasons?',
      '-'],
  ];

  drawTable(doc, {
    title: 'BID EVALUATION SUMMARY REPORT',
    subtitle: itemSub,
    headers: null,
    rows: summaryRows,
    colWidths: [30, 290, 195],
    align: ['center', 'left', 'left'],
  });

  // ══════════════════════════════════════════════════════════════════════════
  // FOOTERS
  // ══════════════════════════════════════════════════════════════════════════
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  for (let i = 1; i < totalPages; i++) {
    doc.switchToPage(range.start + i);
    const savedY = doc.y;
    const fy = PAGE_H - MARGIN + 10;
    doc.moveTo(MARGIN, fy - 6).lineTo(PAGE_W - MARGIN, fy - 6)
       .lineWidth(LINE_W_IN).strokeColor(BLACK).stroke();

    doc.font(FONT).fontSize(7).fillColor(BLACK)
       .text(
         `Generated by BES  |  ${new Date().toLocaleString('en-GB')}  |  Confidential — Government Use Only  |  Page ${i + 1} of ${totalPages}`,
         MARGIN, fy, { width: CONTENT_W, align: 'center', lineBreak: false }
       );
    doc.y = savedY;
  }

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve({ fileName, filePath }));
    stream.on('error', reject);
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// ROUTE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

exports.generate = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { itemId } = req.body;

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: 'itemId is required — reports are per-item only',
      });
    }

    const result = await generateItemReport(projectId, itemId);

    const dbResult = await query(
      `INSERT INTO reports (project_id, report_type, title, file_path, generated_by, status)
       VALUES ($1,'item_evaluation',$2,$3,$4,'completed') RETURNING id`,
      [
        projectId,
        `Item Evaluation Report — ${new Date().toLocaleDateString('en-GB')}`,
        result.filePath,
        req.user.id,
      ]
    );

    res.json({
      success: true,
      data: {
        id: dbResult.rows[0].id,
        fileName: result.fileName,
        downloadUrl: `/api/reports/download/${dbResult.rows[0].id}`,
      },
    });
  } catch (err) {
    logger.error('Generate report error', { err: err.message, stack: err.stack });
    res.status(500).json({ success: false, message: 'Failed to generate report: ' + err.message });
  }
};

exports.download = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`SELECT * FROM reports WHERE id = $1`, [id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Report not found' });
    const report = result.rows[0];
    if (!fs.existsSync(report.file_path)) {
      return res.status(404).json({ success: false, message: 'File not found on disk' });
    }
    res.download(report.file_path, path.basename(report.file_path));
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await query(
      `SELECT r.*, u.first_name||' '||u.last_name AS generated_by_name
       FROM reports r LEFT JOIN users u ON r.generated_by = u.id
       WHERE r.project_id = $1 ORDER BY r.created_at DESC`,
      [projectId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};