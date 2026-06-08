import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { dashboardAPI } from '../../utils/api';

export default function TopHeader({ title, breadcrumb }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    dashboardAPI.getNotifications().then(res => {
      setNotifications(res.data || []);
    }).catch(() => {});
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <header className="top-header">
      <div>
        <div className="page-title">{title}</div>
        {breadcrumb && <div className="breadcrumb">{breadcrumb}</div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* System info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 12px',
          background: '#e8f5e9',
          borderRadius: '20px'
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1b7a4b' }} />
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#1b7a4b' }}>SYSTEM ONLINE</span>
        </div>

        {/* Notifications */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-outline btn-icon"
            onClick={() => setShowNotifs(!showNotifs)}
            style={{ position: 'relative' }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '2px', right: '2px',
                width: '16px', height: '16px',
                background: 'var(--danger)',
                color: 'white',
                borderRadius: '50%',
                fontSize: '10px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>{unreadCount}</span>
            )}
          </button>

          {showNotifs && (
            <div style={{
              position: 'absolute',
              right: 0, top: '44px',
              width: '320px',
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 200
            }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: '600', fontSize: '14px' }}>Notifications</span>
                <button onClick={() => setShowNotifs(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No notifications
                  </div>
                ) : notifications.map(n => (
                  <div key={n.id} style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-light)',
                    background: n.is_read ? 'transparent' : '#f0f7ff'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text)' }}>{n.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{n.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ height: '32px', width: '1px', background: 'var(--border)' }} />
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>
    </header>
  );
}