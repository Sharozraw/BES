// DataImportService.js
// Fuzzy column detection — works with any Excel/CSV layout, any header names.

const XLSX = require('xlsx');
const { query, getClient } = require('../config/database');
const logger = require('../utils/logger');

// ─── Column synonym bank ──────────────────────────────────────────────────────
const SYNONYM_BANK = [
  { role: 'work_package_code', weight: 1.0, synonyms: [
    'workpackageid','workpackagecode','work package id','work package code',
    'wpid','wpcode','wpno','wp number','wp no',
    'packageid','packagecode','packageno','package no','package number',
    'lotid','lotcode','lotno','lot number','lot no',
    'refno','ref no','reference','reference no','reference number'
  ]},
  { role: 'work_package', weight: 1.0, synonyms: [
    'workpackage','workpackagename','work package','work package name',
    'packagename','package name','package',
    'lotname','lot name','lot',
    'section','sectionname','division','divisionname',
    'category','categoryname','group','groupname',
    'bundle','bundlename','wp'
  ]},
  { role: 'item_no',   weight: 1.0, synonyms: [
    'itemno','item no','item number','itemnumber','item#',
    'slno','sl no','serialno','serial no','serial',
    'sno','s.no','lineno','line no','line',
    'refno','ref no','ref'
  ]},
  { role: 'item_desc', weight: 1.0, synonyms: [
    'itemdescription','item description','itemdesc','item desc',
    'item','description','desc','goods','service','works',
    'particulars','details','specification','product','material'
  ]},
  { role: 'unit',      weight: 0.8, synonyms: [
    'unit','units','uom','unit of measure','measure','uomcode'
  ]},
  { role: 'quantity',  weight: 0.9, synonyms: [
    'quantity','qty','qnty','quantity ordered','required quantity','volume'
  ]},
  { role: 'bidder_name', weight: 1.0, synonyms: [
    'biddername','bidder name','bidder',
    'suppliername','supplier name','supplier',
    'contractorname','contractor name','contractor',
    'companyname','company name','company',
    'firmname','firm name','firm',
    'vendorname','vendor name','vendor',
    'tenderername','tenderer name','tenderer',
    'partyname','party name','party'
  ]},
  { role: 'bidder_address', weight: 1.0, synonyms: [
    'bidderaddress','bidder address',
    'supplieraddress','supplier address',
    'address','location','addr','city','place'
  ]},
  { role: 'bidder_no', weight: 1.0, synonyms: [
    'bidderno','bidder no','bidder number',
    'supplierno','supplier no',
    'contractorno','contractor no',
    'vendorno','vendor no'
  ]},
  { role: 'brand_model', weight: 1.0, synonyms: [
    'brandmodel','brand model','brand/model','brand / model',
    'brand','make','model','manufacturer','makeandmodel','make and model',
    'productname','product name','offeredbrand','offered brand'
  ]},
  { role: 'warranty', weight: 1.0, synonyms: [
    'warranty','warrantyperiod','warranty period',
    'guarantee','guaranteeperiod','guarantee period','warrenty'
  ]},
  { role: 'readout_price', weight: 1.0, synonyms: [
    'readoutprice','readout price',
    'bidprice','bid price','bidpricers','bid price rs',
    'quotedprice','quoted price',
    'offeredprice','offered price',
    'unitprice','unit price','rate','value','cost','amount',
    'bidamount','bid amount',
    'totalamount','total amount',
    'totalprice','total price'
  ]},
  { role: 'pre_bid_estimate', weight: 1.0, synonyms: [
    'prebidestimate','prebidestimaters','pre-bid estimate','pre-bid estimate (rs)',
    'estimate','estimatedamount','estimated amount','budget'
  ]},
  { role: 'remarks', weight: 0.7, synonyms: [
    'remarks','remark','note','notes','comment','comments','observation','status','info'
  ]},
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const norm = (s) => String(s || '').replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const scoreCol = (header, role) => {
  const h = norm(header);
  if (!h) return 0;
  const entry = SYNONYM_BANK.find(e => e.role === role);
  if (!entry) return 0;
  let best = 0;
  for (const syn of entry.synonyms) {
    const s = norm(syn);
    if (!s) continue;
    if (h === s) return entry.weight;
    if (h.includes(s) || s.includes(h)) {
      const partial = entry.weight * 0.7;
      if (partial > best) best = partial;
    }
  }
  return best;
};

const buildColMap = (headers) => {
  const map = {};
  const used = new Set();
  const roles = [
    'work_package_code','work_package',
    'item_no','item_desc','unit','quantity',
    'bidder_name','bidder_address','bidder_no',
    'brand_model','warranty',
    'readout_price','pre_bid_estimate','remarks',
  ];

  const candidates = roles
    .flatMap(role => headers.map(header => ({ role, header, score: scoreCol(header, role) })))
    .filter(c => c.score > 0.2)
    .sort((a, b) => b.score - a.score);

  for (const c of candidates) {
    if (!map[c.role] && !used.has(c.header)) {
      map[c.role] = c.header;
      used.add(c.header);
    }
  }
  return map;
};

const findHeaderRow = (matrix) => {
  let bestIndex = 0;
  let bestScore = 0;
  matrix.slice(0, 12).forEach((row, index) => {
    const score = row.reduce(
      (total, cell) => total + Math.max(...SYNONYM_BANK.map(e => scoreCol(cell, e.role))),
      0
    );
    if (score > bestScore) { bestScore = score; bestIndex = index; }
  });
  return bestIndex;
};

const get = (row, key) => (key ? String(row[key] ?? '').trim() : '');

const toDecimal = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).replace(/[^\d.\-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

const normalizeRows = (rows, colMap, sheetName) => {
  let currentWpCode = '';
  let currentWpName = '';
  let currentItemNo = '';
  let currentDescription = '';
  let currentUnit = '';
  let currentQuantity = null;

  return rows.map(row => {
    const explicitWpCode = get(row, colMap.work_package_code);
    const explicitWpName = get(row, colMap.work_package);
    const explicitItemNo = get(row, colMap.item_no);
    const explicitDescription = get(row, colMap.item_desc);
    const explicitUnit = get(row, colMap.unit);
    const explicitQuantity = toDecimal(get(row, colMap.quantity));

    if (explicitWpCode) currentWpCode = explicitWpCode;
    if (explicitWpName) currentWpName = explicitWpName;
    if (explicitItemNo) currentItemNo = explicitItemNo;
    if (explicitDescription) currentDescription = explicitDescription;
    if (explicitUnit) currentUnit = explicitUnit;
    if (explicitQuantity !== null) currentQuantity = explicitQuantity;

    return {
      row,
      workPackageCode: currentWpCode,
      workPackageName: currentWpName,
      itemNo: currentItemNo,
      description: currentDescription,
      unit: currentUnit,
      quantity: currentQuantity,
    };
  });
};

const buildWpDisplayName = (code, name, sheetName) => {
  const c = (code || '').trim();
  const n = (name || '').trim();
  if (c && n && c.toLowerCase() !== n.toLowerCase()) return `${c} — ${n}`;
  if (n) return n;
  if (c) return c;
  return sheetName;
};

// ─── DB helpers ───────────────────────────────────────────────────────────────

const upsertBidder = async (client, projectId, name, address, sourceDocumentId) => {
  const existing = await client.query(
    `SELECT * FROM bidders WHERE project_id=$1 AND LOWER(TRIM(name))=LOWER(TRIM($2)) LIMIT 1`,
    [projectId, name]
  );
  const addr = (address || '').trim() || null;
  if (existing.rows.length) {
    const updated = await client.query(
      `UPDATE bidders SET address=COALESCE($2,address), source_document_id=COALESCE($3,source_document_id), updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [existing.rows[0].id, addr, sourceDocumentId || null]
    );
    return updated.rows[0];
  }
  const res = await client.query(
    `INSERT INTO bidders (project_id, name, address, status, source_document_id) VALUES ($1,$2,$3,'active',$4) RETURNING *`,
    [projectId, name.trim(), addr, sourceDocumentId || null]
  );
  return res.rows[0];
};

const upsertWorkPackage = async (client, projectId, wpName, sourceDocId) => {
  const existing = await client.query(
    `SELECT * FROM work_packages WHERE project_id=$1 AND LOWER(TRIM(name))=LOWER(TRIM($2)) LIMIT 1`,
    [projectId, wpName]
  );
  if (existing.rows.length) {
    const updated = await client.query(
      `UPDATE work_packages SET source='file', source_document_id=COALESCE($2,source_document_id), updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [existing.rows[0].id, sourceDocId || null]
    );
    return updated.rows[0];
  }
  const res = await client.query(
    `INSERT INTO work_packages (project_id, name, source, source_document_id) VALUES ($1,$2,'file',$3) RETURNING *`,
    [projectId, wpName.trim(), sourceDocId || null]
  );
  return res.rows[0];
};

const upsertItem = async (client, projectId, wpId, itemNo, description, unit, quantity, sourceDocumentId) => {
  const normalizedItemNo = (itemNo || '').trim();
  const existing = normalizedItemNo
    ? await client.query(
      `SELECT * FROM items WHERE project_id=$1 AND work_package_id=$2 AND item_no=$3 LIMIT 1`,
      [projectId, wpId, normalizedItemNo]
    )
    : await client.query(
      `SELECT * FROM items WHERE project_id=$1 AND work_package_id=$2 AND LOWER(TRIM(description))=LOWER(TRIM($3)) LIMIT 1`,
      [projectId, wpId, description]
    );

  if (existing.rows.length) {
    const updated = await client.query(
      `UPDATE items SET item_no=COALESCE($2,item_no), description=$3, unit=COALESCE($4,unit), quantity=COALESCE($5,quantity),
         source='file', source_document_id=COALESCE($6,source_document_id), updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [existing.rows[0].id, normalizedItemNo || null, description.trim(), unit || null, quantity || null, sourceDocumentId || null]
    );
    return updated.rows[0];
  }
  const res = await client.query(
    `INSERT INTO items (project_id, work_package_id, item_no, description, unit, quantity, source, source_document_id)
     VALUES ($1,$2,$3,$4,$5,$6,'file',$7) RETURNING *`,
    [projectId, wpId, normalizedItemNo || null, description.trim(), unit || null, quantity || null, sourceDocumentId || null]
  );
  return res.rows[0];
};

const linkBidderToItem = async (client, itemId, bidder, bidderNo, readoutPrice, remarks, sourceDocumentId, brandModel, warranty) => {
  const jExists = await client.query(
    `SELECT id FROM item_bidders WHERE item_id=$1 AND bidder_id=$2`, [itemId, bidder.id]
  );
  let itemBidderId;

  const bm = (brandModel || '').trim() || null;
  const wr = (warranty || '').trim() || null;

  if (jExists.rows.length) {
    itemBidderId = jExists.rows[0].id;
    await client.query(
      `UPDATE item_bidders
         SET bidder_no=COALESCE($3,bidder_no),
             readout_price=COALESCE($4,readout_price),
             remarks=COALESCE($5,remarks),
             brand_model=COALESCE($7,brand_model),
             warranty=COALESCE($8,warranty),
             source_document_id=COALESCE($6,source_document_id)
       WHERE id=$1 AND item_id=$2`,
      [itemBidderId, itemId, bidderNo || null, readoutPrice, remarks || null, sourceDocumentId || null, bm, wr]
    );
  } else {
    const jr = await client.query(
      `INSERT INTO item_bidders (item_id, bidder_id, bidder_no, readout_price, remarks, brand_model, warranty, source_document_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [itemId, bidder.id, bidderNo || null, readoutPrice || null, remarks || null, bm, wr, sourceDocumentId || null]
    );
    itemBidderId = jr.rows[0].id;
  }

  await client.query(
    `INSERT INTO table41_rows
       (item_id, item_bidder_id, bidder_no, bidder_name, address, readout_price, remarks, source_document_id, sort_order)
     SELECT $1,$2,$3,$4,$5,$6,$7,$8,$3
     WHERE NOT EXISTS (SELECT 1 FROM table41_rows WHERE item_id=$1 AND item_bidder_id=$2)`,
    [itemId, itemBidderId, bidderNo || 0, bidder.name, bidder.address, readoutPrice || null, remarks || null, sourceDocumentId || null]
  );

  await client.query(
    `UPDATE table41_rows
       SET readout_price=COALESCE($3,readout_price), bidder_no=COALESCE($4,bidder_no),
           address=COALESCE($5,address), remarks=COALESCE($6,remarks),
           source_document_id=COALESCE($7,source_document_id), updated_at=NOW()
     WHERE item_id=$1 AND item_bidder_id=$2`,
    [itemId, itemBidderId, readoutPrice, bidderNo || null, bidder.address || null, remarks || null, sourceDocumentId || null]
  );

  await client.query(
    `INSERT INTO table51_acceptance (item_id, bidder_id, accepted, source_document_id) VALUES ($1,$2,true,$3)
     ON CONFLICT (item_id, bidder_id) DO UPDATE SET source_document_id=COALESCE(EXCLUDED.source_document_id, table51_acceptance.source_document_id)`,
    [itemId, bidder.id, sourceDocumentId || null]
  );
};

const seedTable51SystemRows = async (client, itemId) => {
  const systemRows = [
    { key: 'form_signed',              label: 'Form of Bid Filled & Signed',       type: 'yesno',  order: 1 },
    { key: 'manufacturer_auth',        label: 'Manufacturer Authorization',         type: 'yesno',  order: 2 },
    { key: 'bid_security',             label: 'Bid Security Submitted',             type: 'yesno',  order: 3 },
    { key: 'bid_security_days',        label: 'Bid Security Validity (Days)',        type: 'number', order: 4 },
    { key: 'business_registration',    label: 'Business Registration Submitted',    type: 'yesno',  order: 5 },
    { key: 'substantial_responsiveness', label: 'Substantial Responsiveness',       type: 'yesno',  order: 6 },
  ];
  for (const r of systemRows) {
    await client.query(
      `INSERT INTO table51_rows (item_id, field_key, field_label, field_type, is_system, sort_order)
       VALUES ($1,$2,$3,$4,true,$5) ON CONFLICT (item_id, field_key) DO NOTHING`,
      [itemId, r.key, r.label, r.type, r.order]
    );
  }
};

const readAllSheets = (filePath) => {
  const wb = XLSX.readFile(filePath, { cellDates: true, defval: '', raw: false });
  return wb.SheetNames.map(sheetName => {
    const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false });
    const headerRow = findHeaderRow(matrix);
    const headers = (matrix[headerRow] || [])
      .map((header, index) => String(header || '').trim() || `Column ${index + 1}`);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: headers, range: headerRow + 1, defval: '', raw: false,
    });
    if (!rows.length) return { sheetName, rows: [], colMap: {} };
    const colMap = buildColMap(headers);
    logger.info(`Sheet "${sheetName}": ${rows.length} rows, colMap=${JSON.stringify(colMap)}`);
    return { sheetName, rows, colMap };
  }).filter(s => s.rows.length > 0);
};

