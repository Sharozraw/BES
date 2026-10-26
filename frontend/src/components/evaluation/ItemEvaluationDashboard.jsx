import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../common/Layout';
import { tenderAPI } from '../../utils/api';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

import Table41BidOpening from './Table41BidOpening';
import Table51PreliminaryExam from './Table51PreliminaryExam';
import Table6Clarifications from './Table6Clarifications';
import Table7TechnicalDepartures from './Table7TechnicalDepartures';
import Table81FinancialEvaluation from './Table81FinancialEvaluation';
import Table811PostQualification from './Table811PostQualification';
import ContractAwardRecommendation from './ContractAwardRecommendation';
import BidEvaluationSummaryReport from './BidEvaluationSummaryReport';
import ItemPDFReport from './ItemPDFReport';

import { Play, ArrowLeft, FileText, ChevronRight, ChevronLeft } from 'lucide-react';

// Tab definitions — clean labels, no numbers
const CREATION_TABS = [
  { id: '41',  label: 'Bid Opening',         icon: '📋' },
];

const EVAL_TABS = [
  { id: '41',      label: 'Bid Opening',         icon: '📋' },
  { id: '51',      label: 'Preliminary Exam',    icon: '✅' },
  { id: '6',       label: 'Clarifications',      icon: '💬' },
  { id: '7',       label: 'Tech. Departures',    icon: '⚠️' },
  { id: '81',      label: 'Financial Eval.',     icon: '💰' },
  { id: '811',     label: 'Post-Qualification',  icon: '🏅' },
  { id: '91',      label: 'Contract Award',      icon: '🏆' },
  { id: 'summary', label: 'Summary Report',      icon: '📊' },
  { id: 'report',  label: 'PDF Report',          icon: '📄' },
];

