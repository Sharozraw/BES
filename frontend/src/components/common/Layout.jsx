import React from 'react';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';

export default function Layout({ children, title, breadcrumb }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopHeader title={title} breadcrumb={breadcrumb} />
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}