import React, { useState, useEffect } from 'react';
import { workflowsAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical, X, Check } from 'lucide-react';

const SCORING_METHODS = [
  { value: 'pass_fail', label: 'Pass / Fail' },
  { value: 'weighted_scoring', label: 'Weighted Scoring' },
  { value: 'ranking', label: 'Ranking' },
  { value: 'compliance', label: 'Compliance Check' },
];

const DECISION_METHODS = [
  { value: 'accept_reject', label: 'Accept / Reject' },
  { value: 'scoring', label: 'Score-Based' },
  { value: 'voting', label: 'Committee Voting' },
  { value: 'ranking', label: 'Ranking' },
  { value: 'manual', label: 'Manual Selection' },
];

const CRITERIA_TYPES = [
  { value: 'pass_fail', label: 'Pass / Fail' },
  { value: 'score', label: 'Numeric Score' },
  { value: 'compliance', label: 'Compliance (Yes/No)' },
  { value: 'deviation', label: 'Deviation Check' },
  { value: 'text', label: 'Text Response' },
  { value: 'ranking', label: 'Rank Order' },
];

const FINAL_DECISION_METHODS = [
  { value: 'ranking', label: 'Lowest Evaluated Price (Ranking)' },
  { value: 'scoring', label: 'Highest Score' },
  { value: 'voting', label: 'Committee Vote' },
  { value: 'manual', label: 'Manual Admin Selection' },
];

const NCB_TEMPLATE = {
  name: 'Standard NCB Procurement Evaluation',
  description: 'Three-stage evaluation following standard NCB procurement procedures',
  final_decision_method: 'ranking',
  stages: [
    {
      name: 'Preliminary Examination',
      description: 'Check completeness of bid documents and administrative compliance',
      scoring_method: 'pass_fail',
      decision_method: 'accept_reject',
      is_voting_enabled: false,
      is_comments_mandatory: true,
      pass_threshold: 100,
      criteria: [
        { name: 'Form of Bid filled & signed', criteria_type: 'compliance', is_mandatory: true, weight: 1 },
        { name: 'Manufacturer Authorization submitted', criteria_type: 'compliance', is_mandatory: true, weight: 1 },
        { name: 'Bid Security submitted', criteria_type: 'compliance', is_mandatory: true, weight: 1 },
        { name: 'Business Registration submitted', criteria_type: 'compliance', is_mandatory: true, weight: 1 },
        { name: 'Substantial Responsiveness', criteria_type: 'pass_fail', is_mandatory: true, weight: 1 },
      ]
    },
    {
      name: 'Technical Evaluation',
      description: 'Evaluate technical specifications against requirements',
      scoring_method: 'compliance',
      decision_method: 'accept_reject',
      is_voting_enabled: true,
      min_votes_required: 3,
      is_comments_mandatory: true,
      pass_threshold: 80,
      criteria: [
        { name: 'Processor Specification', criteria_type: 'compliance', is_mandatory: true, weight: 1 },
        { name: 'Memory (RAM)', criteria_type: 'compliance', is_mandatory: true, weight: 1 },
        { name: 'Storage', criteria_type: 'compliance', is_mandatory: true, weight: 1 },
        { name: 'Video Controller / GPU', criteria_type: 'compliance', is_mandatory: true, weight: 1 },
        { name: 'Keyboard & Mouse', criteria_type: 'deviation', is_mandatory: false, weight: 0.5 },
        { name: 'I/O Ports', criteria_type: 'compliance', is_mandatory: true, weight: 1 },
        { name: 'Operating System', criteria_type: 'compliance', is_mandatory: true, weight: 1 },
        { name: 'Display/Monitor', criteria_type: 'compliance', is_mandatory: true, weight: 1 },
        { name: 'Warranty Terms', criteria_type: 'compliance', is_mandatory: true, weight: 1 },
        { name: 'Manufacturer Experience (10+ years)', criteria_type: 'compliance', is_mandatory: true, weight: 1 },
      ]
    },
    {
      name: 'Financial Evaluation',
      description: 'Arithmetic correction, ranking by evaluated bid price',
      scoring_method: 'ranking',
      decision_method: 'ranking',
      is_voting_enabled: false,
      is_comments_mandatory: false,
      pass_threshold: 0,
      criteria: [
        { name: 'Bid Price (Without VAT)', criteria_type: 'score', is_mandatory: true, weight: 1, max_score: 999999999 },
        { name: 'Arithmetic Error Correction', criteria_type: 'score', is_mandatory: false, weight: 1, max_score: 999999999 },
        { name: 'Discounts Applied', criteria_type: 'score', is_mandatory: false, weight: 1, max_score: 999999999 },
        { name: 'Evaluated Bid Price', criteria_type: 'score', is_mandatory: true, weight: 1, max_score: 999999999 },
        { name: 'Rank', criteria_type: 'ranking', is_mandatory: true, weight: 1 },
      ]
    }
  ]
};

