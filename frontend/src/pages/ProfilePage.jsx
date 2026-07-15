import React, { useState } from 'react';
import Layout from '../components/common/Layout';
import { authAPI } from '../utils/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import { Lock, Save } from 'lucide-react';

export default function ProfilePage() {
  // ✅ selector usage (prevents unnecessary re-renders)
  const { user } = useAuthStore(state => ({ user: state.user }));

  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (pwForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setSaving(true);
    try {
      await authAPI.changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });

      toast.success('Password changed successfully');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e) {
      toast.error(e.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  // ✅ extracted styles
  const headerStyle = {
    background: 'linear-gradient(to right, var(--navy), var(--navy-medium))',
    padding: '28px 28px 80px',
    borderRadius: '12px 12px 0 0',
  };

  const avatarStyle = {
    width: '80px',
    height: '80px',
    background: 'var(--accent)',
    borderRadius: '50%',
    border: '4px solid white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Syne, sans-serif',
    fontWeight: '800',
    fontSize: '24px',
    color: 'var(--navy)',
    marginBottom: '16px',
    boxShadow: 'var(--shadow)',
  };

  const profileFields = [
    ['Email', user?.email],
    ['Role', user?.role_name?.toUpperCase()],
    ['Department', user?.department],
    ['Designation', user?.designation],
    [
      'Last Login',
      user?.last_login
        ? new Date(user.last_login).toLocaleString()
        : 'First login',
    ],
    ['Status', user?.is_active ? 'Active' : 'Inactive'],
  ];

  return (
    <Layout title="My Profile" breadcrumb="View and update your account">
      <div style={{ maxWidth: '700px' }}>
        {/* Profile card */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={headerStyle}>
            <div
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: '20px',
                fontWeight: '700',
                color: 'white',
              }}
            >
              {user?.first_name} {user?.last_name}
            </div>

            <div
              style={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: '13px',
                marginTop: '4px',
              }}
            >
              {user?.designation} · {user?.department}
            </div>
          </div>

          <div style={{ padding: '0 28px 28px', marginTop: '-50px', position: 'relative' }}>
            <div style={avatarStyle}>
              {user?.first_name?.[0]}
              {user?.last_name?.[0]}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
              {profileFields.map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid var(--border-light)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: 'var(--text-muted)',
                      marginBottom: '4px',
                      letterSpacing: '0.3px',
                    }}
                  >
                    {label}
                  </div>

                  <div
                    style={{
                      fontSize: '13.5px',
                      color: 'var(--text)',
                      fontWeight: '500',
                    }}
                  >
                    {value || '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Lock size={15} style={{ display: 'inline', marginRight: '6px' }} />
              Change Password
            </span>
          </div>

          <div className="card-body">
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={pwForm.currentPassword}
                  onChange={(e) =>
                    setPwForm((f) => ({ ...f, currentPassword: e.target.value }))
                  }
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={pwForm.newPassword}
                  onChange={(e) =>
                    setPwForm((f) => ({ ...f, newPassword: e.target.value }))
                  }
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={pwForm.confirmPassword}
                  onChange={(e) =>
                    setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))
                  }
                  placeholder="Repeat new password"
                  required
                />
              </div>

              <button type="submit" className="btn btn-navy" disabled={saving}>
                {saving ? (
                  'Saving...'
                ) : (
                  <>
                    <Save size={15} /> Update Password
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}