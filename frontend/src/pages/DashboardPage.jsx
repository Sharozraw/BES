import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/common/Layout';
import { dashboardAPI } from '../utils/api';
import useAuthStore from '../store/authStore';
import {
  FolderOpen, Users, FileCheck, Award,
  TrendingUp, Clock, AlertCircle, ChevronRight
} from 'lucide-react';

const StatusBadge = ({ status }) => (
  <span className={`badge badge-${status}`}>
    {status?.replace(/_/g, ' ').toUpperCase()}
  </span>
);

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = isAdmin()
          ? await dashboardAPI.getAdminStats()
          : await dashboardAPI.getEvaluatorStats();
        setData(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <Layout title="Dashboard">
        <div className="loading-center">
          <div className="spinner" />
          <span>Loading dashboard...</span>
        </div>
      </Layout>
    );
  }

  const stats = data?.stats || {};

  return (
    <Layout
      title="Dashboard"
      breadcrumb="Overview of procurement evaluation activities"
    >
      {/* Welcome banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-medium) 100%)',
        borderRadius: '16px',
        padding: '24px 28px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute', right: '20px', top: '-20px',
          width: '160px', height: '160px',
          borderRadius: '50%',
          background: 'rgba(200,153,42,0.08)',
          border: '40px solid rgba(200,153,42,0.05)'
        }} />
        <div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', letterSpacing: '1px' }}>
            WELCOME BACK
          </div>
          <h2 style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: '22px',
            fontWeight: '700',
            color: 'white',
            marginBottom: '6px'
          }}>
            {user?.first_name} {user?.last_name}
          </h2>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px' }}>
            {user?.designation} · {user?.department}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`badge badge-${user?.role_name}`} style={{ fontSize: '12px', padding: '5px 14px' }}>
            {user?.role_name?.toUpperCase()}
          </span>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '8px' }}>
            Last login: {user?.last_login ? new Date(user.last_login).toLocaleString() : 'First login'}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      {isAdmin() ? (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue"><FolderOpen size={22} /></div>
            <div>
              <div className="stat-value">{stats.total_projects || 0}</div>
              <div className="stat-label">Total Projects</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon amber"><Clock size={22} /></div>
            <div>
              <div className="stat-value">{stats.active_evaluations || 0}</div>
              <div className="stat-label">Active Evaluations</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Award size={22} /></div>
            <div>
              <div className="stat-value">{stats.awarded_projects || 0}</div>
              <div className="stat-label">Awarded Contracts</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon navy"><Users size={22} /></div>
            <div>
              <div className="stat-value">{stats.total_users || 0}</div>
              <div className="stat-label">System Users</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><TrendingUp size={22} /></div>
            <div>
              <div className="stat-value">{stats.total_bidders || 0}</div>
              <div className="stat-label">Total Bidders</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon amber"><FileCheck size={22} /></div>
            <div>
              <div className="stat-value">{stats.total_documents || 0}</div>
              <div className="stat-label">Documents</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue"><FolderOpen size={22} /></div>
            <div>
              <div className="stat-value">{stats.assigned_projects || 0}</div>
              <div className="stat-label">Assigned Projects</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon amber"><Clock size={22} /></div>
            <div>
              <div className="stat-value">{stats.active_evaluations || 0}</div>
              <div className="stat-label">Active Evaluations</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><FileCheck size={22} /></div>
            <div>
              <div className="stat-value">{stats.total_evaluations || 0}</div>
              <div className="stat-label">My Evaluations</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon navy"><AlertCircle size={22} /></div>
            <div>
              <div className="stat-value">{stats.unread_notifications || 0}</div>
              <div className="stat-label">Notifications</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Recent Projects */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {isAdmin() ? 'Recent Projects' : 'My Assigned Projects'}
            </span>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => navigate('/projects')}
            >
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>File No.</th>
                  <th>Title</th>
                  <th>Bidders</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentProjects || data?.myProjects || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                      No projects yet
                    </td>
                  </tr>
                ) : (data?.recentProjects || data?.myProjects || []).map(p => (
                  <tr
                    key={p.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    <td>
                      <code style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: 'var(--navy)' }}>
                        {p.file_no}
                      </code>
                    </td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title}
                    </td>
                    <td>
                      <span style={{
                        background: 'var(--bg)',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>{p.bidder_count || 0}</span>
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Activity</span>
          </div>
          <div style={{ padding: '8px 0' }}>
            {(data?.recentActivity || []).length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No recent activity
              </div>
            ) : (data?.recentActivity || []).map((a, i) => (
              <div key={i} style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}>
                <div style={{
                  width: '8px', height: '8px',
                  borderRadius: '50%',
                  background: 'var(--blue)',
                  marginTop: '5px',
                  flexShrink: 0
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', color: 'var(--text)' }}>
                    <strong>{a.user_name}</strong> {a.action?.replace(/_/g, ' ')}
                    {a.project_title && (
                      <span style={{ color: 'var(--text-muted)' }}> — {a.project_title}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions for admin */}
      {isAdmin() && (
        <div style={{ marginTop: '20px' }}>
          <div className="card-title" style={{ marginBottom: '12px' }}>Quick Actions</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button className="btn btn-navy" onClick={() => navigate('/projects/new')}>
              <FolderOpen size={16} /> New Project
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/users')}>
              <Users size={16} /> Manage Users
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/reports')}>
              <TrendingUp size={16} /> View Reports
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
