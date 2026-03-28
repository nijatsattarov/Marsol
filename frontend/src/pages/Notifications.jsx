import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Bell, AlertTriangle, Clock, CreditCard, Loader2, Filter } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Toaster } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Notifications() {
  const [data, setData] = useState({ notifications: [], count: 0, high_count: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/notifications`, { headers });
      setData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getSeverityIcon = (severity) => {
    if (severity === 'high') return <AlertTriangle className="w-5 h-5 text-red-500" />;
    if (severity === 'medium') return <Clock className="w-5 h-5 text-amber-500" />;
    return <CreditCard className="w-5 h-5 text-blue-500" />;
  };

  const getSeverityBg = (severity) => {
    if (severity === 'high') return 'bg-red-50 border-red-200';
    if (severity === 'medium') return 'bg-amber-50 border-amber-200';
    return 'bg-blue-50 border-blue-200';
  };

  const getTypeLabel = (type) => {
    const map = {
      debt_overdue: 'Gecikmiş ödəniş',
      debt_pending: 'Ödənilməmiş borc',
      contract_expired: 'Müqavilə bitib',
      contract_expiring: 'Müqavilə bitir',
    };
    return map[type] || type;
  };

  const filtered = data.notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'high') return n.severity === 'high';
    if (filter === 'debt') return n.type.includes('debt');
    if (filter === 'contract') return n.type.includes('contract');
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="notifications-page">
      <Toaster position="top-right" richColors />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Bildirişlər</h1>
          <p className="text-slate-500 text-sm mt-1">Sistem xəbərdarlıqları və bildirişlər</p>
        </div>
        <div className="flex gap-2 items-center">
          {data.high_count > 0 && <Badge className="bg-red-500 text-white">{data.high_count} təcili</Badge>}
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48 text-sm" data-testid="notif-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün bildirişlər ({data.count})</SelectItem>
              <SelectItem value="high">Yalnız təcili</SelectItem>
              <SelectItem value="debt">Borc bildirişləri</SelectItem>
              <SelectItem value="contract">Müqavilə bildirişləri</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500">Cəmi</p>
          <p className="text-2xl font-bold text-[#3D4F6F]">{data.count}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 shadow-sm border border-red-100">
          <p className="text-xs text-red-500">Təcili</p>
          <p className="text-2xl font-bold text-red-600">{data.high_count}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 shadow-sm border border-amber-100">
          <p className="text-xs text-amber-500">Orta</p>
          <p className="text-2xl font-bold text-amber-600">{data.notifications.filter(n => n.severity === 'medium').length}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-100">
          <p className="text-xs text-blue-500">Aşağı</p>
          <p className="text-2xl font-bold text-blue-600">{data.notifications.filter(n => n.severity === 'low').length}</p>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-slate-100">
            <Bell className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-400">Bildiriş yoxdur</p>
          </div>
        ) : (
          filtered.map(n => (
            <div key={n.id} className={`flex items-start gap-4 p-4 rounded-xl border shadow-sm ${getSeverityBg(n.severity)}`} data-testid={`notif-${n.id}`}>
              {getSeverityIcon(n.severity)}
              <div className="flex-1">
                <p className="font-semibold text-sm text-slate-700">{n.title}</p>
                <p className="text-sm text-slate-500 mt-0.5">{n.message}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={`text-xs ${n.severity === 'high' ? 'bg-red-100 text-red-700' : n.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {getTypeLabel(n.type)}
                  </Badge>
                  <span className="text-xs text-slate-400">{n.date}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
