import { useEffect, useState } from 'react';
import axios from 'axios';
import { Sparkles, Loader2, TrendingUp } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const monthLabel = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const months = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
  return `${months[parseInt(m, 10) - 1] || m} ${y}`;
};

export default function ServiceUsageWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API}/dashboard/service-usage-stats`, { headers: { Authorization: `Bearer ${token}` } });
        if (!cancelled) setData(res.data);
      } catch {
        if (!cancelled) setData({ top_services: [], total_records: 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5" data-testid="service-usage-widget">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#9ACD32]" />
          <h3 className="text-sm font-semibold text-[#3D4F6F]">Bu ay aktiv xidmətlər</h3>
        </div>
        {data?.month && <span className="text-[11px] text-slate-400">{monthLabel(data.month)}</span>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-slate-400 text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" />Yüklənir...</div>
      ) : !data || data.top_services.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-8 italic">Bu ay heç bir xidmət istifadəsi qeyd edilməyib</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="text-center p-2.5 rounded-xl bg-[#9ACD32]/10">
              <p className="text-xl font-bold text-[#3D4F6F]">{data.total_records}</p>
              <p className="text-[10px] text-slate-500">Cəmi qeyd</p>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-[#3D4F6F]/5">
              <p className="text-xl font-bold text-[#3D4F6F]">{data.top_services.length}</p>
              <p className="text-[10px] text-slate-500">Aktiv xidmət növü</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {data.top_services.slice(0, 5).map((s, idx) => {
              const max = data.top_services[0]?.total_quantity || 1;
              const pct = (s.total_quantity / max) * 100;
              return (
                <div key={s.service_id || s.service_name || idx} className="group">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-700 font-medium truncate flex-1 pr-2">{s.service_name || '—'}</span>
                    <span className="text-[#3D4F6F] font-bold flex items-center gap-1">
                      {s.total_quantity}
                      <span className="text-[10px] text-slate-400 font-normal">({s.company_count} şirkət)</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#9ACD32] to-[#3D4F6F] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {data.top_services.length > 5 && (
            <p className="text-[11px] text-slate-400 text-center mt-3 flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3" /> +{data.top_services.length - 5} daha çox xidmət
            </p>
          )}
        </>
      )}
    </div>
  );
}
