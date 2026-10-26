import React, { useEffect, useState, useCallback } from 'react';
import { itemEvalAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Check, X } from 'lucide-react';

const COMPLIANCE_OPTIONS = ['Compiled', 'Not Compiled', 'N/A', 'Partially Compiled'];

export default function TechnicalSpecCompliance({ itemId, readOnly = false }) {
  const [rows, setRows] = useState([]);
  const [bidders, setBidders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState({ feature: '', requirement: '' });

  const load = useCallback(async () => {
    try {
      const res = await itemEvalAPI.getTechSpec(itemId);
      setRows(res.data.rows || []);
      setBidders(res.data.bidders || []);
    } catch { toast.error('Failed to load Technical Spec'); }
    finally { setLoading(false); }
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  // Optimistic cell change
  const handleCellChange = async (rowId, bidderId, value) => {
    // Update locally first
    setRows(prev => prev.map(r =>
      r.id === rowId
        ? { ...r, values: { ...(r.values || {}), [bidderId]: value } }
        : r
    ));
    try {
      await itemEvalAPI.updateTechSpecCell(rowId, { bidder_id: bidderId, value });
    } catch {
      toast.error('Save failed');
      load();
    }
  };

  const handleAddRow = async () => {
    if (!newRow.feature.trim()) { toast.error('Feature required'); return; }
    try {
      await itemEvalAPI.addTechSpecRow(itemId, newRow);
      setNewRow({ feature: '', requirement: '' });
      setShowAdd(false);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this specification row?')) return;
    setRows(prev => prev.filter(r => r.id !== id));
    try { await itemEvalAPI.deleteTechSpecRow(id); }
    catch (e) { toast.error(e.message); load(); }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const getCellValue = (row, bidderId) => (row.values || {})[bidderId] || '';

  return (
    <div>
      <div style={{
        background: 'linear-gradient(to right, var(--navy), var(--navy-medium))',
        borderRadius: '10px 10px 0 0', padding: '12px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'white', fontSize: 14 }}>
            Technical Specification Compliance
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            {rows.length} specification rows · {bidders.length} bidders
          </div>
        </div>
        {!readOnly && (
          <button className="btn btn-accent btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={13} /> Add Spec Row
          </button>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${340 + bidders.length * 160}px` }}>
          <thead style={{ background: '#e8eef5' }}>
            <tr>
              <th style={{ ...thS, minWidth: 180 }}>Feature / Specification</th>
              <th style={{ ...thS, minWidth: 200 }}>Requirement</th>
              {bidders.map(b => (
                <th key={b.bidder_id} style={{ ...thS, textAlign: 'center', minWidth: 150, color: 'var(--blue)' }}>
                  {b.bidder_name}
                </th>
              ))}
              {!readOnly && <th style={{ ...thS, width: 40 }} />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} style={{ background: idx % 2 === 0 ? 'white' : '#fafbfc', borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ ...tdS, fontWeight: 500 }}>{row.feature}</td>
                <td style={{ ...tdS, fontSize: 12, color: 'var(--text-secondary)' }}>{row.requirement || '—'}</td>
                {bidders.map(b => {
                  const val = getCellValue(row, b.bidder_id);
                  const color = val === 'Compiled' ? 'var(--success)'
                    : val === 'Not Compiled' ? 'var(--danger)'
                    : val === 'Partially Compiled' ? 'var(--warning)'
                    : 'var(--text-muted)';
                  return (
                    <td key={b.bidder_id} style={{ ...tdS, textAlign: 'center' }}>
                      {readOnly ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color }}>{val || '—'}</span>
                      ) : (
                        <select value={val}
                          onChange={e => handleCellChange(row.id, b.bidder_id, e.target.value)}
                          style={{
                            padding: '4px 8px', borderRadius: 5, fontSize: 12, fontWeight: 600,
                            border: `1.5px solid ${color}`, color, background: 'white',
                            cursor: 'pointer', width: '100%', transition: 'all .1s'
                          }}>
                          <option value="">—</option>
                          {COMPLIANCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                    </td>
                  );
                })}
                {!readOnly && (
                  <td style={{ ...tdS, textAlign: 'center' }}>
                    <button className="btn btn-sm" onClick={() => handleDelete(row.id)}
                      style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', padding: '3px 6px' }}>
                      <Trash2 size={11} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={2 + bidders.length + (readOnly ? 0 : 1)} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)', fontSize: 13 }}>
                No specification rows. Click "+ Add Spec Row" to add features.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && !readOnly && (
        <div style={{ marginTop: 10, padding: '14px 16px', background: '#f0f7ff', borderRadius: 8, border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)', marginBottom: 10 }}>Add Specification Row</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Feature *</label>
              <input className="form-control" value={newRow.feature}
                onChange={e => setNewRow(r => ({ ...r, feature: e.target.value }))}
                placeholder="e.g. Display, Processor, FOV" />
            </div>
            <div style={{ flex: 2 }}>
              <label className="form-label">Requirement</label>
              <input className="form-control" value={newRow.requirement}
                onChange={e => setNewRow(r => ({ ...r, requirement: e.target.value }))}
                placeholder="e.g. Micro-OLED 1920×1080, 120Hz" />
            </div>
            <button className="btn btn-navy" onClick={handleAddRow}><Check size={14} /> Add</button>
            <button className="btn btn-outline" onClick={() => setShowAdd(false)}><X size={14} /></button>
          </div>
        </div>
      )}

      {bidders.length === 0 && (
        <div className="alert alert-info" style={{ marginTop: 10 }}>
          No bidders linked to this item yet.
        </div>
      )}
    </div>
  );
}

const thS = { padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--navy)', borderRight: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const tdS = { padding: '9px 14px', fontSize: 13, borderRight: '1px solid var(--border-light)', verticalAlign: 'middle' };
