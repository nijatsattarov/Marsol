import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div className="app-layout">
      <Sidebar onCollapse={setSidebarCollapsed} />
      <main 
        className="main-content"
        style={{ 
          marginLeft: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
          transition: 'margin-left 0.3s ease'
        }}
        data-testid="main-content"
      >
        <Outlet />
      </main>
    </div>
  );
}