const defaultStage = () => ({
  name: '',
  description: '',
  scoring_method: 'pass_fail',
  decision_method: 'accept_reject',
  is_voting_enabled: false,
  min_votes_required: 1,
  is_comments_mandatory: false,
  pass_threshold: 0,
  auto_advance: true,
  criteria: [],
  _open: true,
});

const defaultCriterion = () => ({
  name: '',
  description: '',
  criteria_type: 'pass_fail',
  weight: 1,
  max_score: 100,
  is_mandatory: true,
  options: [],
});

export default function WorkflowBuilder({ projectId, workflow, onSaved }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [finalMethod, setFinalMethod] = useState('ranking');
  const [stages, setStages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [useTemplate, setUseTemplate] = useState(false);

  useEffect(() => {
    if (workflow) {
      setName(workflow.name || '');
      setDescription(workflow.description || '');
      setFinalMethod(workflow.final_decision_method || 'ranking');
      setStages((workflow.stages || []).map(s => ({
        ...s,
        criteria: s.criteria || [],
        _open: false
      })));
    }
  }, [workflow]);

  const loadTemplate = () => {
    setName(NCB_TEMPLATE.name);
    setDescription(NCB_TEMPLATE.description);
    setFinalMethod(NCB_TEMPLATE.final_decision_method);
    setStages(NCB_TEMPLATE.stages.map(s => ({ ...s, _open: false })));
    setUseTemplate(false);
    toast.success('NCB template loaded');
  };

  const addStage = () => {
    setStages(prev => [...prev, defaultStage()]);
  };

  const removeStage = (i) => {
    setStages(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateStage = (i, key, val) => {
    setStages(prev => prev.map((s, idx) => idx === i ? { ...s, [key]: val } : s));
  };

  const toggleStage = (i) => {
    setStages(prev => prev.map((s, idx) => idx === i ? { ...s, _open: !s._open } : s));
  };

  const addCriterion = (stageIdx) => {
    setStages(prev => prev.map((s, idx) =>
      idx === stageIdx ? { ...s, criteria: [...(s.criteria || []), defaultCriterion()] } : s
    ));
  };

  const removeCriterion = (stageIdx, critIdx) => {
    setStages(prev => prev.map((s, idx) =>
      idx === stageIdx ? { ...s, criteria: s.criteria.filter((_, ci) => ci !== critIdx) } : s
    ));
  };

  const updateCriterion = (stageIdx, critIdx, key, val) => {
    setStages(prev => prev.map((s, idx) =>
      idx === stageIdx ? {
        ...s,
        criteria: s.criteria.map((c, ci) => ci === critIdx ? { ...c, [key]: val } : c)
      } : s
    ));
  };

  const handleSave = async () => {
    if (!name) { toast.error('Workflow name is required'); return; }
    if (stages.length === 0) { toast.error('Add at least one stage'); return; }
    for (const s of stages) {
      if (!s.name) { toast.error('All stages must have a name'); return; }
    }

    setSaving(true);
    try {
      await workflowsAPI.create(projectId, {
        name, description, final_decision_method: finalMethod,
        stages: stages.map(({ _open, ...s }) => s)
      });
      toast.success('Workflow saved successfully!');
      onSaved?.();
    } catch (e) {
      toast.error(e.message || 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Template banner */}
      {stages.length === 0 && (
        <div className="alert alert-info" style={{ marginBottom: '16px' }}>
          <div>
            <strong>Configure your evaluation workflow.</strong> You can use the NCB template or build a custom workflow from scratch.
            <button
              className="btn btn-primary btn-sm"
              style={{ marginLeft: '12px' }}
              onClick={loadTemplate}
            >
              Load NCB Template
            </button>
          </div>
        </div>
      )}

      {/* Workflow header */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header"><span className="card-title">Workflow Configuration</span></div>
        <div className="card-body">
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Workflow Name *</label>
              <input className="form-control" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard NCB Evaluation" />
            </div>
            <div className="form-group">
              <label className="form-label">Final Decision Method</label>
              <select className="form-control" value={finalMethod} onChange={e => setFinalMethod(e.target.value)}>
                {FINAL_DECISION_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Describe this evaluation workflow..." />
          </div>
        </div>
      </div>

      {/* Stages */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: '600', color: 'var(--navy)' }}>
            Evaluation Stages ({stages.length})
          </h3>
          <button className="btn btn-outline btn-sm" onClick={addStage}>
            <Plus size={14} /> Add Stage
          </button>
        </div>

        {stages.map((stage, sIdx) => (
          <div key={sIdx} className="stage-card">
            <div className="stage-header" onClick={() => toggleStage(sIdx)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="stage-number">{sIdx + 1}</div>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: '600', color: 'white', fontSize: '14px' }}>
                    {stage.name || `Stage ${sIdx + 1}`}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                    {stage.scoring_method} · {stage.decision_method} · {stage.criteria?.length || 0} criteria
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  className="btn btn-sm"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }}
                  onClick={e => { e.stopPropagation(); removeStage(sIdx); }}
                >
                  <Trash2 size={13} />
                </button>
                {stage._open ? <ChevronUp size={18} color="white" /> : <ChevronDown size={18} color="white" />}
              </div>
            </div>

            {stage._open && (
              <div className="stage-body">
                <div className="form-grid form-grid-2" style={{ marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Stage Name *</label>
                    <input className="form-control" value={stage.name} onChange={e => updateStage(sIdx, 'name', e.target.value)} placeholder="e.g. Preliminary Examination" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <input className="form-control" value={stage.description} onChange={e => updateStage(sIdx, 'description', e.target.value)} placeholder="Brief description..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Scoring Method</label>
                    <select className="form-control" value={stage.scoring_method} onChange={e => updateStage(sIdx, 'scoring_method', e.target.value)}>
                      {SCORING_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Decision Method</label>
                    <select className="form-control" value={stage.decision_method} onChange={e => updateStage(sIdx, 'decision_method', e.target.value)}>
                      {DECISION_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  {(stage.scoring_method === 'weighted_scoring' || stage.scoring_method === 'ranking') && (
                    <div className="form-group">
                      <label className="form-label">Pass Threshold (%)</label>
                      <input type="number" className="form-control" value={stage.pass_threshold} onChange={e => updateStage(sIdx, 'pass_threshold', parseFloat(e.target.value))} min="0" max="100" />
                    </div>
                  )}
                </div>

                {/* Options row */}
                <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', padding: '12px 16px', background: 'var(--bg)', borderRadius: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <button
                      type="button"
                      className={`toggle ${stage.is_voting_enabled ? 'on' : ''}`}
                      onClick={() => updateStage(sIdx, 'is_voting_enabled', !stage.is_voting_enabled)}
                    >
                      <div className="toggle-thumb" />
                    </button>
                    Enable Voting
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <button
                      type="button"
                      className={`toggle ${stage.is_comments_mandatory ? 'on' : ''}`}
                      onClick={() => updateStage(sIdx, 'is_comments_mandatory', !stage.is_comments_mandatory)}
                    >
                      <div className="toggle-thumb" />
                    </button>
                    Comments Mandatory
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <button
                      type="button"
                      className={`toggle ${stage.auto_advance ? 'on' : ''}`}
                      onClick={() => updateStage(sIdx, 'auto_advance', !stage.auto_advance)}
                    >
                      <div className="toggle-thumb" />
                    </button>
                    Auto-Advance
                  </label>
                  {stage.is_voting_enabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px' }}>Min Votes:</span>
                      <input type="number" className="form-control" value={stage.min_votes_required} onChange={e => updateStage(sIdx, 'min_votes_required', parseInt(e.target.value))} min="1" style={{ width: '60px' }} />
                    </div>
                  )}
                </div>

                {/* Criteria */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      Evaluation Criteria ({stage.criteria?.length || 0})
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={() => addCriterion(sIdx)}>
                      <Plus size={13} /> Add Criterion
                    </button>
                  </div>

                  {(stage.criteria || []).map((crit, cIdx) => (
                    <div key={cIdx} className="criteria-item">
                      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px', gap: '10px', alignItems: 'end' }}>
                        <div>
                          <label className="form-label">Criterion Name</label>
                          <input className="form-control" value={crit.name} onChange={e => updateCriterion(sIdx, cIdx, 'name', e.target.value)} placeholder="e.g. Processor Specification" />
                        </div>
                        <div>
                          <label className="form-label">Type</label>
                          <select className="form-control" value={crit.criteria_type} onChange={e => updateCriterion(sIdx, cIdx, 'criteria_type', e.target.value)}>
                            {CRITERIA_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="form-label">Weight</label>
                          <input type="number" className="form-control" value={crit.weight} onChange={e => updateCriterion(sIdx, cIdx, 'weight', parseFloat(e.target.value))} min="0" step="0.1" />
                        </div>
                        <div>
                          <label className="form-label">Mandatory</label>
                          <div style={{ paddingTop: '4px' }}>
                            <button
                              type="button"
                              className={`toggle ${crit.is_mandatory ? 'on' : ''}`}
                              onClick={() => updateCriterion(sIdx, cIdx, 'is_mandatory', !crit.is_mandatory)}
                            >
                              <div className="toggle-thumb" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', marginLeft: '8px', alignSelf: 'center' }}
                        onClick={() => removeCriterion(sIdx, cIdx)}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}

                  {(stage.criteria || []).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg)', borderRadius: '8px' }}>
                      No criteria added. Click "Add Criterion" to start.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {stages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon"><Plus size={28} /></div>
            <div className="empty-title">No stages configured</div>
            <p>Add evaluation stages or load the NCB template above.</p>
            <button className="btn btn-navy" style={{ marginTop: '12px' }} onClick={addStage}>
              <Plus size={15} /> Add First Stage
            </button>
          </div>
        )}
      </div>

      {/* Save */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button className="btn btn-navy btn-lg" onClick={handleSave} disabled={saving}>
          {saving
            ? <><span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> Saving...</>
            : <><Check size={16} /> Save Workflow</>
          }
        </button>
        {stages.length === 0 && (
          <button className="btn btn-accent btn-lg" onClick={loadTemplate}>
            Load NCB Template
          </button>
        )}
      </div>
    </div>
  );
}
