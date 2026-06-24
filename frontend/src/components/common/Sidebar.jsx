import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, FolderOpen, Users, FileText, 
  Settings, LogOut, ChevronRight, Bell, BarChart3,
  ShieldCheck, Workflow
} from 'lucide-react';

const NavItem = ({ to, icon: Icon, label, onClick }) => {
  if (onClick) {
    return (
      <div className="nav-item" onClick={onClick} style={{ cursor: 'pointer' }}>
        <Icon className="icon" />
        <span>{label}</span>
      </div>
    );
  }
  return (
    <NavLink to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
      <Icon className="icon" />
      <span>{label}</span>
    </NavLink>
  );
};

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const initials = user ? `${user.first_name?.[0]}${user.last_name?.[0]}` : 'U';

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-badge">GOV · LK</div>
        <div className="logo-title">Bid Evaluation<br />System</div>
        <div className="logo-sub">PROCUREMENT PLATFORM v1.0</div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        <NavItem to="/projects" icon={FolderOpen} label="Projects" />

        {isAdmin() && (
          <>
            <div className="nav-section-label" style={{ marginTop: '8px' }}>Administration</div>
            <NavItem to="/users" icon={Users} label="User Management" />
            <NavItem to="/reports" icon={BarChart3} label="Reports" />
          </>
        )}

        <div className="nav-section-label" style={{ marginTop: '8px' }}>Account</div>
        <NavItem to="/profile" icon={Settings} label="Profile" />
        <NavItem icon={LogOut} label="Sign Out" onClick={handleLogout} />
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{initials}</div>
          <div>
            <div className="user-name">{user?.first_name} {user?.last_name}</div>
            <div className="user-role">{user?.role_name?.toUpperCase()} · {user?.department?.split(',')[0] || 'BES'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}