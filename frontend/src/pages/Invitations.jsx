import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Loader2, Search, Phone, PhoneCall, PhoneOff,
  Calendar, Building2, CheckCircle2, XCircle, Clock,
  Filter, X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Toaster, toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Invitations() {
  const [events, setEvents] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [evRes, invRes] = await Promise.all([
        axios.get(`${API}/events`, { headers }),
        axios.get(`${API}/invitations`, { headers }),
      ]);
      setEvents(evRes.data);
      setInvitations(invRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCallStatus = async (invId, callStatus, participationStatus = '') => {
    try {
      await axios.put(`${API}/invitations/${invId}/call`,
        { call_status: callStatus, participation_status: participationStatus }, { headers });
      toast.success('Status yeniləndi');
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const filtered = invitations.filter(inv => {
    if (selectedEventId !== 'all' && inv.event_id !== selectedEventId) return false;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      if (!inv.company_name?.toLowerCase().includes(t) && !inv.event_name?.toLowerCase().includes(t)) return false;
    }
    if (filterStatus !== 'all') {
      if (filterStatus === 'pending' && inv.call_status !== 'Gözləyir') return false;
      if (filterStatus === 'accepted' && inv.participation_status !== 'Qatılır') return false;
      if (filterStatus === 'declined' && inv.participation_status !== 'Qatılmır') return false;
      if (filterStatus === 'no_answer' && inv.call_status !== 'Cavab vermədi') return false;
    }
    return true;
  });

  const stats = {
    total: filtered.length,
    pending: filtered.filter(i => i.call_status === 'Gözləyir').length,
    accepted: filtered.filter(i => i.participation_status === 'Qatılır').length,
    declined: filtered.filter(i => i.participation_status === 'Qatılmır').length,
    no_answer: filtered.filter(i => i.call_status === 'Cavab vermədi').length,
  };

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="invitations-page">
      <Toaster position="top-right" richColors />

      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Dəvətlər</h1>
        <p className="text-slate-500 text-sm mt-1">Bütün dəvətlərin idarə olunması və zəng takibi</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500">Cəmi</p>
          <p className="text-2xl font-bold text-[#3D4F6F]">{stats.total}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500">Gözləyir</p>
          <p className="text-2xl font-bold text-slate-600">{stats.pending}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 shadow-sm border border-green-100">
          <p className="text-xs text-green-600">Qatılır</p>
          <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 shadow-sm border border-red-100">
          <p className="text-xs text-red-500">Rədd etdi</p>
          <p className="text-2xl font-bold text-red-600">{stats.declined}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 shadow-sm border border-amber-100">
          <p className="text-xs text-amber-600">Cavab vermədi</p>
          <p className="text-2xl font-bold text-amber-600">{stats.no_answer}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Şirkət və ya fəaliyyət axtar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 text-sm" data-testid="invitation-search" />
          </div>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-[200px] text-sm h-9"><SelectValue placeholder="Fəaliyyət" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün fəaliyyətlər</SelectItem>
              {events.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.date})</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] text-sm h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Hamısı</SelectItem>
              <SelectItem value="pending">Gözləyir</SelectItem>
              <SelectItem value="accepted">Qatılır</SelectItem>
              <SelectItem value="declined">Rədd etdi</SelectItem>
              <SelectItem value="no_answer">Cavab vermədi</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="invitations-table">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Şirkət</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Fəaliyyət</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Növ</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Tarix</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Status</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Zəng edən</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Əməliyyat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">Dəvət tapılmadı</td></tr>
              ) : (
                filtered.map(inv => (
                  <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50" data-testid={`inv-row-${inv.id}`}>
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-medium text-[#3D4F6F]">{inv.company_name}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{inv.event_name}</td>
                    <td className="px-3 py-2.5"><Badge className="bg-[#3D4F6F]/10 text-[#3D4F6F] text-xs">{inv.event_type}</Badge></td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{inv.event_date}</td>
                    <td className="px-3 py-2.5">
                      {inv.call_status === 'Cavab verdi' && inv.participation_status === 'Qatılır' && <Badge className="bg-green-100 text-green-700 text-xs">Qatılır</Badge>}
                      {inv.call_status === 'Cavab verdi' && inv.participation_status === 'Qatılmır' && <Badge className="bg-red-100 text-red-700 text-xs">Qatılmır</Badge>}
                      {inv.call_status === 'Cavab vermədi' && <Badge className="bg-amber-100 text-amber-700 text-xs">Cavab vermədi</Badge>}
                      {inv.call_status === 'Gözləyir' && <Badge className="bg-slate-100 text-slate-600 text-xs">Gözləyir</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{inv.called_by || '-'}</td>
                    <td className="px-3 py-2.5 text-right">
                      {(inv.call_status === 'Gözləyir' || inv.call_status === 'Cavab vermədi') && (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleCallStatus(inv.id, 'Cavab verdi', 'Qatılır')}
                            className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600"
                            title="Qatılır"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleCallStatus(inv.id, 'Cavab verdi', 'Qatılmır')}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500"
                            title="Qatılmır"
                          >
                            <PhoneOff className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleCallStatus(inv.id, 'Cavab vermədi')}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600"
                            title="Cavab vermədi"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
