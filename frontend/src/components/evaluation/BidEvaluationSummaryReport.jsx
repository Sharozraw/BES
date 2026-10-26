// frontend/src/components/evaluation/BidEvaluationSummaryReport.jsx
// BID EVALUATION SUMMARY REPORT — rows 02/03 editable, 04/06 auto & read-only.
import React, { useEffect, useState, useCallback } from 'react';
import { itemEvalAPI, tenderAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { Save, X } from 'lucide-react';

export default function BidEvaluationSummaryReport({ itemId, project }) {
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState({ procurement_title: '', source_of_financing: '' });
  const [saved, setSaved] = useState({ procurement_title: '', source_of_financing: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [dashRes, itemRes, sumRes] = await Promise.all([
        itemEvalAPI.getDashboard(itemId),
        tenderAPI.getItemById(itemId),
        itemEvalAPI.getSummaryReport(itemId),
      ]);
      setData({ dash: dashRes.data, item: itemRes.data });
      setSummary(sumRes.data);

      const proj = sumRes.data?.project || {};
      const ov   = sumRes.data?.override || {};
      const initial = {
        procurement_title:   (ov.procurement_title   ?? proj.title               ?? '') || '',
        source_of_financing: (ov.source_of_financing ?? proj.source_of_financing ?? '') || '',
      };
      setEdits(initial);
      setSaved(initial);
    } catch {
      toast.error('Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  const isDirty =
    edits.procurement_title   !== saved.procurement_title ||
    edits.source_of_financing !== saved.source_of_financing;

  const setField = (k, v) => setEdits((e) => ({ ...e, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await itemEvalAPI.saveSummaryReport(itemId, edits);
      toast.success('Summary report updated');
      setSaved({ ...edits });
      const r = await itemEvalAPI.getSummaryReport(itemId);
      setSummary(r.data);
    } catch (e) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => setEdits({ ...saved });

  const formatCurrency = (n) => {
    if (n === null || n === undefined || n === '') return '—';
    const num = Number(n);
    if (isNaN(num) || num === 0) return '—';
    return `Rs. ${num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!data || !summary) return null;

  const { dash, item } = data;
  const t41 = dash.table41 || [];
  const t51 = dash.table51 || { acceptance: [] };
  const t81 = dash.table81 || [];
  const car = dash.contractAward;

  const totalBids = t41.length;
  const substantivelyResponsive = t51.acceptance?.filter(a => a.accepted).length || 0;
  const rank1 = t81[0] || null;
  const isLowestRecommended = car?.bidder_id === rank1?.bidder_id;

  const rows = [
    ['01', 'Name of the Procuring Entity',
      project?.department || item?.work_package_name || summary?.project?.department || '—', 'text'],
    ['02', 'Title of the Procurement', null, 'edit-title'],
    ['03', 'Source of Financing', null, 'edit-financing'],
    ['04', 'Pre-bid Estimated Amount of the Procuring Entity',
      formatCurrency(summary?.pre_bid_estimate), 'text'],
    ['05', 'Method of Procurement',
      summary?.project?.procurement_method || 'NCB', 'text'],
    ['06', 'Number of Bidding Documents Issued',
      String(summary?.bidding_docs_issued ?? 0), 'text'],
    ['07', 'Number of Bids Received', totalBids, 'text'],
    ['08', 'Number of Bids Determined as Substantially Responsive', substantivelyResponsive, 'text'],
    ['09', 'Any Common Reason/s Found for Determining Many Bids as Non-Responsive',
      t51.acceptance?.filter(a => !a.accepted).length > 0 ? 'See Table 5.1' : '—', 'text'],
    ['10', 'Was the Lowest Evaluated Bidder Recommended for Contract Award? (Yes / No)',
      isLowestRecommended ? 'Yes' : car ? 'No' : '—', 'text'],
    ['11', 'If Answer for "10" Above is "No", Give Reason/s for Not Recommending',
      !isLowestRecommended && car ? 'See Contract Award Section' : '—', 'text'],
    ['12', 'What is the Recommended Contract Award Price?',
      car?.contract_amount || (rank1 ? `Rs. ${Number(rank1.evaluated_bid_price || 0).toLocaleString()} + (VAT)` : '—'), 'text'],
    ['13', 'What was the Bid Price of the Recommended Bidder at the Bid Opening?', (() => {
      if (!car?.bidder_id) return '—';
      const t41row = t41.find(r => r.bidder_name === rank1?.bidder_name);
      return t41row?.readout_price ? `Rs. ${Number(t41row.readout_price).toLocaleString()} + (VAT)` : '—';
    })(), 'text'],
    ['14', 'If There is a Difference Between "12" and "13" Above, What are the Reasons?', '—', 'text'],
  ];

  const boldNos = ['07', '08', '12'];

  const renderValue = (no, value, kind) => {
    if (kind === 'edit-title') {
      return (
        <input
          className="form-control"
          value={edits.procurement_title}
          onChange={e => setField('procurement_title', e.target.value)}
          placeholder="Enter title of the procurement"
          style={{ fontSize: 13 }}
        />
      );
    }
    if (kind === 'edit-financing') {
      return (
        <input
          className="form-control"
          value={edits.source_of_financing}
          onChange={e => setField('source_of_financing', e.target.value)}
          placeholder="e.g. Government Funds / GOSL"
          style={{ fontSize: 13 }}
        />
      );
    }
    return (
      <span style={{ fontWeight: boldNos.includes(no) ? 700 : 400 }}>
        {String(value)}
      </span>
    );
  };

  return (
    <div>
      <div style={{
        background: 'linear-gradient(to right, var(--navy), var(--navy-medium))',
        borderRadius: '10px 10px 0 0', padding: '12px 20px',
      }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'white', fontSize: 14 }}>
          BID EVALUATION SUMMARY REPORT
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
          Item: {item?.item_no ? `[${item.item_no}] ` : ''}{item?.description}
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {rows.map(([no, label, value, kind]) => {
              const isEdit = kind?.startsWith('edit-');
              return (
                <tr key={no} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '10px 14px', background: '#f8fafc', fontWeight: 700, fontSize: 12, color: 'var(--navy)', width: 40, textAlign: 'center', borderRight: '1px solid var(--border)' }}>
                    {no}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)', width: '45%', borderRight: '1px solid var(--border)' }}>
                    {label}
                  </td>
                  <td style={{ padding: isEdit ? '6px 10px' : '10px 16px', fontSize: 13, color: 'var(--text)' }}>
                    {renderValue(no, value, kind)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isDirty && (
        <div style={{
          marginTop: 12,
          padding: '12px 16px',
          background: '#fffde7',
          border: '1px solid #f9a825',
          borderRadius: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, color: '#5d4037' }}>
            You have unsaved changes to the summary report.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={handleDiscard} disabled={saving}>
              <X size={13} /> Discard
            </button>
            <button className="btn btn-navy btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : <><Save size={13} /> Save Changes</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}