import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Search, Loader2, TrendingUp, TrendingDown, Filter,
  Wallet, CreditCard, Pencil, Trash2, ChevronDown,
  ArrowDownRight, MessageSquare, X, Save, Check, Download
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
import * as XLSX from 'xlsx';
import { usePermissions, canEdit } from '../context/PermissionContext';
import { formatDate } from '../lib/dateUtils';

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
  const [marsolCompanies, setMarsolCompanies] = useState([]);
  const [responsiblePersons, setResponsiblePersons] = useState([]);
  const [loading, setLoading] = useState(true);

  // Expense modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    expense_name: '', category: '', sub_category: '', amount: 0, currency: 'AZN',
    date: new Date().toISOString().split('T')[0], project: '', department: '',
    responsible_person: '', payment_method: '', status: 'Ödənilib', marsol_company: ''
  });

  // Note modal
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteCompany, setNoteCompany] = useState(null);
  const [noteText, setNoteText] = useState('');

  // Payment edit modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCompany, setPaymentCompany] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    new_payment_amount: '', payment_date: '', payment_note: '', payment_method: '',
    finance_contract_number: '', payment_due_date: '', voen: '',
    e_invoice_date: '', e_invoice_number: '', follow_up: '', marsol_company: ''
  });
  const [paymentHistory, setPaymentHistory] = useState([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ package: '', marsol_representative: '', status: '', project: '', marsol_company: '' });
  const [expenseMarsolFilter, setExpenseMarsolFilter] = useState('all');

  // Projects for expense dropdown
  const [projects, setProjects] = useState([]);
  // Finance-project-view
  const [projectEvents, setProjectEvents] = useState([]);
  const [selectedProjectType, setSelectedProjectType] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectSales, setProjectSales] = useState([]);
  const [editingSale, setEditingSale] = useState(null);
  const [saleSearch, setSaleSearch] = useState('');
  const [showSaleFilters, setShowSaleFilters] = useState(false);
  const [saleFilters, setSaleFilters] = useState({});
  const [salePaymentForm, setSalePaymentForm] = useState({});
  const [salePaymentHistory, setSalePaymentHistory] = useState([]);

  const token = localStorage.getItem('token');
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'finance');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [companiesRes, expensesRes, optionsRes, projectsRes, eventsRes, marsolRes, employeesRes, usersRes] = await Promise.all([
        axios.get(`${API}/companies`, { headers }),
        axios.get(`${API}/finance/expenses`, { headers }),
        axios.get(`${API}/options/all`, { headers }),
        axios.get(`${API}/settings/projects`, { headers }),
        axios.get(`${API}/project-events`, { headers }),
        axios.get(`${API}/settings/marsol-companies`, { headers }),
        axios.get(`${API}/employees`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/settings/users`, { headers }).catch(() => ({ data: [] })),
      ]);
      setAllCompanies(companiesRes.data);
      setExpenses(expensesRes.data);
      setOptions(optionsRes.data);
      setProjects(projectsRes.data);
      setProjectEvents(eventsRes.data || []);
      setMarsolCompanies(marsolRes.data || []);
      // Build a unique list of system users + active employees for "Məsul şəxs" dropdowns
      const names = new Set();
      (usersRes.data || []).filter(u => (u.status || 'Aktiv') === 'Aktiv' && u.name).forEach(u => names.add(u.name));
      (employeesRes.data || []).forEach(e => {
        const full = `${e.first_name || ''} ${e.last_name || ''}`.trim();
        if (full) names.add(full);
      });
      setResponsiblePersons([...names].sort());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load sales when a project is selected in finance view
  useEffect(() => {
    if (!selectedProjectId) { setProjectSales([]); return; }
    (async () => {
      try {
        const res = await axios.get(`${API}/project-events/${selectedProjectId}/sales`, { headers });
        setProjectSales(res.data.sales || []);
      } catch { setProjectSales([]); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const saveProjectSale = async () => {
    if (!editingSale) return;
    try {
      const payload = { ...salePaymentForm };
      if (payload.new_payment_amount && parseFloat(payload.new_payment_amount) > 0) {
        // payment add — server will append + update paid_amount
      } else {
        delete payload.new_payment_amount;
        delete payload.payment_date;
        delete payload.payment_note;
      }
      await axios.post(`${API}/sales-leads/${editingSale.id}/payment`, payload, { headers });
      toast.success('Yadda saxlandı');
      setEditingSale(null);
      const res = await axios.get(`${API}/project-events/${selectedProjectId}/sales`, { headers });
      setProjectSales(res.data.sales || []);
    } catch(e) { toast.error(e.response?.data?.detail || 'Xəta baş verdi'); }
  };

  const openSalePayment = async (sale) => {
    setEditingSale(sale);
    setSalePaymentForm({
      new_payment_amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_note: '',
      payment_method: '',
      contract_number: sale.contract_number || '',
      payment_due_date: sale.payment_due_date || '',
      voen: sale.voen || '',
      e_invoice_date: sale.e_invoice_date || '',
      e_invoice_number: sale.e_invoice_number || '',
      follow_up: sale.follow_up || '',
      notes: sale.notes || '',
      marsol_company: sale.marsol_company || ''
    });
    try {
      const res = await axios.get(`${API}/sales-leads/${sale.id}/payments`, { headers });
      setSalePaymentHistory(res.data || []);
    } catch { setSalePaymentHistory([]); }
  };

  // Search + filter applied to projectSales
  const filteredSales = projectSales.filter(s => {
    const term = saleSearch.trim().toLowerCase();
    if (term) {
      const hay = [s.company_name, s.contact_name, s.phone, s.email, s.lead_code, s.stand_number, s.contract_number].map(x => (x || '').toLowerCase()).join(' ');
      if (!hay.includes(term)) return false;
    }
    for (const [k, v] of Object.entries(saleFilters)) {
      if (!v) continue;
      const cell = (s[k] ?? '').toString().toLowerCase();
      if (!cell.includes(v.toLowerCase())) return false;
    }
    return true;
  });
  const saleActiveFilterCount = Object.values(saleFilters).filter(v => v && v.trim()).length;

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
    if (filters.marsol_company && filters.marsol_company !== 'all' && (c.marsol_company || '') !== filters.marsol_company) return false;
    return true;
  });

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length;

  // Filtered expenses (by Marsol entity)
  const filteredExpenses = expenses.filter(e =>
    expenseMarsolFilter === 'all' || (e.marsol_company || '') === expenseMarsolFilter
  );

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
  const openPaymentEdit = async (company) => {
    setPaymentCompany(company);
    setPaymentForm({
      new_payment_amount: '', payment_date: new Date().toISOString().split('T')[0], payment_note: '', payment_method: '',
      finance_contract_number: company.finance_contract_number || '',
      payment_due_date: company.payment_due_date || '',
      voen: company.voen || '',
      e_invoice_date: company.e_invoice_date || '',
      e_invoice_number: company.e_invoice_number || '',
      follow_up: company.follow_up || '',
      marsol_company: company.marsol_company || ''
    });
    try {
      const res = await axios.get(`${API}/companies/${company.id}/payments`, { headers });
      setPaymentHistory(res.data);
    } catch { setPaymentHistory([]); }
    setShowPaymentModal(true);
  };

  const savePayment = async () => {
    try {
      const payload = { ...paymentForm };
      // If no new payment amount, skip the payment-specific fields
      if (!payload.new_payment_amount || parseFloat(payload.new_payment_amount) <= 0) {
        delete payload.new_payment_amount;
        delete payload.payment_date;
        delete payload.payment_note;
      }
      await axios.put(`${API}/companies/${paymentCompany.id}/finance`, payload, { headers });
      toast.success('Yadda saxlandı');
      setShowPaymentModal(false);
      fetchData();
    } catch(e) { toast.error(e.response?.data?.detail || 'Xəta baş verdi'); }
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
      responsible_person: '', payment_method: '', status: 'Ödənilib', marsol_company: ''
    });
  };

  const selectedCategory = expenseCategories.find(c => c.name === expenseForm.category);

  const exportFinanceToExcel = () => {
    const wb = XLSX.utils.book_new();
    // Sheet 1 - Gəlirlər (Şirkət ödənişləri)
    const incomeData = filteredCompanies.map((c, i) => ({
      '№': i + 1,
      'Şirkət': c.brand_name || '',
      'Sahibkar': c.owner_name || '',
      'Paket': c.package || '',
      'Kurator': c.marsol_representative || '',
      'Ümumi məbləğ': c.total_amount || 0,
      'Ödənilib': c.paid_amount || 0,
      'Borc': c.debt_amount || 0,
      'Son ödəniş tarixi': c.last_payment_date || '',
      'Müəssisə': c.marsol_company || '',
      'Status': c.status || '',
      'Qeyd': c.finance_note || '',
    }));
    const ws1 = XLSX.utils.json_to_sheet(incomeData);
    ws1['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 18 },
      { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 10 }, { wch: 25 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Gəlirlər');

    // Sheet 2 - Xərclər
    const expenseData = expenses.map((e, i) => ({
      '№': i + 1,
      'Xərc adı': e.expense_name || '',
      'Kateqoriya': e.category || '',
      'Alt kateqoriya': e.sub_category || '',
      'Məbləğ': e.amount || 0,
      'Valyuta': e.currency || 'AZN',
      'Tarix': e.date || '',
      'Layihə': e.project || '',
      'Şöbə': e.department || '',
      'Məsul şəxs': e.responsible_person || '',
      'Ödəniş üsulu': e.payment_method || e.payment_type || '',
      'Müəssisə': e.marsol_company || '',
      'Status': e.status || '',
    }));
    const ws2 = XLSX.utils.json_to_sheet(expenseData);
    ws2['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 12 },
      { wch: 8 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, 'Xərclər');

    // Sheet 3 - İcmal
    const summaryData = [
      { 'Göstərici': 'Ümumi gəlir', 'Məbləğ (AZN)': totalIncome },
      { 'Göstərici': 'Ödənilib', 'Məbləğ (AZN)': totalPaid },
      { 'Göstərici': 'Debitor borc', 'Məbləğ (AZN)': totalDebt },
      { 'Göstərici': 'Ümumi xərclər', 'Məbləğ (AZN)': totalExpenses },
      { 'Göstərici': 'Xalis mənfəət', 'Məbləğ (AZN)': netProfit },
    ];
    const ws3 = XLSX.utils.json_to_sheet(summaryData);
    ws3['!cols'] = [{ wch: 20 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'İcmal');

    XLSX.writeFile(wb, `maliyye_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel faylı yükləndi');
  };

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
          <Button variant="outline" size="sm" onClick={exportFinanceToExcel} className="text-xs sm:text-sm" data-testid="export-finance-btn">
            <Download className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Excel Export</span>
          </Button>
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
          <TabsTrigger value="projects" data-testid="tab-projects">Layihələr</TabsTrigger>
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
                        <p className="text-xs text-slate-500">{exp.category} - {formatDate(exp.date)}</p>
                      </div>
                      <p className="font-bold text-red-600">{(exp.amount || 0).toLocaleString()} AZN</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* MÜƏSSİSƏYƏ GÖRƏ İCMAL */}
          {marsolCompanies.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mt-4" data-testid="marsol-summary">
              <h3 className="font-semibold text-[#3D4F6F] mb-3">Müəssisəyə görə icmal</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-xs font-semibold text-slate-500">Müəssisə</th>
                      <th className="text-right py-2 text-xs font-semibold text-green-600">Gəlir (Ödənilib)</th>
                      <th className="text-right py-2 text-xs font-semibold text-amber-600">Borc</th>
                      <th className="text-right py-2 text-xs font-semibold text-red-600">Xərc</th>
                      <th className="text-right py-2 text-xs font-semibold text-[#3D4F6F]">Xalis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...marsolCompanies.map(m => m.name), ''].map(name => {
                      const cs = allCompanies.filter(c => (c.marsol_company || '') === name);
                      const exps = expenses.filter(e => (e.marsol_company || '') === name);
                      if (cs.length === 0 && exps.length === 0) return null;
                      const paid = cs.reduce((s, c) => s + (c.paid_amount || 0), 0);
                      const debt = cs.reduce((s, c) => s + (c.debt_amount || 0), 0);
                      const exp = exps.reduce((s, e) => s + (e.amount || 0), 0);
                      const net = paid - exp;
                      return (
                        <tr key={name || 'unassigned'} className="border-b border-slate-50" data-testid={`marsol-row-${name || 'unassigned'}`}>
                          <td className="py-2 font-medium text-[#3D4F6F]">{name || <span className="text-slate-400 italic">Müəssisə təyin edilməyib</span>}</td>
                          <td className="py-2 text-right text-green-600 font-semibold">{paid.toLocaleString()} AZN</td>
                          <td className="py-2 text-right text-amber-600">{debt.toLocaleString()} AZN</td>
                          <td className="py-2 text-right text-red-600">{exp.toLocaleString()} AZN</td>
                          <td className={`py-2 text-right font-bold ${net >= 0 ? 'text-[#9ACD32]' : 'text-red-600'}`}>{net.toLocaleString()} AZN</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Müəssisə</Label>
                    <Select value={filters.marsol_company || 'all'} onValueChange={(v) => setFilters({ ...filters, marsol_company: v })}>
                      <SelectTrigger className="text-sm" data-testid="filter-marsol-company"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Hamısı</SelectItem>
                        {(options.marsol_companies || []).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setFilters({ package: '', marsol_representative: '', status: '', project: '', marsol_company: '' })} className="mt-3 text-slate-500 text-xs">
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
                    <th className="text-left px-2 py-3 text-[11px] font-semibold text-[#3D4F6F]">ID</th>
                    <th className="text-left px-2 py-3 text-[11px] font-semibold text-[#3D4F6F]">Şirkət</th>
                    <th className="text-left px-2 py-3 text-[11px] font-semibold text-[#3D4F6F]">Paket</th>
                    <th className="text-left px-2 py-3 text-[11px] font-semibold text-[#3D4F6F]">Müqavilə №</th>
                    <th className="text-center px-2 py-3 text-[11px] font-semibold text-[#3D4F6F]">Gün sayı</th>
                    <th className="text-left px-2 py-3 text-[11px] font-semibold text-[#3D4F6F]">Ödənilməli</th>
                    <th className="text-left px-2 py-3 text-[11px] font-semibold text-[#3D4F6F]">VÖEN</th>
                    <th className="text-left px-2 py-3 text-[11px] font-semibold text-[#3D4F6F]">E-qaimə tarixi</th>
                    <th className="text-left px-2 py-3 text-[11px] font-semibold text-[#3D4F6F]">Nömrə</th>
                    <th className="text-right px-2 py-3 text-[11px] font-semibold text-[#3D4F6F]">Məbləğ</th>
                    <th className="text-right px-2 py-3 text-[11px] font-semibold text-[#3D4F6F]">Ödənilib</th>
                    <th className="text-right px-2 py-3 text-[11px] font-semibold text-[#3D4F6F]">Borc</th>
                    <th className="text-left px-2 py-3 text-[11px] font-semibold text-[#3D4F6F]">Təqib</th>
                    <th className="text-right px-2 py-3 text-[11px] font-semibold text-[#3D4F6F]"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.length === 0 ? (
                    <tr><td colSpan={14} className="text-center py-8 text-slate-400 text-sm">Şirkət tapılmadı</td></tr>
                  ) : (
                    filteredCompanies.map(c => {
                      const today = new Date().toISOString().split('T')[0];
                      const isOverdue = c.payment_due_date && c.payment_due_date < today && (c.debt_amount || 0) > 0;
                      return (
                      <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors" data-testid={`finance-row-${c.id}`}>
                        <td className="px-2 py-2"><Badge className="bg-slate-100 text-slate-700 text-[10px] font-mono">{c.finance_id || '—'}</Badge></td>
                        <td className="px-2 py-2">
                          <p className="font-medium text-xs text-[#3D4F6F]">{c.brand_name}</p>
                          <p className="text-[10px] text-slate-500">{c.owner_name}</p>
                        </td>
                        <td className="px-2 py-2"><Badge className="bg-[#3D4F6F] text-white text-[10px]">{c.package}</Badge></td>
                        <td className="px-2 py-2 text-xs text-slate-600 font-mono">{c.finance_contract_number || '—'}</td>
                        <td className="px-2 py-2 text-xs text-center">{c.contract_days != null ? <Badge className="bg-blue-50 text-blue-700 text-[10px]">{c.contract_days} gün</Badge> : '—'}</td>
                        <td className={`px-2 py-2 text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>{c.payment_due_date ? formatDate(c.payment_due_date) : '—'}</td>
                        <td className="px-2 py-2 text-xs text-slate-600 font-mono">{c.voen || '—'}</td>
                        <td className="px-2 py-2 text-xs text-slate-600">{c.e_invoice_date || '—'}</td>
                        <td className="px-2 py-2 text-xs text-slate-600 font-mono">{c.e_invoice_number || '—'}</td>
                        <td className="px-2 py-2 text-right text-xs font-medium">{(c.total_amount || 0).toLocaleString()}</td>
                        <td className="px-2 py-2 text-right text-xs text-green-600">{(c.paid_amount || 0).toLocaleString()}</td>
                        <td className="px-2 py-2 text-right">
                          <span className={`text-xs font-bold ${(c.debt_amount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {(c.debt_amount || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-xs text-slate-500 max-w-[120px] truncate" title={c.follow_up}>{c.follow_up || '—'}</td>
                        <td className="px-2 py-2 text-right">
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
                      );
                    })
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 mb-3 flex items-center gap-3 flex-wrap">
            <Label className="text-xs whitespace-nowrap">Müəssisə filteri:</Label>
            <Select value={expenseMarsolFilter} onValueChange={setExpenseMarsolFilter}>
              <SelectTrigger className="text-sm w-[220px]" data-testid="expense-marsol-filter"><SelectValue placeholder="Hamısı" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hamısı</SelectItem>
                {marsolCompanies.map(m => <SelectItem key={m.id || m.name} value={m.name}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {expenseMarsolFilter !== 'all' && (
              <span className="text-xs text-slate-500">
                {filteredExpenses.length} qeyd · Cəmi: <strong className="text-red-600">{filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0).toLocaleString()} AZN</strong>
              </span>
            )}
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="expenses-table">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Xərc adı</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Kateqoriya</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Tarix</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Məbləğ</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Ödəniş üsulu</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Müəssisə</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Status</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-slate-400">Xərc yoxdur</td></tr>
                  ) : (
                    filteredExpenses.map(exp => (
                      <tr key={exp.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium">{exp.expense_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{exp.category}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{formatDate(exp.date)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-red-600">{(exp.amount || 0).toLocaleString()} AZN</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{exp.payment_method || exp.payment_type || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{exp.marsol_company || '—'}</td>
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

        {/* ====== PROJECTS TAB ====== */}
        <TabsContent value="projects">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6" data-testid="finance-projects-tab">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1">
                <Label className="text-xs">Layihə növü</Label>
                <Select value={selectedProjectType} onValueChange={(v) => { setSelectedProjectType(v); setSelectedProjectId(''); }}>
                  <SelectTrigger className="text-sm" data-testid="finance-projtype-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedProjectType && (
              <div className="mb-4">
                <Label className="text-xs mb-2 block">Layihələr</Label>
                <div className="flex flex-wrap gap-2">
                  {projectEvents.filter(e => e.type === selectedProjectType).map(e => (
                    <button
                      key={e.id}
                      onClick={() => setSelectedProjectId(e.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${selectedProjectId === e.id ? 'bg-[#3D4F6F] text-white border-[#3D4F6F]' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                      data-testid={`finance-project-tab-${e.id}`}
                    >
                      {e.name} <span className="opacity-60 ml-1">({e.status})</span>
                    </button>
                  ))}
                  {projectEvents.filter(e => e.type === selectedProjectType).length === 0 && (
                    <p className="text-xs text-slate-400">Bu növdə layihə yoxdur</p>
                  )}
                </div>
              </div>
            )}

            {selectedProjectId && (
              <div className="border-t pt-4">
                {/* Search + Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder="Axtar (şirkət, sahibkar, telefon, müqavilə №)..." value={saleSearch} onChange={e => setSaleSearch(e.target.value)} className="pl-10 text-sm" data-testid="finance-sales-search" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowSaleFilters(!showSaleFilters)} className={saleActiveFilterCount > 0 ? 'border-[#9ACD32] bg-[#9ACD32]/10' : ''} data-testid="finance-sales-filter-toggle">
                    <Filter className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Filtrlər</span>
                    {saleActiveFilterCount > 0 && <Badge className="ml-1 bg-[#9ACD32] text-[#3D4F6F] text-xs">{saleActiveFilterCount}</Badge>}
                  </Button>
                </div>
                {showSaleFilters && (
                  <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(selectedProjectType === 'Sərgi'
                        ? [['company_name', 'Şirkət'], ['contract_number', 'Müqavilə №'], ['e_invoice_number', 'E-qaimə'], ['stand_number', 'Stend №']]
                        : [['company_name', 'Şirkət'], ['contract_number', 'Müqavilə №'], ['phone', 'Telefon']]
                      ).map(([k, label]) => (
                        <div key={k}>
                          <Label className="text-xs text-slate-500 mb-1 block">{label}</Label>
                          <Input value={saleFilters[k] || ''} onChange={e => setSaleFilters({ ...saleFilters, [k]: e.target.value })} className="text-sm h-8" placeholder={label} data-testid={`finance-filter-${k}`} />
                        </div>
                      ))}
                    </div>
                    {saleActiveFilterCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setSaleFilters({})} className="mt-2 text-slate-500 text-xs"><X className="w-3 h-3 mr-1" />Filtrləri təmizlə</Button>
                    )}
                  </div>
                )}

                {filteredSales.length === 0 ? (
                  <p className="text-center text-slate-400 py-8 text-sm">Satış yoxdur</p>
                ) : selectedProjectType === 'Sərgi' ? (
                  <div className="overflow-x-auto bg-white rounded-lg border border-slate-100">
                    <table className="w-full" data-testid="finance-sales-table">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#3D4F6F]">ID</th>
                          <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#3D4F6F]">Şirkət</th>
                          <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#3D4F6F]">Müqavilə №</th>
                          <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#3D4F6F]">E-qaimə</th>
                          <th className="text-right px-3 py-3 text-[11px] font-semibold text-[#3D4F6F]">kv/m</th>
                          <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#3D4F6F]">Stend №</th>
                          <th className="text-right px-3 py-3 text-[11px] font-semibold text-[#3D4F6F]">Məbləğ</th>
                          <th className="text-right px-3 py-3 text-[11px] font-semibold text-emerald-600">Ödənilib</th>
                          <th className="text-right px-3 py-3 text-[11px] font-semibold text-red-500">Borc</th>
                          <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#3D4F6F]">Qeyd</th>
                          <th className="text-right px-3 py-3 text-[11px] font-semibold text-[#3D4F6F]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSales.map(s => {
                          const total = Number(s.total_amount) || 0;
                          const paid = Number(s.paid_amount) || 0;
                          const debt = Math.max(total - paid, 0);
                          return (
                            <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50" data-testid={`finance-sale-row-${s.id}`}>
                              <td className="px-3 py-2 text-xs"><Badge className="bg-slate-100 text-slate-700 text-[10px] font-mono">{s.lead_code}</Badge></td>
                              <td className="px-3 py-2 text-xs font-medium">{s.company_name}</td>
                              <td className="px-3 py-2 text-xs">{s.contract_number || '—'}</td>
                              <td className="px-3 py-2 text-xs">{s.e_invoice_number || '—'}</td>
                              <td className="px-3 py-2 text-xs text-right">{s.kv_m ?? '—'}</td>
                              <td className="px-3 py-2 text-xs">{s.stand_number || '—'}</td>
                              <td className="px-3 py-2 text-xs text-right font-semibold">{total.toLocaleString()}</td>
                              <td className="px-3 py-2 text-xs text-right text-emerald-600 font-medium">{paid.toLocaleString()}</td>
                              <td className="px-3 py-2 text-xs text-right text-red-500 font-medium">{debt.toLocaleString()}</td>
                              <td className="px-3 py-2 text-xs text-slate-500 max-w-[160px] truncate">{s.notes || ''}</td>
                              <td className="px-3 py-2 text-right">{_canEdit && <Button variant="ghost" size="sm" onClick={() => openSalePayment(s)} title="Ödəniş redaktə" data-testid={`finance-edit-sale-${s.id}`}><Pencil className="w-3.5 h-3.5 text-[#3D4F6F]" /></Button>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-white rounded-lg border border-slate-100">
                    <table className="w-full" data-testid="finance-sales-table-simple">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#3D4F6F]">ID</th>
                          <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#3D4F6F]">Şirkət</th>
                          <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#3D4F6F]">Müqavilə №</th>
                          <th className="text-right px-3 py-3 text-[11px] font-semibold text-[#3D4F6F]">Məbləğ</th>
                          <th className="text-right px-3 py-3 text-[11px] font-semibold text-emerald-600">Ödənilib</th>
                          <th className="text-right px-3 py-3 text-[11px] font-semibold text-red-500">Borc</th>
                          <th className="text-left px-3 py-3 text-[11px] font-semibold text-[#3D4F6F]">Qeyd</th>
                          <th className="text-right px-3 py-3 text-[11px] font-semibold text-[#3D4F6F]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSales.map(s => {
                          const total = Number(s.total_amount) || 0;
                          const paid = Number(s.paid_amount) || 0;
                          const debt = Math.max(total - paid, 0);
                          return (
                            <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50" data-testid={`finance-sale-row-${s.id}`}>
                              <td className="px-3 py-2 text-xs"><Badge className="bg-slate-100 text-slate-700 text-[10px] font-mono">{s.lead_code}</Badge></td>
                              <td className="px-3 py-2 text-xs font-medium">{s.company_name}</td>
                              <td className="px-3 py-2 text-xs">{s.contract_number || '—'}</td>
                              <td className="px-3 py-2 text-xs text-right font-semibold">{total.toLocaleString()}</td>
                              <td className="px-3 py-2 text-xs text-right text-emerald-600 font-medium">{paid.toLocaleString()}</td>
                              <td className="px-3 py-2 text-xs text-right text-red-500 font-medium">{debt.toLocaleString()}</td>
                              <td className="px-3 py-2 text-xs text-slate-500 max-w-[160px] truncate">{s.notes || ''}</td>
                              <td className="px-3 py-2 text-right">{_canEdit && <Button variant="ghost" size="sm" onClick={() => openSalePayment(s)} title="Ödəniş redaktə" data-testid={`finance-edit-sale-${s.id}`}><Pencil className="w-3.5 h-3.5 text-[#3D4F6F]" /></Button>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Finance sale payment modal */}
      <Dialog open={!!editingSale} onOpenChange={(o) => !o && setEditingSale(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-[#3D4F6F]">Ödəniş redaktə — {editingSale?.company_name}</DialogTitle></DialogHeader>
          {editingSale && (
            <div className="space-y-4">
              {/* Summary banner */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-lg text-center">
                <div><p className="text-[10px] text-slate-500">Ümumi</p><p className="text-sm font-bold text-[#3D4F6F]">{(Number(editingSale.total_amount) || 0).toLocaleString()} AZN</p></div>
                <div><p className="text-[10px] text-slate-500">Ödənilib</p><p className="text-sm font-bold text-emerald-600">{(Number(editingSale.paid_amount) || 0).toLocaleString()} AZN</p></div>
                <div><p className="text-[10px] text-slate-500">Borc</p><p className="text-sm font-bold text-red-500">{Math.max((Number(editingSale.total_amount) || 0) - (Number(editingSale.paid_amount) || 0), 0).toLocaleString()} AZN</p></div>
              </div>

              {/* New payment */}
              <div className="p-3 border rounded-lg">
                <p className="text-xs font-semibold text-[#3D4F6F] mb-3">Yeni Ödəniş</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Məbləğ (AZN)</Label><Input type="number" value={salePaymentForm.new_payment_amount || ''} onChange={e => setSalePaymentForm({ ...salePaymentForm, new_payment_amount: e.target.value })} className="text-sm" placeholder="0" data-testid="finance-sale-payment-amount" /></div>
                  <div><Label className="text-xs">Tarix</Label><Input type="date" value={salePaymentForm.payment_date || ''} onChange={e => setSalePaymentForm({ ...salePaymentForm, payment_date: e.target.value })} className="text-sm" data-testid="finance-sale-payment-date" /></div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Qeyd</Label><Input value={salePaymentForm.payment_note || ''} onChange={e => setSalePaymentForm({ ...salePaymentForm, payment_note: e.target.value })} className="text-sm" placeholder="Ödəniş qeydi" /></div>
                  <div>
                    <Label className="text-xs">Ödəniş üsulu</Label>
                    <Select value={salePaymentForm.payment_method || 'none'} onValueChange={(v) => setSalePaymentForm({ ...salePaymentForm, payment_method: v === 'none' ? '' : v })}>
                      <SelectTrigger className="text-sm" data-testid="sale-payment-method"><SelectValue placeholder="Seçin" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Seçilməyib</SelectItem>
                        <SelectItem value="Köçürmə">Köçürmə</SelectItem>
                        <SelectItem value="Nəğd">Nəğd</SelectItem>
                        <SelectItem value="Posterminal">Posterminal</SelectItem>
                        <SelectItem value="CTC">CTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Finance metadata */}
              <div className="p-3 border rounded-lg">
                <p className="text-xs font-semibold text-[#3D4F6F] mb-3">Maliyyə Məlumatları</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Müqavilə №</Label><Input value={salePaymentForm.contract_number || ''} onChange={e => setSalePaymentForm({ ...salePaymentForm, contract_number: e.target.value })} className="text-sm" placeholder="MQ-2026-001" data-testid="finance-sale-contract" /></div>
                  <div><Label className="text-xs">Ödəniş tarixi</Label><Input type="date" value={salePaymentForm.payment_due_date || ''} onChange={e => setSalePaymentForm({ ...salePaymentForm, payment_due_date: e.target.value })} className="text-sm" data-testid="finance-sale-due" /></div>
                  <div><Label className="text-xs">VÖEN</Label><Input value={salePaymentForm.voen || ''} onChange={e => setSalePaymentForm({ ...salePaymentForm, voen: e.target.value })} className="text-sm" placeholder="1234567890" /></div>
                  <div><Label className="text-xs">E-qaimə tarixi</Label><Input type="date" value={salePaymentForm.e_invoice_date || ''} onChange={e => setSalePaymentForm({ ...salePaymentForm, e_invoice_date: e.target.value })} className="text-sm" /></div>
                  <div><Label className="text-xs">E-qaimə №</Label><Input value={salePaymentForm.e_invoice_number || ''} onChange={e => setSalePaymentForm({ ...salePaymentForm, e_invoice_number: e.target.value })} className="text-sm" placeholder="EQN123456" data-testid="finance-sale-einvoice" /></div>
                  <div><Label className="text-xs">Follow-up</Label><Input value={salePaymentForm.follow_up || ''} onChange={e => setSalePaymentForm({ ...salePaymentForm, follow_up: e.target.value })} className="text-sm" placeholder="Zəng, email..." /></div>
                  <div>
                    <Label className="text-xs">Marsol müəssisəsi</Label>
                    <Select value={salePaymentForm.marsol_company || 'none'} onValueChange={(v) => setSalePaymentForm({ ...salePaymentForm, marsol_company: v === 'none' ? '' : v })}>
                      <SelectTrigger className="text-sm" data-testid="sale-marsol-company"><SelectValue placeholder="Seçin" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Seçilməyib</SelectItem>
                        {marsolCompanies.map(m => <SelectItem key={m.id || m.name} value={m.name}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-2"><Label className="text-xs">Qeyd</Label><textarea value={salePaymentForm.notes || ''} onChange={e => setSalePaymentForm({ ...salePaymentForm, notes: e.target.value })} className="w-full min-h-[50px] p-2 text-sm border rounded-lg resize-none" /></div>
              </div>

              {/* History */}
              {salePaymentHistory.length > 0 && (
                <div className="p-3 border rounded-lg bg-slate-50/50">
                  <p className="text-xs font-semibold text-[#3D4F6F] mb-2">Ödəniş Tarixçəsi ({salePaymentHistory.length})</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {salePaymentHistory.map((p, i) => (
                      <div key={p.id || i} className="flex justify-between items-center text-xs py-1.5 px-2 bg-white rounded border border-slate-100">
                        <div>
                          <span className="text-emerald-600 font-semibold">{(Number(p.amount) || 0).toLocaleString()} AZN</span>
                          <span className="text-slate-400 mx-2">•</span>
                          <span className="text-slate-500">{formatDate(p.date)}</span>
                          {p.note && <><span className="text-slate-400 mx-2">•</span><span className="text-slate-500">{p.note}</span></>}
                        </div>
                        <span className="text-[10px] text-slate-400">{p.added_by}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingSale(null)}>Ləğv et</Button>
                <Button type="button" className="bg-[#3D4F6F] text-white" onClick={saveProjectSale} data-testid="finance-save-sale-btn">Saxla</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>
              Ödəniş — {paymentCompany?.brand_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Summary */}
            {paymentCompany && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <p className="text-[10px] text-slate-400">Ümumi</p>
                  <p className="text-sm font-bold text-[#3D4F6F]">{(paymentCompany.total_amount || paymentCompany.payment_amount || 0).toLocaleString()} AZN</p>
                </div>
                <div className="p-2 bg-green-50 rounded-lg">
                  <p className="text-[10px] text-slate-400">Ödənilib</p>
                  <p className="text-sm font-bold text-green-600">{(paymentCompany.paid_amount || 0).toLocaleString()} AZN</p>
                </div>
                <div className="p-2 bg-red-50 rounded-lg">
                  <p className="text-[10px] text-slate-400">Borc</p>
                  <p className="text-sm font-bold text-red-600">{(paymentCompany.debt_amount || 0).toLocaleString()} AZN</p>
                </div>
              </div>
            )}

            {/* New payment form */}
            <div className="border border-green-200 rounded-lg p-3 bg-green-50/30">
              <p className="text-xs font-semibold text-green-700 mb-2">Yeni ödəniş əlavə et</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Məbləğ (AZN) *</Label>
                  <Input type="number" value={paymentForm.new_payment_amount} onChange={(e) => setPaymentForm({ ...paymentForm, new_payment_amount: e.target.value })} className="text-sm" placeholder="0" data-testid="payment-amount-input" />
                </div>
                <div>
                  <Label className="text-xs">Tarix *</Label>
                  <Input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} className="text-sm" data-testid="payment-date-input" />
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Qeyd</Label>
                  <Input value={paymentForm.payment_note} onChange={(e) => setPaymentForm({ ...paymentForm, payment_note: e.target.value })} className="text-sm" placeholder="Ödəniş haqqında qeyd" />
                </div>
                <div>
                  <Label className="text-xs">Ödəniş üsulu</Label>
                  <Select value={paymentForm.payment_method || 'none'} onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_method: v === 'none' ? '' : v })}>
                    <SelectTrigger className="text-sm" data-testid="company-payment-method"><SelectValue placeholder="Seçin" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Seçilməyib</SelectItem>
                      <SelectItem value="Köçürmə">Köçürmə</SelectItem>
                      <SelectItem value="Nəğd">Nəğd</SelectItem>
                      <SelectItem value="Posterminal">Posterminal</SelectItem>
                      <SelectItem value="CTC">CTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Finance tracking fields */}
            <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/30">
              <p className="text-xs font-semibold text-blue-700 mb-2">Maliyyə izləməsi</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Müqavilə nömrəsi</Label>
                  <Input value={paymentForm.finance_contract_number} onChange={(e) => setPaymentForm({ ...paymentForm, finance_contract_number: e.target.value })} className="text-sm" placeholder="MQ-2026-001" data-testid="finance-contract-number" />
                </div>
                <div>
                  <Label className="text-xs">Ödənilməli tarix</Label>
                  <Input type="date" value={paymentForm.payment_due_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_due_date: e.target.value })} className="text-sm" data-testid="finance-payment-due" />
                </div>
                <div>
                  <Label className="text-xs">VÖEN</Label>
                  <Input value={paymentForm.voen} onChange={(e) => setPaymentForm({ ...paymentForm, voen: e.target.value })} className="text-sm" placeholder="1234567890" data-testid="finance-voen" />
                </div>
                <div>
                  <Label className="text-xs">E-qaimə tarixi</Label>
                  <Input type="date" value={paymentForm.e_invoice_date} onChange={(e) => setPaymentForm({ ...paymentForm, e_invoice_date: e.target.value })} className="text-sm" data-testid="finance-einvoice-date" />
                </div>
                <div>
                  <Label className="text-xs">E-qaimə nömrəsi</Label>
                  <Input value={paymentForm.e_invoice_number} onChange={(e) => setPaymentForm({ ...paymentForm, e_invoice_number: e.target.value })} className="text-sm" placeholder="EQN123456" data-testid="finance-einvoice-number" />
                </div>
                <div>
                  <Label className="text-xs">Təqib</Label>
                  <Input value={paymentForm.follow_up} onChange={(e) => setPaymentForm({ ...paymentForm, follow_up: e.target.value })} className="text-sm" placeholder="Zəng et, e-mail göndər..." data-testid="finance-followup" />
                </div>
                <div>
                  <Label className="text-xs">Marsol müəssisəsi</Label>
                  <Select value={paymentForm.marsol_company || 'none'} onValueChange={(v) => setPaymentForm({ ...paymentForm, marsol_company: v === 'none' ? '' : v })}>
                    <SelectTrigger className="text-sm" data-testid="finance-marsol-company"><SelectValue placeholder="Seçin" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Seçilməyib</SelectItem>
                      {marsolCompanies.map(m => <SelectItem key={m.id || m.name} value={m.name}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Payment History */}
            {paymentHistory.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#3D4F6F] mb-2">Ödəniş tarixçəsi</p>
                <div className="max-h-[150px] overflow-y-auto space-y-1.5">
                  {paymentHistory.map((p, i) => (
                    <div key={p.id || i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-xs">
                      <div>
                        <span className="text-slate-500">{formatDate(p.date)}</span>
                        {p.note && <span className="text-slate-400 ml-2">— {p.note}</span>}
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-green-600">+{p.amount?.toLocaleString()} AZN</span>
                        <p className="text-[10px] text-slate-400">{p.recorded_by}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPaymentModal(false)}>Ləğv et</Button>
              <Button onClick={savePayment} className="bg-green-500 hover:bg-green-600 text-white" data-testid="save-payment-btn">
                Ödəniş əlavə et
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
              <div>
                <Label className="text-xs">Məsul şəxs</Label>
                <Select value={expenseForm.responsible_person || 'none'} onValueChange={(v) => setExpenseForm({ ...expenseForm, responsible_person: v === 'none' ? '' : v })}>
                  <SelectTrigger className="text-sm" data-testid="expense-responsible-person"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Seçilməyib</SelectItem>
                    {responsiblePersons.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Ödəniş üsulu</Label>
                <Select value={expenseForm.payment_method} onValueChange={(v) => setExpenseForm({ ...expenseForm, payment_method: v === 'none' ? '' : v })}>
                  <SelectTrigger className="text-sm" data-testid="expense-payment-method"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Seçilməyib</SelectItem>
                    <SelectItem value="Köçürmə">Köçürmə</SelectItem>
                    <SelectItem value="Nəğd">Nəğd</SelectItem>
                    <SelectItem value="Posterminal">Posterminal</SelectItem>
                    <SelectItem value="CTC">CTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Marsol müəssisəsi</Label>
                <Select value={expenseForm.marsol_company || 'none'} onValueChange={(v) => setExpenseForm({ ...expenseForm, marsol_company: v === 'none' ? '' : v })}>
                  <SelectTrigger className="text-sm" data-testid="expense-marsol-company"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Seçilməyib</SelectItem>
                    {marsolCompanies.map(m => <SelectItem key={m.id || m.name} value={m.name}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
