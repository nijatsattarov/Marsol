import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Plus, Download, Search, Filter, X, Loader2, User, Phone, Mail, 
  MoreVertical, Eye, ChevronLeft, Calendar, Briefcase, GraduationCap,
  MapPin, CreditCard, Clock, ChevronDown, Pencil, Trash2
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

const getStatusColor = (status) => {
  switch (status) {
    case 'Aktiv': return 'bg-green-100 text-green-700';
    case 'Qeyri-aktiv': return 'bg-red-100 text-red-700';
    case 'Sınaq müddətində': return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-600';
  }
};

const InfoCard = ({ icon: Icon, label, value }) => (
  <div className="bg-white border border-slate-100 rounded-xl p-4">
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-slate-50">
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className="text-sm font-medium text-slate-700 break-words">{value || '-'}</p>
      </div>
    </div>
  </div>
);

// Employee Detail View
const EmployeeDetail = ({ employee, onBack, onEdit }) => {
  if (!employee) return null;
  
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Geri
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#3D4F6F] flex items-center justify-center text-white font-bold text-lg">
              {employee.full_name?.charAt(0) || 'E'}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold" style={{ color: '#3D4F6F' }}>{employee.full_name}</h1>
              <p className="text-sm text-slate-500">{employee.position} • {employee.department}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className={getStatusColor(employee.status)}>{employee.status}</Badge>
          <Button size="sm" onClick={() => onEdit(employee)}>
            <Pencil className="w-4 h-4 mr-1" /> Redaktə
          </Button>
        </div>
      </div>

      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="personal" className="text-xs sm:text-sm">Şəxsi</TabsTrigger>
          <TabsTrigger value="contact" className="text-xs sm:text-sm">Əlaqə</TabsTrigger>
          <TabsTrigger value="contract" className="text-xs sm:text-sm">Müqavilə</TabsTrigger>
          <TabsTrigger value="salary" className="text-xs sm:text-sm">Əmək haqqı</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard icon={User} label="Ata adı" value={employee.father_name} />
            <InfoCard icon={Calendar} label="Doğum tarixi" value={employee.birth_date} />
            <InfoCard icon={User} label="Cins" value={employee.gender} />
            <InfoCard icon={CreditCard} label="Ş.V. seriya №" value={employee.id_card_number} />
            <InfoCard icon={CreditCard} label="FİN kod" value={employee.fin_code} />
            <InfoCard icon={GraduationCap} label="Təhsil səviyyəsi" value={employee.education_level} />
            <InfoCard icon={GraduationCap} label="Təhsil müəssisəsi" value={employee.education_institution} />
            <InfoCard icon={User} label="Ailə vəziyyəti" value={employee.marital_status} />
            <InfoCard icon={User} label="Uşaq sayı" value={employee.children_count?.toString()} />
          </div>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard icon={MapPin} label="Qeydiyyat ünvanı" value={employee.registration_address} />
            <InfoCard icon={MapPin} label="Faktiki ünvan" value={employee.actual_address} />
            <InfoCard icon={Phone} label="Korporativ telefon" value={employee.company_phone} />
            <InfoCard icon={Phone} label="Şəxsi telefon" value={employee.personal_phone} />
            <InfoCard icon={Mail} label="Email" value={employee.email} />
          </div>
          <div className="bg-amber-50 rounded-xl p-4 mt-4">
            <h4 className="font-semibold text-amber-800 mb-2">Təcili əlaqə</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div><span className="text-amber-600">Ad:</span> {employee.emergency_contact_name || '-'}</div>
              <div><span className="text-amber-600">Yaxınlıq:</span> {employee.emergency_contact_relation || '-'}</div>
              <div><span className="text-amber-600">Telefon:</span> {employee.emergency_contact_phone || '-'}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contract" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard icon={Briefcase} label="Şöbə" value={employee.department} />
            <InfoCard icon={Briefcase} label="Vəzifə" value={employee.position} />
            <InfoCard icon={Calendar} label="Müqavilə başlama" value={employee.contract_start_date} />
            <InfoCard icon={Calendar} label="İşə başlama" value={employee.work_start_date} />
            <InfoCard icon={Calendar} label="Müqavilə bitmə" value={employee.contract_end_date} />
            <InfoCard icon={Calendar} label="Sınaq müddəti bitmə" value={employee.probation_end_date} />
            <InfoCard icon={Clock} label="İş qrafiki" value={employee.work_schedule} />
            <InfoCard icon={Calendar} label="Əsas məzuniyyət" value={`${employee.main_vacation_days || 21} gün`} />
            <InfoCard icon={Calendar} label="Əlavə məzuniyyət" value={`${employee.additional_vacation_days || 0} gün`} />
          </div>
        </TabsContent>

        <TabsContent value="salary" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-6 text-center">
              <p className="text-sm text-slate-500 mb-1">Gross əmək haqqı</p>
              <p className="text-3xl font-bold" style={{ color: '#3D4F6F' }}>
                {(employee.gross_salary || 0).toLocaleString()} AZN
              </p>
            </div>
            <div className="bg-green-50 rounded-xl p-6 text-center">
              <p className="text-sm text-green-600 mb-1">Net əmək haqqı</p>
              <p className="text-3xl font-bold text-green-600">
                {(employee.net_salary || 0).toLocaleString()} AZN
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Mobile Card
const EmployeeCard = ({ employee, onView, onEdit, onDelete }) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#3D4F6F] flex items-center justify-center text-white font-bold">
          {employee.full_name?.charAt(0) || 'E'}
        </div>
        <div>
          <h3 className="font-semibold text-[#3D4F6F]">{employee.full_name}</h3>
          <p className="text-xs text-slate-500">{employee.position}</p>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onView(employee)}><Eye className="w-4 h-4 mr-2" />Ətraflı</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(employee)}><Pencil className="w-4 h-4 mr-2" />Redaktə</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete(employee.id)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" />Sil</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <div className="space-y-1.5 text-sm">
      <div className="flex items-center gap-2 text-slate-600">
        <Briefcase className="w-3.5 h-3.5" /><span>{employee.department}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <Phone className="w-3.5 h-3.5" /><span>{employee.personal_phone}</span>
      </div>
      <div className="flex items-center justify-between mt-2">
        <Badge className={`text-xs ${getStatusColor(employee.status)}`}>{employee.status}</Badge>
        <span className="text-xs text-slate-500">{(employee.net_salary || 0).toLocaleString()} AZN</span>
      </div>
    </div>
  </div>
);

