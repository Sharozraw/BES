import React, { useEffect, useState } from 'react';
import Layout from '../components/common/Layout';
import { usersAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Edit, Search, X, Check } from 'lucide-react';

const emptyUser = {
  email: '', password: '', first_name: '', last_name: '',
  role_id: '', department: '', phone: '', designation: '', is_active: true
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyUser);
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([usersAPI.getAll(), usersAPI.getRoles()])
      .then(([uRes, rRes]) => {
        setUsers(uRes.data || []);
        setRoles(rRes.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyUser, role_id: roles.find(r => r.name === 'evaluator')?.id || '' });
    setShowModal(true);
  };

  const openEdit = (user) => {
    setEditing(user.id);
    setForm({
      email: user.email,
      password: '',
      first_name: user.first_name,
      last_name: user.last_name,
      role_id: user.role_id || '',
      department: user.department || '',
      phone: user.phone || '',
      designation: user.designation || '',
      is_active: user.is_active
    });
    setShowModal(true);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.email || !form.first_name || !form.last_name || !form.role_id) {
      toast.error('Email, name and role are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await usersAPI.update(editing, payload);
        toast.success('User updated');
      } else {
        await usersAPI.create(form);
        toast.success('User created. Default password: Change@1234');
      }
      setShowModal(false);
      load();
    } catch (e) {
      toast.error(e.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.email?.toLowerCase().includes(q) ||
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q);
  });

  return (
    <Layout title="User Management" breadcrumb="Manage system users and roles">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-control" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '34px' }} />
        </div>
        <button className="btn btn-navy" onClick={openAdd}>
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        {[
          ['Total Users', users.length, 'var(--navy)'],
          ['Admins', users.filter(u => u.role_name === 'admin').length, 'var(--blue)'],
          ['Evaluators', users.filter(u => u.role_name === 'evaluator').length, 'var(--success)'],
          ['Active', users.filter(u => u.is_active).length, 'var(--success)'],
          ['Inactive', users.filter(u => !u.is_active).length, 'var(--danger)'],
        ].map(([label, value, color]) => (
          <div key={label} className="stat-card">
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: '700', color }}>{value}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Users ({filtered.length})</span>
        </div>
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px',
                          borderRadius: '50%',
                          background: user.is_active ? 'var(--navy)' : 'var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontSize: '11px', fontWeight: '700', flexShrink: 0
                        }}>
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: '500', fontSize: '13px' }}>{user.first_name} {user.last_name}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: '12.5px' }}>{user.email}</td>
                    <td><span className={`badge badge-${user.role_name}`}>{user.role_name}</span></td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user.department || '—'}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user.designation || '—'}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: '600',
                        background: user.is_active ? 'var(--success-light)' : 'var(--danger-light)',
                        color: user.is_active ? 'var(--success)' : 'var(--danger)'
                      }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor' }} />
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(user)}>
                        <Edit size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '600' }}>
                {editing ? 'Edit User' : 'Add New User'}
              </h3>
              <button className="btn btn-icon btn-outline" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input className="form-control" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="First name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input className="form-control" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Last name" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Email Address *</label>
                  <input type="email" className="form-control" value={form.email} onChange={e => set('email', e.target.value)} placeholder="user@gov.lk" disabled={!!editing} />
                </div>
                {!editing && (
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Password (default: Change@1234)</label>
                    <input type="password" className="form-control" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Leave blank for default" />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select className="form-control" value={form.role_id} onChange={e => set('role_id', e.target.value)}>
                    <option value="">Select role...</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name} — {r.description}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input className="form-control" value={form.department} onChange={e => set('department', e.target.value)} placeholder="e.g. Faculty of Engineering" />
                </div>
                <div className="form-group">
                  <label className="form-label">Designation</label>
                  <input className="form-control" value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="e.g. Senior Lecturer" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-control" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+94..." />
                </div>
                {editing && (
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '8px' }}>
                      <button
                        type="button"
                        className={`toggle ${form.is_active ? 'on' : ''}`}
                        onClick={() => set('is_active', !form.is_active)}
                      >
                        <div className="toggle-thumb" />
                      </button>
                      <span style={{ fontSize: '13px' }}>{form.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-navy" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : <><Check size={15} /> {editing ? 'Update User' : 'Create User'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
