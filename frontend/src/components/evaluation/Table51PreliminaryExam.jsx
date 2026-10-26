import React, { useEffect, useState, useCallback } from 'react';
import { itemEvalAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Check, X, Lock } from 'lucide-react';

export default function Table51PreliminaryExam({ itemId, readOnly = false, onAcceptanceChange }) {
  const [rows, setRows] = useState([]);
  const [acceptance, setAcceptance] = useState([]);
  const [bidderCols, setBidderCols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddField, setShowAddField] = useState(false);
  const [newField, setNewField] = useState({ field_label: '', field_type: 'text' });
  // localValues: { [rowId]: { [bidderId]: value } } — optimistic local state
  const [localValues, setLocalValues] = useState({});

  const load = useCallback(async () => {
    try {
      const res = await itemEvalAPI.getTable51(itemId);
      const fetchedRows = res.data.rows || [];
      const fetchedAcc = res.data.acceptance || [];
      setRows(fetchedRows);
      setAcceptance(fetchedAcc);
      setBidderCols(fetchedAcc);
      onAcceptanceChange?.(fetchedAcc);
      // Seed localValues from DB
      const lv = {};
      fetchedRows.forEach(row => { lv[row.id] = { ...(row.values || {}) }; });
      setLocalValues(lv);
    } catch { toast.error('Failed to load Preliminary Examination'); }
    finally { setLoading(false); }
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  // Optimistic update: update local state immediately, then persist
  const handleCellChange = async (rowId, bidderId, value) => {
    // 1. Update local state immediately
    setLocalValues(prev => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || {}), [bidderId]: value }
    }));
    // 2. Also update rows state for consistency
    setRows(prev => prev.map(r =>
      r.id === rowId
        ? { ...r, values: { ...(r.values || {}), [bidderId]: value } }
        : r
    ));
    // 3. Persist in background
    try {
      await itemEvalAPI.updateTable51Cell(rowId, { bidder_id: bidderId, value });
    } catch {
      toast.error('Save failed — reverting');
      // Revert on failure
      load();
    }
  };

  // Optimistic acceptance toggle
  const handleAcceptance = async (bidderId, currentVal) => {
    const newVal = !currentVal;
    // Optimistic update
    const updated = acceptance.map(a =>
      a.bidder_id === bidderId ? { ...a, accepted: newVal } : a
    );
    setAcceptance(updated);
    setBidderCols(updated);
    onAcceptanceChange?.(updated);
    try {
      await itemEvalAPI.setTable51Acceptance(itemId, { bidder_id: bidderId, accepted: newVal });
      toast.success(newVal ? 'Accepted for evaluation' : 'Excluded from evaluation');
    } catch (e) {
      toast.error(e.message);
      // Revert
      load();
    }
  };

  const handleAddField = async () => {
    if (!newField.field_label.trim()) { toast.error('Label required'); return; }
    try {
      await itemEvalAPI.addTable51CustomRow(itemId, newField);
      toast.success('Criteria row added');
      setNewField({ field_label: '', field_type: 'text' });
      setShowAddField(false);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleDeleteRow = async (id, isSystem) => {
    if (isSystem) { toast.error('Cannot delete system rows'); return; }
    if (!window.confirm('Delete this criteria row?')) return;
    setRows(prev => prev.filter(r => r.id !== id));
    try { await itemEvalAPI.deleteTable51Row(id); }
    catch (e) { toast.error(e.message); load(); }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const getCellValue = (rowId, bidderId) =>
    (localValues[rowId] || {})[bidderId] ?? '';

  const renderCellInput = (row, bidder) => {
    const val = getCellValue(row.id, bidder.bidder_id);

    if (row.field_type === 'yesno') {
      return (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          {['Yes', 'No'].map(opt => (
            <button key={opt} type="button" disabled={readOnly}
              onClick={() => handleCellChange(row.id, bidder.bidder_id, opt)}
              style={{
                padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                cursor: readOnly ? 'default' : 'pointer',
                border: `1.5px solid ${val === opt ? (opt === 'Yes' ? 'var(--success)' : 'var(--danger)') : 'var(--border)'}`,
                background: val === opt ? (opt === 'Yes' ? 'var(--success-light)' : 'var(--danger-light)') : 'white',
                color: val === opt ? (opt === 'Yes' ? 'var(--success)' : 'var(--danger)') : 'var(--text-muted)',
                transition: 'all .1s',
              }}>
              {opt}
            </button>
          ))}
        </div>
      );
    }

    if (row.field_type === 'number') {
      return (
        <input type="number" disabled={readOnly}
          value={val}
          onChange={e => handleCellChange(row.id, bidder.bidder_id, e.target.value)}
          style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, textAlign: 'center' }}
        />
      );
    }

    return (
      <input type="text" disabled={readOnly}
        value={val}
        onChange={e => handleCellChange(row.id, bidder.bidder_id, e.target.value)}
        style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }}
      />
    );
  };

  return (
    <div>
      <div style={{
        background: 'linear-gradient(to right, var(--navy), var(--navy-medium))',
        borderRadius: '10px 10px 0 0', padding: '12px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'white', fontSize: 14 }}>
            Preliminary Examination
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            {rows.length} criteria · {bidderCols.length} bidders
          </div>
        </div>
        {!readOnly && (
          <button className="btn btn-accent btn-sm" onClick={() => setShowAddField(true)}>
            <Plus size={13} /> Add Criterion
          </button>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${220 + bidderCols.length * 150}px` }}>
          <thead>
            <tr style={{ background: '#e8eef5' }}>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--navy)', minWidth: 220, borderRight: '1px solid var(--border-light)' }}>
                Criteria
              </th>
              {bidderCols.map(b => (
                <th key={b.bidder_id} style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--navy)', minWidth: 140, borderRight: '1px solid var(--border-light)' }}>
                  {b.bidder_name}
                </th>
              ))}
              {!readOnly && <th style={{ width: 36 }} />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} style={{ background: idx % 2 === 0 ? 'white' : '#fafbfc', borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '10px 16px', borderRight: '1px solid var(--border-light)', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {row.is_system && <Lock size={11} color="var(--text-muted)" />}
                    <span style={{ fontSize: 13, fontWeight: row.is_system ? 500 : 400 }}>{row.field_label}</span>
                  </div>
                </td>
                {bidderCols.map(b => (
                  <td key={b.bidder_id} style={{ padding: '8px 10px', textAlign: 'center', borderRight: '1px solid var(--border-light)', verticalAlign: 'middle' }}>
                    {renderCellInput(row, b)}
                  </td>
                ))}
                {!readOnly && (
                  <td style={{ padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {!row.is_system && (
                      <button className="btn btn-sm" onClick={() => handleDeleteRow(row.id, row.is_system)}
                        style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', padding: '3px 6px' }}>
                        <Trash2 size={11} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}

            {/* Acceptance row */}
            <tr style={{ background: '#e8f5e9', borderTop: '2px solid var(--success)' }}>
              <td style={{ padding: '10px 16px', borderRight: '1px solid var(--border-light)', verticalAlign: 'middle' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>
                  Accepted for Detailed Evaluation
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  Toggles bidder into/out of downstream tables
                </div>
              </td>
              {bidderCols.map(b => {
                const acc = acceptance.find(a => a.bidder_id === b.bidder_id);
                const isAccepted = acc?.accepted !== false;
                return (
                  <td key={b.bidder_id} style={{ padding: '10px', textAlign: 'center', borderRight: '1px solid var(--border-light)', verticalAlign: 'middle' }}>
                    <button type="button" disabled={readOnly}
                      onClick={() => handleAcceptance(b.bidder_id, isAccepted)}
                      style={{
                        padding: '5px 14px', borderRadius: 6, fontWeight: 700, fontSize: 12,
                        cursor: readOnly ? 'default' : 'pointer', transition: 'all .1s',
                        border: `2px solid ${isAccepted ? 'var(--success)' : 'var(--danger)'}`,
                        background: isAccepted ? 'var(--success-light)' : 'var(--danger-light)',
                        color: isAccepted ? 'var(--success)' : 'var(--danger)',
                      }}>
                      {isAccepted ? 'YES' : 'NO'}
                    </button>
                  </td>
                );
              })}
              {!readOnly && <td />}
            </tr>
          </tbody>
        </table>
      </div>

      {showAddField && !readOnly && (
        <div style={{ marginTop: 10, padding: '14px 16px', background: '#f0f7ff', borderRadius: 8, border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)', marginBottom: 10 }}>Add Custom Criteria Row</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Criteria Label *</label>
              <input className="form-control" value={newField.field_label}
                onChange={e => setNewField(f => ({ ...f, field_label: e.target.value }))}
                placeholder="e.g. Manufacturer Authorization" />
            </div>
            <div style={{ width: 150 }}>
              <label className="form-label">Input Type</label>
              <select className="form-control" value={newField.field_type}
                onChange={e => setNewField(f => ({ ...f, field_type: e.target.value }))}>
                <option value="text">Text</option>
                <option value="yesno">Yes / No</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
              </select>
            </div>
            <button className="btn btn-navy" onClick={handleAddField}><Check size={14} /> Add</button>
            <button className="btn btn-outline" onClick={() => setShowAddField(false)}><X size={14} /></button>
          </div>
        </div>
      )}

      {bidderCols.length === 0 && (
        <div className="alert alert-info" style={{ marginTop: 10 }}>
          No bidders yet. Add bidders in Bid Opening first.
        </div>
      )}
    </div>
  );
}
