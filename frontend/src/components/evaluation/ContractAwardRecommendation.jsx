// frontend/src/components/evaluation/ContractAwardRecommendation.jsx
// Contract Award Recommendation
import React, { useEffect, useState, useCallback } from 'react';
import { itemEvalAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { Award, Save, Plus, Trash2 } from 'lucide-react';

const buildContractAmount = (info) => {
  if (!info) return '';
  const total = Number(info.evaluated_bid_price) || 0;
  if (!total) return '';
  const qty = Number(info.evaluated_quantity) || 0;
  const fmt = (n) => Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (qty > 1) {
    const unit = total / qty;
    return `Rs. ${fmt(unit)} × ${qty} = Rs. ${fmt(total)} + (VAT)`;
  }
  return `Rs. ${fmt(total)} + (VAT)`;
};

export default function ContractAwardRecommendation({ itemId, acceptedBidders = [], readOnly = false }) {
  const [data, setData] = useState(null);
  const [bidderInfo, setBidderInfo] = useState([]);
  const [rank1Bidder, setRank1Bidder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    bidder_id: '',
    address: '',
    contract_amount: '',
    brand_model: '',
    warranty: '',
    rejection_reasons: [],
    comments: '',
    signatures: [],
    award_date: new Date().toISOString().slice(0, 10),
  });

  const findInfo = (bidderId) => {
    if (!bidderId) return null;
    return bidderInfo.find((b) => String(b.bidder_id) === String(bidderId)) || null;
  };

  const load = useCallback(async () => {
    try {
      const [carRes, t81Res] = await Promise.all([
        itemEvalAPI.getContractAward(itemId),
        itemEvalAPI.getTable81(itemId),
      ]);
      const car = carRes.data?.award || null;
      const bInfo = carRes.data?.bidder_info || [];
      const rank1 = t81Res.data.rows?.find((r) => r.rank === 1) || t81Res.data.rows?.[0] || null;

      setData(car);
      setBidderInfo(bInfo);
      setRank1Bidder(rank1);

      if (car) {
        const matched = bInfo.find((b) => String(b.bidder_id) === String(car.bidder_id));
        setForm({
          bidder_id: car.bidder_id || rank1?.bidder_id || '',
          address: car.address || car.bidder_address || matched?.bidder_address || '',
          contract_amount: car.contract_amount || '',
          brand_model: car.brand_model || '',
          warranty: car.warranty || '',
          rejection_reasons: car.rejection_reasons || [],
          comments: car.comments || '',
          signatures: car.signatures || [],
          award_date: car.award_date
            ? car.award_date.slice(0, 10)
            : new Date().toISOString().slice(0, 10),
        });
      } else {
        const rank1Id = rank1?.bidder_id;
        const info = rank1Id
          ? (bInfo.find(b => String(b.bidder_id) === String(rank1Id)) || null)
          : null;
        setForm((f) => ({
          ...f,
          bidder_id: rank1Id || '',
          address: info?.bidder_address || '',
          contract_amount: buildContractAmount(info),
          brand_model: info?.offered_brand || '',
          warranty: info?.warranty || '',
        }));
      }
    } catch {
      toast.error('Failed to load contract award');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleBidderChange = (bidderId) => {
    const info = findInfo(bidderId);
    setForm((f) => ({
      ...f,
      bidder_id: bidderId,
      address: info?.bidder_address || '',
      contract_amount: buildContractAmount(info),
      brand_model: info?.offered_brand || '',
      warranty: info?.warranty || '',
    }));
  };

  const addRejectionRow = () =>
    set('rejection_reasons', [...form.rejection_reasons, { bidder: '', reason: '' }]);
  const updateRejection = (idx, field, val) =>
    set('rejection_reasons', form.rejection_reasons.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  const removeRejection = (idx) =>
    set('rejection_reasons', form.rejection_reasons.filter((_, i) => i !== idx));

  const addSignature = () =>
    set('signatures', [...form.signatures, { name: '', designation: '', date: '' }]);
  const updateSignature = (idx, field, val) =>
    set('signatures', form.signatures.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  const removeSignature = (idx) =>
    set('signatures', form.signatures.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    try {
      await itemEvalAPI.upsertContractAward(itemId, form);
      toast.success('Contract award recommendation saved');
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const bidderOptions = (() => {
    if (bidderInfo.length > 0) {
      return bidderInfo.map(b => ({ id: b.bidder_id, name: b.bidder_name }));
    }
    return acceptedBidders
      .filter(b => b.accepted !== false)
      .map(b => ({ id: b.bidder_id || b.id, name: b.bidder_name || b.name }));
  })();

  return (
    <div>
      <div style={{
        background: 'linear-gradient(to right, var(--navy), var(--navy-medium))',
        borderRadius: '10px 10px 0 0', padding: '12px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'white', fontSize: 14 }}>
            Contract Award Recommendation
          </div>
          {rank1Bidder && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              Rank 1: {rank1Bidder.bidder_name}
            </div>
          )}
        </div>
        <Award size={20} color="var(--accent)" />
      </div>

      <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '20px 24px' }}>

        <div style={{ marginBottom: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid var(--border)' }}>
            <tbody>
              {[
                {
                  label: 'Name of Contractor / Supplier',
                  content: readOnly ? (
                    <strong>{data?.bidder_name || '—'}</strong>
                  ) : (
                    <select className="form-control" value={form.bidder_id}
                      onChange={(e) => handleBidderChange(e.target.value)}>
                      <option value="">Select bidder…</option>
                      {bidderOptions.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  )
                },
                {
                  label: 'Address',
                  content: readOnly ? (
                    <span style={{ fontSize: 13 }}>{data?.bidder_address || data?.address || '—'}</span>
                  ) : (
                    <input className="form-control" value={form.address}
                      onChange={(e) => set('address', e.target.value)}
                      placeholder="Auto-filled from bidder — editable" />
                  )
                },
                {
                  label: 'Contract Amount (Rs.)',
                  content: readOnly ? (
                    <strong style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{data?.contract_amount || '—'}</strong>
                  ) : (
                    <input className="form-control" value={form.contract_amount}
                      onChange={(e) => set('contract_amount', e.target.value)}
                      placeholder="e.g. Rs. 168,000.00 × 6 = Rs. 1,008,050.00 + (VAT)" />
                  )
                },
                {
                  label: 'Brand / Model',
                  content: readOnly ? (
                    <span>{data?.brand_model || '—'}</span>
                  ) : (
                    <input className="form-control" value={form.brand_model}
                      onChange={(e) => set('brand_model', e.target.value)}
                      placeholder="Auto-filled from CSV — editable" />
                  )
                },
                {
                  label: 'Warranty',
                  content: readOnly ? (
                    <span>{data?.warranty || '—'}</span>
                  ) : (
                    <input className="form-control" value={form.warranty}
                      onChange={(e) => set('warranty', e.target.value)}
                      placeholder="Auto-filled from CSV — editable" />
                  )
                },
              ].map(({ label, content }) => (
                <tr key={label} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '10px 16px', background: '#f8fafc', fontWeight: 600, fontSize: 12.5, color: 'var(--navy)', width: 220, borderRight: '1px solid var(--border)' }}>
                    {label}
                  </td>
                  <td style={{ padding: '8px 16px', fontSize: 13 }}>
                    {content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Reasons for Rejecting Any Bid
            {!readOnly && (
              <button className="btn btn-outline btn-sm" onClick={addRejectionRow}>
                <Plus size={12} /> Add Row
              </button>
            )}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid var(--border)' }}>
            <thead style={{ background: '#e8eef5' }}>
              <tr>
                <th style={thS}>Bidder</th>
                <th style={thS}>Reason</th>
                {!readOnly && <th style={{ ...thS, width: 40 }} />}
              </tr>
            </thead>
            <tbody>
              {form.rejection_reasons.length === 0 ? (
                <tr><td colSpan={readOnly ? 2 : 3} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: 13 }}>
                  None
                </td></tr>
              ) : form.rejection_reasons.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={tdS}>
                    {readOnly ? r.bidder : (
                      <input className="form-control" value={r.bidder}
                        onChange={(e) => updateRejection(i, 'bidder', e.target.value)}
                        placeholder="Bidder name" />
                    )}
                  </td>
                  <td style={tdS}>
                    {readOnly ? r.reason : (
                      <input className="form-control" value={r.reason}
                        onChange={(e) => updateRejection(i, 'reason', e.target.value)}
                        placeholder="Reason for rejection" />
                    )}
                  </td>
                  {!readOnly && (
                    <td style={tdS}>
                      <button className="btn btn-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none' }}
                        onClick={() => removeRejection(i)}><Trash2 size={11} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)', marginBottom: 8 }}>Any Other Comments</div>
          {readOnly ? (
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, minHeight: 60 }}>
              {data?.comments || 'None'}
            </div>
          ) : (
            <textarea className="form-control" rows={3} value={form.comments}
              onChange={(e) => set('comments', e.target.value)}
              placeholder="The BEC recommends awarding the purchase of … to … for a price of Rs. … + VAT." />
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Agree with Above Decisions — Signatures
            {!readOnly && (
              <button className="btn btn-outline btn-sm" onClick={addSignature}>
                <Plus size={12} /> Add Signatory
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {form.signatures.map((sig, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', minWidth: 160, position: 'relative', background: '#fafbfc' }}>
                {!readOnly && (
                  <button className="btn btn-sm" style={{ position: 'absolute', top: 6, right: 6, background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', padding: '2px 5px' }}
                    onClick={() => removeSignature(i)}><Trash2 size={10} /></button>
                )}
                {readOnly ? (
                  <>
                    <div style={{ height: 40, borderBottom: '1px solid var(--border)', marginBottom: 6 }} />
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{sig.name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sig.designation || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sig.date || '—'}</div>
                  </>
                ) : (
                  <>
                    <div className="form-group" style={{ marginBottom: 6 }}>
                      <label className="form-label">Name</label>
                      <input className="form-control" value={sig.name}
                        onChange={(e) => updateSignature(i, 'name', e.target.value)}
                        placeholder="Dr./Mr./Ms. …" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 6 }}>
                      <label className="form-label">Designation</label>
                      <input className="form-control" value={sig.designation}
                        onChange={(e) => updateSignature(i, 'designation', e.target.value)}
                        placeholder="Chairperson / Member" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Date</label>
                      <input type="date" className="form-control" value={sig.date}
                        onChange={(e) => updateSignature(i, 'date', e.target.value)} />
                    </div>
                  </>
                )}
              </div>
            ))}
            {form.signatures.length === 0 && !readOnly && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Click "+ Add Signatory" to add committee members
              </div>
            )}
          </div>
        </div>

        {!readOnly && (
          <button className="btn btn-success" onClick={handleSave} disabled={saving} style={{ marginTop: 8 }}>
            {saving ? 'Saving…' : <><Save size={15} /> Save Award Recommendation</>}
          </button>
        )}
      </div>
    </div>
  );
}

const thS = { padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--navy)', borderRight: '1px solid var(--border-light)' };
const tdS = { padding: '8px 14px', fontSize: 13, borderRight: '1px solid var(--border-light)', verticalAlign: 'middle' };