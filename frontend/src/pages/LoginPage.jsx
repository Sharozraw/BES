import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  // ✅ use selector (better performance)
  const { login, isLoading } = useAuthStore(state => ({
    login: state.login,
    isLoading: state.isLoading,
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);

    if (result.success) {
      toast.success('Welcome back!');
      navigate('/dashboard');
    } else {
      toast.error(result.message || 'Login failed');
    }
  };

  // ✅ extracted styles (cleaner JSX)
  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0d2137 0%, #1a3a5c 50%, #1e4976 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  };

  const cardStyle = {
    background: 'white',
    borderRadius: '16px',
    padding: '36px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  };

  return (
    <div style={containerStyle}>
      {/* Background pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(200,153,42,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(21,101,192,0.08) 0%, transparent 50%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              display: 'inline-block',
              background: 'rgba(200,153,42,0.15)',
              border: '1px solid rgba(200,153,42,0.3)',
              borderRadius: '8px',
              padding: '6px 16px',
              marginBottom: '16px',
            }}
          >
            <span
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '2px',
                color: '#c8992a',
                textTransform: 'uppercase',
              }}
            >
              GOVERNMENT OF SRI LANKA
            </span>
          </div>

          <h1
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: '28px',
              fontWeight: '800',
              color: 'white',
              marginBottom: '6px',
            }}
          >
            BID EVALUATION SYSTEM
          </h1>

          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
            Secure Procurement Management Platform
          </p>
        </div>

        {/* Card */}
        <div style={cardStyle}>
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div
                style={{
                  width: '4px',
                  height: '24px',
                  background: 'var(--accent)',
                  borderRadius: '2px',
                }}
              />
              <h2
                style={{
                  fontFamily: 'Syne, sans-serif',
                  fontSize: '18px',
                  fontWeight: '700',
                  color: 'var(--navy)',
                }}
              >
                Sign In
              </h2>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginLeft: '14px' }}>
              Authorized personnel only
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="your.email@gov.lk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{ fontSize: '14px' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ fontSize: '14px' }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-navy btn-lg"
              disabled={isLoading}
              style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
            >
              {isLoading ? (
                <>
                  <span
                    className="spinner"
                    style={{ width: '16px', height: '16px', borderWidth: '2px' }}
                  />
                  {' '}Signing In...
                </>
              ) : (
                'Sign In to BES'
              )}
            </button>
          </form>

          {/* Credentials */}
          <div
            style={{
              marginTop: '24px',
              padding: '14px',
              background: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid var(--border-light)',
            }}
          >
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600' }}>
              DEFAULT CREDENTIALS
            </p>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Admin: <code>admin@bes.gov.lk</code> / <code>Admin@1234</code>
            </p>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Evaluator: <code>evaluator@bes.gov.lk</code> / <code>Eval@1234</code>
            </p>
          </div>
        </div>

        <p
          style={{
            textAlign: 'center',
            color: 'rgba(255,255,255,0.25)',
            fontSize: '11px',
            marginTop: '20px',
          }}
        >
          BES v1.0 • Procurement Management Division • Confidential
        </p>
      </div>
    </div>
  );
}