import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Loader2, Search, Calendar, Building2, Eye,
  Phone, PhoneCall, PhoneOff, CheckCircle2, XCircle,
  Filter, ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ObligationHistory() {
  const [data, setData] = useState({ obligations: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyDetail, setCompanyDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/obligations/dashboard`, { headers });
      setData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDetail = async (companyId) => {
    setSelectedCompany(companyId);
    setDetailLoading(true);
    try {
      const res = await axios.get(`${API}/obligations/company/${companyId}`, { headers });
      setCompanyDetail(res.data);
    } catch { toast.error('Xəta baş verdi'); }
    finally { setDetailLoading(false); }
  };

  const filtered = data.obligations.filter(o => {
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      return o.company_name?.toLowerCase().includes(t) || o.owner_name?.toLowerCase().includes(t);
    }
    return true;
  }).filter(o => o.total_invited > 0);

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="obligation-history-page">
      <Toaster position="top-right" richColors />

      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Öhdəlik Tarixçəsi</h1>
        <p className="text-slate-500 text-sm mt-1">Şirkətlərin dəvət və qatılma tarixçəsi</p>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Şirkət axtar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 text-sm" data-testid="history-search" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && <p className="col-span-full text-center text-slate-400 py-8">Tarixçəsi olan şirkət yoxdur</p>}
        {filtered.map(obl => (
          <div key={obl.company_id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 hover:shadow-md transition-shadow" data-testid={`history-card-${obl.company_id}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-[#3D4F6F]">{obl.company_name}</p>
                <p className="text-xs text-slate-500">{obl.package} · {obl.owner_name}</p>
              </div>
              <Badge className="bg-[#3D4F6F]/10 text-[#3D4F6F] text-xs">{obl.used_quota}/{obl.total_quota}</Badge>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="text-center bg-slate-50 rounded-lg p-2">
                <p className="text-lg font-bold text-[#3D4F6F]">{obl.total_invited}</p>
                <p className="text-[10px] text-slate-500">Dəvət</p>
              </div>
              <div className="text-center bg-green-50 rounded-lg p-2">
                <p className="text-lg font-bold text-green-600">{obl.total_attended}</p>
                <p className="text-[10px] text-green-600">Qatıldı</p>
              </div>
              <div className="text-center bg-red-50 rounded-lg p-2">
                <p className="text-lg font-bold text-red-600">{obl.total_declined}</p>
                <p className="text-[10px] text-red-500">Rədd</p>
              </div>
              <div className="text-center bg-amber-50 rounded-lg p-2">
                <p className="text-lg font-bold text-amber-600">{obl.total_no_answer}</p>
                <p className="text-[10px] text-amber-500">Cavabsız</p>
              </div>
            </div>

            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => openDetail(obl.company_id)} data-testid={`view-history-${obl.company_id}`}>
              <Eye className="w-3 h-3 mr-1" />Ətraflı bax
            </Button>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedCompany} onOpenChange={(open) => { if (!open) { setSelectedCompany(null); setCompanyDetail(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#3D4F6F]" /></div>
          ) : companyDetail && (
            <>
              <DialogHeader>
                <DialogTitle style={{ color: '#3D4F6F' }}>{companyDetail.company_name} — Tarixçə</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-[#3D4F6F]/5 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-[#3D4F6F]">{companyDetail.remaining_quota}</p>
                  <p className="text-xs text-slate-500">Qalan kvota</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-green-600">{companyDetail.total_attended}</p>
                  <p className="text-xs text-slate-500">Qatıldı</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-red-600">{companyDetail.total_declined}</p>
                  <p className="text-xs text-slate-500">Rədd etdi</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-amber-600">{companyDetail.total_no_answer}</p>
                  <p className="text-xs text-slate-500">Cavab vermədi</p>
                </div>
              </div>

              {/* Type Breakdown */}
              {companyDetail.type_breakdown && Object.keys(companyDetail.type_breakdown).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-[#3D4F6F] mb-2">Fəaliyyət növü üzrə statistika</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(companyDetail.type_breakdown).map(([type, stats]) => (
                      <div key={type} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                        <p className="text-xs font-semibold text-[#3D4F6F]">{type}</p>
                        <div className="flex gap-2 mt-1 text-[10px]">
                          <span className="text-slate-500">Dəvət: {stats.invited}</span>
                          <span className="text-green-600">Qatıldı: {stats.attended}</span>
                          <span className="text-red-500">Rədd: {stats.declined}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div>
                <h4 className="text-sm font-semibold text-[#3D4F6F] mb-2">Dəvət tarixçəsi</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {companyDetail.invitations?.map(inv => (
                    <div key={inv.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${inv.participation_status === 'Qatılır' ? 'bg-green-500' : inv.participation_status === 'Qatılmır' ? 'bg-red-500' : inv.call_status === 'Cavab vermədi' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#3D4F6F] truncate">{inv.event_name}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{inv.event_type}</span>
                          <span>{inv.event_date}</span>
                          {inv.called_by && <span>Zəng: {inv.called_by}</span>}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {inv.participation_status === 'Qatılır' && <Badge className="bg-green-100 text-green-700 text-xs">Qatıldı</Badge>}
                        {inv.participation_status === 'Qatılmır' && <Badge className="bg-red-100 text-red-700 text-xs">Rədd</Badge>}
                        {inv.call_status === 'Cavab vermədi' && <Badge className="bg-amber-100 text-amber-700 text-xs">Cavabsız</Badge>}
                        {inv.call_status === 'Gözləyir' && <Badge className="bg-slate-100 text-slate-500 text-xs">Gözləyir</Badge>}
                      </div>
                    </div>
                  ))}
                  {(!companyDetail.invitations || companyDetail.invitations.length === 0) && (
                    <p className="text-center text-slate-400 text-sm py-4">Tarixçə boşdur</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
