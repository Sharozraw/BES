import React, { useEffect, useState, useCallback } from 'react';
import { evaluationsAPI } from '../../utils/api';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { MessageSquare, ThumbsUp, ThumbsDown, Check, Save, ChevronLeft, ChevronRight } from 'lucide-react';

export default function EvaluationWorkspace({ projectId, workflow, project, currentStageIdx, onStageAdvanced }) {
  const { user } = useAuthStore();
  const [workspaceData, setWorkspaceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedBidder, setSelectedBidder] = useState(null);
  const [evaluations, setEvaluations] = useState({});
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [viewStageIdx, setViewStageIdx] = useState(currentStageIdx);

  const stages = workflow?.stages || [];
  const viewStage = stages[viewStageIdx];

  const loadWorkspace = useCallback(async () => {
    if (!viewStage) return;
    setLoading(true);
    try {
      const res = await evaluationsAPI.getWorkspace(projectId, viewStage.id);
      setWorkspaceData(res.data);
      if (!selectedBidder && res.data.bidders?.length > 0) {
        setSelectedBidder(res.data.bidders[0]);
      }
    } catch (e) {
      toast.error('Failed to load workspace');
    } finally {
      setLoading(false);
    }
  }, [projectId, viewStage?.id]);

  useEffect(() => {
    setViewStageIdx(currentStageIdx);
  }, [currentStageIdx]);

  useEffect(() => {
    loadWorkspace();
    setSelectedBidder(null);
    setEvaluations({});
  }, [viewStageIdx]);

  // Pre-fill evaluations from existing data
  useEffect(() => {
    if (!workspaceData || !selectedBidder) return;
    const existing = workspaceData.evaluations?.[selectedBidder.id] || {};
    const prefilled = {};
    (viewStage?.criteria || []).forEach(c => {
      const ev = existing[c.id];
      prefilled[c.id] = ev ? {
        score: ev.score ?? '',
        pass_fail: ev.pass_fail || '',
        rank: ev.rank || '',
        compliance_status: ev.compliance_status || '',
        response_value: ev.response_value || '',
        is_deviation: ev.is_deviation || false,
        deviation_description: ev.deviation_description || '',
        is_minor_deviation: ev.is_minor_deviation || false,
      } : {
        score: '', pass_fail: '', rank: '', compliance_status: '',
        response_value: '', is_deviation: false, deviation_description: '', is_minor_deviation: false
      };
    });
    setEvaluations(prefilled);
  }, [selectedBidder, workspaceData]);

  const updateEval = (criteriaId, key, value) => {
    setEvaluations(prev => ({
      ...prev,
      [criteriaId]: { ...(prev[criteriaId] || {}), [key]: value }
    }));
  };

  const handleSaveEvaluation = async () => {
    if (!selectedBidder || !viewStage) return;
    setSaving(true);
    try {
      const evalList = (viewStage.criteria || []).map(c => ({
        criteria_id: c.id,
        ...evaluations[c.id]
      }));
      await evaluationsAPI.submitEvaluation(viewStage.id, selectedBidder.id, { evaluations: evalList });
      toast.success('Evaluation saved');
      loadWorkspace();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim() || !selectedBidder) return;
    try {
      await evaluationsAPI.addComment(viewStage.id, selectedBidder.id, { comment, comment_type: 'general' });
      setComment('');
      toast.success('Comment added');
      loadWorkspace();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleVote = async (vote) => {
    if (!selectedBidder) return;
    try {
      await evaluationsAPI.submitVote(viewStage.id, selectedBidder.id, { vote });
      toast.success(`Vote recorded: ${vote}`);
      loadWorkspace();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!workflow || stages.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-title">Workflow not configured</div>
        <p style={{ fontSize: '13px' }}>Ask the administrator to configure the evaluation workflow first.</p>
      </div>
    );
  }

  if (project?.status === 'draft' || project?.status === 'workflow_configured') {
    return (
      <div className="empty-state">
        <div className="empty-title">Evaluation not started</div>
        <p style={{ fontSize: '13px' }}>The evaluation process has not been started yet.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Stage selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <button className="btn btn-outline btn-sm" onClick={() => setViewStageIdx(i => Math.max(0, i - 1))} disabled={viewStageIdx === 0}>
          <ChevronLeft size={14} />
        </button>
        <div style={{ display: 'flex', gap: '6px', flex: 1, overflowX: 'auto' }}>
          {stages.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setViewStageIdx(idx)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: 'none',
                background: viewStageIdx === idx ? 'var(--navy)' : 'var(--bg)',
                color: viewStageIdx === idx ? 'white' : 'var(--text)',
                fontSize: '12.5px',
                fontWeight: '500',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {idx < currentStageIdx ? '✓' : idx + 1}. {s.name}
              {idx === currentStageIdx && <span style={{ width: '6px', height: '6px', background: '#4caf50', borderRadius: '50%' }} />}
            </button>
          ))}
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => setViewStageIdx(i => Math.min(stages.length - 1, i + 1))} disabled={viewStageIdx === stages.length - 1}>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Stage info banner */}
      {viewStage && (
        <div style={{
          background: 'linear-gradient(to right, var(--navy), var(--navy-light))',
          borderRadius: '10px',
          padding: '14px 20px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: '600', color: 'white', fontSize: '15px' }}>
              Stage {viewStageIdx + 1}: {viewStage.name}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
              {viewStage.description || ''}
              {' · '}{viewStage.scoring_method?.replace(/_/g, ' ')}
              {' · '}{viewStage.decision_method?.replace(/_/g, ' ')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <span className={`badge badge-${viewStage.status || 'pending'}`}>
              {viewStage.status || 'pending'}
            </span>
            {viewStage.is_voting_enabled && (
              <span className="badge badge-active">Voting Enabled</span>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div className="workspace-container">
          {/* Bidder list panel */}
          <div className="bidder-list-panel">
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-light)',
              fontFamily: 'Syne, sans-serif',
              fontWeight: '600',
              fontSize: '13px',
              color: 'var(--navy)',
              background: 'var(--bg)'
            }}>
              Bidders ({workspaceData?.bidders?.length || 0})
            </div>
            {(workspaceData?.bidders || []).map(bidder => {
              const summary = workspaceData?.summary?.[bidder.id];
              const myEvals = workspaceData?.evaluations?.[bidder.id] || {};
              const hasMyEval = Object.keys(myEvals).length > 0;

              return (
                <div
                  key={bidder.id}
                  className={`bidder-item ${selectedBidder?.id === bidder.id ? 'selected' : ''} ${bidder.status === 'eliminated' ? 'eliminated' : ''}`}
                  onClick={() => setSelectedBidder(bidder)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500', lineHeight: '1.3' }}>{bidder.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', fontFamily: 'IBM Plex Mono, monospace' }}>
                        {bidder.bid_price ? `Rs. ${Number(bidder.bid_price).toLocaleString()}` : 'No price'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {hasMyEval && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', marginLeft: 'auto', marginBottom: '4px' }} title="Evaluated" />
                      )}
                      {bidder.status === 'eliminated' && (
                        <span style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: '600' }}>ELIM.</span>
                      )}
                    </div>
                  </div>
                  {summary && (
                    <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {summary.evaluator_count} evaluator(s) · Pass: {summary.pass_count || 0} / Fail: {summary.fail_count || 0}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Evaluation panel */}
          <div className="eval-panel">
            {!selectedBidder ? (
              <div className="empty-state">
                <div className="empty-title">Select a bidder</div>
                <p>Choose a bidder from the list to evaluate.</p>
              </div>
            ) : (
              <>
                {/* Bidder header */}
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-light)',
                  background: 'var(--bg)',
                  position: 'sticky', top: 0, zIndex: 2
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: '600', fontSize: '15px', color: 'var(--navy)' }}>
                        {selectedBidder.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {selectedBidder.address} · {selectedBidder.bid_price ? `Rs. ${Number(selectedBidder.bid_price).toLocaleString()}` : 'No bid price'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setShowComments(!showComments)}
                      >
                        <MessageSquare size={13} />
                        Comments ({(workspaceData?.comments || []).filter(c => c.bidder_id === selectedBidder.id).length})
                      </button>
                      {viewStage?.is_voting_enabled && (
                        <>
                          <button className="btn btn-success btn-sm" onClick={() => handleVote('approve')}>
                            <ThumbsUp size={13} /> Approve
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleVote('reject')}>
                            <ThumbsDown size={13} /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Vote summary */}
                  {viewStage?.is_voting_enabled && (
                    <div style={{ marginTop: '10px', display: 'flex', gap: '16px' }}>
                      {(() => {
                        const bVotes = (workspaceData?.votes || []).filter(v => v.bidder_id === selectedBidder.id);
                        const approves = bVotes.filter(v => v.vote === 'approve').length;
                        const rejects = bVotes.filter(v => v.vote === 'reject').length;
                        return (
                          <>
                            <span style={{ fontSize: '12px', color: 'var(--success)' }}>👍 {approves} Approve</span>
                            <span style={{ fontSize: '12px', color: 'var(--danger)' }}>👎 {rejects} Reject</span>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Criteria */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {(viewStage?.criteria || []).map((criterion, idx) => {
                    const ev = evaluations[criterion.id] || {};
                    return (
                      <div key={criterion.id} className="criteria-eval-row">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <div>
                            <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--navy)' }}>
                              {idx + 1}. {criterion.name}
                              {criterion.is_mandatory && <span style={{ color: 'var(--danger)', marginLeft: '4px' }}>*</span>}
                            </div>
                            {criterion.description && (
                              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{criterion.description}</div>
                            )}
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Type: {criterion.criteria_type} · Weight: {criterion.weight}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          {/* Pass/Fail */}
                          {['pass_fail', 'compliance'].includes(criterion.criteria_type) && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {['pass', 'fail'].map(v => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => updateEval(criterion.id, 'pass_fail', v)}
                                  style={{
                                    padding: '6px 20px',
                                    borderRadius: '6px',
                                    border: `1.5px solid ${ev.pass_fail === v ? (v === 'pass' ? 'var(--success)' : 'var(--danger)') : 'var(--border)'}`,
                                    background: ev.pass_fail === v ? (v === 'pass' ? 'var(--success-light)' : 'var(--danger-light)') : 'white',
                                    color: ev.pass_fail === v ? (v === 'pass' ? 'var(--success)' : 'var(--danger)') : 'var(--text-muted)',
                                    fontWeight: '600',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase'
                                  }}
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Score */}
                          {criterion.criteria_type === 'score' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="number"
                                className="form-control score-input"
                                value={ev.score ?? ''}
                                onChange={e => updateEval(criterion.id, 'score', e.target.value)}
                                min="0"
                                max={criterion.max_score}
                                placeholder="Score"
                              />
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ {criterion.max_score}</span>
                            </div>
                          )}

                          {/* Rank */}
                          {criterion.criteria_type === 'ranking' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rank:</label>
                              <input
                                type="number"
                                className="form-control score-input"
                                value={ev.rank ?? ''}
                                onChange={e => updateEval(criterion.id, 'rank', parseInt(e.target.value))}
                                min="1"
                                placeholder="Rank"
                              />
                            </div>
                          )}

                          {/* Deviation */}
                          {criterion.criteria_type === 'deviation' && (
                            <div style={{ width: '100%' }}>
                              <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                                  <input type="checkbox" checked={ev.is_deviation || false} onChange={e => updateEval(criterion.id, 'is_deviation', e.target.checked)} />
                                  Has Deviation
                                </label>
                                {ev.is_deviation && (
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={ev.is_minor_deviation || false} onChange={e => updateEval(criterion.id, 'is_minor_deviation', e.target.checked)} />
                                    Minor Deviation
                                  </label>
                                )}
                              </div>
                              {ev.is_deviation && (
                                <input
                                  className="form-control"
                                  value={ev.deviation_description || ''}
                                  onChange={e => updateEval(criterion.id, 'deviation_description', e.target.value)}
                                  placeholder="Describe the deviation..."
                                />
                              )}
                              {!ev.is_deviation && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  {['pass', 'fail'].map(v => (
                                    <button
                                      key={v}
                                      type="button"
                                      onClick={() => updateEval(criterion.id, 'pass_fail', v)}
                                      style={{
                                        padding: '6px 20px',
                                        borderRadius: '6px',
                                        border: `1.5px solid ${ev.pass_fail === v ? (v === 'pass' ? 'var(--success)' : 'var(--danger)') : 'var(--border)'}`,
                                        background: ev.pass_fail === v ? (v === 'pass' ? 'var(--success-light)' : 'var(--danger-light)') : 'white',
                                        color: ev.pass_fail === v ? (v === 'pass' ? 'var(--success)' : 'var(--danger)') : 'var(--text-muted)',
                                        fontWeight: '600', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase'
                                      }}
                                    >
                                      {v}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Text */}
                          {criterion.criteria_type === 'text' && (
                            <textarea
                              className="form-control"
                              value={ev.response_value || ''}
                              onChange={e => updateEval(criterion.id, 'response_value', e.target.value)}
                              placeholder="Enter response..."
                              rows={2}
                              style={{ flex: 1 }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Comments panel */}
                {showComments && (
                  <div style={{
                    borderTop: '1px solid var(--border-light)',
                    padding: '16px 20px',
                    maxHeight: '240px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ fontWeight: '600', marginBottom: '10px', fontSize: '13px' }}>Comments</div>
                    {(workspaceData?.comments || [])
                      .filter(c => c.bidder_id === selectedBidder.id)
                      .map(c => (
                        <div key={c.id} style={{
                          padding: '8px 12px',
                          background: 'var(--bg)',
                          borderRadius: '8px',
                          marginBottom: '8px'
                        }}>
                          <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '3px' }}>{c.user_name}</div>
                          <div style={{ fontSize: '13px' }}>{c.comment}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {new Date(c.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))
                    }
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <input
                        className="form-control"
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder="Add a comment..."
                        onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                      />
                      <button className="btn btn-outline btn-sm" onClick={handleAddComment}>Post</button>
                    </div>
                  </div>
                )}

                {/* Save bar */}
                <div style={{
                  padding: '12px 20px',
                  borderTop: '1px solid var(--border-light)',
                  background: 'white',
                  display: 'flex',
                  gap: '10px',
                  justifyContent: 'flex-end',
                  position: 'sticky',
                  bottom: 0
                }}>
                  <button className="btn btn-navy" onClick={handleSaveEvaluation} disabled={saving}>
                    {saving ? 'Saving...' : <><Save size={15} /> Save Evaluation</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
