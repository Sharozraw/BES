// frontend/src/components/admin/TenderCreation.jsx
//
// Shown inside ProjectDetailPage as the "Tender Setup" tab.
// Sections: 1) Global file import  2) Global bidder pool  3) Work packages + items

import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { tenderAPI, documentsAPI, biddersAPI } from '../../utils/api';
import { usersAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Plus, Upload, Trash2, Edit, X, Check,
  ChevronDown, ChevronRight, FolderOpen, Users, FileSpreadsheet
} from 'lucide-react';

// ─── Qty formatter — whole numbers, no trailing decimals ──────────────────────
const formatQty = (q) => {
  if (q === null || q === undefined || q === '') return '—';
  const n = Number(q);
  if (isNaN(n)) return '—';
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
};

// ─── tiny helpers ─────────────────────────────────────────────────────────────

const FileDrop = ({ label, onFile, accept = '.xlsx,.xls,.csv' }) => {
  const ref = useRef();
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const handle = async (file) => {
    if (!file) return;
    setSelectedFile(file);
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }).slice(0, 6);
      setPreview({ sheet: workbook.SheetNames[0], rows: matrix });
    } catch { setPreview({ sheet: '', rows: [] }); }
    finally { setUploading(false); }
  };

  const confirmUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try { await onFile(selectedFile); setSelectedFile(null); setPreview(null); }
    finally { setUploading(false); }
  };

  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${over ? 'var(--blue)' : 'var(--border)'}`,
        borderRadius: 8, padding: '18px 20px',
        background: over ? '#e3f2fd' : 'var(--bg)',
        cursor: 'pointer', textAlign: 'center', transition: 'all .15s'
      }}
    >
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }}
        onChange={(e) => handle(e.target.files[0])} />
      {uploading
        ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Parsing file…</span>
          </div>
        : selectedFile && preview ? <>
            <div style={{ textAlign: 'left' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Preview: {selectedFile.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                Sheet: {preview.sheet || '—'} · First {Math.max(preview.rows.length - 1, 0)} data rows shown
              </div>
              {preview.rows.length > 0 && (
                <div style={{ overflowX: 'auto', background: 'white', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <table style={{ fontSize: 10, width: '100%' }}>
                    <tbody>{preview.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} style={{ padding: '4px 6px', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>{String(cell)}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" className="btn btn-navy btn-sm" onClick={confirmUpload}>Confirm Import</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => { setSelectedFile(null); setPreview(null); }}>Choose Another</button>
              </div>
            </div>
          </> : <>
            <FileSpreadsheet size={22} color="var(--text-muted)" style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              .xlsx / .xls / .csv — drag & drop or click
            </div>
          </>
      }
    </div>
  );
};

// ─── main component ───────────────────────────────────────────────────────────

export default function TenderCreation({ projectId }) {
  const [globalBidders, setGlobalBidders] = useState([]);
  const [workPackages, setWorkPackages] = useState([]);
  const [items, setItems] = useState([]);
  const [evaluators, setEvaluators] = useState([]);
  const [loading, setLoading] = useState(true);

  const [expandedWPs, setExpandedWPs] = useState({});
  const [showBidderModal, setShowBidderModal] = useState(false);
  const [showWPModal, setShowWPModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingWP, setEditingWP] = useState(null);
  const [targetWPId, setTargetWPId] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [imports, setImports] = useState([]);

  const load = useCallback(async () => {
    try {
      const [bRes, wRes, iRes, eRes, dRes] = await Promise.all([
        tenderAPI.getGlobalBidders(projectId),
        tenderAPI.getWorkPackages(projectId),
        tenderAPI.getItems(projectId),
        usersAPI.getEvaluators(),
        documentsAPI.getByProject(projectId),
      ]);
      setGlobalBidders(bRes.data || []);
      setWorkPackages(wRes.data || []);
      setItems(iRes.data || []);
      setEvaluators(eRes.data || []);
      setImports((dRes.data || []).filter(d => ['tender_import', 'work_package_import', 'item_import'].includes(d.document_type)));
    } catch { toast.error('Failed to load tender data'); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleTenderFile = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await tenderAPI.importTenderFile(projectId, fd);
      setImportSummary(res.summary);
      toast.success(`Imported: ${res.summary.workPackages} WPs, ${res.summary.items} items, ${res.summary.bidders} bidders`);
      load();
    } catch (e) {
      toast.error(e.message || 'Import failed');
    }
  };

  const itemsForWP = (wpId) => items.filter((i) => i.work_package_id === wpId);
  const toggleWP = (id) => setExpandedWPs((p) => ({ ...p, [id]: !p[id] }));

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const deleteImport = async (document) => {
    if (!window.confirm(`Delete ${document.original_name || document.file_name} and all data imported from it?`)) return;
    try {
      await tenderAPI.deleteImport(projectId, document.id);
      toast.success('Imported file and generated data deleted');
      load();
    } catch (e) { toast.error(e.message || 'Delete failed'); }
  };

  return (
    <div>
      {/* ── Section 1: Global tender import ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">📂 Global Tender File Import</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Excel/CSV with columns: Work Package ID | Work Package Name | Item No | Item Description | Quantity | Bidder Name | Bidder Address | Bid Price
          </span>
        </div>
        <div className="card-body">
          <FileDrop
            label="Drop tender Excel/CSV here — auto-creates Work Packages → Items → Bidders"
            onFile={handleTenderFile}
          />
          {importSummary && (
            <div className="alert alert-success" style={{ marginTop: 12 }}>
              <strong>Import complete:</strong>{' '}
              {importSummary.workPackages} work packages · {importSummary.items} items ·{' '}
              {importSummary.bidders} bidders · {importSummary.links} bidder-item links
              {importSummary.errors?.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--warning)' }}>
                  {importSummary.errors.length} rows skipped
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Global Bidder Pool (Email/Phone/Reg. No. REMOVED) ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title"><Users size={14} style={{ display: 'inline', marginRight: 6 }} />Global Bidder Pool ({globalBidders.length})</span>
          <button className="btn btn-navy btn-sm" onClick={() => setShowBidderModal(true)}>
            <Plus size={13} /> Add Bidder
          </button>
        </div>
        {globalBidders.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No bidders yet. Add manually or import a file above.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Bidder Name</th>
                  <th>Address</th>
                  <th>Items</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {globalBidders.map((b, i) => (
                  <tr key={b.id}>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{b.name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{b.address || '—'}</td>
                    <td>
                      <span style={{ background: 'var(--bg)', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                        {b.item_ids?.length || 0}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm" style={{ color: 'var(--danger)', background: 'var(--danger-light)', border: 'none' }}
                        onClick={async () => {
                          if (!window.confirm(`Remove ${b.name} from the global bidder pool and all item mappings?`)) return;
                          try { await biddersAPI.delete(b.id); toast.success('Bidder removed'); load(); }
                          catch (e) { toast.error(e.message || 'Bidder deletion failed'); }
                        }}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 3: Work Packages ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 600, color: 'var(--navy)' }}>
          Work Packages ({workPackages.length})
        </h3>
        <button className="btn btn-navy btn-sm" onClick={() => { setEditingWP(null); setShowWPModal(true); }}>
          <Plus size={13} /> New Work Package
        </button>
      </div>

      {workPackages.length === 0 && (
        <div className="empty-state">
          <div className="empty-title">No work packages</div>
          <p style={{ fontSize: 13 }}>Create work packages manually or import a file above.</p>
        </div>
      )}
      {imports.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border-light)', paddingTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Imported Files</div>
          {imports.map(document => (
            <div key={document.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: 12 }}>{document.original_name || document.file_name} <span style={{ color: 'var(--text-muted)' }}>({document.document_type.replace('_', ' ')})</span></span>
              <button className="btn btn-sm" style={{ color: 'var(--danger)', background: 'var(--danger-light)', border: 'none' }} onClick={() => deleteImport(document)}><Trash2 size={12} /> Delete Data</button>
            </div>
          ))}
        </div>
      )}

      {workPackages.map((wp) => (
        <WorkPackageCard
          key={wp.id}
          wp={wp}
          items={itemsForWP(wp.id)}
          projectId={projectId}
          evaluators={evaluators}
          globalBidders={globalBidders}
          expanded
          onToggle={() => toggleWP(wp.id)}
          onEdit={() => { setEditingWP(wp); setShowWPModal(true); }}
          onAddItem={() => { setTargetWPId(wp.id); setShowItemModal(true); }}
          onRefresh={load}
        />
      ))}

      {items.filter((i) => !i.work_package_id).length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-title">Items (no Work Package)</span>
            <button className="btn btn-outline btn-sm" onClick={() => { setTargetWPId(null); setShowItemModal(true); }}>
              <Plus size={13} /> Add Item
            </button>
          </div>
          <ItemTable
            items={items.filter((i) => !i.work_package_id)}
            projectId={projectId}
            globalBidders={globalBidders}
            evaluators={evaluators}
            onRefresh={load}
          />
        </div>
      )}

      {items.filter((i) => !i.work_package_id).length === 0 && workPackages.length === 0 && (
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={() => { setTargetWPId(null); setShowItemModal(true); }}>
            <Plus size={13} /> Add Standalone Item
          </button>
        </div>
      )}

      {showBidderModal && (
        <GlobalBidderModal
          projectId={projectId}
          items={items}
          onClose={() => setShowBidderModal(false)}
          onSaved={() => { setShowBidderModal(false); load(); }}
        />
      )}
      {showWPModal && (
        <WorkPackageModal
          projectId={projectId}
          evaluators={evaluators}
          editing={editingWP}
          onClose={() => setShowWPModal(false)}
          onSaved={() => { setShowWPModal(false); load(); }}
        />
      )}
      {showItemModal && (
        <ItemModal
          projectId={projectId}
          workPackageId={targetWPId}
          evaluators={evaluators}
          onClose={() => setShowItemModal(false)}
          onSaved={() => { setShowItemModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── WorkPackageCard ──────────────────────────────────────────────────────────

function WorkPackageCard({ wp, items, projectId, evaluators, globalBidders, expanded, onToggle, onEdit, onAddItem, onRefresh }) {
  const [importing, setImporting] = useState(false);

  const handleWPFile = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    setImporting(true);
    try {
      const res = await tenderAPI.importWorkPackageFile(projectId, wp.id, fd);
      toast.success(`WP import: ${res.summary.items} items, ${res.summary.bidders} bidders`);
      onRefresh();
    } catch (e) { toast.error(e.message || 'Import failed'); }
    finally { setImporting(false); }
  };

  return (
    <div className="stage-card" style={{ marginBottom: 10 }}>
      <div className="stage-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ChevronDown size={16} color="white" />
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, color: 'white', fontSize: 14 }}>
              {wp.name}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              {items.length} items · Evaluator: {wp.evaluator_name || 'Admin (default)'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none' }} onClick={onEdit}>
            <Edit size={12} />
          </button>
          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none' }} onClick={onAddItem}>
            <Plus size={12} />
          </button>
          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: '#fecaca', border: 'none' }} onClick={async () => {
            if (!window.confirm(`Delete work package "${wp.name}" and its items?`)) return;
            try { await tenderAPI.deleteWorkPackage(wp.id); toast.success('Work package deleted'); onRefresh(); }
            catch (e) { toast.error(e.message || 'Work package deletion failed'); }
          }} title="Delete work package">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="stage-body">
          <div style={{ marginBottom: 16 }}>
            <FileDrop
              label={`Import Excel/CSV for "${wp.name}" — creates Items + Bidders under this WP`}
              onFile={handleWPFile}
            />
          </div>
          <ItemTable
            items={items}
            projectId={projectId}
            globalBidders={globalBidders}
            evaluators={evaluators}
            onRefresh={onRefresh}
          />
          {items.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>
              No items yet in this work package.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ItemTable ────────────────────────────────────────────────────────────────

function ItemTable({ items, projectId, globalBidders, evaluators = [], onRefresh }) {
  const [showAssignModal, setShowAssignModal] = useState(null);
  const [showImportModal, setShowImportModal] = useState(null);
  const navigate = (id) => window.location.assign(`/items/${id}`);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item and all its evaluation data?')) return;
    try {
      await tenderAPI.deleteItem(id);
      toast.success('Item deleted');
      onRefresh();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Item No.</th><th>Description</th><th>Unit</th><th>Qty</th>
            <th>Bidders</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>{item.item_no || '—'}</td>
              <td style={{ fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.description}
              </td>
              <td style={{ fontSize: 12 }}>{item.unit || '—'}</td>
              <td style={{ fontSize: 12 }}>{formatQty(item.quantity)}</td>
              <td>
                <span style={{ background: 'var(--bg)', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                  {item.bidder_count || 0}
                </span>
              </td>
              <td>
                <span className={`badge badge-${item.eval_status === 'evaluation' ? 'in_evaluation' : 'draft'}`}>
                  {item.eval_status === 'evaluation' ? 'Evaluation' : 'Creation'}
                </span>
              </td>
              <td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => navigate(item.id)}>
                    Open
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowAssignModal(item)}>
                    <Users size={11} />
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowImportModal(item)} title="Import bidders for this item">
                    <Upload size={11} />
                  </button>
                  <button className="btn btn-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none' }}
                    onClick={() => handleDelete(item.id)}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showAssignModal && (
        <AssignBidderModal
          item={showAssignModal}
          globalBidders={globalBidders}
          onClose={() => setShowAssignModal(null)}
          onSaved={() => { setShowAssignModal(null); onRefresh(); }}
        />
      )}
      {showImportModal && (
        <ItemImportModal
          projectId={projectId}
          item={showImportModal}
          onClose={() => setShowImportModal(null)}
          onSaved={() => { setShowImportModal(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function GlobalBidderModal({ projectId, items, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', address: '', email: '', phone: '', registration_no: '', item_ids: [] });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleItem = (id) => set('item_ids', form.item_ids.includes(id) ? form.item_ids.filter((x) => x !== id) : [...form.item_ids, id]);

  const handleSave = async () => {
    if (!form.name) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      await tenderAPI.createGlobalBidder(projectId, form);
      toast.success('Bidder added');
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>Add Global Bidder</h3>
          <button className="btn btn-icon btn-outline" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid form-grid-2">
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Bidder Name *</label>
              <input className="form-control" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Company name" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Address</label>
              <textarea className="form-control" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-control" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Registration No.</label>
              <input className="form-control" value={form.registration_no} onChange={(e) => set('registration_no', e.target.value)} />
            </div>
          </div>
          {items.length > 0 && (
            <div className="form-group">
              <label className="form-label">Assign to Items (multi-select)</label>
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                {items.map((item) => (
                  <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', cursor: 'pointer',
                    borderRadius: 6, background: form.item_ids.includes(item.id) ? '#e3f2fd' : 'transparent' }}>
                    <input type="checkbox" checked={form.item_ids.includes(item.id)} onChange={() => toggleItem(item.id)} />
                    <span style={{ fontSize: 13 }}>{item.item_no && `[${item.item_no}] `}{item.description}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-navy" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : <><Check size={14} /> Add Bidder</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkPackageModal({ projectId, evaluators, editing, onClose, onSaved }) {
  const [form, setForm] = useState({ name: editing?.name || '', description: editing?.description || '', evaluator_id: editing?.evaluator_id || '' });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      let workPackageId = editing?.id;
      if (editing) {
        await tenderAPI.updateWorkPackage(editing.id, form);
        toast.success('Work package updated');
      } else {
        const response = await tenderAPI.createWorkPackage(projectId, form);
        workPackageId = response.data.id;
        toast.success('Work package created');
      }
      if (file && workPackageId) {
        const fd = new FormData();
        fd.append('file', file);
        await tenderAPI.importWorkPackageFile(projectId, workPackageId, fd);
        toast.success('Work package file imported');
      }
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>{editing ? 'Edit' : 'New'} Work Package</h3>
          <button className="btn btn-icon btn-outline" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-control" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Civil Works" />
          </div>
          <div className="form-group">
            <label className="form-label">Work Package Items/Bidders File</label>
            <input type="file" accept=".xlsx,.xls,.csv" className="form-control"
              onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Assigned Evaluator <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(blank = Admin)</span></label>
            <select className="form-control" value={form.evaluator_id} onChange={(e) => set('evaluator_id', e.target.value)}>
              <option value="">— Admin (fallback) —</option>
              {evaluators.map((u) => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name} · {u.designation}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-navy" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : <><Check size={14} /> {editing ? 'Update' : 'Create'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemModal({ projectId, workPackageId, evaluators = [], onClose, onSaved }) {
  const [form, setForm] = useState({ item_no: '', description: '', unit: '', quantity: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.description) { toast.error('Description required'); return; }
    setSaving(true);
    try {
      await tenderAPI.createItem(projectId, { ...form, work_package_id: workPackageId });
      toast.success('Item created');
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>New Item</h3>
          <button className="btn btn-icon btn-outline" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Item No.</label>
              <input className="form-control" value={form.item_no} onChange={(e) => set('item_no', e.target.value)} placeholder="e.g. 1.1" />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <input className="form-control" value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="Nos, m³…" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Description *</label>
              <textarea className="form-control" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Item description" />
            </div>
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input type="number" className="form-control" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Evaluator Override</label>
              <select className="form-control" value={form.evaluator_id || ''} onChange={e => set('evaluator_id', e.target.value)}>
                <option value="">Use work package/tender default</option>
                {evaluators.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-navy" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : <><Check size={14} /> Create Item</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignBidderModal({ item, globalBidders, onClose, onSaved }) {
  const [form, setForm] = useState({ bidder_id: '', readout_price: '', remarks: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.bidder_id) { toast.error('Select a bidder'); return; }
    setSaving(true);
    try {
      await tenderAPI.assignBidderToItem(item.id, form);
      toast.success('Bidder assigned');
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>Assign Bidder to Item</h3>
          <button className="btn btn-icon btn-outline" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Item: {item.description}</div>
          <div className="form-group">
            <label className="form-label">Bidder *</label>
            <select className="form-control" value={form.bidder_id} onChange={(e) => setForm((f) => ({ ...f, bidder_id: e.target.value }))}>
              <option value="">Select bidder…</option>
              {globalBidders.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Readout Price (Rs.)</label>
            <input type="number" className="form-control" value={form.readout_price}
              onChange={(e) => setForm((f) => ({ ...f, readout_price: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Remarks</label>
            <input className="form-control" value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-navy" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : <><Check size={14} /> Assign</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemImportModal({ projectId, item, onClose, onSaved }) {
  const handleImport = async file => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await tenderAPI.importItemFile(projectId, item.id, formData);
      toast.success(`Imported ${result.summary?.bidders || 0} bidder(s) for this item`);
      onSaved();
    } catch (e) { toast.error(e.message || 'Item import failed'); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>Import Item Data</h3>
          <button className="btn btn-icon btn-outline" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{item.description}</div>
          <FileDrop label="Preview and import this item's Excel/CSV" onFile={handleImport} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}