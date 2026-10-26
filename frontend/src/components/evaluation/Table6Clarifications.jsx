// frontend/src/components/evaluation/Table6Clarifications.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { itemEvalAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Check, X } from 'lucide-react';

export default function Table6Clarifications({ itemId, acceptedBidders = [], readOnly = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState({ bidder_id: '', query_text: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await itemEvalAPI.getTable6(itemId);
      setRows(res.data.rows || []);
    } catch { toast.error('Failed to load Table 6'); }
    finally { setLoading(false); }
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    setSaving(true);
    try {
      await itemEvalAPI.addTable6Row(itemId, newRow);
      toast.success('Row added');
      setNewRow({ bidder_id: '', query_text: '' });
      setShowAdd(false);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleSaveEdit = async (id) => {
    setSaving(true);
    try {
      await itemEvalAPI.updateTable6Row(id, editForm);
      toast.success('Updated');
      setEditingId(null);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this clarification row?')) return;
    try { await itemEvalAPI.deleteTable6Row(id); load(); }
    catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{
        background: 'linear-gradient(to right, var(--navy), var(--navy-medium))',
        borderRadius: '10px 10px 0 0',
        padding: '12px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'white', fontSize: 14 }}>
            Clarifications
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            {acceptedBidders.length} responsive bidders available
          </div>
        </div>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-accent btn-sm" onClick={() => setShowAdd(true)}>
              <Plus size={13} /> Add Row
            </button>
          </div>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#e8eef5' }}>
            <tr>
              <th style={thStyle}>No.</th>
              <th style={thStyle}>Bidder</th>
              <th style={thStyle}>Nature of Clarification</th>
              {!readOnly && <th style={thStyle}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              editingId === row.id ? (
                <tr key={row.id} style={{ background: '#fffde7' }}>
                  <td style={tdStyle}>{row.clarification_no}</td>
                  <td style={tdStyle}>
                    <select className="form-control" style={{ fontSize: 12 }} value={editForm.bidder_id || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, bidder_id: e.target.value }))}>
                      <option value="">Select…</option>
                      {acceptedBidders.map((b) => <option key={b.bidder_id || b.id} value={b.bidder_id || b.id}>{b.bidder_name || b.name}</option>)}
                    </select>
                  </td>
                  <td style={tdStyle}><textarea className="form-control" rows={2} style={{ fontSize: 12 }} value={editForm.query_text || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, query_text: e.target.value }))} /></td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-success btn-sm" onClick={() => handleSaveEdit(row.id)} disabled={saving}><Check size={12} /></button>
                      <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}><X size={12} /></button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{row.clarification_no}</td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{row.bidder_name || '—'}</td>
                  <td style={{ ...tdStyle, maxWidth: 500 }}>{row.query_text || row.subject || '—'}</td>
                  {!readOnly && (
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => { setEditingId(row.id); setEditForm({ ...row }); }}><Edit size={12} /></button>
                        <button className="btn btn-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none' }}
                          onClick={() => handleDelete(row.id)}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={2 + (readOnly ? 0 : 1)} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                No clarifications. Click "+ Add Row" to add a clarification request.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Inline add form */}
      {showAdd && !readOnly && (
        <div style={{ marginTop: 10, padding: '14px 16px', background: '#f0f7ff', borderRadius: 8, border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)', marginBottom: 10 }}>New Clarification Row</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label">Bidder</label>
              <select className="form-control" value={newRow.bidder_id}
                onChange={(e) => setNewRow((r) => ({ ...r, bidder_id: e.target.value }))}>
                <option value="">Select bidder…</option>
                {acceptedBidders.map((b) => (
                  <option key={b.bidder_id || b.id} value={b.bidder_id || b.id}>
                    {b.bidder_name || b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Nature of Clarification</label>
              <textarea className="form-control" rows={2} value={newRow.query_text}
                onChange={(e) => setNewRow((r) => ({ ...r, query_text: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-navy btn-sm" onClick={handleAdd} disabled={saving}>
              {saving ? 'Saving…' : <><Check size={13} /> Add Row</>}
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--navy)', borderRight: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const tdStyle = { padding: '9px 12px', fontSize: 13, borderRight: '1px solid var(--border-light)', verticalAlign: 'top' };