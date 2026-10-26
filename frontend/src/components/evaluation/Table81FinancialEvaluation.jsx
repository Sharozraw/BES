// frontend/src/components/evaluation/Table81FinancialEvaluation.jsx
// Evaluation of Responsive Bids
import React, { useEffect, useState, useCallback } from 'react';
import { itemEvalAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { Save, TrendingUp } from 'lucide-react';

export default function Table81FinancialEvaluation({ itemId, acceptedBidders = [], readOnly = false }) {
  const [rows, setRows] = useState([]);
  const [validBidderIds, setValidBidderIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localEdits, setLocalEdits] = useState({});
  const [saving, setSaving] = useState({});
  const [warnings, setWarnings] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await itemEvalAPI.getTable81(itemId);
      setRows(res.data.rows || []);
      setValidBidderIds(res.data.valid_bidder_ids || []);
      const draft = localStorage.getItem(`bes-table81-${itemId}`);
      if (draft) setLocalEdits(JSON.parse(draft));
    } catch { toast.error('Failed to load Table 8.1'); }
    finally { setLoading(false); }
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  const setEdit = (bidderId, field, val) =>
    setLocalEdits(p => {
      const next = { ...p, [bidderId]: { ...(p[bidderId] || {}), [field]: val } };
      localStorage.setItem(`bes-table81-${itemId}`, JSON.stringify(next));
      return next;
    });

  const getVal = (bidderId, field, fallback = '') => {
    const edit = localEdits[bidderId];
    if (edit && edit[field] !== undefined) return edit[field];
    const row = rows.find(r => r.bidder_id === bidderId);
    return row ? (row[field] ?? fallback) : fallback;
  };

  const computeEvaluated = (bidderId) => {
    const bp = parseFloat(getVal(bidderId, 'bid_price', 0)) || 0;
    const ae = parseFloat(getVal(bidderId, 'arithmetic_errors', 0)) || 0;
    const disc = parseFloat(getVal(bidderId, 'discounts', 0)) || 0;
    const ao = parseFloat(getVal(bidderId, 'additions_omissions', 0)) || 0;
    return bp + ae - disc + ao;
  };

  const handleSave = async (bidderId) => {
    setSaving(s => ({ ...s, [bidderId]: true }));
    try {
      const res = await itemEvalAPI.upsertTable81Row(itemId, {
        bidder_id: bidderId,
        bid_price: parseFloat(getVal(bidderId, 'bid_price', 0)) || 0,
        arithmetic_errors: parseFloat(getVal(bidderId, 'arithmetic_errors', 0)) || 0,
        discounts: parseFloat(getVal(bidderId, 'discounts', 0)) || 0,
        additions_omissions: parseFloat(getVal(bidderId, 'additions_omissions', 0)) || 0,
        quantity: parseFloat(getVal(bidderId, 'quantity', 1)) || 1,
      });
      setWarnings(res.compliance_warnings || []);
      toast.success('Saved & re-ranked');
      setLocalEdits(p => { const n = { ...p }; delete n[bidderId]; return n; });
      localStorage.setItem(`bes-table81-${itemId}`, JSON.stringify({}));
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(s => ({ ...s, [bidderId]: false })); }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const allIds = [...new Set([...rows.map(r => r.bidder_id), ...validBidderIds])];

  const getBidderInfo = (id) => {
    const r = rows.find(r => r.bidder_id === id);
    if (r) return { name: r.bidder_name, no: r.bidder_no };
    const b = acceptedBidders.find(b => (b.bidder_id || b.id) === id);
    return { name: b?.bidder_name || b?.name || id, no: b?.bidder_no || '—' };
  };

  const getRow = (id) => rows.find(r => r.bidder_id === id);

  return (
    <div>
      {warnings.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 12 }}>
          {warnings.map(warning => <div key={warning}>{warning}</div>)}
        </div>
      )}
      <div style={{
        background: 'linear-gradient(to right, var(--navy), var(--navy-medium))',
        borderRadius: '10px 10px 0 0', padding: '12px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'white', fontSize: 14 }}>
            Evaluation of Responsive Bids
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            Auto-ranked ascending by Evaluated Bid Price · {allIds.length} bidder(s)
          </div>
        </div>
        <TrendingUp size={18} color="rgba(255,255,255,0.4)" />
      </div>

      <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#e8eef5' }}>
            <tr>
              <th style={thS}>Bidder No.</th>
              <th style={thS}>Bidder Name</th>
              <th style={thS}>Bid Price (Rs.)</th>
              <th style={thS}>Arithmetic Errors (+/-)</th>
              <th style={thS}>Discounts</th>
              <th style={thS}>Additions / Omissions</th>
              <th style={thS}>Qty</th>
              <th style={{ ...thS, background: '#dbeafe', color: 'var(--blue)' }}>Evaluated Bid Price (Rs.)</th>
              <th style={{ ...thS, background: '#d1fae5', color: 'var(--success)', textAlign: 'center' }}>Rank</th>
              {!readOnly && <th style={thS}>Save</th>}
            </tr>
          </thead>
          <tbody>
            {allIds.map((bidderId) => {
              const row = getRow(bidderId);
              const info = getBidderInfo(bidderId);
              const isValid = validBidderIds.includes(bidderId);
              const evaluated = computeEvaluated(bidderId);
              const savedEvaluated = row?.evaluated_bid_price ? Number(row.evaluated_bid_price) : null;
              const displayEval = savedEvaluated ?? (evaluated || null);
              const rank = row?.rank;

              return (
                <tr key={bidderId} style={{
                  borderBottom: '1px solid var(--border-light)',
                  background: rank === 1 ? '#f0fdf4' : !isValid ? '#fff5f5' : 'transparent',
                  opacity: !isValid ? 0.55 : 1,
                }}>
                  <td style={{ ...tdS, textAlign: 'center', fontWeight: 700, color: 'var(--navy)' }}>
                    {info.no || '—'}
                  </td>
                  <td style={{ ...tdS, fontWeight: rank === 1 ? 700 : 500 }}>
                    {info.name}
                    {!isValid && <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2 }}>EXCLUDED</div>}
                  </td>
                  {['bid_price', 'arithmetic_errors', 'discounts', 'additions_omissions', 'quantity'].map(field => (
                    <td key={field} style={tdS}>
                      {!readOnly && isValid ? (
                        <input type="number" className="form-control"
                          value={getVal(bidderId, field, field === 'quantity' ? '1' : '0')}
                          onChange={e => setEdit(bidderId, field, e.target.value)}
                          style={{ fontFamily: 'IBM Plex Mono, monospace', textAlign: 'right', minWidth: 110 }}
                        />
                      ) : (
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>
                          {getVal(bidderId, field, field === 'quantity' ? '1' : '-')}
                        </span>
                      )}
                    </td>
                  ))}
                  <td style={{ ...tdS, background: '#f0f9ff' }}>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: 13, color: rank === 1 ? 'var(--success)' : 'var(--navy)' }}>
                      {displayEval ? displayEval.toLocaleString('en-LK', { minimumFractionDigits: 2 }) : '—'}
                    </span>
                  </td>
                  <td style={{ ...tdS, textAlign: 'center', background: '#f0fdf4' }}>
                    {rank ? (
                      <span style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: rank === 1 ? 'var(--success)' : rank === 2 ? '#3b82f6' : '#e5e7eb',
                        color: rank <= 2 ? 'white' : 'var(--text)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 12
                      }}>{rank}</span>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                  </td>
                  {!readOnly && (
                    <td style={tdS}>
                      {isValid && (
                        <button className="btn btn-navy btn-sm" onClick={() => handleSave(bidderId)} disabled={saving[bidderId]}>
                          {saving[bidderId] ? '…' : <Save size={12} />}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div style={{ marginTop: 10, padding: '12px 16px', background: 'var(--success-light)', borderRadius: 8, border: '1px solid #a5d6a7' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>
            🏆 Rank 1: {rows[0]?.bidder_name} — Rs. {Number(rows[0]?.evaluated_bid_price || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
          </span>
          <span style={{ fontSize: 12, color: '#166534', marginLeft: 12 }}>
            → Queried automatically in 8.1.1 Post-Qualification
          </span>
        </div>
      )}
    </div>
  );
}

const thS = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--navy)', borderRight: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const tdS = { padding: '9px 12px', fontSize: 13, borderRight: '1px solid var(--border-light)', verticalAlign: 'middle' };