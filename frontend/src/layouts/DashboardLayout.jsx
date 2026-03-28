import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar, MobileHeader, SidebarProvider, useSidebar } from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';

const DashboardContent = () => {
  const navigate = useNavigate();
  const { collapsed } = useSidebar();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <MobileHeader />
      {/* Top Notification Bar */}
      <div className={`fixed top-0 right-0 z-30 hidden lg:flex items-center justify-end h-14 px-6 transition-all duration-300 ${collapsed ? 'left-20' : 'left-[280px]'}`}>
        <NotificationBell />
      </div>
      <main 
        className={`
          transition-all duration-300
          pt-14 lg:pt-14
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
    <SidebarProvider>
      <DashboardContent />
    </SidebarProvider>
  );
}
