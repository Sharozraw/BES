import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/common/Layout';
import { projectsAPI, workflowsAPI } from '../utils/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import BidderManager from '../components/admin/BidderManager';
import EvaluatorAssigner from '../components/admin/EvaluatorAssigner';
import TenderCreation from '../components/admin/TenderCreation';
import {
  FolderOpen, Users, Package,
  Edit, ArrowRight
} from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview', icon: FolderOpen },
  { id: 'tender', label: 'Tender Setup', icon: Package },
  { id: 'bidders', label: 'Bidders', icon: Users },
];

const ADMIN_ONLY_TABS = ['tender'];

const StatusBadge = ({ status }) => (
  <span className={`badge badge-${status}`} style={{ fontSize: '13px', padding: '5px 14px' }}>
    {status?.replace(/_/g, ' ').toUpperCase()}
  </span>
);

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();
  const [project, setProject] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pRes, wRes] = await Promise.all([
        projectsAPI.getById(id),
        workflowsAPI.getByProject(id)
      ]);
      setProject(pRes.data);
      setWorkflow(wRes.data);
    } catch (e) {
      toast.error('Failed to load project');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleAdvanceStage = async () => {
    if (!window.confirm('Advance to the next evaluation stage?')) return;
    setActionLoading(true);
    try {
      await workflowsAPI.advance(id);
      toast.success('Advanced to next stage');
      load();
    } catch (e) {
      toast.error(e.message || 'Failed to advance stage');
    } finally {
      setActionLoading(false);
    }
  };

  const visibleTabs = TABS.filter(t => isAdmin() || !ADMIN_ONLY_TABS.includes(t.id));

  if (loading) {
    return (
      <Layout title="Project Details">
        <div className="loading-center"><div className="spinner" /></div>
      </Layout>
    );
  }

  const stages = workflow?.stages || [];
  const currentStageIdx = workflow?.current_stage_index ?? 0;
  const currentStage = stages[currentStageIdx];
  const totalStages = stages.length;

  return (
    <Layout
      title={project?.file_no}
      breadcrumb={`Projects › ${project?.title}`}
    >
      {/* Project header bar */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <StatusBadge status={project?.status} />
                <span style={{
                  background: '#e8eef5',
                  padding: '3px 10px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: 'var(--navy)',
                  fontWeight: '600',
                  fontFamily: 'IBM Plex Mono, monospace'
                }}>{project?.procurement_method || 'NCB'}</span>
              </div>
              <h2 style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: '20px',
                fontWeight: '700',
                color: 'var(--navy)',
                marginBottom: '6px',
                lineHeight: '1.3'
              }}>{project?.title}</h2>
              <div style={{ display: 'flex', gap: '20px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                <span>👥 {project?.bidder_count || 0} bidders</span>
              </div>
            </div>

            {/* Action buttons */}
            {isAdmin() && (
              <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                {project?.status === 'in_evaluation' && (
                  <button className="btn btn-accent" onClick={handleAdvanceStage} disabled={actionLoading}>
                    <ArrowRight size={15} /> Next Stage
                  </button>
                )}
                <button
                  className="btn btn-outline"
                  onClick={() => navigate(`/projects/${id}/edit`)}
                >
                  <Edit size={15} /> Edit
                </button>
              </div>
            )}
          </div>

          {/* Workflow stage progress */}
          {stages.length > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '10px', letterSpacing: '1px' }}>
                EVALUATION PROGRESS
              </div>
              <div className="stage-progress">
                {stages.map((stage, idx) => {
                  const done = idx < currentStageIdx || project?.status === 'evaluation_complete' || project?.status === 'awarded';
                  const active = idx === currentStageIdx && project?.status === 'in_evaluation';
                  return (
                    <div key={stage.id} className="stage-step">
                      <div className={`step-dot ${done ? 'completed' : active ? 'active' : 'pending'}`}>
                        {done ? '✓' : idx + 1}
                      </div>
                      <div className={`step-label ${done ? 'completed' : active ? 'active' : ''}`}>
                        {stage.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '2px',
        background: 'white',
        border: '1px solid var(--border-light)',
        borderRadius: '10px',
        padding: '4px',
        marginBottom: '20px',
        overflowX: 'auto'
      }}>
        {visibleTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '7px',
                border: 'none',
                background: activeTab === tab.id ? 'var(--navy)' : 'transparent',
                color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
                fontFamily: 'IBM Plex Sans, sans-serif',
                fontSize: '13px',
                fontWeight: activeTab === tab.id ? '600' : '500',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s'
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <ProjectOverview project={project} workflow={workflow} stages={stages} currentStageIdx={currentStageIdx} />
      )}
      {activeTab === 'tender' && isAdmin() && (
        <TenderCreation projectId={id} />
      )}
      {activeTab === 'bidders' && (
        <BidderManager projectId={id} isAdmin={isAdmin()} />
      )}
    </Layout>
  );
}

function ProjectOverview({ project, workflow, stages, currentStageIdx }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      <div className="card">
        <div className="card-header"><span className="card-title">Project Information</span></div>
        <div className="card-body">
          {[
            ['File Number', project?.file_no],
            ['Procurement Method', project?.procurement_method],
            ['Invitation Date', project?.invitation_date ? new Date(project.invitation_date).toLocaleDateString() : '—'],
            ['Bid Close Date', project?.bid_close_date ? new Date(project.bid_close_date).toLocaleString() : '—'],
            ['Bid Open Date', project?.bid_open_date ? new Date(project.bid_open_date).toLocaleString() : '—'],
            ['Document Price', project?.document_price ? `Rs. ${Number(project.document_price).toLocaleString()}` : '—'],
            ['Created By', project?.created_by_name],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ width: '160px', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: '13px', color: 'var(--text)' }}>{value || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-header"><span className="card-title">Evaluation Committee</span></div>
          <div style={{ padding: '12px 0' }}>
            {(project?.evaluators || []).length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No evaluators assigned
              </div>
            ) : (project?.evaluators || []).map(ev => (
              <div key={ev.id} style={{
                padding: '10px 20px',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '32px', height: '32px',
                  background: 'var(--navy)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '11px',
                  fontWeight: '700',
                  flexShrink: 0
                }}>
                  {ev.first_name?.[0]}{ev.last_name?.[0]}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>{ev.first_name} {ev.last_name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {ev.designation} · <span className={`badge badge-${ev.role}`} style={{ fontSize: '10px' }}>{ev.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {workflow && (
          <div className="card">
            <div className="card-header"><span className="card-title">Workflow: {workflow.name}</span></div>
            <div style={{ padding: '12px 20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Final Decision Method: <strong>{workflow.final_decision_method?.replace(/_/g, ' ')}</strong>
              </div>
              {stages.map((stage, idx) => (
                <div key={stage.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border-light)'
                }}>
                  <div style={{
                    width: '22px', height: '22px',
                    borderRadius: '50%',
                    background: idx < currentStageIdx ? 'var(--success)' :
                      idx === currentStageIdx ? 'var(--blue)' : 'var(--border)',
                    color: idx <= currentStageIdx ? 'white' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: '700',
                    flexShrink: 0
                  }}>{idx + 1}</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{stage.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {stage.scoring_method} · {stage.decision_method} · {stage.criteria?.length || 0} criteria
                    </div>
                  </div>
                  <span className={`badge badge-${stage.status || 'pending'}`} style={{ marginLeft: 'auto', fontSize: '10px' }}>
                    {stage.status || 'pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}