import { useEffect } from 'react';
import axios from 'axios';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar, MobileHeader, SidebarProvider, useSidebar } from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import { PermissionProvider } from '../context/PermissionContext';

const DashboardContent = () => {
  const navigate = useNavigate();
  const { collapsed } = useSidebar();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  // System session heartbeat — fires every minute so server can compute active duration
  useEffect(() => {
    const ping = () => {
      const tk = localStorage.getItem('token');
      if (!tk) return;
      axios
        .post(`${process.env.REACT_APP_BACKEND_URL}/api/auth/heartbeat`, {}, {
          headers: { Authorization: `Bearer ${tk}` },
        })
        .catch(() => {});
    };
    ping();
    const id = setInterval(ping, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <MobileHeader />
      {/* Top Notification Bar (desktop) - sticky regardless of scroll */}
      <div className={`fixed top-0 right-0 z-30 hidden lg:flex items-center justify-end h-14 px-6 bg-white/85 backdrop-blur-sm border-b border-slate-100 transition-all duration-300 ${collapsed ? 'left-20' : 'left-[280px]'}`}>
        <NotificationBell />
      </div>
      <main 
        className={`
          transition-all duration-300
          pt-14 lg:pt-14
          min-w-0 overflow-x-hidden
          ${collapsed ? 'lg:ml-20' : 'lg:ml-[280px]'}
        `}
        data-testid="main-content"
      >
        <Outlet />
      </main>
    </div>
  );
};

export default function DashboardLayout() {
  return (
    <PermissionProvider>
      <SidebarProvider>
        <DashboardContent />
      </SidebarProvider>
    </PermissionProvider>
  );
}