// ─── Public API ───────────────────────────────────────────────────────────────

exports.importTenderFile = async (projectId, filePath, uploadedBy, sourceDocId) => {
  const sheets = readAllSheets(filePath);
  const client = await getClient();
  const summary = { workPackages: 0, items: 0, bidders: 0, links: 0, errors: [] };
  const seenWp = new Set();
  const seenItems = new Set();
  const seenBidders = new Set();

  try {
    await client.query('BEGIN');

    for (const { sheetName, rows, colMap } of sheets) {
      for (const normalized of normalizeRows(rows, colMap, sheetName)) {
        const { row } = normalized;

        const wpDisplayName = buildWpDisplayName(
          normalized.workPackageCode,
          normalized.workPackageName,
          sheetName
        );

        const itemNo = normalized.itemNo;
        const itemDesc = normalized.description;
        const unit = normalized.unit;
        const quantity = normalized.quantity;
        const bidderName = get(row, colMap.bidder_name);
        const bidderAddress = get(row, colMap.bidder_address);
        const bidderNo = toDecimal(get(row, colMap.bidder_no));
        const readoutPrice = toDecimal(get(row, colMap.readout_price));
        const remarks = get(row, colMap.remarks);
        const brandModel = get(row, colMap.brand_model);
        const warranty = get(row, colMap.warranty);

        if (!itemDesc) {
          summary.errors.push(`Skipped (no item description): ${JSON.stringify(row)}`);
          continue;
        }

        const wp = await upsertWorkPackage(client, projectId, wpDisplayName, sourceDocId);
        if (!seenWp.has(wp.id)) { seenWp.add(wp.id); summary.workPackages++; }

        const item = await upsertItem(client, projectId, wp.id, itemNo, itemDesc, unit, quantity, sourceDocId);
        if (!seenItems.has(item.id)) { seenItems.add(item.id); summary.items++; }
        await seedTable51SystemRows(client, item.id);

        if (bidderName) {
          const bidder = await upsertBidder(client, projectId, bidderName, bidderAddress, sourceDocId);
          if (!seenBidders.has(bidder.id)) { seenBidders.add(bidder.id); summary.bidders++; }
          const countRes = await client.query(`SELECT COUNT(*) FROM item_bidders WHERE item_id=$1`, [item.id]);
          const no = bidderNo || parseInt(countRes.rows[0].count) + 1;
          await linkBidderToItem(client, item.id, bidder, no, readoutPrice, remarks, sourceDocId, brandModel, warranty);
          summary.links++;
        }
      }
    }

    await client.query('COMMIT');
    logger.info('importTenderFile completed', summary);
    return { success: true, summary };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('importTenderFile failed', { err: err.message });
    return { success: false, error: err.message, summary };
  } finally {
    client.release();
  }
};

