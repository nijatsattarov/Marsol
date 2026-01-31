import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Wallet, 
  Megaphone, 
  UserCog, 
  ClipboardList, 
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react';

const menuItems = [
  { path: '/dashboard', label: 'İdarə Paneli', icon: LayoutDashboard },
  { path: '/members', label: 'Üzvlər', icon: Users },
  { path: '/meetings', label: 'Görüşlər', icon: Calendar },
  { path: '/finance', label: 'Maliyyə', icon: Wallet },
  { path: '/marketing', label: 'Marketing', icon: Megaphone },
  { path: '/hr', label: 'İnsan Resurları', icon: UserCog },
  { path: '/tasks', label: 'Tapşırıqlar', icon: ClipboardList },
  { path: '/messages', label: 'Mesajlar', icon: MessageSquare },
];

export const Sidebar = () => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState(() => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <aside 
      className={`sidebar ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}
      data-testid="sidebar"
    >
      {/* Logo Section */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <img 
              src="https://customer-assets.emergentagent.com/job_03e89fda-1599-48f3-846d-f1d3e818b1fa/artifacts/h0q248dw_Marsol.png" 
              alt="Marsol Group" 
              className="h-10 object-contain"
              data-testid="sidebar-logo"
            />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
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
      <nav className="flex-1 py-6 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `menu-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-4' : ''}`
            }
            data-testid={`menu-${item.path.slice(1)}`}
          >
            <item.icon className={`w-5 h-5 flex-shrink-0 ${collapsed ? '' : 'mr-3'}`} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-white/10">
        {!collapsed && user && (
          <div className="mb-3 px-3">
            <p className="font-semibold text-white truncate">{user.name}</p>
            <p className="text-xs text-white/60 truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`menu-item hover:bg-red-500/20 hover:text-red-300 w-full ${collapsed ? 'justify-center px-4' : ''}`}
          data-testid="logout-btn"
        >
          <LogOut className={`w-5 h-5 flex-shrink-0 ${collapsed ? '' : 'mr-3'}`} />
          {!collapsed && <span>Çıxış</span>}
        </button>
      </div>
    </aside>
  );
};
