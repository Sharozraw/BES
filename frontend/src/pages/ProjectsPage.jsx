import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/common/Layout';
import { projectsAPI } from '../utils/api';
import useAuthStore from '../store/authStore';
import { Plus, Search, Eye, FolderOpen, Trash2 } from 'lucide-react';

const STATUS_LABELS = {
  draft: 'Draft',
  workflow_configured: 'Ready',
  in_evaluation: 'In Evaluation',
  evaluation_complete: 'Eval. Complete',
  awarded: 'Awarded'
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { isAdmin } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    projectsAPI.getAll()
      .then(res => setProjects(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.title?.toLowerCase().includes(q) || p.file_no?.toLowerCase().includes(q) || p.department?.toLowerCase().includes(q);
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const deleteProject = async project => {
    if (!window.confirm(`Delete project ${project.file_no} and all its data?`)) return;
    try {
      await projectsAPI.delete(project.id);
      setProjects(current => current.filter(item => item.id !== project.id));
    } catch (error) { window.alert(error.message || 'Project deletion failed'); }
  };

  return (
    <Layout title="Projects" breadcrumb="All procurement evaluation projects">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-control"
              placeholder="Search by title, file no, department..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '34px' }}
            />
          </div>
          <select
            className="form-control"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        {isAdmin() && (
          <button className="btn btn-navy" onClick={() => navigate('/projects/new')}>
            <Plus size={16} /> New Project
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Projects <span style={{ fontSize: '12px', fontWeight: '400', color: 'var(--text-muted)' }}>({filtered.length})</span>
          </span>
        </div>
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FolderOpen size={28} /></div>
            <div className="empty-title">No projects found</div>
            <p style={{ fontSize: '13px' }}>
              {isAdmin() ? 'Create your first project to get started.' : 'No projects assigned to you yet.'}
            </p>
            {isAdmin() && (
              <button className="btn btn-navy" style={{ marginTop: '16px' }} onClick={() => navigate('/projects/new')}>
                <Plus size={16} /> Create Project
              </button>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>File No.</th>
                  <th>Project Title</th>
                  <th>Department</th>
                  <th>Est. Amount</th>
                  <th>Method</th>
                  <th>Bidders</th>
                  <th>Evaluators</th>
                  <th>Current Stage</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <code style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: 'var(--navy)', fontWeight: '500' }}>
                        {p.file_no}
                      </code>
                    </td>
                    <td style={{ maxWidth: '220px' }}>
                      <div style={{ fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.title}
                      </div>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.department}</td>
                    <td style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px' }}>
                      {p.estimated_amount
                        ? `Rs. ${Number(p.estimated_amount).toLocaleString()}`
                        : '—'
                      }
                    </td>
                    <td>
                      {p.procurement_method && (
                        <span style={{
                          background: '#e8eef5',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: '600',
                          color: 'var(--navy)'
                        }}>{p.procurement_method}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        background: 'var(--bg)',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>{p.bidder_count || 0}</span>
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '12px' }}>
                      {p.evaluator_count || 0}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {p.current_stage_name || '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${p.status}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        <Eye size={13} /> View
                      </button>
                      {isAdmin() && (
                        <button className="btn btn-sm" style={{ color: 'var(--danger)', background: 'var(--danger-light)', border: 'none' }} onClick={() => deleteProject(p)} title="Delete project">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
