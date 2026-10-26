// frontend/src/components/evaluation/Table41BidOpening.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { itemEvalAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Check, X, AlertCircle } from 'lucide-react';

const emptyRow = { bidder_no: '', bidder_name: '', address: '', readout_price: '', currency: 'LKR', remarks: '' };

export default function Table41BidOpening({ itemId, globalBidders = [], readOnly = false, onBiddersChange }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyRow);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const selectBidder = (bidderId) => {
    const bidder = globalBidders.find(b => b.id === bidderId);
    if (!bidder) {
      setForm(emptyRow);
      return;
    }
    setForm(f => ({
      ...f,
      bidder_id: bidder.id,
      bidder_name: bidder.name,
      address: bidder.address || '',
    }));
  };

  const load = useCallback(async () => {
    try {
      const res = await itemEvalAPI.getTable41(itemId);
      setRows(res.data || []);
      onBiddersChange?.(res.data || []);
    } catch { toast.error('Failed to load Table 4.1'); }
    finally { setLoading(false); }
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleAdd = async () => {
    if (!form.bidder_name.trim()) { toast.error('Bidder name required'); return; }
    setSaving(true);
    try {
      await itemEvalAPI.addTable41Row(itemId, {
        ...form,
          bidder_id: form.bidder_id || undefined,
        readout_price: form.readout_price ? parseFloat(form.readout_price) : null,
        bidder_no: form.bidder_no ? parseInt(form.bidder_no) : undefined,
      });
      toast.success('Bidder added to bid opening');
      setForm(emptyRow);
      setShowAddForm(false);
      load();
    } catch (e) { toast.error(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleEdit = (row) => {
    setEditingId(row.id);
    setEditForm({
      bidder_no: row.bidder_no || '',
      bidder_name: row.bidder_name || '',
      address: row.address || '',
      readout_price: row.readout_price || '',
      currency: row.currency || 'LKR',
      remarks: row.remarks || '',
    });
  };

  const handleSaveEdit = async (id) => {
    setSaving(true);
    try {
      await itemEvalAPI.updateTable41Row(id, {
        ...editForm,
        readout_price: editForm.readout_price ? parseFloat(editForm.readout_price) : null,
        bidder_no: editForm.bidder_no ? parseInt(editForm.bidder_no) : null,
      });
      toast.success('Row updated');
      setEditingId(null);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this bidder from Table 4.1?')) return;
    try {
      await itemEvalAPI.deleteTable41Row(id);
      toast.success('Row removed');
      load();
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(to right, var(--navy), var(--navy-medium))',
        borderRadius: '10px 10px 0 0',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'white', fontSize: 14 }}>
            Bid Opening
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            {rows.length} bid{rows.length !== 1 ? 's' : ''} received
          </div>
        </div>
        {!readOnly && (
          <button
            className="btn btn-accent btn-sm"
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={13} /> Add Row
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
        <div className="table-container">
          <table>
            <thead style={{ background: '#e8eef5' }}>
              <tr>
                <th style={{ color: 'var(--navy)' }}>Bidder No.</th>
                <th style={{ color: 'var(--navy)' }}>Bidder Name</th>
                <th style={{ color: 'var(--navy)' }}>Address</th>
                <th style={{ color: 'var(--navy)' }}>Bid Price Read-Out</th>
                <th style={{ color: 'var(--navy)' }}>Currency</th>
                <th style={{ color: 'var(--navy)' }}>Remarks</th>
                <th style={{ color: 'var(--navy)' }}>Source</th>
                {!readOnly && <th style={{ color: 'var(--navy)' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                editingId === row.id ? (
                  <tr key={row.id} style={{ background: '#fffde7' }}>
                    <td><input className="form-control" style={{ width: 60 }} value={editForm.bidder_no}
                      onChange={(e) => setEditForm((f) => ({ ...f, bidder_no: e.target.value }))} /></td>
                    <td><input className="form-control" value={editForm.bidder_name}
                      onChange={(e) => setEditForm((f) => ({ ...f, bidder_name: e.target.value }))} /></td>
                    <td><input className="form-control" value={editForm.address}
                      onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} /></td>
                    <td><input type="number" className="form-control" style={{ width: 120 }} value={editForm.readout_price}
                      onChange={(e) => setEditForm((f) => ({ ...f, readout_price: e.target.value }))} /></td>
                    <td>
                      <select className="form-control" style={{ width: 80 }} value={editForm.currency}
                        onChange={(e) => setEditForm((f) => ({ ...f, currency: e.target.value }))}>
                        {['LKR', 'USD', 'EUR', 'GBP'].map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td><input className="form-control" value={editForm.remarks}
                      onChange={(e) => setEditForm((f) => ({ ...f, remarks: e.target.value }))} /></td>
                    <td />
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-success btn-sm" onClick={() => handleSaveEdit(row.id)} disabled={saving}>
                          <Check size={12} />
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}>
                          <X size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 700, textAlign: 'center', color: 'var(--navy)' }}>
                      {row.bidder_no ?? '—'}
                    </td>
                    <td style={{ fontWeight: 500 }}>{row.bidder_name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.address || '—'}
                    </td>
                    <td style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, color: 'var(--navy)' }}>
                      {row.readout_price
                        ? Number(row.readout_price).toLocaleString('en-LK', { minimumFractionDigits: 2 })
                        : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>{row.currency || 'LKR'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.remarks || '—'}</td>
                    <td>
                      {row.is_manual_addition ? (
                        <span style={{ fontSize: 10, background: '#fff3e0', color: 'var(--warning)', padding: '2px 6px', borderRadius: 10, fontWeight: 600 }}>
                          MANUAL
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, background: '#e8f5e9', color: 'var(--success)', padding: '2px 6px', borderRadius: 10, fontWeight: 600 }}>
                          IMPORTED
                        </span>
                      )}
                    </td>
                    {!readOnly && (
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => handleEdit(row)}>
                            <Edit size={12} />
                          </button>
                          <button className="btn btn-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none' }}
                            onClick={() => handleDelete(row.id)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={readOnly ? 7 : 8} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                    No bids received yet. Add rows manually or import a file.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Inline add form */}
        {showAddForm && !readOnly && (
          <div style={{
            padding: '16px 20px',
            background: '#f0f7ff',
            borderTop: '1px solid var(--border-light)'
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={13} />
              Add Bidder (live at bid opening)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 130px 80px 1fr', gap: 8, alignItems: 'end' }}>
              <div>
                <label className="form-label">No.</label>
                <input type="number" className="form-control" value={form.bidder_no}
                  onChange={(e) => set('bidder_no', e.target.value)} placeholder="Auto" />
              </div>
              <div>
                <label className="form-label">Tender Bidder</label>
                <select className="form-control" value={form.bidder_id || ''} onChange={e => selectBidder(e.target.value)}>
                  <option value="">Select tender bidder…</option>
                  {globalBidders.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Bidder Name *</label>
                <input className="form-control" list="imported-bidders" value={form.bidder_name}
                  onChange={(e) => {
                    const value = e.target.value;
                    const imported = rows.find(row => row.bidder_name?.toLowerCase() === value.toLowerCase());
                    setForm(f => ({ ...f, bidder_name: value, address: imported?.address || f.address }));
                  }} placeholder="Company name" />
                <datalist id="imported-bidders">
                  {rows.map(row => <option key={row.id} value={row.bidder_name} />)}
                </datalist>
              </div>
              <div>
                <label className="form-label">Address</label>
                <input className="form-control" value={form.address}
                  onChange={(e) => set('address', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Readout Price</label>
                <input type="number" className="form-control" value={form.readout_price}
                  onChange={(e) => set('readout_price', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Currency</label>
                <select className="form-control" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                  {['LKR', 'USD', 'EUR', 'GBP'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Remarks</label>
                <input className="form-control" value={form.remarks}
                  onChange={(e) => set('remarks', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-navy btn-sm" onClick={handleAdd} disabled={saving}>
                {saving ? 'Saving…' : <><Check size={13} /> Add to Table</>}
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => { setShowAddForm(false); setForm(emptyRow); }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary bar */}
      {rows.length > 0 && (
        <div style={{
          marginTop: 10,
          display: 'flex',
          gap: 24,
          padding: '10px 16px',
          background: 'var(--bg)',
          borderRadius: 8,
          border: '1px solid var(--border-light)'
        }}>
          {[
            ['Total Bids', rows.length],
            ['Lowest', rows.filter((r) => r.readout_price).length > 0
              ? `Rs. ${Math.min(...rows.filter((r) => r.readout_price).map((r) => Number(r.readout_price))).toLocaleString()}`
              : '—'],
            ['Highest', rows.filter((r) => r.readout_price).length > 0
              ? `Rs. ${Math.max(...rows.filter((r) => r.readout_price).map((r) => Number(r.readout_price))).toLocaleString()}`
              : '—'],
            ['Manual Additions', rows.filter((r) => r.is_manual_addition).length],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>{label}</div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: 13, color: 'var(--navy)' }}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}