exports.importWorkPackageFile = async (projectId, wpId, filePath, uploadedBy, sourceDocId) => {
  const sheets = readAllSheets(filePath);
  const client = await getClient();
  const summary = { items: 0, bidders: 0, links: 0, errors: [] };
  const seenItems = new Set();
  const seenBidders = new Set();

  try {
    await client.query('BEGIN');

    for (const { sheetName, rows, colMap } of sheets) {
      for (const normalized of normalizeRows(rows, colMap, sheetName)) {
        const { row } = normalized;
        const itemNo = normalized.itemNo;
        const itemDesc = normalized.description;
        const unit = normalized.unit;
        const quantity = normalized.quantity;
        const bidderName = get(row, colMap.bidder_name);
        const bidderAddress = get(row, colMap.bidder_address);
        const bidderNo = toDecimal(get(row, colMap.bidder_no));
        const readoutPrice = toDecimal(get(row, colMap.readout_price));
        const remarks = get(row, colMap.remarks);
        const brandModel = get(row, colMap.brand_model);
        const warranty = get(row, colMap.warranty);

        if (!itemDesc && !bidderName) {
          summary.errors.push(`Skipped: ${JSON.stringify(row)}`);
          continue;
        }
        if (!itemDesc) {
          summary.errors.push(`Skipped (bidder row has no preceding item): ${JSON.stringify(row)}`);
          continue;
        }

        const item = await upsertItem(client, projectId, wpId, itemNo, itemDesc, unit, quantity, sourceDocId);
        if (!seenItems.has(item.id)) { seenItems.add(item.id); summary.items++; }
        await seedTable51SystemRows(client, item.id);

        if (bidderName) {
          const bidder = await upsertBidder(client, projectId, bidderName, bidderAddress, sourceDocId);
          if (!seenBidders.has(bidder.id)) { seenBidders.add(bidder.id); summary.bidders++; }
          const countRes = await client.query(`SELECT COUNT(*) FROM item_bidders WHERE item_id=$1`, [item.id]);
          const no = bidderNo || parseInt(countRes.rows[0].count) + 1;
          await linkBidderToItem(client, item.id, bidder, no, readoutPrice, remarks, sourceDocId, brandModel, warranty);
          summary.links++;
        }
      }
    }

    await client.query('COMMIT');
    return { success: true, summary };
  } catch (err) {
    await client.query('ROLLBACK');
    return { success: false, error: err.message, summary };
  } finally {
    client.release();
  }
};

