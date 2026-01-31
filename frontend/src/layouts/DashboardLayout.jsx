import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar, MobileHeader, SidebarProvider, useSidebar } from '../components/Sidebar';

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
      <main 
        className={`
          transition-all duration-300
          pt-14 lg:pt-0
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
