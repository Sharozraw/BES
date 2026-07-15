import React, { useEffect, useState } from 'react';
import { biddersAPI, evaluationsAPI, reportsAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { Award, Download, Check } from 'lucide-react';

export default function FinalDecisionPanel({ projectId, workflow }) {
  const [bidders, setBidders] = useState([]);
  const [existingDecision, setExistingDecision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    bidder_id: '',
    decision_method: workflow?.final_decision_method || 'ranking',
    decision: 'award',
    contract_amount: '',
    reasons: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    Promise.all([
      biddersAPI.getEvaluationSummary(projectId),
      evaluationsAPI.getFinalDecision(projectId),
    ]).then(([bRes, dRes]) => {
      const sorted = (bRes.data || [])
        .filter(b => b.status !== 'eliminated')
        .sort((a, b) => Number(a.bid_price) - Number(b.bid_price));
      setBidders(bRes.data || []);
      if (sorted.length > 0 && !form.bidder_id) {
        setForm(f => ({ ...f, bidder_id: sorted[0].id, contract_amount: sorted[0].bid_price }));
      }
      setExistingDecision(dRes.data);
    }).finally(() => setLoading(false));
  }, [projectId]);

  const handleSubmit = async () => {
    if (!form.bidder_id) { toast.error('Select a bidder'); return; }
    if (!window.confirm('Record this final decision? This action will mark the project as awarded.')) return;
    setSubmitting(true);
    try {
      await evaluationsAPI.submitFinalDecision(projectId, {
        ...form,
        contract_amount: parseFloat(form.contract_amount) || 0
      });
      toast.success('Final decision recorded!');
      const dRes = await evaluationsAPI.getFinalDecision(projectId);
      setExistingDecision(dRes.data);
    } catch (e) {
      toast.error(e.message || 'Failed to record decision');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const res = await reportsAPI.generate(projectId, { reportType: 'full_evaluation' });
      const url = reportsAPI.download(res.data.id);
      const token = localStorage.getItem('bes_token');
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = res.data.fileName;
      a.click();
      toast.success('Report generated and downloaded');
    } catch (e) {
      toast.error(e.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const activeBidders = bidders.filter(b => b.status !== 'eliminated');
  const selectedBidder = bidders.find(b => b.id === form.bidder_id);

  return (
    <div>
      {/* Existing decision banner */}
      {existingDecision && (
        <div className="alert alert-success" style={{ marginBottom: '20px', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Award size={20} />
            <strong>Contract Awarded</strong>
          </div>
          <div>
            <strong>{existingDecision.bidder_name}</strong> has been awarded the contract.
            <br />
            Contract Amount: <strong>Rs. {Number(existingDecision.contract_amount || existingDecision.bid_price).toLocaleString()}</strong>
            <br />
            Decision Method: {existingDecision.decision_method}
          </div>
        </div>
      )}

      {/* Bidder evaluation summary */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <span className="card-title">Evaluation Summary — All Bidders</span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Bidder Name</th>
                <th>Bid Price (Rs.)</th>
                <th>Avg Score</th>
                <th>Evaluators</th>
                <th>Pass / Fail</th>
                <th>Approve / Reject Votes</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bidders.sort((a, b) => Number(a.bid_price || 0) - Number(b.bid_price || 0)).map((b, idx) => (
                <tr key={b.id} style={{ opacity: b.status === 'eliminated' ? 0.5 : 1 }}>
                  <td style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: '700', color: idx === 0 && b.status !== 'eliminated' ? 'var(--success)' : 'var(--text)' }}>
                    {b.status === 'eliminated' ? '—' : `#${idx + 1}`}
                  </td>
                  <td style={{ fontWeight: '500' }}>{b.name}</td>
                  <td style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: '600', color: 'var(--navy)' }}>
                    {b.bid_price ? Number(b.bid_price).toLocaleString() : '—'}
                  </td>
                  <td>{b.avg_score ? Number(b.avg_score).toFixed(1) : '—'}</td>
                  <td style={{ textAlign: 'center' }}>{b.evaluator_count || 0}</td>
                  <td>
                    <span style={{ color: 'var(--success)', fontWeight: '600' }}>{b.pass_count || 0}</span>
                    {' / '}
                    <span style={{ color: 'var(--danger)', fontWeight: '600' }}>{b.fail_count || 0}</span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--success)', fontWeight: '600' }}>{b.approve_votes || 0}</span>
                    {' / '}
                    <span style={{ color: 'var(--danger)', fontWeight: '600' }}>{b.reject_votes || 0}</span>
                  </td>
                  <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decision form */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <span className="card-title">
            <Award size={16} style={{ display: 'inline', marginRight: '6px' }} />
            Contract Award Recommendation
          </span>
        </div>
        <div className="card-body">
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Recommended Supplier *</label>
              <select
                className="form-control"
                value={form.bidder_id}
                onChange={e => {
                  const b = bidders.find(b => b.id === e.target.value);
                  setForm(f => ({ ...f, bidder_id: e.target.value, contract_amount: b?.bid_price || '' }));
                }}
              >
                <option value="">Select bidder...</option>
                {activeBidders.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} — Rs. {Number(b.bid_price || 0).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Decision Method</label>
              <select className="form-control" value={form.decision_method} onChange={e => setForm(f => ({ ...f, decision_method: e.target.value }))}>
                <option value="ranking">Lowest Evaluated Price</option>
                <option value="scoring">Highest Score</option>
                <option value="voting">Committee Vote</option>
                <option value="manual">Manual Selection</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Contract Amount (Rs.)</label>
              <input
                type="number"
                className="form-control"
                value={form.contract_amount}
                onChange={e => setForm(f => ({ ...f, contract_amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Decision</label>
              <select className="form-control" value={form.decision} onChange={e => setForm(f => ({ ...f, decision: e.target.value }))}>
                <option value="award">Award Contract</option>
                <option value="reject_all">Reject All Bids</option>
                <option value="re_tender">Re-Tender</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Reasons / Justification</label>
              <textarea
                className="form-control"
                value={form.reasons}
                onChange={e => setForm(f => ({ ...f, reasons: e.target.value }))}
                rows={3}
                placeholder="Recommended to purchase from ... because ..."
              />
            </div>
          </div>

          {selectedBidder && (
            <div style={{
              background: 'var(--success-light)',
              border: '1px solid #a5d6a7',
              borderRadius: '8px',
              padding: '14px 18px',
              marginBottom: '16px'
            }}>
              <div style={{ fontWeight: '600', color: 'var(--success)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Award size={16} /> Recommended: {selectedBidder.name}
              </div>
              <div style={{ fontSize: '13px', color: '#1b5e20' }}>
                Contract Amount: Rs. {Number(form.contract_amount || 0).toLocaleString()} (No VAT)
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn btn-success btn-lg"
              onClick={handleSubmit}
              disabled={submitting || !!existingDecision}
            >
              {submitting ? 'Recording...' : <><Check size={16} /> Record Final Decision</>}
            </button>
            <button
              className="btn btn-accent btn-lg"
              onClick={handleGenerateReport}
              disabled={generating}
            >
              {generating ? 'Generating...' : <><Download size={16} /> Generate PDF Report</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
