import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, Loader2, Search, Download, Package, BarChart3, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { usePermissions, canEdit } from '../context/PermissionContext';
import { formatDate } from '../lib/dateUtils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_OPTIONS = ['Aktiv', 'Köhnəlmiş', 'Təmirdə', 'Anbarda', 'Silinib'];
const CONDITION_OPTIONS = ['Yeni', 'Yaxşı', 'Orta', 'Pis'];

const emptyForm = {
  display_id: '',
  department: '',
  asset_name: '',
  category: '',
  inventory_code: '',
  quantity: 1,
  condition: 'Yeni',
  responsible_person: '',
  location: '',
  purchase_date: '',
  last_check_date: '',
  status: 'Aktiv',
  note: '',
  // Financial fields
  purchase_price: 0,
  delivery_cost: 0,
  customs_cost: 0,
  installation_cost: 0,
  other_costs: 0,
  useful_life_years: 5,
  market_value: 0,
  is_operational: true,
};

const opStatusColor = (s) => {
  if (!s) return 'bg-slate-100 text-slate-700';
  if (s.includes('Silinməyə')) return 'bg-red-100 text-red-700';
  if (s.includes('Tam amortizasiya')) return 'bg-amber-100 text-amber-700';
  if (s.includes('yararsız')) return 'bg-orange-100 text-orange-700';
  return 'bg-emerald-100 text-emerald-700';
};