export default function ItemEvaluationDashboard() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthStore();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [acceptanceSummary, setAcceptanceSummary] = useState([]);
  const [globalBidders, setGlobalBidders] = useState([]);

  const acceptedBidders = acceptanceSummary.filter(a => a.accepted !== false);

  const load = useCallback(async () => {
    try {
      const res = await tenderAPI.getItemById(itemId);
      setItem(res.data);
      const bidderRes = await tenderAPI.getGlobalBidders(res.data.project_id);
      setGlobalBidders(bidderRes.data || []);
      setActiveTabIdx(res.data.eval_status === 'evaluation'
        ? Math.min(res.data.evaluation_step || 0, EVAL_TABS.length - 1)
        : 0);
    } catch {
      toast.error('Item not found');
      navigate('/projects');
    } finally { setLoading(false); }
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  if (loading || !item) {
    return (
      <Layout title="Item Evaluation">
        <div className="loading-center"><div className="spinner" /></div>
      </Layout>
    );
  }

  const isCreation = item.eval_status === 'creation';
  const isEval = item.eval_status === 'evaluation';
  const canEdit = isAdmin() || user?.id === item.evaluator_id;
  const tabs = isEval ? EVAL_TABS : CREATION_TABS;
  const activeTab = tabs[activeTabIdx];

  // ── Navigation handlers ──────────────────────────────────────────────────

  const handleTabClick = (idx) => {
    const currentStep = item.evaluation_step || 0;
    if (idx <= currentStep) {
      setActiveTabIdx(idx);
    } else {
      toast('Complete the current step and confirm it before continuing.', { icon: '🔒' });
    }
  };

  const handleConfirmAndNext = async () => {
    if (!isEval || activeTabIdx !== (item.evaluation_step || 0)) return;
    try {
      await tenderAPI.advanceEvaluationStep(itemId, { current_step: activeTabIdx });
      if (activeTabIdx < tabs.length - 1) {
        setActiveTabIdx(activeTabIdx + 1);
        toast.success(`${activeTab.label} confirmed — moved to ${tabs[activeTabIdx + 1].label}`);
      } else {
        toast.success('All evaluation steps completed');
      }
      load();
    } catch (e) { toast.error(e.message || 'Could not advance evaluation'); }
  };

  // "Previous" — always allowed
  const handlePrev = () => {
    if (activeTabIdx > 0) setActiveTabIdx(activeTabIdx - 1);
  };

  const handleBeginEvaluation = async () => {
    if (!window.confirm('Begin evaluation? All tables will become available.')) return;
    setStarting(true);
    try {
      await tenderAPI.beginEvaluation(itemId);
      toast.success('Evaluation mode activated');
      load();
    } catch (e) { toast.error(e.message); }
    finally { setStarting(false); }
  };

  const isLastTab = activeTabIdx === tabs.length - 1;
  const isFirstTab = activeTabIdx === 0;
  const currentStep = item.evaluation_step || 0;

  return (
    <Layout
      title={`${item.item_no ? `[${item.item_no}] ` : ''}${item.description}`}
      breadcrumb={`Projects › ${item.work_package_name || 'Items'} › Evaluation`}
    >
      {/* Item header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 10 }}>
              <ArrowLeft size={13} /> Back
            </button>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={`badge badge-${isEval ? 'in_evaluation' : 'draft'}`}>
                {isEval ? '⚡ Evaluation Mode' : '✏️ Creation Mode'}
              </span>
              {item.work_package_name && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>WP: {item.work_package_name}</span>
              )}
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Evaluator: {item.evaluator_name || 'Admin'}
              </span>
            </div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginTop: 8, lineHeight: 1.3 }}>
              {item.item_no && <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>[{item.item_no}]</span>}
              {item.description}
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            {isCreation && canEdit && (
              <button className="btn btn-success" onClick={handleBeginEvaluation} disabled={starting}>
                {starting
                  ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Starting…</>
                  : <><Play size={15} /> Begin Evaluation</>}
              </button>
            )}

          </div>
        </div>

        {isCreation && (
          <div className="alert alert-info" style={{ margin: '0 24px 16px', fontSize: 12 }}>
            <FileText size={14} />
            <span>
              <strong>Creation Mode:</strong> Complete Bid Opening, then click <strong>"Begin Evaluation"</strong> to start the sequential evaluation.
            </span>
          </div>
        )}

      </div>

      {/* Tab strip */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)',
        borderRadius: 12, padding: '6px 8px', marginBottom: 20,
        overflowX: 'auto', display: 'flex', gap: 3, alignItems: 'center'
      }}>
        {tabs.map((tab, idx) => {
          const isActive = idx === activeTabIdx;
          const isDone = idx < currentStep;
          const isLocked = idx > currentStep;

          return (
            <button key={tab.id}
              onClick={() => handleTabClick(idx)}
              title={isLocked ? 'Complete the current step first' : tab.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8, border: 'none',
                background: isActive ? 'var(--navy)' : isDone ? '#e8f5e9' : 'transparent',
                color: isActive ? 'white' : isDone ? 'var(--success)' : isLocked ? 'var(--text-muted)' : 'var(--text-secondary)',
                fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12.5,
                fontWeight: isActive ? 600 : 500,
                cursor: isLocked ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap', transition: 'all .15s',
                opacity: isLocked ? 0.5 : 1,
              }}>
              <span>{isDone && !isActive ? '✓' : tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Section content */}
      <div>
        {activeTab?.id === '41' && (
          <Table41BidOpening itemId={itemId} globalBidders={globalBidders} readOnly={!canEdit || activeTabIdx > currentStep} onBiddersChange={() => {}} />
        )}
        {activeTab?.id === '51' && (
          <Table51PreliminaryExam itemId={itemId} readOnly={!canEdit || activeTabIdx > currentStep} onAcceptanceChange={setAcceptanceSummary} />
        )}
        {activeTab?.id === '6' && (
          <Table6Clarifications itemId={itemId} acceptedBidders={acceptedBidders} readOnly={!canEdit || activeTabIdx > currentStep} />
        )}
        {activeTab?.id === '7' && (
          <Table7TechnicalDepartures itemId={itemId} acceptedBidders={acceptedBidders} readOnly={!canEdit || activeTabIdx > currentStep} />
        )}
        {activeTab?.id === '81' && (
          <Table81FinancialEvaluation itemId={itemId} acceptedBidders={acceptedBidders} readOnly={!canEdit || activeTabIdx > currentStep} />
        )}
        {activeTab?.id === '811' && (
          <Table811PostQualification itemId={itemId} readOnly={!canEdit || activeTabIdx > currentStep} />
        )}
        {activeTab?.id === '91' && (
          <ContractAwardRecommendation itemId={itemId} acceptedBidders={acceptedBidders} readOnly={!canEdit || activeTabIdx > currentStep} />
        )}
        {activeTab?.id === 'summary' && (
          <BidEvaluationSummaryReport itemId={itemId} project={null} />
        )}
        {activeTab?.id === 'report' && (
          <ItemPDFReport itemId={itemId} project={null} item={item} />
        )}
      </div>

      {/* Bottom navigation bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 20, padding: '14px 20px',
        background: 'white', borderRadius: 12,
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Previous */}
        <button
          className="btn btn-outline"
          onClick={handlePrev}
          disabled={isFirstTab}
        >
          <ChevronLeft size={15} /> Previous
        </button>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {tabs.map((tab, idx) => (
            <div key={tab.id}
              onClick={() => handleTabClick(idx)}
              style={{
                width: idx === activeTabIdx ? 24 : 8,
                height: 8, borderRadius: 4,
                background: idx === activeTabIdx ? 'var(--navy)'
                  : idx < currentStep ? 'var(--success)'
                  : 'var(--border)',
                cursor: 'pointer', transition: 'all .2s',
              }}
            />
          ))}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
            {activeTabIdx + 1} / {tabs.length}
          </span>
        </div>

        {/* Next / Confirm */}
        {isEval && canEdit ? (
          <button
            className="btn btn-navy"
            onClick={handleConfirmAndNext}
            disabled={isLastTab || activeTabIdx !== currentStep}
            style={{ gap: 6 }}
          >
            Confirm &amp; Continue
            <ChevronRight size={15} />
          </button>
        ) : (
          <button
            className="btn btn-outline"
            onClick={() => setActiveTabIdx(i => Math.min(i + 1, tabs.length - 1))}
            disabled
          >
            Next <ChevronRight size={15} />
          </button>
        )}
      </div>
    </Layout>
  );
}
