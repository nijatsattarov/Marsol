import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, Loader2, Search, Download, Package, BarChart3 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
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
  unit_value: 0,
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
      unit_value: item.unit_value || 0,
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
      const payload = {
        ...form,
        quantity: Number(form.quantity) || 1,
        unit_value: Number(form.unit_value) || 0,
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

  const totalValue = filtered.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_value) || 0), 0);
  const totalQty = filtered.reduce((s, it) => s + (Number(it.quantity) || 0), 0);

  const exportToExcel = () => {
    const rows = filtered.map(it => ({
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
      'Son yoxlanış': it.last_check_date ? formatDate(it.last_check_date) : '',
      'Status': it.status || '',
      'Vahid dəyəri (AZN)': Number(it.unit_value || 0),
      'Toplam dəyər (AZN)': (Number(it.quantity) || 0) * (Number(it.unit_value) || 0),
      'Qeyd': it.note || '',
    }));
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
            {/* Header bar */}
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
              <Badge className="bg-blue-50 text-blue-700">Toplam say: {totalQty}</Badge>
              <Badge className="bg-emerald-50 text-emerald-700">Toplam dəyər: {totalValue.toLocaleString()} AZN</Badge>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
              <p className="text-center text-slate-400 py-10 text-sm">İnventar tapılmadı</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-xs" data-testid="inv-table">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">№</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">Şöbə</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">Əmlakın adı</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">Kateqoriya</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">İnventar kodu</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-[#3D4F6F]">Sayı</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">Vəziyyət</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">Məsul şəxs</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">Məkan</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">Alış tarixi</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">Son yoxlanış</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">Status</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-[#3D4F6F]">Vahid (AZN)</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-emerald-600">Toplam (AZN)</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-[#3D4F6F]">Qeyd</th>
                      {_canEdit && <th className="text-right px-3 py-2.5 font-semibold text-[#3D4F6F]"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(it => {
                      const tot = (Number(it.quantity) || 0) * (Number(it.unit_value) || 0);
                      return (
                        <tr key={it.id} className="border-b border-slate-50 hover:bg-slate-50/60" data-testid={`inv-row-${it.id}`}>
                          <td className="px-3 py-2 font-mono text-[11px]">
                            <Badge className="bg-slate-100 text-slate-700 text-[10px]">{it.display_id}</Badge>
                          </td>
                          <td className="px-3 py-2">{it.department || '—'}</td>
                          <td className="px-3 py-2 font-medium">{it.asset_name}</td>
                          <td className="px-3 py-2">{it.category || '—'}</td>
                          <td className="px-3 py-2 font-mono text-[11px]">{it.inventory_code || '—'}</td>
                          <td className="px-3 py-2 text-right">{it.quantity || 0}</td>
                          <td className="px-3 py-2">{it.condition || '—'}</td>
                          <td className="px-3 py-2">{it.responsible_person || '—'}</td>
                          <td className="px-3 py-2">{it.location || '—'}</td>
                          <td className="px-3 py-2">{it.purchase_date ? formatDate(it.purchase_date) : '—'}</td>
                          <td className="px-3 py-2">{it.last_check_date ? formatDate(it.last_check_date) : '—'}</td>
                          <td className="px-3 py-2">
                            <Badge className={
                              it.status === 'Aktiv' ? 'bg-emerald-50 text-emerald-700'
                              : it.status === 'Silinib' ? 'bg-red-50 text-red-700'
                              : it.status === 'Təmirdə' ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                            }>
                              {it.status || 'Aktiv'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right">{Number(it.unit_value || 0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-700">{tot.toLocaleString()}</td>
                          <td className="px-3 py-2 text-slate-500 max-w-[180px] truncate">{it.note || ''}</td>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100" data-testid="inv-total-items">
                  <p className="text-xs text-slate-500 mb-1">Toplam element</p>
                  <p className="text-2xl font-bold text-[#3D4F6F]">{report.totals?.items || 0}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100" data-testid="inv-total-qty">
                  <p className="text-xs text-slate-500 mb-1">Toplam say</p>
                  <p className="text-2xl font-bold text-blue-600">{report.totals?.quantity || 0}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100" data-testid="inv-total-value">
                  <p className="text-xs text-slate-500 mb-1">Toplam dəyər (AZN)</p>
                  <p className="text-2xl font-bold text-emerald-600">{(report.totals?.value || 0).toLocaleString()}</p>
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
                          <th className="text-right py-2 text-xs font-semibold text-slate-500">Say</th>
                          <th className="text-right py-2 text-xs font-semibold text-emerald-600">Dəyər (AZN)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.by_department.map(row => (
                          <tr key={row.department} className="border-b border-slate-50">
                            <td className="py-2 font-medium text-[#3D4F6F]">{row.department}</td>
                            <td className="py-2 text-right">{row.items}</td>
                            <td className="py-2 text-right">{row.quantity}</td>
                            <td className="py-2 text-right font-semibold text-emerald-700">{(row.value || 0).toLocaleString()}</td>
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
                          <th className="text-right py-2 text-xs font-semibold text-slate-500">Say</th>
                          <th className="text-right py-2 text-xs font-semibold text-emerald-600">Dəyər (AZN)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.by_category.map(row => (
                          <tr key={row.category} className="border-b border-slate-50">
                            <td className="py-2 font-medium text-[#3D4F6F]">{row.category}</td>
                            <td className="py-2 text-right">{row.items}</td>
                            <td className="py-2 text-right">{row.quantity}</td>
                            <td className="py-2 text-right font-semibold text-emerald-700">{(row.value || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* By status */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                <h3 className="font-semibold text-[#3D4F6F] mb-3">Status üzrə paylama</h3>
                <div className="flex flex-wrap gap-2">
                  {(report.by_status || []).map(s => (
                    <Badge key={s.status} className="bg-slate-100 text-slate-700 text-sm px-3 py-1">
                      {s.status}: <span className="ml-1 font-bold text-[#3D4F6F]">{s.count}</span>
                    </Badge>
                  ))}
                  {(report.by_status || []).length === 0 && <p className="text-slate-400 text-sm">Məlumat yoxdur</p>}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={(o) => !o && setShowModal(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#3D4F6F]">{editing ? 'İnventarı redaktə et' : 'Yeni inventar əlavə et'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3" data-testid="inv-form">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Şöbə</Label>
                <Input
                  value={form.department}
                  onChange={e => setForm({ ...form, department: e.target.value })}
                  list="inv-dept-list"
                  placeholder="məs. İT, Mühasibatlıq"
                  data-testid="inv-form-department"
                />
                <datalist id="inv-dept-list">
                  {uniqueDepartments.map(d => <option key={d} value={d} />)}
                </datalist>
              </div>
              <div>
                <Label className="text-xs">Əmlakın adı *</Label>
                <Input
                  value={form.asset_name}
                  onChange={e => setForm({ ...form, asset_name: e.target.value })}
                  required
                  data-testid="inv-form-asset-name"
                />
              </div>
              <div>
                <Label className="text-xs">Kateqoriya</Label>
                <Input
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  placeholder="məs. Kompüter, Mebel"
                  data-testid="inv-form-category"
                />
              </div>
              <div>
                <Label className="text-xs">İnventar kodu</Label>
                <Input
                  value={form.inventory_code}
                  onChange={e => setForm({ ...form, inventory_code: e.target.value })}
                  data-testid="inv-form-code"
                />
              </div>
              <div>
                <Label className="text-xs">Sayı</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value })}
                  data-testid="inv-form-quantity"
                />
              </div>
              <div>
                <Label className="text-xs">Vahid dəyəri (AZN)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unit_value}
                  onChange={e => setForm({ ...form, unit_value: e.target.value })}
                  data-testid="inv-form-unit-value"
                />
              </div>
              <div>
                <Label className="text-xs">Vəziyyət</Label>
                <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                  <SelectTrigger data-testid="inv-form-condition"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger data-testid="inv-form-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Məsul şəxs</Label>
                <Input
                  value={form.responsible_person}
                  onChange={e => setForm({ ...form, responsible_person: e.target.value })}
                  list="inv-resp-list"
                  data-testid="inv-form-responsible"
                />
                <datalist id="inv-resp-list">
                  {responsiblePersons.map(p => <option key={p} value={p} />)}
                </datalist>
              </div>
              <div>
                <Label className="text-xs">Məkan</Label>
                <Input
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="məs. Ofis 201"
                  data-testid="inv-form-location"
                />
              </div>
              <div>
                <Label className="text-xs">Alış tarixi</Label>
                <Input
                  type="date"
                  value={form.purchase_date}
                  onChange={e => setForm({ ...form, purchase_date: e.target.value })}
                  data-testid="inv-form-purchase-date"
                />
              </div>
              <div>
                <Label className="text-xs">Son yoxlanış tarixi</Label>
                <Input
                  type="date"
                  value={form.last_check_date}
                  onChange={e => setForm({ ...form, last_check_date: e.target.value })}
                  data-testid="inv-form-check-date"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Qeyd</Label>
                <Input
                  value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  data-testid="inv-form-note"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
                Ləğv et
              </Button>
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
