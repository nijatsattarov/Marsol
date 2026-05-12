import { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { usePermissions, canView } from '../context/PermissionContext';
import NotificationBell from './NotificationBell';
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
  ChevronDown,
  LogOut,
  Menu,
  X,
  TrendingUp,
  Settings,
  Bell,
  FileCheck,
  Megaphone,
  FolderKanban,
  Trophy,
  Users2,
  BarChart3,
  Presentation,
  FolderOpen,
  StickyNote,
  Database,
  History,
  MessageCircle,
  Lightbulb,
  Send,
  ArrowLeftRight
} from 'lucide-react';

const salesSubItems = [
  { path: '/sales/company-database', label: 'Şirkət bazası', icon: Database, module: 'sales' },
  { path: '/sales/members', label: 'Üzvlər', icon: Users2, module: 'members' },
  { path: '/sales/obligations', label: 'Öhdəliklər', icon: FileCheck, module: 'obligations' },
  { path: '/sales/obligation-history', label: 'Öhdəlik tarixçəsi', icon: History, module: 'obligations' },
  { path: '/sales/invitations', label: 'Dəvətlər', icon: Send, module: 'sales' },
  { path: '/sales/contact-lists', label: 'Siyahılar', icon: ClipboardList, module: 'sales' },
];

const hrSubItems = [
  { path: '/hr', label: 'İşçilər', icon: Users2, module: 'hr' },
  { path: '/attendance', label: 'Davamiyyət', icon: FileCheck, module: 'hr' },
];

const financeSubItems = [
  { path: '/finance', label: 'Mühasibat', icon: Wallet, module: 'finance' },
  { path: '/barter', label: 'Barter', icon: ArrowLeftRight, module: 'finance' },
];

const organizationSubItems = [
  { path: '/organization', label: 'İdarə paneli', icon: LayoutDashboard, module: 'organization' },
  { path: '/organization/venues', label: 'Məkanlar', icon: Building2, module: 'organization' },
  { path: '/organization/catering', label: 'Catering', icon: FolderOpen, module: 'organization' },
  { path: '/organization/decor', label: 'Dekor və texniki', icon: FolderKanban, module: 'organization' },
  { path: '/organization/musicians', label: 'Musiqi və şou', icon: Megaphone, module: 'organization' },
  { path: '/organization/photovideo', label: 'Foto / Video', icon: Presentation, module: 'organization' },
  { path: '/organization/transport', label: 'Nəqliyyat', icon: Send, module: 'organization' },
  { path: '/organization/materials', label: 'Materiallar', icon: Database, module: 'organization' },
  { path: '/organization/ratings', label: 'Reytinq', icon: Lightbulb, module: 'organization' },
];

const menuItems = [
  { path: '/companies', label: 'Şirkət Məlumatları', icon: Building2, module: 'companies' },
  { path: '/hr', label: 'İnsan Resursları', icon: UserCog, children: hrSubItems, module: 'hr' },
  { path: '/sales', label: 'Satış', icon: TrendingUp, children: salesSubItems, module: 'sales' },
  { path: '/marketing', label: 'Marketinq', icon: Megaphone, module: 'marketing' },
  { path: '/projects', label: 'Layihələr', icon: FolderKanban, module: 'projects' },
  { path: '/activities', label: 'Fəaliyyətlər', icon: Calendar, module: 'organization' },
  { path: '/organization', label: 'Təşkilatçılıq', icon: Users2, children: organizationSubItems, module: 'organization' },
  { path: '/finance', label: 'Maliyyə', icon: Wallet, children: financeSubItems, module: 'finance' },
  { path: '/reports', label: 'Hesabatlar', icon: BarChart3, module: 'reports' },
  { path: '/partner-evaluation', label: 'Partnyor Reytinqi', icon: Trophy, module: 'reports' },
  { path: '/meetings', label: 'Görüşlər', icon: Calendar, module: 'meetings' },
  { path: '/assembly', label: 'İclas', icon: Presentation, module: 'assembly' },
  { path: '/tasks', label: 'Tapşırıqlar', icon: ClipboardList, module: 'tasks' },
  { path: '/messages', label: 'Mesajlar', icon: MessageSquare, module: 'messages' },
  { path: '/files', label: 'Fayllar', icon: FolderOpen, module: 'files' },
  { path: '/notes', label: 'Qeydlər', icon: StickyNote, module: 'notes' },
];

