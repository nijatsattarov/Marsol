import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Search, Loader2, BarChart3, Calendar as CalIcon, Building, Users2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { DatePickerAz } from '../components/DateTimePickerAz';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PERIODS = [
  { value: 'day', label: 'Bu gün' },
  { value: 'week', label: 'Bu həftə' },
  { value: 'month', label: 'Bu ay' },
  { value: 'year', label: 'Bu il' },
  { value: 'all', label: 'Bütün dövr' },
  { value: 'custom', label: 'Xüsusi tarix...' },
];

const StatCard = ({ icon: Icon, label, value, tone = 'slate' }) => {
  const toneMap = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <div className={`rounded-xl border p-4 ${toneMap[tone]}`} data-testid={`kpi-stat-${label}`}>
      <div className="flex items-center gap-2 mb-1.5"><Icon className="w-4 h-4" /><span className="text-xs font-medium opacity-80">{label}</span></div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
};

const SummaryRow = ({ name, sub, total, completed, in_progress, pending, overdue, completion_rate }) => (
  <tr className="border-b last:border-0 hover:bg-slate-50">
    <td className="px-3 py-2 text-sm">
      <div className="font-medium text-slate-800">{name || '—'}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </td>
    <td className="px-3 py-2 text-sm text-center font-semibold text-slate-700">{total}</td>
    <td className="px-3 py-2 text-sm text-center text-emerald-700">{completed}</td>
    <td className="px-3 py-2 text-sm text-center text-blue-700">{in_progress}</td>
    <td className="px-3 py-2 text-sm text-center text-amber-700">{pending}</td>
    <td className="px-3 py-2 text-sm text-center text-rose-700 font-semibold">{overdue}</td>
    <td className="px-3 py-2 text-sm text-center">
      <Badge className={`text-[11px] ${completion_rate >= 70 ? 'bg-emerald-100 text-emerald-700' : completion_rate >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
        {completion_rate}%
      </Badge>
    </td>
  </tr>
);

export default function HrKpi() {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [period, setPeriod] = useState('year');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [department, setDepartment] = useState('all');
  const [marsolCompany, setMarsolCompany] = useState('all');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [marsolCompanies, setMarsolCompanies] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [opts, mc] = await Promise.all([
          axios.get(`${API}/options/all`, { headers }),
          axios.get(`${API}/settings/marsol-companies`, { headers }).catch(() => ({ data: [] })),
        ]);
        setDepartments(opts.data?.departments || []);
        setMarsolCompanies(mc.data || []);
      } catch (e) {
        console.error(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchKpi = useCallback(async () => {
    setLoading(true);
    try {
      const params = { period };
      if (period === 'custom') {
        if (startDate) params.start = startDate;
        if (endDate) params.end = endDate;
      }
      if (department !== 'all') params.department = department;
      if (marsolCompany !== 'all') params.marsol_company = marsolCompany;
      if (search.trim()) params.search = search.trim();
      const r = await axios.get(`${API}/hr/kpi`, { headers, params });
      setData(r.data);
    } catch (e) {
      console.error(e);
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, startDate, endDate, department, marsolCompany, search]);

  useEffect(() => { fetchKpi(); }, [fetchKpi]);

  const totals = data?.totals || { total: 0, completed: 0, in_progress: 0, pending: 0, overdue: 0, completion_rate: 0 };
  const filteredUsers = useMemo(() => data?.users || [], [data]);

  return (
    <div className="p-4 sm:p-6 max-w-[1500px] mx-auto" data-testid="hr-kpi-page">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2" style={{ color: '#3D4F6F' }}>
            <BarChart3 className="w-6 h-6" />KPİ — Tapşırıq hesabatı
          </h1>
          <p className="text-slate-500 text-sm mt-1">İstifadəçilər, şöbələr və müəssisələr üzrə tapşırıq icra göstəriciləri</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-44">
            <Label className="text-xs flex items-center gap-1"><CalIcon className="w-3 h-3" />Dövr</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-9 text-sm" data-testid="kpi-period-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {period === 'custom' && (
            <>
              <div className="w-40">
                <Label className="text-xs">Tarixdən</Label>
                <DatePickerAz value={startDate} onChange={setStartDate} testId="kpi-date-from" />
              </div>
              <div className="w-40">
                <Label className="text-xs">Tarixə qədər</Label>
                <DatePickerAz value={endDate} onChange={setEndDate} testId="kpi-date-to" />
              </div>
            </>
          )}
          <div className="w-44">
            <Label className="text-xs">Şöbə</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="h-9 text-sm" data-testid="kpi-dept-select"><SelectValue placeholder="Hamısı" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün şöbələr</SelectItem>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Label className="text-xs flex items-center gap-1"><Building className="w-3 h-3" />Müəssisə</Label>
            <Select value={marsolCompany} onValueChange={setMarsolCompany}>
              <SelectTrigger className="h-9 text-sm" data-testid="kpi-marsol-select"><SelectValue placeholder="Hamısı" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün müəssisələr</SelectItem>
                {marsolCompanies.map(mc => <SelectItem key={mc.id} value={mc.name}>{mc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Axtar</Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="İstifadəçi adı, şöbə, müəssisə..."
                className="pl-8 h-9 text-sm"
                data-testid="kpi-search-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <StatCard icon={BarChart3} label="Ümumi tapşırıq" value={totals.total} tone="blue" />
        <StatCard icon={CheckCircle2} label="Tamamlanmış" value={totals.completed} tone="emerald" />
        <StatCard icon={Users2} label="İcradadır" value={totals.in_progress} tone="blue" />
        <StatCard icon={Users2} label="Gözləyir" value={totals.pending} tone="amber" />
        <StatCard icon={AlertTriangle} label="Gecikmiş" value={totals.overdue} tone="rose" />
        <StatCard icon={CheckCircle2} label="İcra %" value={`${totals.completion_rate}%`} tone={totals.completion_rate >= 70 ? 'emerald' : totals.completion_rate >= 40 ? 'amber' : 'rose'} />
      </div>

      {/* Tabs: Users / Departments / Müəssisələr */}
      <Tabs defaultValue="users" className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <TabsList className="px-3 pt-3">
          <TabsTrigger value="users" data-testid="kpi-tab-users">İstifadəçilər ({filteredUsers.length})</TabsTrigger>
          <TabsTrigger value="departments" data-testid="kpi-tab-departments">Şöbələr ({data?.departments?.length || 0})</TabsTrigger>
          <TabsTrigger value="companies" data-testid="kpi-tab-companies">Müəssisələr ({data?.companies?.length || 0})</TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" />Yüklənir...</div>
        ) : (
          <>
            <TabsContent value="users" className="px-3 pb-3">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="kpi-users-table">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F] text-left">İstifadəçi</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Ümumi</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Tamamlanıb</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">İcrada</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Gözləyir</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Gecikmiş</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">İcra %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-8 text-slate-400">Filterə uyğun nəticə yoxdur</td></tr>
                    ) : filteredUsers.map(u => (
                      <SummaryRow key={u.name} {...u} sub={`${u.department} · ${u.marsol_company}`} />
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="departments" className="px-3 pb-3">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="kpi-departments-table">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F] text-left">Şöbə</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Ümumi</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Tamamlanıb</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">İcrada</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Gözləyir</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Gecikmiş</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">İcra %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.departments || []).map(d => <SummaryRow key={d.name} {...d} />)}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="companies" className="px-3 pb-3">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="kpi-companies-table">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F] text-left">Müəssisə</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Ümumi</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Tamamlanıb</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">İcrada</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Gözləyir</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Gecikmiş</th>
                      <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F]">İcra %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.companies || []).map(c => <SummaryRow key={c.name} {...c} />)}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
