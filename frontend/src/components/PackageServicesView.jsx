import { useState, useEffect } from 'react';
import axios from 'axios';
import { Check, X, Sparkles, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Read-only display of services included in a package, identified by name.
 * Shows nothing (or a hint) if the package has no services configured.
 */
export default function PackageServicesView({ packageName, title = 'Paket xidmətləri', compact = false }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pkgName, setPkgName] = useState('');

  useEffect(() => {
    if (!packageName) { setServices([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const pkgRes = await axios.get(`${API}/settings/packages`, { headers });
        const pkg = (pkgRes.data || []).find(p => (p.name || '').toLowerCase() === (packageName || '').toLowerCase());
        if (!pkg) { setServices([]); return; }
        if (!cancelled) setPkgName(pkg.name);
        const svcRes = await axios.get(`${API}/settings/packages/${pkg.id}/services`, { headers });
        if (!cancelled) setServices(svcRes.data || []);
      } catch {
        if (!cancelled) setServices([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [packageName]);

  if (!packageName) return null;

  return (
    <div className={compact ? '' : 'bg-white border border-slate-100 rounded-xl p-4'} data-testid="package-services-view">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-[#9ACD32]" />
        <h3 className="text-sm font-semibold text-[#3D4F6F]">{title}{pkgName && <span className="text-slate-400 font-normal"> · {pkgName}</span>}</h3>
      </div>
      {loading ? (
        <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Yüklənir...</p>
      ) : services.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Bu paket üçün xidmət təyin olunmayıb. Tənzimləmələr → Paketlər bölməsindən əlavə edə bilərsiniz.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {services.map((s) => (
            <div
              key={s.id}
              className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-xs border ${s.included ? 'bg-emerald-50/50 border-emerald-100 text-[#3D4F6F]' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
            >
              <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${s.included ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                {s.included ? <Check className="w-2.5 h-2.5 text-white" /> : <X className="w-2.5 h-2.5 text-white" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`font-medium leading-snug ${s.included ? '' : 'line-through'}`}>{s.name}</span>
                  {s.value && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#3D4F6F] text-white">{s.value}</span>}
                </div>
                {s.description && <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{s.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
