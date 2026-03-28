import { useState, createContext, useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Calendar, 
  Wallet, 
  UserCog, 
  ClipboardList, 
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  TrendingUp,
  Settings
} from 'lucide-react';

const menuItems = [
  { path: '/dashboard', label: 'İdarə Paneli', icon: LayoutDashboard },
  { path: '/companies', label: 'Şirkət Məlumatları', icon: Building2 },
  { path: '/hr', label: 'İnsan Resurları', icon: UserCog },
  { path: '/finance', label: 'Maliyyə', icon: Wallet },
  { path: '/sales', label: 'Satış', icon: TrendingUp },
  { path: '/meetings', label: 'Görüşlər', icon: Calendar },
  { path: '/tasks', label: 'Tapşırıqlar', icon: ClipboardList },
  { path: '/messages', label: 'Mesajlar', icon: MessageSquare },
  { path: '/settings', label: 'Tənzimləmələr', icon: Settings },
];

// Create context for sidebar state
const SidebarContext = createContext(null);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const openMobileMenu = () => {
    setMobileOpen(true);
  };

  const closeMobileMenu = () => {
    setMobileOpen(false);
  };

  const toggleCollapsed = () => {
    setCollapsed(prev => !prev);
  };
  
  return (
    <SidebarContext.Provider value={{ 
      collapsed, 
      setCollapsed, 
      toggleCollapsed,
      mobileOpen, 
      setMobileOpen,
      openMobileMenu,
      closeMobileMenu
    }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = () => {
  const navigate = useNavigate();
  const { collapsed, toggleCollapsed, mobileOpen, closeMobileMenu } = useSidebar();
  const [user] = useState(() => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleNavClick = () => {
    closeMobileMenu();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeMobileMenu}
          data-testid="sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed left-0 top-0 h-full z-50
          bg-gradient-to-b from-[#3D4F6F] to-[#2A364C]
          text-white transition-all duration-300 ease-in-out
          flex flex-col
          shadow-[4px_0_20px_rgba(61,79,111,0.15)]
          w-[280px]
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          ${collapsed ? 'lg:w-20' : 'lg:w-[280px]'}
        `}
        data-testid="sidebar"
      >
        {/* Logo Section */}
        <div className="p-4 lg:p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            {(!collapsed || mobileOpen) && (
              <img 
                src="https://customer-assets.emergentagent.com/job_03e89fda-1599-48f3-846d-f1d3e818b1fa/artifacts/h0q248dw_Marsol.png" 
                alt="Marsol Group" 
                className="h-8 lg:h-10 object-contain"
                data-testid="sidebar-logo"
              />
            )}
            
            {/* Mobile close button */}
            <button
              onClick={closeMobileMenu}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors lg:hidden"
              data-testid="sidebar-close-btn"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Desktop collapse button */}
            <button
              onClick={toggleCollapsed}
              className="hidden lg:flex p-2 rounded-lg hover:bg-white/10 transition-colors"
              data-testid="sidebar-toggle-btn"
            >
              {collapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 py-4 lg:py-6 overflow-y-auto">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={({ isActive }) => `
                flex items-center
                px-4 lg:px-5 py-3 lg:py-3.5
                mx-2 lg:mx-3 my-1
                rounded-xl
                text-sm lg:text-base
                font-medium
                transition-all duration-200
                ${isActive 
                  ? 'bg-[#9ACD32] text-[#3D4F6F] font-bold' 
                  : 'text-white/75 hover:bg-white/10 hover:text-[#9ACD32]'
                }
                ${collapsed && !mobileOpen ? 'lg:justify-center lg:px-3' : ''}
              `}
              data-testid={`menu-${item.path.slice(1)}`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${collapsed && !mobileOpen ? 'lg:mr-0' : 'mr-3'}`} />
              {(!collapsed || mobileOpen) && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-3 lg:p-4 border-t border-white/10">
          {(!collapsed || mobileOpen) && user && (
            <div className="mb-3 px-3">
              <p className="font-semibold text-white truncate text-sm lg:text-base">{user.name}</p>
              <p className="text-xs text-white/60 truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`
              flex items-center w-full
              px-4 py-3 mx-0
              rounded-xl
              text-white/75
              hover:bg-red-500/20 hover:text-red-300
              transition-all duration-200
              ${collapsed && !mobileOpen ? 'lg:justify-center' : ''}
            `}
            data-testid="logout-btn"
          >
            <LogOut className={`w-5 h-5 flex-shrink-0 ${collapsed && !mobileOpen ? 'lg:mr-0' : 'mr-3'}`} />
            {(!collapsed || mobileOpen) && <span>Çıxış</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

// Mobile Header with Menu Button
export const MobileHeader = () => {
  const { openMobileMenu } = useSidebar();
  
  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-100 z-30 flex items-center px-4 shadow-sm">
      <button
        onClick={openMobileMenu}
        className="p-2 -ml-2 rounded-lg hover:bg-slate-100 transition-colors active:bg-slate-200"
        data-testid="mobile-menu-btn"
        type="button"
      >
        <Menu className="w-6 h-6" style={{ color: '#3D4F6F' }} />
      </button>
      <img 
        src="https://customer-assets.emergentagent.com/job_03e89fda-1599-48f3-846d-f1d3e818b1fa/artifacts/h0q248dw_Marsol.png" 
        alt="Marsol Group" 
        className="h-7 ml-3"
      />
    </div>
  );
};