const bottomItems = [
  { path: '/notifications', label: 'Bildirişlər', icon: Bell, module: 'notifications' },
  { path: '/settings', label: 'Tənzimləmələr', icon: Settings, module: 'settings' },
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

const MenuLink = ({ item, collapsed, mobileOpen, onClick }) => {
  return (
    <NavLink
      to={item.path}
      onClick={onClick}
      className={({ isActive }) => `
        flex items-center
        px-4 lg:px-5 py-2.5 lg:py-3
        mx-2 lg:mx-3 my-0.5
        rounded-xl
        text-sm
        font-medium
        transition-all duration-200
        ${isActive 
          ? 'bg-[#9ACD32] text-[#3D4F6F] font-bold' 
          : 'text-white/75 hover:bg-white/10 hover:text-[#9ACD32]'
        }
        ${collapsed && !mobileOpen ? 'lg:justify-center lg:px-3' : ''}
      `}
      data-testid={`menu-${item.path.split('/').filter(Boolean).join('-')}`}
    >
      <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${collapsed && !mobileOpen ? 'lg:mr-0' : 'mr-3'}`} />
      {(!collapsed || mobileOpen) && <span>{item.label}</span>}
    </NavLink>
  );
};

const ExpandableMenu = ({ item, collapsed, mobileOpen, onClick }) => {
  const location = useLocation();
  const isChildActive = item.children?.some(child => location.pathname === child.path);
  const [expanded, setExpanded] = useState(isChildActive);

  const handleToggle = (e) => {
    e.preventDefault();
    if (collapsed && !mobileOpen) return;
    setExpanded(prev => !prev);
  };

  return (
    <div>
      <button
        onClick={handleToggle}
        className={`
          flex items-center w-full
          px-4 lg:px-5 py-2.5 lg:py-3
          mx-2 lg:mx-3 my-0.5
          rounded-xl
          text-sm
          font-medium
          transition-all duration-200
          ${isChildActive 
            ? 'bg-white/15 text-[#9ACD32]' 
            : 'text-white/75 hover:bg-white/10 hover:text-[#9ACD32]'
          }
          ${collapsed && !mobileOpen ? 'lg:justify-center lg:px-3' : ''}
        `}
        style={{ width: 'calc(100% - 1rem)', marginLeft: '0.5rem', marginRight: '0.5rem' }}
        data-testid={`menu-${item.path.slice(1)}`}
      >
        <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${collapsed && !mobileOpen ? 'lg:mr-0' : 'mr-3'}`} />
        {(!collapsed || mobileOpen) && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>
      {expanded && (!collapsed || mobileOpen) && (
        <div className="ml-4 lg:ml-6 border-l border-white/10 pl-2 mt-1 mb-1">
          {item.children.map(child => (
            <NavLink
              key={child.path}
              to={child.path}
              onClick={onClick}
              className={({ isActive }) => `
                flex items-center
                px-3 py-2
                mx-2 my-0.5
                rounded-lg
                text-xs lg:text-sm
                font-medium
                transition-all duration-200
                ${isActive 
                  ? 'bg-[#9ACD32] text-[#3D4F6F] font-bold' 
                  : 'text-white/65 hover:bg-white/10 hover:text-[#9ACD32]'
                }
              `}
              data-testid={`menu-${child.path.split('/').filter(Boolean).join('-')}`}
            >
              <child.icon className="w-4 h-4 flex-shrink-0 mr-2.5" />
              <span>{child.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
};

export const Sidebar = () => {
  const navigate = useNavigate();
  const { collapsed, toggleCollapsed, mobileOpen, closeMobileMenu } = useSidebar();
  const { permissions } = usePermissions();
  const [user] = useState(() => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  });
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/public/branding`)
      .then(r => setLogoUrl(r.data.sidebar_logo_url || ''))
      .catch(() => {});
  }, []);

  const resolvedLogo = logoUrl
    ? (logoUrl.startsWith('http') ? logoUrl : `${process.env.REACT_APP_BACKEND_URL}${logoUrl}`)
    : "https://customer-assets.emergentagent.com/job_03e89fda-1599-48f3-846d-f1d3e818b1fa/artifacts/h0q248dw_Marsol.png";
  const applyInvert = !logoUrl;  // only apply invert filter when using the default logo

  const isVisible = (item) => {
    if (!item.module) return true;
    return canView(permissions, item.module);
  };

  const handleLogout = () => {
    const tk = localStorage.getItem('token');
    if (tk) {
      // Fire-and-forget — close server-side session record before clearing token
      axios
        .post(`${process.env.REACT_APP_BACKEND_URL}/api/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${tk}` },
        })
        .catch(() => {});
    }
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
        <div className="p-4 lg:p-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            {(!collapsed || mobileOpen) && (
              <img 
                src={resolvedLogo}
                alt="Marsol Group" 
                className="h-8 lg:h-10 object-contain"
                style={applyInvert ? { filter: 'brightness(0) invert(1)' } : undefined}
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
        <nav className="flex-1 py-3 lg:py-4 overflow-y-auto scrollbar-thin">
          {/* Dashboard link — RBAC gated */}
          {canView(permissions, 'dashboard') && (
            <>
              <MenuLink
                item={{ path: '/dashboard', label: 'İdarə Paneli', icon: LayoutDashboard, module: 'dashboard' }}
                collapsed={collapsed}
                mobileOpen={mobileOpen}
                onClick={handleNavClick}
              />
              <div className="my-2 mx-4 border-t border-white/8" />
            </>
          )}

          {/* Main menu items */}
          {menuItems.filter(isVisible).map((item) => 
            item.children ? (
              <ExpandableMenu 
                key={item.path} 
                item={{...item, children: item.children.filter(isVisible)}} 
                collapsed={collapsed} 
                mobileOpen={mobileOpen} 
                onClick={handleNavClick} 
              />
            ) : (
              <MenuLink 
                key={item.path} 
                item={item} 
                collapsed={collapsed} 
                mobileOpen={mobileOpen} 
                onClick={handleNavClick} 
              />
            )
          )}

          <div className="my-2 mx-4 border-t border-white/8" />

          {/* Bottom utility items */}
          {bottomItems.filter(isVisible).map((item) => (
            <MenuLink 
              key={item.path} 
              item={item} 
              collapsed={collapsed} 
              mobileOpen={mobileOpen} 
              onClick={handleNavClick} 
            />
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
    <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-100 z-30 flex items-center justify-between px-4 shadow-sm">
      <div className="flex items-center">
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
      <NotificationBell />
    </div>
  );
};
