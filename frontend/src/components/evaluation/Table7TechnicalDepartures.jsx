// frontend/src/components/evaluation/Table7TechnicalDepartures.jsx
// Departures from Technical Specifications
import React, { useEffect, useState, useCallback } from 'react';
import { itemEvalAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Check, X, AlertTriangle } from 'lucide-react';

const emptyRow = {
  bidder_id: '', item_description: '', requirement: '', offered: '',
  bid_rejected: false, is_minor: false
};

export default function Table7TechnicalDepartures({ itemId, acceptedBidders = [], readOnly = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState(emptyRow);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await itemEvalAPI.getTable7(itemId);
      setRows(res.data.rows || []);
    } catch { toast.error('Failed to load Table 7.1'); }
    finally { setLoading(false); }
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    setSaving(true);
    try {
      await itemEvalAPI.addTable7Row(itemId, {
        ...newRow,
      });
      toast.success('Row added');
      setNewRow(emptyRow);
      setShowAdd(false);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleSaveEdit = async (id) => {
    setSaving(true);
    try {
      await itemEvalAPI.updateTable7Row(id, {
        ...editForm,
      });
      toast.success('Updated');
      setEditingId(null);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this row?')) return;
    try { await itemEvalAPI.deleteTable7Row(id); load(); }
    catch (e) { toast.error(e.message); }
  };

  const toggleRejection = async (row) => {
    const newVal = !row.bid_rejected;
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, bid_rejected: newVal } : r));
    try {
      await itemEvalAPI.updateTable7Row(row.id, { ...row, bid_rejected: newVal });
      toast.success(newVal ? 'Bid marked non-responsive — excluded from Financial Eval.' : 'Bid reinstated');
    } catch (e) {
      toast.error(e.message);
      load();
    }
  };

  const rejectedIds = new Set(rows.filter(r => r.bid_rejected).map(r => r.bidder_id));

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      {rejectedIds.size > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 12 }}>
          <AlertTriangle size={14} />
          <span><strong>{rejectedIds.size} bidder(s)</strong> marked non-responsive — excluded from Table 8.1.</span>
        </div>
      )}

      <div style={{
        background: 'linear-gradient(to right, var(--navy), var(--navy-medium))',
        borderRadius: '10px 10px 0 0', padding: '12px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'white', fontSize: 14 }}>
            Departures from Technical Specifications
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            "Bid Rejected = Yes" removes bidder from financial evaluation
          </div>
        </div>
        {!readOnly && (
          <button className="btn btn-accent btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={13} /> Add Row
          </button>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#e8eef5' }}>
            <tr>
              <th style={thS}>Bidder Name</th>
              <th style={thS}>Item Descriptions</th>
              <th style={thS}>Requirement (Spec)</th>
              <th style={thS}>Offered / Suggested</th>
              <th style={thS}>Minor Deviation?</th>
              <th style={{ ...thS, color: 'var(--danger)' }}>Bid Rejected as Non-Responsive?</th>
              {!readOnly && <th style={thS}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              editingId === row.id ? (
                <tr key={row.id} style={{ background: '#fffde7' }}>
                  <td style={tdS}>
                    <select className="form-control" style={{ fontSize: 12 }} value={editForm.bidder_id || ''}
                      onChange={e => setEditForm(f => ({ ...f, bidder_id: e.target.value }))}>
                      <option value="">Select…</option>
                      {acceptedBidders.map(b => (
                        <option key={b.bidder_id || b.id} value={b.bidder_id || b.id}>
                          {b.bidder_name || b.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={tdS}><textarea className="form-control" rows={2} style={{ fontSize: 12 }} value={editForm.item_description || ''}
                    onChange={e => setEditForm(f => ({ ...f, item_description: e.target.value }))} /></td>
                  <td style={tdS}><textarea className="form-control" rows={2} style={{ fontSize: 12 }} value={editForm.requirement || ''}
                    onChange={e => setEditForm(f => ({ ...f, requirement: e.target.value }))} /></td>
                  <td style={tdS}><textarea className="form-control" rows={2} style={{ fontSize: 12 }} value={editForm.offered || ''}
                    onChange={e => setEditForm(f => ({ ...f, offered: e.target.value }))} /></td>
                  <td style={{ ...tdS, textAlign: 'center' }}>
                    <button type="button" className={`toggle ${editForm.is_minor ? 'on' : ''}`}
                      onClick={() => setEditForm(f => ({ ...f, is_minor: !f.is_minor }))}>
                      <div className="toggle-thumb" />
                    </button>
                  </td>
                  <td style={{ ...tdS, textAlign: 'center' }}>
                    <button type="button" className={`toggle ${editForm.bid_rejected ? 'on' : ''}`}
                      onClick={() => setEditForm(f => ({ ...f, bid_rejected: !f.bid_rejected }))}>
                      <div className="toggle-thumb" />
                    </button>
                  </td>
                  <td style={tdS}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-success btn-sm" onClick={() => handleSaveEdit(row.id)} disabled={saving}><Check size={12} /></button>
                      <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}><X size={12} /></button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border-light)', background: row.bid_rejected ? '#fff5f5' : 'transparent' }}>
                  <td style={{ ...tdS, fontWeight: row.bid_rejected ? 700 : 500 }}>
                    {row.bidder_name || '—'}
                    {row.bid_rejected && <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2 }}>REJECTED</div>}
                  </td>
                  <td style={{ ...tdS, fontSize: 12 }}>{row.item_description || '—'}</td>
                  <td style={{ ...tdS, fontSize: 12 }}>{row.requirement || '—'}</td>
                  <td style={{ ...tdS, fontSize: 12 }}>{row.offered || '—'}</td>
                  <td style={{ ...tdS, textAlign: 'center' }}>
                    <span className={`badge badge-${row.is_minor ? 'pending' : 'draft'}`}>
                      {row.is_minor ? 'Minor' : 'Major'}
                    </span>
                  </td>
                  <td style={{ ...tdS, textAlign: 'center' }}>
                    {!readOnly ? (
                      <button type="button" onClick={() => toggleRejection(row)} style={{
                        padding: '5px 14px', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                        border: `2px solid ${row.bid_rejected ? 'var(--danger)' : 'var(--success)'}`,
                        background: row.bid_rejected ? 'var(--danger-light)' : 'var(--success-light)',
                        color: row.bid_rejected ? 'var(--danger)' : 'var(--success)',
                      }}>{row.bid_rejected ? 'YES' : 'NO'}</button>
                    ) : (
                      <span className={`badge badge-${row.bid_rejected ? 'eliminated' : 'pass'}`}>
                        {row.bid_rejected ? 'YES' : 'NO'}
                      </span>
                    )}
                  </td>
                  {!readOnly && (
                    <td style={tdS}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-outline btn-sm"
                          onClick={() => { setEditingId(row.id); setEditForm({ ...row }); }}><Edit size={12} /></button>
                        <button className="btn btn-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none' }}
                          onClick={() => handleDelete(row.id)}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={readOnly ? 6 : 7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                No technical departures recorded.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add form */}
      {showAdd && !readOnly && (
        <div style={{ marginTop: 10, padding: '14px 16px', background: '#f0f7ff', borderRadius: 8, border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)', marginBottom: 10 }}>New Departure Row</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label">Bidder</label>
              <select className="form-control" value={newRow.bidder_id}
                onChange={e => setNewRow(r => ({ ...r, bidder_id: e.target.value }))}>
                <option value="">Select…</option>
                {acceptedBidders.map(b => (
                  <option key={b.bidder_id || b.id} value={b.bidder_id || b.id}>{b.bidder_name || b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Item Description</label>
              <input className="form-control" value={newRow.item_description}
                onChange={e => setNewRow(r => ({ ...r, item_description: e.target.value }))}
                placeholder="e.g. Keyboard" />
            </div>
            <div>
              <label className="form-label">Requirement</label>
              <input className="form-control" value={newRow.requirement}
                onChange={e => setNewRow(r => ({ ...r, requirement: e.target.value }))}
                placeholder="128 Key Standard English Keyboard" />
            </div>
            <div>
              <label className="form-label">Offered / Suggested</label>
              <input className="form-control" value={newRow.offered}
                onChange={e => setNewRow(r => ({ ...r, offered: e.target.value }))}
                placeholder="Logitech MK120 Keyboard" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <button type="button" className={`toggle ${newRow.is_minor ? 'on' : ''}`}
                onClick={() => setNewRow(r => ({ ...r, is_minor: !r.is_minor }))}>
                <div className="toggle-thumb" />
              </button>
              Minor Deviation
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <button type="button" className={`toggle ${newRow.bid_rejected ? 'on' : ''}`}
                onClick={() => setNewRow(r => ({ ...r, bid_rejected: !r.bid_rejected }))}>
                <div className="toggle-thumb" />
              </button>
              Reject Bid
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-navy btn-sm" onClick={handleAdd} disabled={saving}>
              {saving ? 'Saving…' : <><Check size={13} /> Add Row</>}
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => { setShowAdd(false); setNewRow(emptyRow); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

const thS = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--navy)', borderRight: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const tdS = { padding: '9px 12px', fontSize: 13, borderRight: '1px solid var(--border-light)', verticalAlign: 'top' };