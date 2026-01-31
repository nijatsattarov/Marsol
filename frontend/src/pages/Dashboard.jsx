import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Calendar, 
  Users, 
  Building2, 
  CreditCard, 
  TrendingUp, 
  TrendingDown,
  Loader2
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
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <p className="text-3xl font-bold" style={{ color: '#3D4F6F' }}>{value}</p>
        {subtitle && (
          <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
        )}
      </div>
      <div 
        className="p-3 rounded-xl"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
    </div>
    {trend && (
      <div className="flex items-center gap-1 mt-3 text-sm">
        {trend > 0 ? (
          <TrendingUp className="w-4 h-4 text-green-500" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-500" />
        )}
        <span className={trend > 0 ? 'text-green-500' : 'text-red-500'}>
          {Math.abs(trend)}%
        </span>
        <span className="text-slate-400">keçən aydan</span>
      </div>
    )}
  </div>
);

const ChartCard = ({ title, children }) => (
  <div className="chart-container" data-testid={`chart-${title.toLowerCase().replace(/\s+/g, '-')}`}>
    <h3 className="text-lg font-semibold mb-4" style={{ color: '#3D4F6F' }}>{title}</h3>
    {children}
  </div>
);

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-4 py-2 shadow-lg rounded-lg border border-slate-100">
        <p className="font-semibold text-slate-700">{payload[0].name}</p>
        <p className="text-sm text-slate-500">{payload[0].value}</p>
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

  return (
    <div className="p-6 lg:p-8 space-y-8" data-testid="dashboard-container">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: '#3D4F6F' }} data-testid="dashboard-title">
          İdarə Paneli
        </h1>
        <p className="text-slate-500 mt-1">Marsol Group-un ümumi icmalı</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Events Bar Chart */}
        <ChartCard title="Tədbirlərin növləri">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.events.breakdown} layout="vertical">
              <XAxis type="number" />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={140}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="count" 
                radius={[0, 6, 6, 0]}
              >
                {stats.events.breakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Members Pie Chart */}
        <ChartCard title="Üzvlük paketləri">
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={stats.members.breakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="count"
                >
                  {stats.members.breakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sectors Pie Chart */}
        <ChartCard title="Sektorlar üzrə bölgü">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={stats.sectors.breakdown}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="count"
                label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
              >
                {stats.sectors.breakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {stats.sectors.breakdown.slice(0, 6).map((sector, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: sector.color }}
                />
                <span className="text-slate-600 truncate">{sector.name}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Payments Summary */}
        <ChartCard title="Ödənişlərin icmalı">
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-4xl font-bold" style={{ color: '#3D4F6F' }}>
                {stats.payments.total.toLocaleString()}
              </p>
              <p className="text-slate-500">{stats.payments.currency}</p>
            </div>

            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${paymentProgress}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-xl bg-green-50">
                <p className="text-2xl font-bold text-green-600">
                  {stats.payments.paid.toLocaleString()}
                </p>
                <p className="text-sm text-green-600/70">Ödənilib</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-amber-50">
                <p className="text-2xl font-bold text-amber-600">
                  {stats.payments.remaining.toLocaleString()}
                </p>
                <p className="text-sm text-amber-600/70">Qalıq</p>
              </div>
            </div>
          </div>
        </ChartCard>

        {/* Income vs Expenses */}
        <ChartCard title="Gəlir və Xərclər">
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 rounded-xl bg-slate-50">
              <div>
                <p className="text-sm text-slate-500">Gəlir</p>
                <p className="text-2xl font-bold" style={{ color: '#9ACD32' }}>
                  {stats.financials.income.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-8 h-8" style={{ color: '#9ACD32' }} />
            </div>

            <div className="flex justify-between items-center p-4 rounded-xl bg-slate-50">
              <div>
                <p className="text-sm text-slate-500">Xərclər</p>
                <p className="text-2xl font-bold text-slate-600">
                  {stats.financials.expenses.toLocaleString()}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-slate-400" />
            </div>

            <div className="p-4 rounded-xl" style={{ backgroundColor: '#3D4F6F' }}>
              <p className="text-sm text-white/70">Xalis mənfəət</p>
              <p className="text-2xl font-bold text-white">
                {stats.financials.profit.toLocaleString()} {stats.financials.currency}
              </p>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Monthly Chart */}
      <ChartCard title="Aylıq maliyyə icmalı">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats.financials.monthly}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
              }}
            />
            <Legend />
            <Bar 
              dataKey="income" 
              name="Gəlir" 
              fill="#9ACD32" 
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="expenses" 
              name="Xərc" 
              fill="#64748B" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
