import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Loader2, Building2, UtensilsCrossed, Palette, Music, Camera, Bus, Package, Star, TrendingUp, Clock } from 'lucide-react';
import { ORG_CONFIGS } from './configs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MODULE_ICONS = {
  venues: Building2,
  catering: UtensilsCrossed,
  decor: Palette,
  musicians: Music,
  photovideo: Camera,
  transport: Bus,
  materials: Package,
};

const MODULE_COLORS = {
  venues: 'from-blue-500 to-blue-600',
  catering: 'from-orange-500 to-red-500',
  decor: 'from-pink-500 to-rose-500',
  musicians: 'from-purple-500 to-indigo-500',
  photovideo: 'from-cyan-500 to-teal-500',
  transport: 'from-green-500 to-emerald-500',
  materials: 'from-amber-500 to-yellow-500',
};

export default function OrgDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    axios.get(`${API}/organization/dashboard/stats`, { headers })
      .then(r => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[#3D4F6F]" /></div>;

  const totalVendors = stats ? Object.values(stats.counts || {}).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="org-dashboard">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[#3D4F6F]">Fəaliyyətlər</h1>
        <p className="text-slate-500 text-sm mt-1">Tədbir təchizatçılarının və xidmətlərin mərkəzi bazası</p>
      </div>

      {/* Top-level summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-gradient-to-br from-[#3D4F6F] to-[#2A364C] rounded-xl p-4 text-white">
          <p className="text-xs text-white/70 mb-1">Ümumi təchizatçı</p>
          <p className="text-3xl font-bold">{totalVendors}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-1.5 mb-1"><Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /><p className="text-xs text-slate-500">Reytinq qeydləri</p></div>
          <p className="text-3xl font-bold text-[#3D4F6F]">{stats?.total_ratings || 0}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-1.5 mb-1"><TrendingUp className="w-3.5 h-3.5 text-green-500" /><p className="text-xs text-slate-500">Ən yüksək orta</p></div>
          <p className="text-3xl font-bold text-green-600">{stats?.top_rated?.[0]?.overall ?? '—'}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-1.5 mb-1"><Clock className="w-3.5 h-3.5 text-blue-500" /><p className="text-xs text-slate-500">Son əlavələr</p></div>
          <p className="text-3xl font-bold text-[#3D4F6F]">{stats?.recent_additions?.length || 0}</p>
        </div>
      </div>

      {/* Modules grid */}
      <h2 className="text-sm font-semibold text-[#3D4F6F] mb-3">Alt-modullar</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Object.entries(ORG_CONFIGS).map(([key, cfg]) => {
          const Icon = MODULE_ICONS[key];
          const count = stats?.counts?.[key] || 0;
          return (
            <button
              key={key}
              onClick={() => navigate(`/organization/${key}`)}
              className="group bg-white rounded-xl border shadow-sm p-4 text-left hover:shadow-md hover:border-[#9ACD32] transition-all"
              data-testid={`nav-${key}`}
            >
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${MODULE_COLORS[key]} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-1">{cfg.title}</p>
              <p className="text-2xl font-bold text-[#3D4F6F] group-hover:text-[#2A364C]">{count}</p>
              <p className="text-[11px] text-slate-500 mt-1">{cfg.subtitle}</p>
            </button>
          );
        })}
        <button
          onClick={() => navigate('/organization/ratings')}
          className="group bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200 shadow-sm p-4 text-left hover:shadow-md transition-all"
          data-testid="nav-ratings"
        >
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-3">
            <Star className="w-5 h-5 text-white fill-white" />
          </div>
          <p className="text-[11px] text-amber-700 font-medium uppercase tracking-wider mb-1">Reytinq</p>
          <p className="text-2xl font-bold text-amber-700">{stats?.total_ratings || 0}</p>
          <p className="text-[11px] text-amber-600 mt-1">Bütün təchizatçılar üzrə</p>
        </button>
      </div>

      {/* Top rated */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="text-sm font-semibold text-[#3D4F6F] mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />Ən yüksək reytinq
          </h3>
          {!stats?.top_rated?.length ? <p className="text-xs text-slate-400 py-4 text-center">Reytinq qeydi yoxdur</p> :
            <div className="space-y-2">
              {stats.top_rated.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-[#3D4F6F]">{r.vendor_name || 'Adsız'}</p>
                      <p className="text-[10px] text-slate-400">{ORG_CONFIGS[r.vendor_type]?.title || r.vendor_type} • {r.count} qiymətləndirmə</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-bold text-[#3D4F6F]">{r.overall}</span>
                  </div>
                </div>
              ))}
            </div>}
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="text-sm font-semibold text-[#3D4F6F] mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />Son əlavə edilmiş
          </h3>
          {!stats?.recent_additions?.length ? <p className="text-xs text-slate-400 py-4 text-center">Qeyd yoxdur</p> :
            <div className="space-y-2">
              {stats.recent_additions.map((r, i) => (
                <button key={i} onClick={() => navigate(`/organization/${r.module}`)} className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg text-left">
                  <div>
                    <p className="text-sm font-medium text-[#3D4F6F]">{r.name}</p>
                    <p className="text-[10px] text-slate-400">{r.module_label}</p>
                  </div>
                  <span className="text-[10px] text-slate-400">{(r.created_at || '').slice(0, 10)}</span>
                </button>
              ))}
            </div>}
        </div>
      </div>
    </div>
  );
}
