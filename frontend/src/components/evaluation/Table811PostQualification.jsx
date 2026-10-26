import React, { useEffect, useState, useCallback } from 'react';
import { itemEvalAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Award, Check, X } from 'lucide-react';

export default function Table811PostQualification({ itemId, readOnly = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCriteria, setNewCriteria] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await itemEvalAPI.getTable811(itemId);
      setRows(res.data || []);
    } catch { toast.error('Failed to load Post-Qualification'); }
    finally { setLoading(false); }
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  // Optimistic toggle — update local state immediately
  const handleToggle = async (rowId, field, currentRows) => {
    const row = currentRows.find(r => r.id === rowId);
    if (!row) return;
    const updated = {
      complied: field === 'complied' ? !row.complied : row.complied,
      accepted: field === 'accepted' ? !row.accepted : row.accepted,
      notes: row.notes,
    };
    // Instant local update
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, ...updated } : r));
    try {
      await itemEvalAPI.updateTable811Row(rowId, updated);
    } catch (e) {
      toast.error(e.message);
      load(); // revert
    }
  };

  const handleNotes = async (rowId, notes, currentRows) => {
    const row = currentRows.find(r => r.id === rowId);
    if (!row) return;
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, notes } : r));
    try {
      await itemEvalAPI.updateTable811Row(rowId, { complied: row.complied, accepted: row.accepted, notes });
    } catch { /* silent */ }
  };

  const handleAddCriteria = async () => {
    if (!newCriteria.trim()) { toast.error('Criteria label required'); return; }
    try {
      await itemEvalAPI.addTable811Row(itemId, { criteria_label: newCriteria });
      setNewCriteria('');
      setShowAdd(false);
      load();
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const allComplied = rows.length > 0 && rows.every(r => r.complied === true);
  const allAccepted = rows.length > 0 && rows.every(r => r.accepted === true);
  const bidderName = rows[0]?.bidder_name;

  return (
    <div>
      <div style={{
        background: 'linear-gradient(to right, var(--navy), var(--navy-medium))',
        borderRadius: '10px 10px 0 0', padding: '12px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'white', fontSize: 14 }}>
            Post-Qualification Assessment
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            {bidderName ? `Rank 1 Bidder: ${bidderName}` : 'Rank 1 bidder auto-queried from Financial Evaluation'}
          </div>
        </div>
        {!readOnly && (
          <button className="btn btn-accent btn-sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={13} /> Add Criteria
          </button>
        )}
      </div>

      {bidderName && (
        <div style={{ padding: '12px 20px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderTop: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Award size={18} color="var(--success)" />
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>Rank 1: {bidderName}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 12 }}>
              All criteria must be Complied &amp; Accepted for award recommendation
            </span>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px solid var(--border)', borderTop: 'none' }}>
          No post-qualification criteria yet. Save a row in Financial Evaluation to auto-seed defaults, or add custom criteria above.
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#e8eef5' }}>
              <tr>
                <th style={thS}>#</th>
                <th style={thS}>Post-Qualification Criteria</th>
                <th style={{ ...thS, textAlign: 'center', color: 'var(--success)' }}>Complied</th>
                <th style={{ ...thS, textAlign: 'center', color: 'var(--blue)' }}>Accepted</th>
                <th style={thS}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id} style={{
                  borderBottom: '1px solid var(--border-light)',
                  background: (row.complied === false || row.accepted === false) ? '#fff5f5' : idx % 2 === 0 ? 'white' : '#fafbfc'
                }}>
                  <td style={{ ...tdS, textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ ...tdS, fontWeight: 500 }}>{row.criteria_label}</td>

                  {/* Complied toggle — instant */}
                  <td style={{ ...tdS, textAlign: 'center' }}>
                    <button type="button" disabled={readOnly}
                      onClick={() => handleToggle(row.id, 'complied', rows)}
                      style={{
                        padding: '5px 18px', borderRadius: 6, fontWeight: 700, fontSize: 12,
                        cursor: readOnly ? 'default' : 'pointer', transition: 'all .1s',
                        border: `2px solid ${row.complied === true ? 'var(--success)' : row.complied === false ? 'var(--danger)' : 'var(--border)'}`,
                        background: row.complied === true ? 'var(--success-light)' : row.complied === false ? 'var(--danger-light)' : 'white',
                        color: row.complied === true ? 'var(--success)' : row.complied === false ? 'var(--danger)' : 'var(--text-muted)',
                        display: 'inline-flex', alignItems: 'center', gap: 5
                      }}>
                      {row.complied === true ? <><Check size={12} /> YES</> : row.complied === false ? <><X size={12} /> NO</> : '—'}
                    </button>
                  </td>

                  {/* Accepted toggle — instant */}
                  <td style={{ ...tdS, textAlign: 'center' }}>
                    <button type="button" disabled={readOnly}
                      onClick={() => handleToggle(row.id, 'accepted', rows)}
                      style={{
                        padding: '5px 18px', borderRadius: 6, fontWeight: 700, fontSize: 12,
                        cursor: readOnly ? 'default' : 'pointer', transition: 'all .1s',
                        border: `2px solid ${row.accepted === true ? 'var(--blue)' : row.accepted === false ? 'var(--danger)' : 'var(--border)'}`,
                        background: row.accepted === true ? '#e3f2fd' : row.accepted === false ? 'var(--danger-light)' : 'white',
                        color: row.accepted === true ? 'var(--blue)' : row.accepted === false ? 'var(--danger)' : 'var(--text-muted)',
                        display: 'inline-flex', alignItems: 'center', gap: 5
                      }}>
                      {row.accepted === true ? <><Check size={12} /> YES</> : row.accepted === false ? <><X size={12} /> NO</> : '—'}
                    </button>
                  </td>

                  <td style={tdS}>
                    {!readOnly ? (
                      <input className="form-control" value={row.notes || ''}
                        placeholder="Notes…"
                        onChange={e => handleNotes(row.id, e.target.value, rows)}
                        style={{ fontSize: 12 }}
                      />
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.notes || '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Verdict */}
          <div style={{
            padding: '14px 20px',
            background: allComplied && allAccepted ? '#e8f5e9' : '#fff3e0',
            borderTop: '1px solid var(--border-light)',
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: allComplied && allAccepted ? 'var(--success)' : 'var(--warning)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 16, flexShrink: 0
            }}>
              {allComplied && allAccepted ? '✓' : '!'}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: allComplied && allAccepted ? 'var(--success)' : 'var(--warning)' }}>
                {allComplied && allAccepted
                  ? `${bidderName || 'Rank 1 Bidder'} — QUALIFIED for contract award`
                  : 'Post-qualification incomplete or criteria not met'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                {rows.filter(r => r.complied === true).length}/{rows.length} criteria complied ·{' '}
                {rows.filter(r => r.accepted === true).length}/{rows.length} accepted
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdd && !readOnly && (
        <div style={{ marginTop: 10, padding: '12px 16px', background: '#f0f7ff', borderRadius: 8, border: '1px solid var(--border-light)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Criteria Label *</label>
            <input className="form-control" value={newCriteria}
              onChange={e => setNewCriteria(e.target.value)}
              placeholder="e.g. Key Personnel Qualifications"
              onKeyDown={e => e.key === 'Enter' && handleAddCriteria()} />
          </div>
          <button className="btn btn-navy" onClick={handleAddCriteria}><Check size={14} /> Add</button>
          <button className="btn btn-outline" onClick={() => setShowAdd(false)}><X size={14} /></button>
        </div>
      )}
    </div>
  );
}

const thS = { padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--navy)', borderRight: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const tdS = { padding: '10px 14px', fontSize: 13, borderRight: '1px solid var(--border-light)', verticalAlign: 'middle' };
