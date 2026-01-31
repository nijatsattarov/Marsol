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
  Menu
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
    {trend && (
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
        <p className="font-semibold text-slate-700">{payload[0].name}</p>
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

  const paymentProgress = (stats.payments.paid / stats.payments.total) * 100;

  // Shortened labels for mobile
  const mobileEventsData = stats.events.breakdown.map(item => ({
    ...item,
    shortName: item.name.length > 15 ? item.name.substring(0, 12) + '...' : item.name
  }));

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
          title="Tədbirlər"
          value={stats.events.total}
          subtitle="Ümumi təşkil olunan"
          icon={Calendar}
          color="#3D4F6F"
          trend={12}
        />
        <StatCard
          title="Üzvlər"
          value={stats.members.total}
          subtitle="Aktiv üzvlər"
          icon={Users}
          color="#9ACD32"
          trend={8}
        />
        <StatCard
          title="Sektorlar"
          value={stats.sectors.total}
          subtitle="Fərqli sektor"
          icon={Building2}
          color="#64748B"
        />
        <StatCard
          title="Gəlir"
          value={`${(stats.financials.income / 1000).toFixed(0)}K`}
          subtitle={stats.financials.currency}
          icon={CreditCard}
          color="#3D4F6F"
          trend={15}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Events Bar Chart */}
        <ChartCard title="Tədbirlərin növləri">
          <div className="w-full overflow-x-auto">
            <ResponsiveContainer width="100%" height={240} minWidth={300}>
              <BarChart data={mobileEventsData} layout="vertical" margin={{ left: 0, right: 10 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis 
                  type="category" 
                  dataKey="shortName" 
                  width={100}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="count" 
                  radius={[0, 4, 4, 0]}
                >
                  {mobileEventsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Members Pie Chart */}
        <ChartCard title="Üzvlük paketləri">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={stats.members.breakdown}
                cx="50%"
                cy="45%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={4}
                dataKey="count"
              >
                {stats.members.breakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
                iconSize={10}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2 - Stack on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Sectors Pie Chart */}
        <ChartCard title="Sektorlar üzrə bölgü">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={stats.sectors.breakdown}
                cx="50%"
                cy="50%"
                outerRadius={60}
                dataKey="count"
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {stats.sectors.breakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mt-3">
            {stats.sectors.breakdown.slice(0, 6).map((sector, index) => (
              <div key={index} className="flex items-center gap-1.5 text-xs sm:text-sm">
                <div 
                  className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: sector.color }}
                />
                <span className="text-slate-600 truncate">{sector.name}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Payments Summary */}
        <ChartCard title="Ödənişlərin icmalı">
          <div className="space-y-4 sm:space-y-6">
            <div className="text-center">
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold" style={{ color: '#3D4F6F' }}>
                {stats.payments.total.toLocaleString()}
              </p>
              <p className="text-slate-500 text-sm">{stats.payments.currency}</p>
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
                  {stats.payments.paid.toLocaleString()}
                </p>
                <p className="text-xs sm:text-sm text-green-600/70">Ödənilib</p>
              </div>
              <div className="text-center p-2 sm:p-4 rounded-xl bg-amber-50">
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-amber-600">
                  {stats.payments.remaining.toLocaleString()}
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
                  {stats.financials.income.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 ml-2" style={{ color: '#9ACD32' }} />
            </div>

            <div className="flex justify-between items-center p-3 sm:p-4 rounded-xl bg-slate-50">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-slate-500">Xərclər</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-600">
                  {stats.financials.expenses.toLocaleString()}
                </p>
              </div>
              <TrendingDown className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400 flex-shrink-0 ml-2" />
            </div>

            <div className="p-3 sm:p-4 rounded-xl" style={{ backgroundColor: '#3D4F6F' }}>
              <p className="text-xs sm:text-sm text-white/70">Xalis mənfəət</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-white">
                {stats.financials.profit.toLocaleString()} {stats.financials.currency}
              </p>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Monthly Chart */}
      <ChartCard title="Aylıq maliyyə icmalı">
        <div className="w-full overflow-x-auto -mx-2 px-2">
          <ResponsiveContainer width="100%" height={250} minWidth={500}>
            <BarChart data={stats.financials.monthly} margin={{ left: -10, right: 10 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={45} />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '8px',
                  border: 'none',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} iconSize={10} />
              <Bar 
                dataKey="income" 
                name="Gəlir" 
                fill="#9ACD32" 
                radius={[3, 3, 0, 0]}
              />
              <Bar 
                dataKey="expenses" 
                name="Xərc" 
                fill="#64748B" 
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
