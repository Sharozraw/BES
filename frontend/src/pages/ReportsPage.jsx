import React, { useEffect, useState } from 'react';
import Layout from '../components/common/Layout';
import { projectsAPI, reportsAPI, tenderAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { FileText, Download, BarChart3, RefreshCw } from 'lucide-react';

export default function ReportsPage() {
  const [projects, setProjects]         = useState([]);
  const [selectedProject, setProject]   = useState('');
  const [workPackages, setWorkPackages] = useState([]);
  const [selectedWP, setWP]             = useState('');
  const [items, setItems]               = useState([]);
  const [selectedItem, setItem]         = useState('');
  const [reports, setReports]           = useState([]);
  const [generating, setGenerating]     = useState(false);

  // Load projects
  useEffect(() => {
    projectsAPI.getAll()
      .then((res) => {
        setProjects(res.data || []);
        if (res.data?.length > 0) setProject(res.data[0].id);
      })
      .catch(() => {});
  }, []);

  // Load work packages + report history when project changes
  useEffect(() => {
    if (!selectedProject) return;
    setWorkPackages([]); setWP(''); setItems([]); setItem('');
    tenderAPI.getWorkPackages(selectedProject)
      .then((res) => setWorkPackages(res.data || []))
      .catch(() => {});
    reportsAPI.getByProject(selectedProject)
      .then((res) => setReports(res.data || []))
      .catch(() => {});
  }, [selectedProject]);

  // Load items when work package changes
  useEffect(() => {
    if (!selectedProject || !selectedWP) { setItems([]); setItem(''); return; }
    tenderAPI.getItems(selectedProject, selectedWP)
      .then((res) => setItems(res.data || []))
      .catch(() => {});
  }, [selectedProject, selectedWP]);

  const handleGenerate = async () => {
    if (!selectedProject || !selectedItem) {
      toast.error('Select a project, work package, and item');
      return;
    }
    setGenerating(true);
    try {
      const res = await reportsAPI.generate(selectedProject, {
        reportType: 'item_evaluation',
        itemId: selectedItem,
      });
      toast.success('Report generated!');

      const url = reportsAPI.download(res.data.id);
      const token = localStorage.getItem('bes_token');
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = res.data.fileName;
      a.click();
      URL.revokeObjectURL(a.href);

      reportsAPI.getByProject(selectedProject).then((r) => setReports(r.data || []));
    } catch (e) {
      toast.error(e.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (reportId, fileName) => {
    try {
      const url = reportsAPI.download(reportId);
      const token = localStorage.getItem('bes_token');
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName || 'report.pdf';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <Layout title="Reports" breadcrumb="Generate and download item-level bid evaluation reports">
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px' }}>

        {/* Generator panel */}
        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-header">
              <span className="card-title">Generate Item Report</span>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Project</label>
                <select className="form-control" value={selectedProject}
                  onChange={(e) => setProject(e.target.value)}>
                  <option value="">Select project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.file_no} — {p.title?.substring(0, 40)}…
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Work Package</label>
                <select className="form-control" value={selectedWP}
                  onChange={(e) => setWP(e.target.value)}
                  disabled={!selectedProject || workPackages.length === 0}>
                  <option value="">Select work package...</option>
                  {workPackages.map((wp) => (
                    <option key={wp.id} value={wp.id}>
                      {wp.name || wp.code || `WP ${wp.id}`}
                    </option>
                  ))}
                </select>
                {selectedProject && workPackages.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    No work packages found for this project.
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Item</label>
                <select className="form-control" value={selectedItem}
                  onChange={(e) => setItem(e.target.value)}
                  disabled={!selectedWP || items.length === 0}>
                  <option value="">Select item...</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.item_no ? `[${it.item_no}] ` : ''}{it.description}
                    </option>
                  ))}
                </select>
                {selectedWP && items.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    No items found in this work package.
                  </div>
                )}
              </div>

              <button
                className="btn btn-navy btn-lg"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleGenerate}
                disabled={generating || !selectedItem}
              >
                {generating
                  ? <><span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> Generating...</>
                  : <><FileText size={16} /> Generate &amp; Download PDF</>
                }
              </button>

              <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                Reports are generated <strong>per item</strong> and follow the official NCB Bid Evaluation Report layout.
              </div>
            </div>
          </div>
        </div>

        {/* Report history */}
        <div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Report History</span>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => selectedProject
                  && reportsAPI.getByProject(selectedProject).then((r) => setReports(r.data || []))}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
            {reports.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><BarChart3 size={28} /></div>
                <div className="empty-title">No reports generated</div>
                <p style={{ fontSize: '13px' }}>
                  Select a project, work package, and item to generate your first report.
                </p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Report Type</th>
                      <th>Title</th>
                      <th>Generated By</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <span style={{
                            background: 'var(--bg)', padding: '2px 8px',
                            borderRadius: '10px', fontSize: '11px', fontWeight: '500',
                          }}>
                            {r.report_type?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ fontSize: '13px' }}>{r.title}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {r.generated_by_name}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td>
                          <span className={`badge badge-${r.status}`}>{r.status}</span>
                        </td>
                        <td>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleDownload(r.id, r.file_path?.split('/').pop())}
                          >
                            <Download size={13} /> Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}