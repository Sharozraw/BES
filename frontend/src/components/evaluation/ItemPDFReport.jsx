// frontend/src/components/evaluation/ItemPDFReport.jsx
// Triggers PDF generation for the current item.
import React, { useEffect, useState } from 'react';
import { reportsAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { FileText, Download } from 'lucide-react';

export default function ItemPDFReport({ itemId, project, item }) {
  const [generating, setGenerating] = useState(false);
  const [reports, setReports]       = useState([]);

  const projectId = project?.id || item?.project_id;

  useEffect(() => {
    if (projectId) {
      reportsAPI.getByProject(projectId)
        .then((r) => setReports(r.data || []))
        .catch(() => {});
    }
  }, [projectId]);

  const handleGenerate = async () => {
    if (!itemId)    { toast.error('Item not loaded');    return; }
    if (!projectId) { toast.error('Project not loaded'); return; }

    setGenerating(true);
    try {
      const res = await reportsAPI.generate(projectId, {
        reportType: 'item_evaluation',
        itemId,
      });
      toast.success('Report generated — downloading…');
      await downloadReport(res.data.id, res.data.fileName);
      reportsAPI.getByProject(projectId).then((r) => setReports(r.data || []));
    } catch (e) {
      toast.error(e.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = async (id, fileName) => {
    try {
      const url = reportsAPI.download(id);
      const token = localStorage.getItem('bes_token');
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName || 'BES_Item_Report.pdf';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <div>
      <div style={{
        background: 'linear-gradient(to right, var(--navy), var(--navy-medium))',
        borderRadius: '10px 10px 0 0', padding: '12px 20px',
      }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'white', fontSize: 14 }}>
          📄 Generate PDF Report
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
          Item-level report matching the official NCB Bid Evaluation Report structure
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '24px' }}>
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          <FileText size={14} />
          <div>
            <strong>Report Sections (per item):</strong>
            <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.8 }}>
              1.0 Background &amp; Evaluation Committee
              <br />
              2.0 Bidding Documents &nbsp;·&nbsp; 3.0 Bidding Process
              <br />
              4.0 Bid Opening (all) &nbsp;·&nbsp; 4.1 Bid Opening (item)
              <br />
              5.1 Preliminary Examination &nbsp;·&nbsp; 6.1 Clarifications
              <br />
              7.1 Departures from Technical Specifications
              <br />
              8.1 Evaluation of Responsive Bids &nbsp;·&nbsp; 8.1.1 Post-Qualification Verification
              <br />
              9.1 Contract Award Recommendation
            </div>
          </div>
        </div>

        <button
          className="btn btn-navy btn-lg"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating
            ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Generating…</>
            : <><Download size={16} /> Generate &amp; Download PDF</>
          }
        </button>

        {reports.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)', marginBottom: 10 }}>
              Previously Generated Reports
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reports.slice(0, 8).map((r) => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: '#f8fafc',
                  borderRadius: 8, border: '1px solid var(--border-light)',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {new Date(r.created_at).toLocaleString()} · {r.generated_by_name}
                    </div>
                  </div>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => downloadReport(r.id, r.file_path?.split('/').pop())}
                  >
                    <Download size={12} /> Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}