import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Plus, Download, Search, Loader2, TrendingUp, TrendingDown,
  Wallet, CreditCard, MoreVertical, Pencil, Trash2, ChevronDown,
  ArrowUpRight, ArrowDownRight, Calendar, FileText
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
import { ScrollArea } from '../components/ui/scroll-area';

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
  const [summary, setSummary] = useState(null);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [incomeForm, setIncomeForm] = useState({
    company_id: '', company_name: '', owner_name: '', marsol_representative: '',
    project: '', package: '', amount: 0, paid_amount: 0, currency: 'AZN',
    contract_start_date: '', contract_end_date: ''
  });

  const [expenseForm, setExpenseForm] = useState({
    expense_name: '', category: '', sub_category: '', amount: 0, currency: 'AZN',
    date: new Date().toISOString().split('T')[0], project: '', department: '',
    responsible_person: '', payment_type: '', status: 'Ödənilib'
  });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, incomesRes, expensesRes] = await Promise.all([
        axios.get(`${API}/finance/summary`, { headers }),
        axios.get(`${API}/finance/incomes`, { headers }),
        axios.get(`${API}/finance/expenses`, { headers })
      ]);
      setSummary(summaryRes.data);
      setIncomes(incomesRes.data);
      setExpenses(expensesRes.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleIncomeSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/finance/incomes`, incomeForm, { headers });
      toast.success('Gəlir əlavə edildi');
      setShowIncomeModal(false);
      setIncomeForm({ company_id: '', company_name: '', owner_name: '', marsol_representative: '', project: '', package: '', amount: 0, paid_amount: 0, currency: 'AZN', contract_start_date: '', contract_end_date: '' });
      fetchData();
    } catch (error) {
      toast.error('Xəta baş verdi');
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/finance/expenses`, expenseForm, { headers });
      toast.success('Xərc əlavə edildi');
      setShowExpenseModal(false);
      setExpenseForm({ expense_name: '', category: '', sub_category: '', amount: 0, currency: 'AZN', date: new Date().toISOString().split('T')[0], project: '', department: '', responsible_person: '', payment_type: '', status: 'Ödənilib' });
      fetchData();
    } catch (error) {
      toast.error('Xəta baş verdi');
    }
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
        <div className="flex gap-2">
          <Button onClick={() => setShowIncomeModal(true)} size="sm" className="bg-green-500 hover:bg-green-600 text-white text-xs sm:text-sm">
            <ArrowUpRight className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Gəlir</span>
          </Button>
          <Button onClick={() => setShowExpenseModal(true)} size="sm" className="bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm">
            <ArrowDownRight className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Xərc</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-slate-500">Ümumi gəlir</span>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold" style={{ color: '#3D4F6F' }}>
            {(summary?.total_income || 0).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400">AZN</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-slate-500">Ödənilib</span>
            <CreditCard className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-green-600">
            {(summary?.paid_income || 0).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400">AZN</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-slate-500">Debitor borc</span>
            <Wallet className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-amber-600">
            {(summary?.debt || 0).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400">AZN</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-slate-500">Xalis mənfəət</span>
            <TrendingDown className="w-5 h-5 text-[#9ACD32]" />
          </div>
          <p className="text-xl sm:text-2xl font-bold" style={{ color: '#9ACD32' }}>
            {(summary?.current_profit || 0).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400">AZN</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">İcmal</TabsTrigger>
          <TabsTrigger value="incomes">Gəlirlər</TabsTrigger>
          <TabsTrigger value="expenses">Xərclər</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Incomes */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <h3 className="font-semibold text-[#3D4F6F] mb-4">Son gəlirlər</h3>
              {incomes.slice(0, 5).length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">Gəlir yoxdur</p>
              ) : (
                <div className="space-y-3">
                  {incomes.slice(0, 5).map(inc => (
                    <div key={inc.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm text-slate-700">{inc.company_name}</p>
                        <p className="text-xs text-slate-500">{inc.project} • {inc.package}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{inc.amount?.toLocaleString()} AZN</p>
                        <p className="text-xs text-slate-500">Ödənilib: {inc.paid_amount?.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Expenses */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <h3 className="font-semibold text-[#3D4F6F] mb-4">Son xərclər</h3>
              {expenses.slice(0, 5).length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">Xərc yoxdur</p>
              ) : (
                <div className="space-y-3">
                  {expenses.slice(0, 5).map(exp => (
                    <div key={exp.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm text-slate-700">{exp.expense_name}</p>
                        <p className="text-xs text-slate-500">{exp.category} • {exp.date}</p>
                      </div>
                      <p className="font-bold text-red-600">{exp.amount?.toLocaleString()} AZN</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="incomes">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Şirkət</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Layihə</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Paket</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Məbləğ</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Ödənilib</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Borc</th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400">Gəlir yoxdur</td></tr>
                  ) : (
                    incomes.map(inc => (
                      <tr key={inc.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm">{inc.company_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{inc.project}</td>
                        <td className="px-4 py-3"><Badge className="bg-[#3D4F6F] text-white text-xs">{inc.package}</Badge></td>
                        <td className="px-4 py-3 text-sm font-medium">{inc.amount?.toLocaleString()} AZN</td>
                        <td className="px-4 py-3 text-sm text-green-600">{inc.paid_amount?.toLocaleString()} AZN</td>
                        <td className="px-4 py-3 text-sm text-red-600">{inc.debt_amount?.toLocaleString()} AZN</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="expenses">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Xərc adı</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Kateqoriya</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Tarix</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Məbləğ</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-400">Xərc yoxdur</td></tr>
                  ) : (
                    expenses.map(exp => (
                      <tr key={exp.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium">{exp.expense_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{exp.category}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{exp.date}</td>
                        <td className="px-4 py-3 text-sm font-medium text-red-600">{exp.amount?.toLocaleString()} AZN</td>
                        <td className="px-4 py-3"><Badge className="bg-green-100 text-green-700 text-xs">{exp.status}</Badge></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Income Modal */}
      <Dialog open={showIncomeModal} onOpenChange={setShowIncomeModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>Gəlir əlavə et</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleIncomeSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Şirkət adı *</Label><Input value={incomeForm.company_name} onChange={(e) => setIncomeForm({...incomeForm, company_name: e.target.value})} required className="text-sm" /></div>
              <div><Label className="text-xs">Sahibkar</Label><Input value={incomeForm.owner_name} onChange={(e) => setIncomeForm({...incomeForm, owner_name: e.target.value})} className="text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Layihə</Label><Input value={incomeForm.project} onChange={(e) => setIncomeForm({...incomeForm, project: e.target.value})} className="text-sm" /></div>
              <div><Label className="text-xs">Paket</Label><Input value={incomeForm.package} onChange={(e) => setIncomeForm({...incomeForm, package: e.target.value})} className="text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Məbləğ (AZN) *</Label><Input type="number" value={incomeForm.amount} onChange={(e) => setIncomeForm({...incomeForm, amount: parseFloat(e.target.value) || 0})} required className="text-sm" /></div>
              <div><Label className="text-xs">Ödənilib (AZN)</Label><Input type="number" value={incomeForm.paid_amount} onChange={(e) => setIncomeForm({...incomeForm, paid_amount: parseFloat(e.target.value) || 0})} className="text-sm" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowIncomeModal(false)}>Ləğv et</Button>
              <Button type="submit" className="bg-green-500 hover:bg-green-600 text-white">Əlavə et</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Expense Modal */}
      <Dialog open={showExpenseModal} onOpenChange={setShowExpenseModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>Xərc əlavə et</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleExpenseSubmit} className="space-y-4">
            <div><Label className="text-xs">Xərc adı *</Label><Input value={expenseForm.expense_name} onChange={(e) => setExpenseForm({...expenseForm, expense_name: e.target.value})} required className="text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Kateqoriya *</Label>
                <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({...expenseForm, category: v, sub_category: ''})}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{expenseCategories.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Alt kateqoriya</Label>
                <Select value={expenseForm.sub_category} onValueChange={(v) => setExpenseForm({...expenseForm, sub_category: v})} disabled={!selectedCategory}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{selectedCategory?.subs.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Məbləğ (AZN) *</Label><Input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({...expenseForm, amount: parseFloat(e.target.value) || 0})} required className="text-sm" /></div>
              <div><Label className="text-xs">Tarix *</Label><Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})} required className="text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Şöbə</Label><Input value={expenseForm.department} onChange={(e) => setExpenseForm({...expenseForm, department: e.target.value})} className="text-sm" /></div>
              <div><Label className="text-xs">Məsul şəxs</Label><Input value={expenseForm.responsible_person} onChange={(e) => setExpenseForm({...expenseForm, responsible_person: e.target.value})} className="text-sm" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowExpenseModal(false)}>Ləğv et</Button>
              <Button type="submit" className="bg-red-500 hover:bg-red-600 text-white">Əlavə et</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