export default function InventoryTab({ responsiblePersons = [], departments = [] }) {
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'finance');
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [items, setItems] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSub, setActiveSub] = useState('list');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, reportRes] = await Promise.all([
        axios.get(`${API}/finance/inventory`, { headers }),
        axios.get(`${API}/finance/inventory/value-report`, { headers }).catch(() => ({ data: null })),
      ]);
      setItems(itemsRes.data || []);
      setReport(reportRes.data);
    } catch (e) {
      console.error('Inventory fetch error', e);
      toast.error('İnventar yüklənərkən xəta baş verdi');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      display_id: item.display_id || '',
      department: item.department || '',
      asset_name: item.asset_name || '',
      category: item.category || '',
      inventory_code: item.inventory_code || '',
      quantity: item.quantity || 1,
      condition: item.condition || 'Yeni',
      responsible_person: item.responsible_person || '',
      location: item.location || '',
      purchase_date: item.purchase_date || '',
      last_check_date: item.last_check_date || '',
      status: item.status || 'Aktiv',
      note: item.note || '',
      purchase_price: item.purchase_price ?? (item.quantity || 1) * (item.unit_value || 0),
      delivery_cost: item.delivery_cost || 0,
      customs_cost: item.customs_cost || 0,
      installation_cost: item.installation_cost || 0,
      other_costs: item.other_costs || 0,
      useful_life_years: item.useful_life_years || 5,
      market_value: item.market_value || 0,
      is_operational: item.is_operational !== false,
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.asset_name.trim()) {
      toast.error('Əmlakın adı boş ola bilməz');
      return;
    }
    setSaving(true);
    try {
      const numField = (v) => Math.max(Number(v) || 0, 0);
      const payload = {
        ...form,
        quantity: Math.max(Number(form.quantity) || 1, 1),
        purchase_price: numField(form.purchase_price),
        delivery_cost: numField(form.delivery_cost),
        customs_cost: numField(form.customs_cost),
        installation_cost: numField(form.installation_cost),
        other_costs: numField(form.other_costs),
        useful_life_years: numField(form.useful_life_years),
        market_value: numField(form.market_value),
        is_operational: !!form.is_operational,
      };
      if (editing) {
        await axios.put(`${API}/finance/inventory/${editing.id}`, payload, { headers });
        toast.success('İnventar yeniləndi');
      } else {
        await axios.post(`${API}/finance/inventory`, payload, { headers });
        toast.success('İnventar əlavə edildi');
      }
      setShowModal(false);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xəta baş verdi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`"${item.asset_name}" inventarı silinsin?`)) return;
    try {
      await axios.delete(`${API}/finance/inventory/${item.id}`, { headers });
      toast.success('İnventar silindi');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xəta baş verdi');
    }
  };

  // Live computed total initial value for the form
  const formTotalInitial = Math.max(Number(form.purchase_price) || 0, 0)
    + Math.max(Number(form.delivery_cost) || 0, 0)
    + Math.max(Number(form.customs_cost) || 0, 0)
    + Math.max(Number(form.installation_cost) || 0, 0)
    + Math.max(Number(form.other_costs) || 0, 0);

  const filtered = items.filter(it => {
    if (search) {
      const term = search.toLowerCase();
      const hay = `${it.asset_name} ${it.category} ${it.inventory_code} ${it.responsible_person} ${it.location} ${it.department}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    if (statusFilter !== 'all' && (it.status || '') !== statusFilter) return false;
    if (deptFilter !== 'all' && (it.department || '') !== deptFilter) return false;
    return true;
  });

  const uniqueDepartments = [...new Set([
    ...(departments || []),
    ...items.map(i => i.department).filter(Boolean),
  ])].sort();

  const sumBook = filtered.reduce((s, it) => s + (it.valuation?.book_value || 0), 0);
  const sumInitial = filtered.reduce((s, it) => s + (it.valuation?.total_initial_value || 0), 0);

  const exportToExcel = () => {
    const rows = filtered.map(it => {
      const v = it.valuation || {};
      return {
        'İnventar №': it.display_id || '',
        'Şöbə': it.department || '',
        'Əmlakın adı': it.asset_name || '',
        'Kateqoriya': it.category || '',
        'İnventar kodu': it.inventory_code || '',
        'Sayı': it.quantity || 0,
        'Vəziyyət': it.condition || '',
        'Məsul şəxs': it.responsible_person || '',
        'Məkan': it.location || '',
        'Alış tarixi': it.purchase_date ? formatDate(it.purchase_date) : '',
        'Alış qiyməti (AZN)': v.purchase_price || 0,
        'Çatdırılma (AZN)': v.delivery_cost || 0,
        'Gömrük (AZN)': v.customs_cost || 0,
        'Quraşdırma (AZN)': v.installation_cost || 0,
        'Digər xərclər (AZN)': v.other_costs || 0,
        'Ümumi ilkin dəyər (AZN)': v.total_initial_value || 0,
        'Faydalı istifadə (il)': v.useful_life_years || 0,
        'İllik amortizasiya': v.annual_depreciation || 0,
        'Aylıq amortizasiya': v.monthly_depreciation || 0,
        'İstifadə (ay)': v.months_used || 0,
        'Yığılmış amortizasiya': v.accumulated_depreciation || 0,
        'Qalıq dəyər (AZN)': v.book_value || 0,
        'Bazar dəyəri (AZN)': v.market_value || 0,
        'Əməliyyat statusu': v.operational_status || '',
        'Tövsiyə': v.suggestion || '',
        'Status': it.status || '',
        'Qeyd': it.note || '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'İnventarlar');
    XLSX.writeFile(wb, `inventarlar-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-[#3D4F6F] animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="finance-inventory-tab">
      <Tabs value={activeSub} onValueChange={setActiveSub}>
        <TabsList className="mb-4">
          <TabsTrigger value="list" data-testid="inv-tab-list">
            <Package className="w-4 h-4 mr-1.5" />İnventarlar ({items.length})
          </TabsTrigger>
          <TabsTrigger value="report" data-testid="inv-tab-report">
            <BarChart3 className="w-4 h-4 mr-1.5" />İnventar dəyər hesabatı
          </TabsTrigger>
        </TabsList>

        {/* LIST SUB-TAB */}
        <TabsContent value="list">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Axtar (ad, kateqoriya, kod, məsul şəxs)..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10 text-sm"
                  data-testid="inv-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px] text-sm" data-testid="inv-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Bütün statuslar</SelectItem>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-full sm:w-[180px] text-sm" data-testid="inv-dept-filter">
                  <SelectValue placeholder="Şöbə" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Bütün şöbələr</SelectItem>
                  {uniqueDepartments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportToExcel} data-testid="inv-export-btn">
                <Download className="w-4 h-4 mr-1.5" />Excel
              </Button>
              {_canEdit && (
                <Button onClick={openCreate} className="bg-[#3D4F6F] hover:bg-[#3D4F6F]/90 text-white" size="sm" data-testid="inv-add-btn">
                  <Plus className="w-4 h-4 mr-1.5" />Əlavə et
                </Button>
              )}
            </div>

            {/* Summary chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge className="bg-slate-100 text-slate-700">Element: {filtered.length}</Badge>
              <Badge className="bg-blue-50 text-blue-700">İlkin dəyər: {sumInitial.toLocaleString()} AZN</Badge>
              <Badge className="bg-emerald-50 text-emerald-700">Qalıq dəyər: {sumBook.toLocaleString()} AZN</Badge>
            </div>

            {filtered.length === 0 ? (
              <p className="text-center text-slate-400 py-10 text-sm">İnventar tapılmadı</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-xs" data-testid="inv-table">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">№</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">Əmlakın adı</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">Şöbə</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">Kateqoriya</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">Alış tarixi</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-[#3D4F6F]">İlkin dəyər</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-amber-600">Amortizasiya</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-emerald-700">Qalıq dəyər</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-blue-600">Bazar dəyəri</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">Əməliyyat statusu</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">Məsul şəxs</th>
                      {_canEdit && <th className="text-right px-3 py-2.5 font-semibold text-[#3D4F6F]"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(it => {
                      const v = it.valuation || {};
                      return (
                        <tr key={it.id} className="border-b border-slate-50 hover:bg-slate-50/60" data-testid={`inv-row-${it.id}`}>
                          <td className="px-3 py-2 font-mono text-[11px]">
                            <Badge className="bg-slate-100 text-slate-700 text-[10px]">{it.display_id}</Badge>
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {it.asset_name}
                            {it.inventory_code && <div className="text-[10px] text-slate-400 font-mono">{it.inventory_code}</div>}
                          </td>
                          <td className="px-3 py-2">{it.department || '—'}</td>
                          <td className="px-3 py-2">{it.category || '—'}</td>
                          <td className="px-3 py-2">
                            {it.purchase_date ? formatDate(it.purchase_date) : '—'}
                            {v.months_used > 0 && <div className="text-[10px] text-slate-400">{v.months_used} ay</div>}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">{(v.total_initial_value || 0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-amber-700">
                            {(v.accumulated_depreciation || 0).toLocaleString()}
                            {v.monthly_depreciation > 0 && <div className="text-[10px] text-slate-400">{v.monthly_depreciation.toLocaleString()} AZN/ay</div>}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700">{(v.book_value || 0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-blue-700">
                            {(v.market_value || 0).toLocaleString()}
                            {v.market_above_book && (
                              <div className="text-[10px] text-emerald-600 flex items-center justify-end gap-0.5">
                                <TrendingUp className="w-3 h-3" />+{(v.market_value - v.book_value).toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Badge className={opStatusColor(v.operational_status)}>
                              {v.operational_status || '—'}
                            </Badge>
                            {v.suggestion && (
                              <div className="text-[10px] text-slate-500 mt-1 max-w-[200px] flex items-start gap-1" title={v.suggestion}>
                                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{v.suggestion}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">{it.responsible_person || '—'}</td>
                          {_canEdit && (
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(it)} title="Redaktə" data-testid={`inv-edit-${it.id}`}>
                                <Pencil className="w-3.5 h-3.5 text-[#3D4F6F]" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(it)} title="Sil" data-testid={`inv-delete-${it.id}`}>
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* REPORT SUB-TAB */}
        <TabsContent value="report">
          {!report ? (
            <p className="text-center text-slate-400 py-10 text-sm">Hesabat yüklənərkən xəta baş verdi</p>
          ) : (
            <div className="space-y-4" data-testid="inv-report">
              {/* Totals */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100" data-testid="inv-total-items">
                  <p className="text-xs text-slate-500 mb-1">Toplam element</p>
                  <p className="text-2xl font-bold text-[#3D4F6F]">{report.totals?.items || 0}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">İlkin dəyər</p>
                  <p className="text-2xl font-bold text-blue-600">{(report.totals?.initial_value || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400">AZN</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">Yığılmış amortizasiya</p>
                  <p className="text-2xl font-bold text-amber-600">{(report.totals?.accumulated_depreciation || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400">AZN</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100" data-testid="inv-total-book">
                  <p className="text-xs text-slate-500 mb-1">Qalıq dəyər</p>
                  <p className="text-2xl font-bold text-emerald-600">{(report.totals?.book_value || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400">AZN</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100" data-testid="inv-total-market">
                  <p className="text-xs text-slate-500 mb-1">Bazar dəyəri</p>
                  <p className="text-2xl font-bold text-violet-600">{(report.totals?.market_value || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400">AZN</p>
                </div>
              </div>

              {/* By department */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                <h3 className="font-semibold text-[#3D4F6F] mb-3">Şöbəyə görə</h3>
                {(report.by_department || []).length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-3">Məlumat yoxdur</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 text-xs font-semibold text-slate-500">Şöbə</th>
                          <th className="text-right py-2 text-xs font-semibold text-slate-500">Element</th>
                          <th className="text-right py-2 text-xs font-semibold text-blue-600">İlkin dəyər</th>
                          <th className="text-right py-2 text-xs font-semibold text-amber-600">Amortizasiya</th>
                          <th className="text-right py-2 text-xs font-semibold text-emerald-600">Qalıq dəyər</th>
                          <th className="text-right py-2 text-xs font-semibold text-violet-600">Bazar dəyəri</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.by_department.map(row => (
                          <tr key={row.department} className="border-b border-slate-50">
                            <td className="py-2 font-medium text-[#3D4F6F]">{row.department}</td>
                            <td className="py-2 text-right">{row.items}</td>
                            <td className="py-2 text-right text-blue-700">{(row.initial_value || 0).toLocaleString()}</td>
                            <td className="py-2 text-right text-amber-700">{(row.accumulated_depreciation || 0).toLocaleString()}</td>
                            <td className="py-2 text-right font-semibold text-emerald-700">{(row.book_value || 0).toLocaleString()}</td>
                            <td className="py-2 text-right text-violet-700">{(row.market_value || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* By category */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                <h3 className="font-semibold text-[#3D4F6F] mb-3">Kateqoriyaya görə</h3>
                {(report.by_category || []).length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-3">Məlumat yoxdur</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 text-xs font-semibold text-slate-500">Kateqoriya</th>
                          <th className="text-right py-2 text-xs font-semibold text-slate-500">Element</th>
                          <th className="text-right py-2 text-xs font-semibold text-blue-600">İlkin</th>
                          <th className="text-right py-2 text-xs font-semibold text-amber-600">Amortizasiya</th>
                          <th className="text-right py-2 text-xs font-semibold text-emerald-600">Qalıq</th>
                          <th className="text-right py-2 text-xs font-semibold text-violet-600">Bazar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.by_category.map(row => (
                          <tr key={row.category} className="border-b border-slate-50">
                            <td className="py-2 font-medium text-[#3D4F6F]">{row.category}</td>
                            <td className="py-2 text-right">{row.items}</td>
                            <td className="py-2 text-right text-blue-700">{(row.initial_value || 0).toLocaleString()}</td>
                            <td className="py-2 text-right text-amber-700">{(row.accumulated_depreciation || 0).toLocaleString()}</td>
                            <td className="py-2 text-right font-semibold text-emerald-700">{(row.book_value || 0).toLocaleString()}</td>
                            <td className="py-2 text-right text-violet-700">{(row.market_value || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Operational status distribution */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                <h3 className="font-semibold text-[#3D4F6F] mb-3">Əməliyyat statusu üzrə paylama</h3>
                <div className="flex flex-wrap gap-2">
                  {(report.by_operational_status || []).map(s => (
                    <Badge key={s.status} className={`text-sm px-3 py-1 ${opStatusColor(s.status)}`}>
                      {s.status}: <span className="ml-1 font-bold">{s.count}</span>
                    </Badge>
                  ))}
                  {(report.by_operational_status || []).length === 0 && <p className="text-slate-400 text-sm">Məlumat yoxdur</p>}
                </div>
              </div>

              {/* Write-off candidates */}
              {(report.writeoff_candidates || []).length > 0 && (
                <div className="bg-red-50 rounded-xl border border-red-200 p-4" data-testid="inv-writeoff">
                  <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />Silinməyə namizəd ({report.writeoff_candidates.length})
                  </h3>
                  <div className="space-y-1.5">
                    {report.writeoff_candidates.map(c => (
                      <div key={c.id} className="flex items-center justify-between bg-white rounded px-3 py-2 text-xs">
                        <span><span className="font-mono text-slate-500">{c.display_id}</span> · <span className="font-medium">{c.asset_name}</span> · {c.department}</span>
                        <span className="text-slate-500">Qalıq: {c.book_value.toFixed(2)} · Bazar: {c.market_value.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Revaluation candidates */}
              {(report.revaluation_candidates || []).length > 0 && (
                <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4" data-testid="inv-revaluation">
                  <h3 className="font-semibold text-emerald-700 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />Yenidən qiymətləndirmə tövsiyə olunan ({report.revaluation_candidates.length})
                  </h3>
                  <div className="space-y-1.5">
                    {report.revaluation_candidates.map(c => (
                      <div key={c.id} className="flex items-center justify-between bg-white rounded px-3 py-2 text-xs">
                        <span><span className="font-mono text-slate-500">{c.display_id}</span> · <span className="font-medium">{c.asset_name}</span></span>
                        <span className="text-emerald-700 font-semibold">+{c.delta.toFixed(2)} AZN (Qalıq: {c.book_value.toFixed(2)} → Bazar: {c.market_value.toFixed(2)})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={(o) => !o && setShowModal(false)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#3D4F6F]">{editing ? 'İnventarı redaktə et' : 'Yeni inventar əlavə et'}</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Əmlakın bütün məlumatlarını doldurun. * ilə işarələnmiş sahə məcburidir. Mənfi dəyərlərə icazə verilmir.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-5" data-testid="inv-form">
            {/* SECTION 1: Asset info */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Əsas məlumat</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Əmlakın adı *</Label>
                  <Input value={form.asset_name} onChange={e => setForm({ ...form, asset_name: e.target.value })} required data-testid="inv-form-asset-name" />
                </div>
                <div>
                  <Label className="text-xs">Şöbə</Label>
                  <Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} list="inv-dept-list" data-testid="inv-form-department" />
                  <datalist id="inv-dept-list">{uniqueDepartments.map(d => <option key={d} value={d} />)}</datalist>
                </div>
                <div>
                  <Label className="text-xs">Kateqoriya</Label>
                  <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} data-testid="inv-form-category" />
                </div>
                <div>
                  <Label className="text-xs">İnventar kodu</Label>
                  <Input value={form.inventory_code} onChange={e => setForm({ ...form, inventory_code: e.target.value })} data-testid="inv-form-code" />
                </div>
                <div>
                  <Label className="text-xs">Sayı</Label>
                  <Input type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} data-testid="inv-form-quantity" />
                </div>
                <div>
                  <Label className="text-xs">Vəziyyət</Label>
                  <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                    <SelectTrigger data-testid="inv-form-condition"><SelectValue /></SelectTrigger>
                    <SelectContent>{CONDITION_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Məsul şəxs</Label>
                  <Input value={form.responsible_person} onChange={e => setForm({ ...form, responsible_person: e.target.value })} list="inv-resp-list" data-testid="inv-form-responsible" />
                  <datalist id="inv-resp-list">{responsiblePersons.map(p => <option key={p} value={p} />)}</datalist>
                </div>
                <div>
                  <Label className="text-xs">Məkan</Label>
                  <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} data-testid="inv-form-location" />
                </div>
              </div>
            </div>

            {/* SECTION 2: Initial cost */}
            <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2">İlkin dəyər</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Alış qiyməti (AZN)</Label>
                  <Input type="number" min="0" step="0.01" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} data-testid="inv-form-purchase-price" />
                </div>
                <div>
                  <Label className="text-xs">Çatdırılma</Label>
                  <Input type="number" min="0" step="0.01" value={form.delivery_cost} onChange={e => setForm({ ...form, delivery_cost: e.target.value })} data-testid="inv-form-delivery" />
                </div>
                <div>
                  <Label className="text-xs">Gömrük</Label>
                  <Input type="number" min="0" step="0.01" value={form.customs_cost} onChange={e => setForm({ ...form, customs_cost: e.target.value })} data-testid="inv-form-customs" />
                </div>
                <div>
                  <Label className="text-xs">Quraşdırma</Label>
                  <Input type="number" min="0" step="0.01" value={form.installation_cost} onChange={e => setForm({ ...form, installation_cost: e.target.value })} data-testid="inv-form-installation" />
                </div>
                <div>
                  <Label className="text-xs">Digər birbaşa xərclər</Label>
                  <Input type="number" min="0" step="0.01" value={form.other_costs} onChange={e => setForm({ ...form, other_costs: e.target.value })} data-testid="inv-form-other" />
                </div>
                <div className="bg-white rounded-md p-2 border border-blue-200">
                  <Label className="text-xs text-slate-500">Ümumi ilkin dəyər</Label>
                  <p className="text-base font-bold text-blue-700" data-testid="inv-form-total-initial">{formTotalInitial.toLocaleString()} AZN</p>
                </div>
              </div>
            </div>

            {/* SECTION 3: Depreciation & dates */}
            <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-100">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">Amortizasiya və tarixlər</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Alış tarixi</Label>
                  <Input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} data-testid="inv-form-purchase-date" />
                </div>
                <div>
                  <Label className="text-xs">Faydalı istifadə müddəti (il)</Label>
                  <Input type="number" min="0" step="0.5" value={form.useful_life_years} onChange={e => setForm({ ...form, useful_life_years: e.target.value })} data-testid="inv-form-useful-life" />
                </div>
                <div>
                  <Label className="text-xs">Son yoxlanış</Label>
                  <Input type="date" value={form.last_check_date} onChange={e => setForm({ ...form, last_check_date: e.target.value })} data-testid="inv-form-check-date" />
                </div>
              </div>
            </div>

            {/* SECTION 4: Market & operational */}
            <div className="bg-violet-50/50 rounded-lg p-3 border border-violet-100">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-violet-700 mb-2">Bazar dəyəri və əməliyyat</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Təxmini bazar dəyəri (AZN)</Label>
                  <Input type="number" min="0" step="0.01" value={form.market_value} onChange={e => setForm({ ...form, market_value: e.target.value })} data-testid="inv-form-market-value" />
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger data-testid="inv-form-status"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!form.is_operational}
                      onChange={e => setForm({ ...form, is_operational: e.target.checked })}
                      className="w-4 h-4 accent-emerald-600"
                      data-testid="inv-form-is-operational"
                    />
                    <span>İşlək vəziyyətdədir (operational)</span>
                  </label>
                </div>
                <div className="sm:col-span-3">
                  <Label className="text-xs">Qeyd</Label>
                  <Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} data-testid="inv-form-note" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Ləğv et</Button>
              <Button type="submit" className="bg-[#3D4F6F] hover:bg-[#3D4F6F]/90 text-white" disabled={saving} data-testid="inv-form-submit">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? 'Yadda saxla' : 'Əlavə et')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
