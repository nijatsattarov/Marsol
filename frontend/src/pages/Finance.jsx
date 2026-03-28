import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Search, Loader2, TrendingUp, TrendingDown, Filter,
  Wallet, CreditCard, Pencil, Trash2, ChevronDown,
  ArrowDownRight, MessageSquare, X, Save, Check
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Toaster, toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const expenseCategories = [
  { name: 'Əməliyyat xərcləri', subs: ['Əmək haqqı', 'Bonus', 'Ofis icarəsi', 'Kommunal', 'Ofis xərcləri'] },
  { name: 'Marketinq xərcləri', subs: ['Sosial Media reklamı', 'Outdoor reklam', 'Promo materiallar'] },
  { name: 'Layihə xərcləri', subs: ['Məkan icarəsi', 'Texniki avadanlıq', 'Aparıcı', 'Musiqi', 'Çap materialları'] },
  { name: 'Texniki xərclər', subs: ['Hosting', 'Domen', 'Proqram təminatı', 'İT xidmətləri'] },
  { name: 'Satış xərcləri', subs: ['Müştəri görüş xərcləri', 'Hədiyyə'] },
  { name: 'Digər xərclər', subs: ['Cərimələr', 'Hüquqi xidmətlər'] }
];

export default function Finance() {
  const [activeTab, setActiveTab] = useState('overview');
  const [allCompanies, setAllCompanies] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);

  // Expense modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    expense_name: '', category: '', sub_category: '', amount: 0, currency: 'AZN',
    date: new Date().toISOString().split('T')[0], project: '', department: '',
    responsible_person: '', payment_type: '', status: 'Ödənilib'
  });

  // Note modal
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteCompany, setNoteCompany] = useState(null);
  const [noteText, setNoteText] = useState('');

  // Payment edit modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCompany, setPaymentCompany] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ paid_amount: 0, last_payment_date: '' });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ package: '', marsol_representative: '', status: '', project: '' });

  // Projects for expense dropdown
  const [projects, setProjects] = useState([]);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [companiesRes, expensesRes, optionsRes, projectsRes] = await Promise.all([
        axios.get(`${API}/companies`, { headers }),
        axios.get(`${API}/finance/expenses`, { headers }),
        axios.get(`${API}/options/all`, { headers }),
        axios.get(`${API}/settings/projects`, { headers }),
      ]);
      setAllCompanies(companiesRes.data);
      setExpenses(expensesRes.data);
      setOptions(optionsRes.data);
      setProjects(projectsRes.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Summary calculated from companies
  const totalIncome = allCompanies.reduce((s, c) => s + (c.total_amount || 0), 0);
  const totalPaid = allCompanies.reduce((s, c) => s + (c.paid_amount || 0), 0);
  const totalDebt = allCompanies.reduce((s, c) => s + (c.debt_amount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalPaid - totalExpenses;

  // Filtered companies
  const filteredCompanies = allCompanies.filter(c => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const match = c.brand_name?.toLowerCase().includes(term) ||
        c.owner_name?.toLowerCase().includes(term) ||
        c.marsol_representative?.toLowerCase().includes(term);
      if (!match) return false;
    }
    if (filters.package && filters.package !== 'all' && c.package !== filters.package) return false;
    if (filters.marsol_representative && filters.marsol_representative !== 'all' && c.marsol_representative !== filters.marsol_representative) return false;
    if (filters.status && filters.status !== 'all' && c.status !== filters.status) return false;
    if (filters.project && filters.project !== 'all' && c.joined_project !== filters.project) return false;
    return true;
  });

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length;

  // Note handlers
  const openNote = (company) => {
    setNoteCompany(company);
    setNoteText(company.finance_note || '');
    setShowNoteModal(true);
  };

  const saveNote = async () => {
    try {
      await axios.put(`${API}/companies/${noteCompany.id}/finance`, { finance_note: noteText }, { headers });
      toast.success('Qeyd yadda saxlanıldı');
      setShowNoteModal(false);
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  // Payment edit handlers
  const openPaymentEdit = (company) => {
    setPaymentCompany(company);
    setPaymentForm({ paid_amount: company.paid_amount || 0, last_payment_date: company.last_payment_date || '' });
    setShowPaymentModal(true);
  };

  const savePayment = async () => {
    try {
      await axios.put(`${API}/companies/${paymentCompany.id}/finance`, paymentForm, { headers });
      toast.success('Ödəniş məlumatı yeniləndi');
      setShowPaymentModal(false);
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  // Expense handlers
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingExpense) {
        await axios.put(`${API}/finance/expenses/${editingExpense.id}`, expenseForm, { headers });
        toast.success('Xərc yeniləndi');
      } else {
        await axios.post(`${API}/finance/expenses`, expenseForm, { headers });
        toast.success('Xərc əlavə edildi');
      }
      setShowExpenseModal(false);
      setEditingExpense(null);
      resetExpenseForm();
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Bu xərci silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/finance/expenses/${id}`, { headers });
      toast.success('Xərc silindi');
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      expense_name: '', category: '', sub_category: '', amount: 0, currency: 'AZN',
      date: new Date().toISOString().split('T')[0], project: '', department: '',
      responsible_person: '', payment_type: '', status: 'Ödənilib'
    });
  };

  const selectedCategory = expenseCategories.find(c => c.name === expenseForm.category);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="finance-page">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Maliyyə</h1>
          <p className="text-slate-500 text-sm mt-1">Gəlir və xərclərin idarə edilməsi</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { resetExpenseForm(); setEditingExpense(null); setShowExpenseModal(true); }} size="sm" className="bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm" data-testid="add-expense-btn">
            <ArrowDownRight className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Xərc əlavə et</span><span className="sm:hidden">Xərc</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100" data-testid="summary-total-income">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-slate-500">Ümumi gəlir</span>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-lg sm:text-2xl font-bold" style={{ color: '#3D4F6F' }}>{totalIncome.toLocaleString()}</p>
          <p className="text-xs text-slate-400">AZN</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100" data-testid="summary-paid">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-slate-500">Ödənilib</span>
            <CreditCard className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-green-600">{totalPaid.toLocaleString()}</p>
          <p className="text-xs text-slate-400">AZN</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100" data-testid="summary-debt">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-slate-500">Debitor borc</span>
            <Wallet className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-amber-600">{totalDebt.toLocaleString()}</p>
          <p className="text-xs text-slate-400">AZN</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100" data-testid="summary-expenses">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-slate-500">Ümumi xərclər</span>
            <TrendingDown className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-red-600">{totalExpenses.toLocaleString()}</p>
          <p className="text-xs text-slate-400">AZN</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100" data-testid="summary-profit">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-slate-500">Xalis mənfəət</span>
            <TrendingUp className="w-5 h-5 text-[#9ACD32]" />
          </div>
          <p className={`text-lg sm:text-2xl font-bold ${netProfit >= 0 ? 'text-[#9ACD32]' : 'text-red-600'}`}>{netProfit.toLocaleString()}</p>
          <p className="text-xs text-slate-400">AZN</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview" data-testid="tab-overview">İcmal</TabsTrigger>
          <TabsTrigger value="incomes" data-testid="tab-incomes">Gəlirlər ({allCompanies.length})</TabsTrigger>
          <TabsTrigger value="expenses" data-testid="tab-expenses">Xərclər ({expenses.length})</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <h3 className="font-semibold text-[#3D4F6F] mb-4">Borclu şirkətlər</h3>
              {allCompanies.filter(c => (c.debt_amount || 0) > 0).length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">Borclu şirkət yoxdur</p>
              ) : (
                <div className="space-y-3">
                  {allCompanies.filter(c => (c.debt_amount || 0) > 0).sort((a, b) => (b.debt_amount || 0) - (a.debt_amount || 0)).slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm text-slate-700">{c.brand_name}</p>
                        <p className="text-xs text-slate-500">{c.package} - {c.marsol_representative}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">{(c.debt_amount || 0).toLocaleString()} AZN</p>
                        {c.finance_note && <p className="text-xs text-slate-500 max-w-[150px] truncate">{c.finance_note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <h3 className="font-semibold text-[#3D4F6F] mb-4">Son xərclər</h3>
              {expenses.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">Xərc yoxdur</p>
              ) : (
                <div className="space-y-3">
                  {expenses.slice(0, 5).map(exp => (
                    <div key={exp.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm text-slate-700">{exp.expense_name}</p>
                        <p className="text-xs text-slate-500">{exp.category} - {exp.date}</p>
                      </div>
                      <p className="font-bold text-red-600">{(exp.amount || 0).toLocaleString()} AZN</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* INCOMES TAB - Shows all companies */}
        <TabsContent value="incomes">
          {/* Search & Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 sm:p-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Şirkət, sahibkar və ya təmsilçi ilə axtar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-sm"
                  data-testid="finance-search"
                />
              </div>
              <Button
                variant="outline" size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={activeFilterCount > 0 ? 'border-[#9ACD32] bg-[#9ACD32]/10' : ''}
                data-testid="finance-filter-toggle"
              >
                <Filter className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Filtrlər</span>
                {activeFilterCount > 0 && <Badge className="ml-1 bg-[#9ACD32] text-[#3D4F6F] text-xs">{activeFilterCount}</Badge>}
              </Button>
            </div>

            {showFilters && options && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Paket</Label>
                    <Select value={filters.package} onValueChange={(v) => setFilters({ ...filters, package: v })}>
                      <SelectTrigger className="text-sm" data-testid="filter-package"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Hamısı</SelectItem>
                        {options.packages?.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Təmsilçi</Label>
                    <Select value={filters.marsol_representative} onValueChange={(v) => setFilters({ ...filters, marsol_representative: v })}>
                      <SelectTrigger className="text-sm" data-testid="filter-representative"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Hamısı</SelectItem>
                        {options.marsol_representatives?.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Layihə</Label>
                    <Select value={filters.project} onValueChange={(v) => setFilters({ ...filters, project: v })}>
                      <SelectTrigger className="text-sm" data-testid="filter-project"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Hamısı</SelectItem>
                        {options.projects?.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Status</Label>
                    <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                      <SelectTrigger className="text-sm" data-testid="filter-status"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Hamısı</SelectItem>
                        {options.statuses?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setFilters({ package: '', marsol_representative: '', status: '', project: '' })} className="mt-3 text-slate-500 text-xs">
                    <X className="w-3 h-3 mr-1" /> Filtrləri təmizlə
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Companies Finance Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="finance-companies-table">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Şirkət</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Paket</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Təmsilçi</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Müqavilə</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Xitam</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Məbləğ</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Ödənilib</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Borc</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Qeyd</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-8 text-slate-400 text-sm">Şirkət tapılmadı</td></tr>
                  ) : (
                    filteredCompanies.map(c => (
                      <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors" data-testid={`finance-row-${c.id}`}>
                        <td className="px-3 py-3">
                          <p className="font-medium text-sm text-[#3D4F6F]">{c.brand_name}</p>
                          <p className="text-xs text-slate-500">{c.owner_name}</p>
                        </td>
                        <td className="px-3 py-3">
                          <Badge className="bg-[#3D4F6F] text-white text-xs">{c.package}</Badge>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">{c.marsol_representative}</td>
                        <td className="px-3 py-3 text-xs text-slate-600">{c.contract_start_date || '-'}</td>
                        <td className="px-3 py-3 text-xs text-slate-600">{c.contract_end_date || '-'}</td>
                        <td className="px-3 py-3 text-right text-sm font-medium">{(c.total_amount || 0).toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-sm text-green-600">{(c.paid_amount || 0).toLocaleString()}</td>
                        <td className="px-3 py-3 text-right">
                          <span className={`text-sm font-bold ${(c.debt_amount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {(c.debt_amount || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {c.finance_note ? (
                            <button onClick={() => openNote(c)} className="text-left group" data-testid={`note-view-${c.id}`}>
                              <p className="text-xs text-slate-600 max-w-[140px] truncate group-hover:text-[#3D4F6F]">{c.finance_note}</p>
                            </button>
                          ) : (
                            <button onClick={() => openNote(c)} className="text-xs text-slate-400 hover:text-[#3D4F6F]" data-testid={`note-add-${c.id}`}>
                              + Qeyd əlavə et
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openNote(c)} title="Qeyd" data-testid={`note-btn-${c.id}`}>
                              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openPaymentEdit(c)} title="Ödəniş redaktə" data-testid={`payment-edit-${c.id}`}>
                              <Pencil className="w-3.5 h-3.5 text-slate-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredCompanies.length > 0 && (
              <div className="p-3 bg-slate-50 border-t flex flex-wrap gap-4 text-xs text-slate-600">
                <span>Cəmi: <strong>{filteredCompanies.length}</strong> şirkət</span>
                <span>Məbləğ: <strong>{filteredCompanies.reduce((s, c) => s + (c.total_amount || 0), 0).toLocaleString()} AZN</strong></span>
                <span>Ödənilib: <strong className="text-green-600">{filteredCompanies.reduce((s, c) => s + (c.paid_amount || 0), 0).toLocaleString()} AZN</strong></span>
                <span>Borc: <strong className="text-red-600">{filteredCompanies.reduce((s, c) => s + (c.debt_amount || 0), 0).toLocaleString()} AZN</strong></span>
              </div>
            )}
          </div>
        </TabsContent>

        {/* EXPENSES TAB */}
        <TabsContent value="expenses">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="expenses-table">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Xərc adı</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Kateqoriya</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Tarix</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Məbləğ</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Status</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400">Xərc yoxdur</td></tr>
                  ) : (
                    expenses.map(exp => (
                      <tr key={exp.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium">{exp.expense_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{exp.category}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{exp.date}</td>
                        <td className="px-4 py-3 text-sm font-medium text-red-600">{(exp.amount || 0).toLocaleString()} AZN</td>
                        <td className="px-4 py-3"><Badge className="bg-green-100 text-green-700 text-xs">{exp.status}</Badge></td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><ChevronDown className="w-4 h-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditingExpense(exp); setExpenseForm({ ...exp }); setShowExpenseModal(true); }}><Pencil className="w-4 h-4 mr-2" />Redaktə</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteExpense(exp.id)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" />Sil</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Note Modal */}
      <Dialog open={showNoteModal} onOpenChange={setShowNoteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>
              Maliyyə qeydi - {noteCompany?.brand_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs mb-1">Qeyd (ödəniş vəziyyəti, gecikdirmə səbəbi və s.)</Label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full min-h-[120px] p-3 text-sm border rounded-lg resize-none focus:ring-2 focus:ring-[#3D4F6F]/20 focus:border-[#3D4F6F]"
                placeholder="Məsələn: Müştəri martın 15-nə kimi ödəniş edəcəyini bildirdi..."
                data-testid="note-textarea"
              />
            </div>
            {noteCompany && (
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Ümumi məbləğ:</span><span className="font-medium">{(noteCompany.total_amount || 0).toLocaleString()} AZN</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Ödənilib:</span><span className="font-medium text-green-600">{(noteCompany.paid_amount || 0).toLocaleString()} AZN</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Borc:</span><span className="font-bold text-red-600">{(noteCompany.debt_amount || 0).toLocaleString()} AZN</span></div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNoteModal(false)}>Ləğv et</Button>
              <Button onClick={saveNote} className="bg-[#3D4F6F] hover:bg-[#2A364C] text-white" data-testid="save-note-btn">
                <Save className="w-4 h-4 mr-1" />Yadda saxla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Edit Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>
              Ödəniş redaktə - {paymentCompany?.brand_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Ümumi məbləğ (AZN)</Label>
              <Input type="number" value={paymentCompany?.total_amount || 0} disabled className="text-sm bg-slate-50" />
            </div>
            <div>
              <Label className="text-xs">Ödənilən məbləğ (AZN)</Label>
              <Input type="number" value={paymentForm.paid_amount} onChange={(e) => setPaymentForm({ ...paymentForm, paid_amount: parseFloat(e.target.value) || 0 })} className="text-sm" data-testid="payment-amount-input" />
            </div>
            <div>
              <Label className="text-xs">Son ödəniş tarixi</Label>
              <Input type="date" value={paymentForm.last_payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, last_payment_date: e.target.value })} className="text-sm" data-testid="payment-date-input" />
            </div>
            {paymentCompany && (
              <div className="p-3 bg-slate-50 rounded-lg text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Yeni borc:</span>
                  <span className="font-bold text-red-600">{((paymentCompany.total_amount || 0) - (paymentForm.paid_amount || 0)).toLocaleString()} AZN</span>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPaymentModal(false)}>Ləğv et</Button>
              <Button onClick={savePayment} className="bg-green-500 hover:bg-green-600 text-white" data-testid="save-payment-btn">
                <Check className="w-4 h-4 mr-1" />Yadda saxla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expense Modal */}
      <Dialog open={showExpenseModal} onOpenChange={setShowExpenseModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>{editingExpense ? 'Xərci redaktə et' : 'Xərc əlavə et'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleExpenseSubmit} className="space-y-4">
            <div><Label className="text-xs">Xərc adı *</Label><Input value={expenseForm.expense_name} onChange={(e) => setExpenseForm({ ...expenseForm, expense_name: e.target.value })} required className="text-sm" data-testid="expense-name-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Kateqoriya *</Label>
                <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v, sub_category: '' })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{expenseCategories.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Alt kateqoriya</Label>
                <Select value={expenseForm.sub_category} onValueChange={(v) => setExpenseForm({ ...expenseForm, sub_category: v })} disabled={!selectedCategory}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{selectedCategory?.subs.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Məbləğ (AZN) *</Label><Input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })} required className="text-sm" /></div>
              <div><Label className="text-xs">Tarix *</Label><Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} required className="text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Layihə</Label>
                <Select value={expenseForm.project} onValueChange={(v) => setExpenseForm({ ...expenseForm, project: v === "none" ? "" : v })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Seçilməyib</SelectItem>
                    {projects.map(p => <SelectItem key={p.id || p.name} value={p.name}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Məsul şəxs</Label><Input value={expenseForm.responsible_person} onChange={(e) => setExpenseForm({ ...expenseForm, responsible_person: e.target.value })} className="text-sm" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => { setShowExpenseModal(false); setEditingExpense(null); }}>Ləğv et</Button>
              <Button type="submit" className="bg-red-500 hover:bg-red-600 text-white">{editingExpense ? 'Yadda saxla' : 'Əlavə et'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
