import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { usePermissions, canView } from '../context/PermissionContext';
import { 
  Calendar, 
  Users, 
  Building2, 
  CreditCard, 
  TrendingUp, 
  TrendingDown,
  Loader2,
  ClipboardList,
  Briefcase
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import ServiceUsageWidget from '../components/ServiceUsageWidget';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StatCard = ({ title, value, subtitle, icon: Icon, color, trend }) => (
  <div className="stat-card" data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm font-medium text-slate-500 mb-1 truncate">{title}</p>
        <p className="text-2xl sm:text-3xl font-bold" style={{ color: '#3D4F6F' }}>{value}</p>
        {subtitle && (
          <p className="text-xs sm:text-sm text-slate-400 mt-1 truncate">{subtitle}</p>
        )}
      </div>
      <div 
        className="p-2 sm:p-3 rounded-xl flex-shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color }} />
      </div>
    </div>
    {trend !== undefined && (
      <div className="flex items-center gap-1 mt-3 text-xs sm:text-sm flex-wrap">
        {trend > 0 ? (
          <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
        ) : (
          <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-500 flex-shrink-0" />
        )}
        <span className={trend > 0 ? 'text-green-500' : 'text-red-500'}>
          {Math.abs(trend)}%
        </span>
        <span className="text-slate-400">keçən aydan</span>
      </div>
    )}
  </div>
);

const ChartCard = ({ title, children, className = '' }) => (
  <div className={`chart-container ${className}`} data-testid={`chart-${title.toLowerCase().replace(/\s+/g, '-')}`}>
    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4" style={{ color: '#3D4F6F' }}>{title}</h3>
    {children}
  </div>
);

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-3 py-2 shadow-lg rounded-lg border border-slate-100 text-sm">
        <p className="font-semibold text-slate-700">{payload[0].name || payload[0].payload?.name}</p>
        <p className="text-slate-500">{payload[0].value}</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { permissions, loading: permsLoading } = usePermissions();

  // RBAC: if Dashboard ('dashboard') permission is not granted, redirect to the
  // first module the user IS allowed to access. Wait until permissions finish
  // loading so we don't bounce mid-fetch.
  useEffect(() => {
    if (permsLoading) return;
    if (Object.keys(permissions || {}).length === 0) return; // not loaded yet
    if (canView(permissions, 'dashboard')) return;
    const fallbackOrder = [
      ['companies', '/companies'],
      ['hr', '/hr'],
      ['sales', '/sales'],
      ['members', '/sales/members'],
      ['obligations', '/sales/obligations'],
      ['organization', '/organization'],
      ['projects', '/projects'],
      ['marketing', '/marketing'],
      ['finance', '/finance'],
      ['meetings', '/meetings'],
      ['assembly', '/assembly'],
      ['tasks', '/tasks'],
      ['messages', '/messages'],
      ['files', '/files'],
      ['notes', '/notes'],
      ['reports', '/reports'],
      ['notifications', '/notifications'],
      ['settings', '/settings'],
    ];
    const first = fallbackOrder.find(([m]) => canView(permissions, m));
    navigate(first ? first[1] : '/login', { replace: true });
  }, [permsLoading, permissions, navigate]);

  const fetchStats = useCallback(async () => {
    // Wait until permissions are loaded so we don't make a request that will
    // 403 (and clutter the console) for users without dashboard access.
    if (permsLoading) return;
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    // Skip fetch if user has no dashboard permission — we're about to redirect
    if (Object.keys(permissions || {}).length > 0 && !canView(permissions, 'dashboard')) {
      setLoading(false);
      return;
    }
    try {
      const response = await axios.get(`${API}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000,
      });
      setStats(response.data);
    } catch (e) {
      // Expired/invalid token → force re-login silently
      if (e.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
        return;
      }
      // 403 (no dashboard permission) — RBAC redirect effect will handle navigation.
      // Do NOT clear the token; just stop loading so the redirect can happen.
      if (e.response?.status === 403) {
        setStats({});
        return;
      }
      // Other failures → fall back to empty stats so UI still renders
      console.error('Error fetching dashboard stats:', e);
      setStats({});
    } finally {
      setLoading(false);
    }
  }, [navigate, permsLoading, permissions]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3" data-testid="loading-spinner">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} />
        <p className="text-sm text-slate-500">Məlumat yüklənir...</p>
      </div>
    );
  }

  const paymentProgress = stats.payments?.total > 0 
    ? (stats.payments.paid / stats.payments.total) * 100 
    : 0;

  // Prepare chart data
  // Strip trailing " paket" from package legend names so they don't repeat the word
  const companiesBreakdown = (stats.companies?.breakdown || []).map(b => ({
    ...b,
    name: (b.name || '').replace(/\s+paket$/i, '').trim() || b.name,
  }));
  const sectorsBreakdown = stats.sectors?.breakdown || [];
  const totalPackageCount = companiesBreakdown.reduce((s, x) => s + (x.count || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8 overflow-x-hidden" data-testid="dashboard-container">
      {/* Header */}
      <div className="mb-4 sm:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }} data-testid="dashboard-title">
          İdarə Paneli
        </h1>
        <p className="text-slate-500 mt-1 text-sm sm:text-base">Marsol Group-un ümumi icmalı</p>
      </div>

      {/* Stats Cards — filtered by per-user module access */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {canView(permissions, 'companies') && (
          <StatCard
            title="Şirkətlər"
            value={stats.companies?.total || 0}
            subtitle="Aktiv şirkət"
            icon={Building2}
            color="#3D4F6F"
          />
        )}
        {canView(permissions, 'hr') && (
          <StatCard
            title="Əməkdaşlar"
            value={stats.employees?.total || 0}
            subtitle="Ümumi əməkdaş"
            icon={Users}
            color="#9ACD32"
          />
        )}
        {canView(permissions, 'tasks') && (
          <StatCard
            title="Tapşırıqlar"
            value={stats.tasks?.total || 0}
            subtitle={`${stats.tasks?.pending || 0} gözləyir`}
            icon={ClipboardList}
            color="#64748B"
          />
        )}
        {canView(permissions, 'meetings') && (
          <StatCard
            title="Görüşlər"
            value={stats.meetings?.total || 0}
            subtitle={
              (stats.meetings?.today || 0) > 0
                ? `Bu gün ${stats.meetings.today}, qarşıdan ${stats.meetings?.upcoming || 0}`
                : `${stats.meetings?.upcoming || 0} qarşıdan, ${stats.meetings?.past || 0} keçmiş`
            }
            icon={CreditCard}
            color="#3D4F6F"
          />
        )}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Companies by Package - List + Pie */}
        {canView(permissions, 'companies') && (
        <ChartCard title="Şirkətlər üzrə paketlər">
          {companiesBreakdown.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-center">
              {/* Left list */}
              <ul className="space-y-2 order-2 sm:order-1" data-testid="package-list">
                {companiesBreakdown.map((p, i) => {
                  const pct = totalPackageCount > 0 ? Math.round((p.count / totalPackageCount) * 100) : 0;
                  return (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="flex-1 truncate text-slate-600">{p.name}</span>
                      <span className="font-bold text-[#3D4F6F] tabular-nums">{p.count}</span>
                      <span className="text-[10px] text-slate-400 w-9 text-right tabular-nums">{pct}%</span>
                    </li>
                  );
                })}
              </ul>
              {/* Right donut */}
              <div className="order-1 sm:order-2 h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={companiesBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="name"
                      stroke="#fff"
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {companiesBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-slate-400">
              Məlumat yoxdur
            </div>
          )}
        </ChartCard>
        )}

        {/* Sectors - Bar Chart */}
        {canView(permissions, 'companies') && (
        <ChartCard title="Sektorlar üzrə bölgü">
          {sectorsBreakdown.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <ResponsiveContainer width="100%" height={240} minWidth={300}>
                <BarChart data={sectorsBreakdown} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={80}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fontWeight: 600, fill: '#3D4F6F' }}>
                    {sectorsBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-slate-400">
              Məlumat yoxdur
            </div>
          )}
        </ChartCard>
        )}
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Service Usage Widget */}
        {canView(permissions, 'companies') && <ServiceUsageWidget />}

        {/* Events Stats */}
        {canView(permissions, 'organization') && (
        <ChartCard title="Fəaliyyət statistikası">
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-xl" style={{ backgroundColor: '#3D4F6F0A' }}>
              <div>
                <p className="text-xs text-slate-500">Cəmi fəaliyyət</p>
                <p className="text-2xl font-bold" style={{ color: '#3D4F6F' }}>{stats.events?.total || 0}</p>
              </div>
              <Calendar className="w-6 h-6" style={{ color: '#3D4F6F' }} />
            </div>
            {(stats.events?.by_type || []).length > 0 ? (
              <div className="space-y-2">
                {stats.events.by_type.map((et, i) => (
                  <div key={et.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50">
                    <span className="text-sm text-slate-600">{et.name}</span>
                    <span className="text-sm font-bold" style={{ color: '#3D4F6F' }}>{et.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-slate-400 text-sm py-3">Hələ fəaliyyət yoxdur</p>
            )}
          </div>
        </ChartCard>
        )}

        {/* Invitation Stats */}
        {canView(permissions, 'obligations') && (
        <ChartCard title="Dəvət statistikası">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-2.5 rounded-xl bg-slate-50">
                <p className="text-xl font-bold" style={{ color: '#3D4F6F' }}>{stats.invitations?.total || 0}</p>
                <p className="text-[10px] text-slate-500">Cəmi dəvət</p>
              </div>
              <div className="text-center p-2.5 rounded-xl bg-green-50">
                <p className="text-xl font-bold text-green-600">{stats.invitations?.attended || 0}</p>
                <p className="text-[10px] text-green-600">Qatıldı</p>
              </div>
              <div className="text-center p-2.5 rounded-xl bg-red-50">
                <p className="text-xl font-bold text-red-600">{stats.invitations?.declined || 0}</p>
                <p className="text-[10px] text-red-500">Rədd etdi</p>
              </div>
              <div className="text-center p-2.5 rounded-xl bg-amber-50">
                <p className="text-xl font-bold text-amber-600">{stats.invitations?.no_answer || 0}</p>
                <p className="text-[10px] text-amber-500">Cavab vermədi</p>
              </div>
            </div>
            {(stats.invitations?.by_type || []).length > 0 && (
              <div className="w-full overflow-x-auto">
                <ResponsiveContainer width="100%" height={120} minWidth={200}>
                  <BarChart data={stats.invitations.by_type} margin={{ left: 0, right: 5 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} width={25} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#3D4F6F" name="Dəvət" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="attended" fill="#9ACD32" name="Qatıldı" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </ChartCard>
        )}

        {/* Tasks Summary */}
        {canView(permissions, 'tasks') && (
        <ChartCard title="Tapşırıqlar icmalı">
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-xl bg-amber-50">
              <div>
                <p className="text-xs text-amber-600">Gözləyir</p>
                <p className="text-xl font-bold text-amber-600">{stats.tasks?.pending || 0}</p>
              </div>
              <ClipboardList className="w-6 h-6 text-amber-500" />
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-blue-50">
              <div>
                <p className="text-xs text-blue-600">İcrada</p>
                <p className="text-xl font-bold text-blue-600">{stats.tasks?.in_progress || 0}</p>
              </div>
              <Briefcase className="w-6 h-6 text-blue-500" />
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-green-50">
              <div>
                <p className="text-xs text-green-600">Tamamlandı</p>
                <p className="text-xl font-bold text-green-600">{stats.tasks?.completed || 0}</p>
              </div>
              <TrendingUp className="w-6 h-6 text-green-500" />
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-red-50">
              <div>
                <p className="text-xs text-red-600">Ləğv edildi</p>
                <p className="text-xl font-bold text-red-600">{stats.tasks?.cancelled || 0}</p>
              </div>
              <ClipboardList className="w-6 h-6 text-red-500" />
            </div>
          </div>
        </ChartCard>
        )}

        {/* Payments / finance widgets removed per request */}
      </div>
    </div>
  );
}
