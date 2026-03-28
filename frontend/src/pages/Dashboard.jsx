import { useState, useEffect } from 'react';
import axios from 'axios';
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

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/dashboard/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats(response.data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" data-testid="loading-spinner">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-slate-500">Məlumat yüklənə bilmədi</p>
      </div>
    );
  }

  const paymentProgress = stats.payments?.total > 0 
    ? (stats.payments.paid / stats.payments.total) * 100 
    : 0;

  // Prepare chart data
  const companiesBreakdown = stats.companies?.breakdown || [];
  const sectorsBreakdown = stats.sectors?.breakdown || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8 overflow-x-hidden" data-testid="dashboard-container">
      {/* Header */}
      <div className="mb-4 sm:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }} data-testid="dashboard-title">
          İdarə Paneli
        </h1>
        <p className="text-slate-500 mt-1 text-sm sm:text-base">Marsol Group-un ümumi icmalı</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <StatCard
          title="Şirkətlər"
          value={stats.companies?.total || 0}
          subtitle="Aktiv şirkət"
          icon={Building2}
          color="#3D4F6F"
        />
        <StatCard
          title="Əməkdaşlar"
          value={stats.employees?.total || 0}
          subtitle="Ümumi əməkdaş"
          icon={Users}
          color="#9ACD32"
        />
        <StatCard
          title="Tapşırıqlar"
          value={stats.tasks?.total || 0}
          subtitle={`${stats.tasks?.pending || 0} gözləyir`}
          icon={ClipboardList}
          color="#64748B"
        />
        <StatCard
          title="Mənfəət"
          value={`${((stats.financials?.profit || 0) / 1000).toFixed(0)}K`}
          subtitle={stats.financials?.currency || "AZN"}
          icon={CreditCard}
          color="#3D4F6F"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Companies by Package - Pie Chart */}
        <ChartCard title="Şirkətlər üzrə paketlər">
          {companiesBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={companiesBreakdown}
                  cx="50%"
                  cy="45%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="name"
                >
                  {companiesBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-slate-400">
              Məlumat yoxdur
            </div>
          )}
        </ChartCard>

        {/* Sectors - Bar Chart */}
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
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
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
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Tasks Summary */}
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
          </div>
        </ChartCard>

        {/* Payments Summary */}
        <ChartCard title="Ödənişlərin icmalı">
          <div className="space-y-4 sm:space-y-6">
            <div className="text-center">
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold" style={{ color: '#3D4F6F' }}>
                {(stats.payments?.total || 0).toLocaleString()}
              </p>
              <p className="text-slate-500 text-sm">{stats.payments?.currency || "AZN"}</p>
            </div>

            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${paymentProgress}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="text-center p-2 sm:p-4 rounded-xl bg-green-50">
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">
                  {(stats.payments?.paid || 0).toLocaleString()}
                </p>
                <p className="text-xs sm:text-sm text-green-600/70">Ödənilib</p>
              </div>
              <div className="text-center p-2 sm:p-4 rounded-xl bg-amber-50">
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-amber-600">
                  {(stats.payments?.remaining || 0).toLocaleString()}
                </p>
                <p className="text-xs sm:text-sm text-amber-600/70">Qalıq</p>
              </div>
            </div>
          </div>
        </ChartCard>

        {/* Income vs Expenses */}
        <ChartCard title="Gəlir və Xərclər" className="md:col-span-2 lg:col-span-1">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex justify-between items-center p-3 sm:p-4 rounded-xl bg-slate-50">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-slate-500">Gəlir</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold" style={{ color: '#9ACD32' }}>
                  {(stats.financials?.income || 0).toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 ml-2" style={{ color: '#9ACD32' }} />
            </div>

            <div className="flex justify-between items-center p-3 sm:p-4 rounded-xl bg-slate-50">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-slate-500">Xərclər</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-600">
                  {(stats.financials?.expenses || 0).toLocaleString()}
                </p>
              </div>
              <TrendingDown className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400 flex-shrink-0 ml-2" />
            </div>

            <div className="p-3 sm:p-4 rounded-xl" style={{ backgroundColor: '#3D4F6F' }}>
              <p className="text-xs sm:text-sm text-white/70">Xalis mənfəət</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-white">
                {(stats.financials?.profit || 0).toLocaleString()} {stats.financials?.currency || "AZN"}
              </p>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Debt Warning */}
      {(stats.payments?.remaining || 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <CreditCard className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h4 className="font-semibold text-amber-800">Debitor borclar</h4>
              <p className="text-sm text-amber-700 mt-1">
                Ümumi {(stats.payments?.remaining || 0).toLocaleString()} AZN debitor borc mövcuddur. 
                Gecikmiş ödənişləri yoxlamaq üçün Şirkət Məlumatları bölməsinə keçin.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