export default function HR() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('personal');
  const [filters, setFilters] = useState({ department: '', status: '' });

  const departments = ['Satış', 'Marketing', 'HR', 'Maliyyə', 'Layihə', 'İT', 'İdarəetmə'];
  const statuses = ['Aktiv', 'Qeyri-aktiv', 'Sınaq müddətində'];
  const genders = ['Kişi', 'Qadın'];
  const educationLevels = ['Ali', 'Orta-ixtisas', 'Orta', 'Natamam ali'];
  const maritalStatuses = ['Evli', 'Subay', 'Boşanmış'];

  const initialFormData = {
    photo: '', full_name: '', father_name: '', birth_date: '', gender: '',
    id_card_number: '', fin_code: '', education_level: '', education_institution: '',
    marital_status: '', children_count: 0, registration_address: '', actual_address: '',
    company_phone: '', personal_phone: '', email: '', emergency_contact_name: '',
    emergency_contact_relation: '', emergency_contact_phone: '', department: '',
    position: '', contract_start_date: '', work_start_date: '', contract_end_date: '',
    probation_end_date: '', main_vacation_days: 21, additional_vacation_days: 0,
    gross_salary: 0, net_salary: 0, work_schedule: '', status: 'Aktiv'
  };

  const [formData, setFormData] = useState(initialFormData);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchEmployees = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') params.append(key, value);
      });
      const response = await axios.get(`${API}/employees?${params.toString()}`, { headers });
      setEmployees(response.data);
    } catch (error) {
      toast.error('Əməkdaşlar yüklənmədi');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await axios.put(`${API}/employees/${editingEmployee.id}`, formData, { headers });
        toast.success('Əməkdaş yeniləndi');
      } else {
        await axios.post(`${API}/employees`, formData, { headers });
        toast.success('Yeni əməkdaş əlavə edildi');
      }
      setShowModal(false);
      setEditingEmployee(null);
      setFormData(initialFormData);
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Xəta baş verdi');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu əməkdaşı silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/employees/${id}`, { headers });
      toast.success('Əməkdaş silindi');
      fetchEmployees();
    } catch (error) {
      toast.error('Silinmə zamanı xəta');
    }
  };

  const handleEdit = (emp) => {
    setEditingEmployee(emp);
    setFormData({ ...initialFormData, ...emp });
    setActiveTab('personal');
    setShowModal(true);
  };

  const exportToExcel = () => {
    const csvContent = [
      ['Ad Soyad', 'Şöbə', 'Vəzifə', 'Telefon', 'Email', 'Gross', 'Net', 'Status'].join(','),
      ...filteredEmployees.map(e => [
        `"${e.full_name}"`, `"${e.department}"`, `"${e.position}"`, `"${e.personal_phone}"`,
        `"${e.email}"`, e.gross_salary || 0, e.net_salary || 0, `"${e.status}"`
      ].join(','))
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `marsol_emekdaslar_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Excel faylı yükləndi');
  };

  const filteredEmployees = employees.filter(e =>
    e.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} />
      </div>
    );
  }

  if (viewingEmployee) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Toaster position="top-right" richColors />
        <EmployeeDetail employee={viewingEmployee} onBack={() => setViewingEmployee(null)} onEdit={(e) => { setViewingEmployee(null); handleEdit(e); }} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="hr-page">
      <Toaster position="top-right" richColors />
      
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>İnsan Resurları</h1>
          <p className="text-slate-500 text-sm mt-1">Cəmi {employees.length} əməkdaş</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={exportToExcel} variant="outline" size="sm" className="text-xs sm:text-sm">
            <Download className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Excel Export</span>
          </Button>
          <Button onClick={() => { setFormData(initialFormData); setEditingEmployee(null); setActiveTab('personal'); setShowModal(true); }}
            size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold text-xs sm:text-sm">
            <Plus className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Əməkdaş əlavə et</span><span className="sm:hidden">Əlavə et</span>
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 sm:p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Axtar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 text-sm" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}
            className={activeFilterCount > 0 ? 'border-[#9ACD32] bg-[#9ACD32]/10' : ''}>
            <Filter className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Filtrlər</span>
            {activeFilterCount > 0 && <Badge className="ml-1 bg-[#9ACD32] text-[#3D4F6F] text-xs">{activeFilterCount}</Badge>}
          </Button>
        </div>
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Şöbə</Label>
              <Select value={filters.department} onValueChange={(v) => setFilters({...filters, department: v})}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Hamısı</SelectItem>
                  {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Hamısı</SelectItem>
                  {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredEmployees.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl p-8 text-center">
            <User className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">Əməkdaş tapılmadı</p>
          </div>
        ) : (
          filteredEmployees.map(emp => (
            <EmployeeCard key={emp.id} employee={emp} onView={setViewingEmployee} onEdit={handleEdit} onDelete={handleDelete} />
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {['Əməkdaş', 'Şöbə', 'Vəzifə', 'Telefon', 'Email', 'Əmək haqqı', 'Status', 'Əməliyyat'].map(h => (
                <th key={h} className={`text-left font-semibold text-[#3D4F6F] px-4 py-3 text-sm ${h === 'Əməliyyat' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-500"><User className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p>Əməkdaş tapılmadı</p></td></tr>
            ) : (
              filteredEmployees.map(emp => (
                <tr key={emp.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#3D4F6F] flex items-center justify-center text-white text-sm font-bold">
                        {emp.full_name?.charAt(0)}
                      </div>
                      <span className="font-medium text-sm">{emp.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{emp.department}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{emp.position}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{emp.personal_phone}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{emp.email}</td>
                  <td className="px-4 py-3 text-sm font-medium">{(emp.net_salary || 0).toLocaleString()} AZN</td>
                  <td className="px-4 py-3"><Badge className={`text-xs ${getStatusColor(emp.status)}`}>{emp.status}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><ChevronDown className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewingEmployee(emp)}><Eye className="w-4 h-4 mr-2" />Ətraflı</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(emp)}><Pencil className="w-4 h-4 mr-2" />Redaktə</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(emp.id)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" />Sil</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl lg:max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 sm:p-6 pb-0">
            <DialogTitle className="text-lg font-bold" style={{ color: '#3D4F6F' }}>
              {editingEmployee ? 'Əməkdaşı redaktə et' : 'Yeni əməkdaş əlavə et'}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-120px)]">
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 pt-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="flex-wrap h-auto gap-1 mb-4">
                  <TabsTrigger value="personal" className="text-xs">Şəxsi</TabsTrigger>
                  <TabsTrigger value="contact" className="text-xs">Əlaqə</TabsTrigger>
                  <TabsTrigger value="contract" className="text-xs">Müqavilə</TabsTrigger>
                  <TabsTrigger value="salary" className="text-xs">Əmək haqqı</TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Ad Soyad *</Label><Input value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} required className="text-sm" /></div>
                    <div><Label className="text-xs">Ata adı</Label><Input value={formData.father_name} onChange={(e) => setFormData({...formData, father_name: e.target.value})} className="text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Doğum tarixi</Label><Input type="date" value={formData.birth_date} onChange={(e) => setFormData({...formData, birth_date: e.target.value})} className="text-sm" /></div>
                    <div>
                      <Label className="text-xs">Cins *</Label>
                      <Select value={formData.gender} onValueChange={(v) => setFormData({...formData, gender: v})}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>{genders.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Ailə vəziyyəti</Label>
                      <Select value={formData.marital_status} onValueChange={(v) => setFormData({...formData, marital_status: v})}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>{maritalStatuses.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Ş.V. seriya №</Label><Input value={formData.id_card_number} onChange={(e) => setFormData({...formData, id_card_number: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">FİN kod</Label><Input value={formData.fin_code} onChange={(e) => setFormData({...formData, fin_code: e.target.value})} className="text-sm" /></div>
                    <div>
                      <Label className="text-xs">Təhsil</Label>
                      <Select value={formData.education_level} onValueChange={(v) => setFormData({...formData, education_level: v})}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>{educationLevels.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="contact" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Şəxsi telefon *</Label><Input value={formData.personal_phone} onChange={(e) => setFormData({...formData, personal_phone: e.target.value})} required className="text-sm" /></div>
                    <div><Label className="text-xs">Korporativ telefon</Label><Input value={formData.company_phone} onChange={(e) => setFormData({...formData, company_phone: e.target.value})} className="text-sm" /></div>
                  </div>
                  <div><Label className="text-xs">Email *</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required className="text-sm" /></div>
                  <div><Label className="text-xs">Faktiki ünvan</Label><Input value={formData.actual_address} onChange={(e) => setFormData({...formData, actual_address: e.target.value})} className="text-sm" /></div>
                  <h4 className="font-semibold text-sm text-slate-700 pt-2">Təcili əlaqə</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Ad</Label><Input value={formData.emergency_contact_name} onChange={(e) => setFormData({...formData, emergency_contact_name: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">Yaxınlıq dərəcəsi</Label><Input value={formData.emergency_contact_relation} onChange={(e) => setFormData({...formData, emergency_contact_relation: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">Telefon</Label><Input value={formData.emergency_contact_phone} onChange={(e) => setFormData({...formData, emergency_contact_phone: e.target.value})} className="text-sm" /></div>
                  </div>
                </TabsContent>

                <TabsContent value="contract" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Şöbə *</Label>
                      <Select value={formData.department} onValueChange={(v) => setFormData({...formData, department: v})}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Vəzifə *</Label><Input value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} required className="text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Müqavilə başlama</Label><Input type="date" value={formData.contract_start_date} onChange={(e) => setFormData({...formData, contract_start_date: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">Sınaq müddəti bitmə</Label><Input type="date" value={formData.probation_end_date} onChange={(e) => setFormData({...formData, probation_end_date: e.target.value})} className="text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Əsas məzuniyyət (gün)</Label><Input type="number" value={formData.main_vacation_days} onChange={(e) => setFormData({...formData, main_vacation_days: parseInt(e.target.value) || 0})} className="text-sm" /></div>
                    <div><Label className="text-xs">Əlavə məzuniyyət (gün)</Label><Input type="number" value={formData.additional_vacation_days} onChange={(e) => setFormData({...formData, additional_vacation_days: parseInt(e.target.value) || 0})} className="text-sm" /></div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="salary" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Gross əmək haqqı (AZN)</Label><Input type="number" value={formData.gross_salary} onChange={(e) => setFormData({...formData, gross_salary: parseFloat(e.target.value) || 0})} className="text-sm" /></div>
                    <div><Label className="text-xs">Net əmək haqqı (AZN)</Label><Input type="number" value={formData.net_salary} onChange={(e) => setFormData({...formData, net_salary: parseFloat(e.target.value) || 0})} className="text-sm" /></div>
                  </div>
                  <div><Label className="text-xs">İş qrafiki</Label><Input value={formData.work_schedule} onChange={(e) => setFormData({...formData, work_schedule: e.target.value})} placeholder="Məs: 09:00-18:00" className="text-sm" /></div>
                </TabsContent>
              </Tabs>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t mt-6">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="text-sm">Ləğv et</Button>
                <Button type="submit" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold text-sm">
                  {editingEmployee ? 'Yadda saxla' : 'Əlavə et'}
                </Button>
              </div>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