exports.importItemFile = async (projectId, itemId, filePath, uploadedBy, sourceDocId) => {
  const sheets = readAllSheets(filePath);
  const client = await getClient();
  const summary = { bidders: 0, customFields: 0, errors: [] };

  try {
    await client.query('BEGIN');
    await seedTable51SystemRows(client, itemId);

    const BASE_ROLES = new Set([
      'bidder_name','bidder_address','bidder_no','readout_price','remarks',
      'item_no','item_desc','unit','quantity','work_package','work_package_code',
      'pre_bid_estimate','brand_model','warranty',
    ]);

    for (const { sheetName, rows, colMap } of sheets) {
      const allHeaders = rows.length ? Object.keys(rows[0]) : [];
      const mappedKeys = new Set(Object.values(colMap).filter(Boolean));
      const customCols = allHeaders.filter(h => !mappedKeys.has(h));

      for (let ci = 0; ci < customCols.length; ci++) {
        const col = customCols[ci];
        if (!col.trim()) continue;
        const fieldKey = `custom_${norm(col)}_${ci}`;
        await client.query(
          `INSERT INTO table51_rows (item_id, field_key, field_label, field_type, is_system, sort_order, source_document_id)
           VALUES ($1,$2,$3,'text',false,$4,$5)
           ON CONFLICT (item_id, field_key) DO UPDATE SET source_document_id=EXCLUDED.source_document_id`,
          [itemId, fieldKey, col.trim(), 100 + ci, sourceDocId || null]
        );
        summary.customFields++;
      }

      for (const row of rows) {
        const bidderName = get(row, colMap.bidder_name);
        const bidderAddress = get(row, colMap.bidder_address);
        const bidderNo = toDecimal(get(row, colMap.bidder_no));
        const readoutPrice = toDecimal(get(row, colMap.readout_price));
        const remarks = get(row, colMap.remarks);
        const brandModel = get(row, colMap.brand_model);
        const warranty = get(row, colMap.warranty);

        if (!bidderName) { summary.errors.push(`Skipped (no bidder name): ${JSON.stringify(row)}`); continue; }

        const bidder = await upsertBidder(client, projectId, bidderName, bidderAddress, sourceDocId);
        summary.bidders++;

        const countRes = await client.query(`SELECT COUNT(*) FROM item_bidders WHERE item_id=$1`, [itemId]);
        const no = bidderNo || parseInt(countRes.rows[0].count) + 1;
        await linkBidderToItem(client, itemId, bidder, no, readoutPrice, remarks, sourceDocId, brandModel, warranty);

        for (let ci = 0; ci < customCols.length; ci++) {
          const col = customCols[ci];
          const val = String(row[col] || '').trim();
          if (!val) continue;
          const fieldKey = `custom_${norm(col)}_${ci}`;
          await client.query(
            `UPDATE table51_rows
               SET values=jsonb_set(COALESCE(values,'{}'), $1, $2::jsonb, true), updated_at=NOW()
             WHERE item_id=$3 AND field_key=$4`,
            [`{${bidder.id}}`, JSON.stringify(val), itemId, fieldKey]
          );
        }
      }
    }

    await client.query('COMMIT');
    return { success: true, summary };
  } catch (err) {
    await client.query('ROLLBACK');
    return { success: false, error: err.message, summary };
  } finally {
    client.release();
  }
};