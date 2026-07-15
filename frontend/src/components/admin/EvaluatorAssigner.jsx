import React, { useEffect, useState } from 'react';
import { usersAPI, projectsAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { Users, Check, X } from 'lucide-react';

const ROLES = [
  { value: 'chairman', label: 'Chairman' },
  { value: 'member', label: 'Member' },
  { value: 'convener', label: 'Convener' },
  { value: 'observer', label: 'Observer' },
];

export default function EvaluatorAssigner({ projectId, currentEvaluators = [], onSaved }) {
  const [allEvaluators, setAllEvaluators] = useState([]);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usersAPI.getEvaluators().then(res => setAllEvaluators(res.data || []));
  }, []);

  useEffect(() => {
    setSelected(currentEvaluators.map(e => ({ user_id: e.user_id || e.id, role: e.role || 'member' })));
  }, [currentEvaluators]);

  const isSelected = (userId) => selected.some(s => s.user_id === userId);

  const toggleUser = (user) => {
    if (isSelected(user.id)) {
      setSelected(prev => prev.filter(s => s.user_id !== user.id));
    } else {
      setSelected(prev => [...prev, { user_id: user.id, role: 'member' }]);
    }
  };

  const updateRole = (userId, role) => {
    setSelected(prev => prev.map(s => s.user_id === userId ? { ...s, role } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await projectsAPI.assignEvaluators(projectId, { evaluators: selected });
      toast.success('Evaluators assigned successfully');
      onSaved?.();
    } catch (e) {
      toast.error(e.message || 'Failed to assign evaluators');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
        Select committee members and assign their roles for this project.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Available evaluators */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Available Users</span>
          </div>
          <div style={{ padding: '8px 0', maxHeight: '400px', overflowY: 'auto' }}>
            {allEvaluators.map(user => (
              <div
                key={user.id}
                onClick={() => toggleUser(user)}
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--border-light)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: isSelected(user.id) ? '#e3f2fd' : 'transparent',
                  transition: 'background 0.1s'
                }}
              >
                <div style={{
                  width: '32px', height: '32px',
                  borderRadius: '50%',
                  background: isSelected(user.id) ? 'var(--blue)' : 'var(--navy)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '11px', fontWeight: '700', flexShrink: 0
                }}>
                  {isSelected(user.id) ? <Check size={14} /> : `${user.first_name?.[0]}${user.last_name?.[0]}`}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>
                    {user.first_name} {user.last_name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {user.designation} · {user.department}
                  </div>
                </div>
                <span className={`badge badge-${user.role_name}`} style={{ fontSize: '10px' }}>
                  {user.role_name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected evaluators with roles */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Selected Committee ({selected.length})</span>
          </div>
          <div style={{ padding: '8px 0', maxHeight: '400px', overflowY: 'auto' }}>
            {selected.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No members selected. Click users on the left to add them.
              </div>
            ) : selected.map(sel => {
              const user = allEvaluators.find(u => u.id === sel.user_id);
              if (!user) return null;
              return (
                <div key={sel.user_id} style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <div style={{
                    width: '30px', height: '30px',
                    borderRadius: '50%',
                    background: 'var(--navy)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: '10px', fontWeight: '700', flexShrink: 0
                  }}>
                    {user.first_name?.[0]}{user.last_name?.[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{user.first_name} {user.last_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user.designation}</div>
                  </div>
                  <select
                    className="form-control"
                    value={sel.role}
                    onChange={e => updateRole(sel.user_id, e.target.value)}
                    style={{ width: '110px', fontSize: '12px', padding: '4px 8px' }}
                  >
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <button
                    className="btn btn-sm"
                    style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none' }}
                    onClick={() => toggleUser(user)}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-light)' }}>
            <button className="btn btn-navy" onClick={handleSave} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
              {saving ? 'Saving...' : <><Check size={15} /> Save Committee</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
