import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Plus, Download, Search, Filter, X, Loader2, Building2, Phone, Mail, 
  User, ChevronDown, Pencil, Trash2, MoreVertical, Eye, ChevronLeft,
  Calendar, CreditCard, FileText, Users, Globe, MapPin
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

const getPackageColor = (pkg) => {
  switch (pkg) {
    case 'Premium': return 'bg-[#3D4F6F] text-white';
    case 'Business Plus': return 'bg-[#9ACD32] text-[#3D4F6F]';
    default: return 'bg-slate-200 text-slate-700';
  }
};

const getSizeColor = (size) => {
  switch (size) {
    case 'Böyük': return 'bg-blue-100 text-blue-700';
    case 'Orta': return 'bg-amber-100 text-amber-700';
    case 'Kiçik': return 'bg-green-100 text-green-700';
    default: return 'bg-slate-100 text-slate-600';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Aktiv': return 'bg-green-100 text-green-700';
    case 'Qeyri-aktiv': return 'bg-red-100 text-red-700';
    default: return 'bg-amber-100 text-amber-700';
  }
};

// Detail View Component
const CompanyDetail = ({ company, onBack, onEdit }) => {
  if (!company) return null;
  
  const debtDays = company.payment_due_date ? 
    Math.max(0, Math.floor((new Date() - new Date(company.payment_due_date)) / (1000 * 60 * 60 * 24))) : 0;
  
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="back-btn">
            <ChevronLeft className="w-4 h-4 mr-1" /> Geri
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: '#3D4F6F' }}>{company.brand_name}</h1>
            <p className="text-sm text-slate-500">{company.legal_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className={getStatusColor(company.status)}>{company.status}</Badge>
          <Button size="sm" onClick={() => onEdit(company)} data-testid="edit-company-btn">
            <Pencil className="w-4 h-4 mr-1" /> Redaktə
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="general" className="text-xs sm:text-sm">Ümumi</TabsTrigger>
          <TabsTrigger value="owner" className="text-xs sm:text-sm">Sahibkar</TabsTrigger>
          <TabsTrigger value="representative" className="text-xs sm:text-sm">Təmsilçi</TabsTrigger>
          <TabsTrigger value="contract" className="text-xs sm:text-sm">Müqavilə</TabsTrigger>
          <TabsTrigger value="payment" className="text-xs sm:text-sm">Ödəniş</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard icon={Building2} label="Sektor" value={company.sector} />
            <InfoCard icon={Users} label="Şirkət ölçüsü" value={company.company_size} />
            <InfoCard icon={Calendar} label="Qeydiyyat tarixi" value={company.registration_date || '-'} />
            <InfoCard icon={MapPin} label="Ünvan" value={company.address || '-'} />
            <InfoCard icon={Phone} label="Şirkət telefonu" value={company.company_phone || '-'} />
            <InfoCard icon={Globe} label="Veb sayt" value={company.company_website || '-'} />
            <InfoCard icon={FileText} label="Bank rekvizitləri" value={company.bank_details || '-'} />
            <InfoCard icon={Users} label="Referans mənbəsi" value={company.reference_source || '-'} />
            <InfoCard icon={User} label="Marsol Təmsilçisi" value={company.marsol_representative} />
          </div>
        </TabsContent>

        <TabsContent value="owner" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard icon={User} label="Sahibkar adı" value={company.owner_name} />
            <InfoCard icon={Phone} label="Əlaqə nömrəsi" value={company.owner_phone} />
            <InfoCard icon={Mail} label="Email" value={company.owner_email || '-'} />
            <InfoCard icon={Globe} label="Sosial media" value={company.owner_social_links || '-'} />
            <InfoCard icon={Users} label="Digər təsisçilər" value={company.co_founders?.join(', ') || '-'} />
            <InfoCard icon={Users} label="Uşaq sayı" value={company.children_count?.toString() || '0'} />
          </div>
          {company.children_info?.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-4">
              <h4 className="font-semibold text-sm mb-2">Uşaqlar haqqında</h4>
              {company.children_info.map((child, i) => (
                <p key={i} className="text-sm text-slate-600">{child.name} - {child.birth_date}</p>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="representative" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard icon={User} label="Təmsilçi adı" value={company.representative_name || '-'} />
            <InfoCard icon={Phone} label="Əlaqə nömrəsi" value={company.representative_phone || '-'} />
            <InfoCard icon={Mail} label="Email" value={company.representative_email || '-'} />
          </div>
        </TabsContent>

        <TabsContent value="contract" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard icon={FileText} label="Layihə" value={company.joined_project} />
            <InfoCard icon={CreditCard} label="Paket" value={company.package} badge badgeClass={getPackageColor(company.package)} />
            <InfoCard icon={Calendar} label="Müqavilə başlama" value={company.contract_start_date || '-'} />
            <InfoCard icon={Calendar} label="Müqavilə bitmə" value={company.contract_end_date || '-'} />
          </div>
          {company.contract_file && (
            <Button variant="outline" size="sm">
              <FileText className="w-4 h-4 mr-2" /> Müqaviləni yüklə
            </Button>
          )}
        </TabsContent>

        <TabsContent value="payment" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Ümumi məbləğ</p>
              <p className="text-xl font-bold text-[#3D4F6F]">{(company.total_amount || 0).toLocaleString()} AZN</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-xs text-green-600 mb-1">Ödənilib</p>
              <p className="text-xl font-bold text-green-600">{(company.paid_amount || 0).toLocaleString()} AZN</p>
            </div>
            <div className={`rounded-xl p-4 text-center ${company.debt_amount > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
              <p className={`text-xs mb-1 ${company.debt_amount > 0 ? 'text-red-600' : 'text-slate-500'}`}>Borc</p>
              <p className={`text-xl font-bold ${company.debt_amount > 0 ? 'text-red-600' : 'text-slate-600'}`}>
                {(company.debt_amount || 0).toLocaleString()} AZN
              </p>
            </div>
            <div className={`rounded-xl p-4 text-center ${debtDays > 30 ? 'bg-red-50' : debtDays > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
              <p className={`text-xs mb-1 ${debtDays > 30 ? 'text-red-600' : debtDays > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                Gecikmiş gün
              </p>
              <p className={`text-xl font-bold ${debtDays > 30 ? 'text-red-600' : debtDays > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                {debtDays}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard icon={Calendar} label="Son ödəniş tarixi" value={company.last_payment_date || '-'} />
            <InfoCard icon={Calendar} label="Ödəniş son tarixi" value={company.payment_due_date || '-'} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const InfoCard = ({ icon: Icon, label, value, badge, badgeClass }) => (
  <div className="bg-white border border-slate-100 rounded-xl p-4">
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-slate-50">
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        {badge ? (
          <Badge className={badgeClass}>{value}</Badge>
        ) : (
          <p className="text-sm font-medium text-slate-700 break-words">{value}</p>
        )}
      </div>
    </div>
  </div>
);

// Mobile Card
const CompanyCard = ({ company, onView, onEdit, onDelete }) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[#3D4F6F] truncate">{company.brand_name}</h3>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <Badge className={`text-xs ${getPackageColor(company.package)}`}>{company.package}</Badge>
          <Badge className={`text-xs ${getSizeColor(company.company_size)}`}>{company.company_size}</Badge>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onView(company)}>
            <Eye className="w-4 h-4 mr-2" /> Ətraflı
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(company)}>
            <Pencil className="w-4 h-4 mr-2" /> Redaktə
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete(company.id)} className="text-red-600">
            <Trash2 className="w-4 h-4 mr-2" /> Sil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2 text-slate-600">
        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{company.sector}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <User className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{company.owner_name}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{company.owner_phone}</span>
      </div>
      {company.debt_amount > 0 && (
        <div className="flex items-center gap-2 text-red-600">
          <CreditCard className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Borc: {company.debt_amount.toLocaleString()} AZN</span>
        </div>
      )}
    </div>
    
    <Button 
      variant="outline" 
      size="sm" 
      className="w-full mt-3 text-xs"
      onClick={() => onView(company)}
    >
      <Eye className="w-3.5 h-3.5 mr-1" /> Ətraflı bax
    </Button>
  </div>
);

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [viewingCompany, setViewingCompany] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('basic');
  
  const [filters, setFilters] = useState({
    sector: '', package: '', company_size: '', marsol_representative: '', status: ''
  });

  const initialFormData = {
    brand_name: '', legal_name: '', sector: '', company_size: '', registration_date: '',
    address: '', bank_details: '', owner_name: '', owner_phone: '', owner_email: '',
    owner_social_links: '', co_founders: [], representative_name: '', representative_phone: '',
    representative_email: '', company_phone: '', company_website: '', company_social_links: '',
    children_count: 0, children_info: [], reference_source: '', reference_person: '',
    reference_company: '', marsol_representative: '', joined_project: '', package: '',
    contract_start_date: '', contract_end_date: '', contract_file: '', total_amount: 0,
    paid_amount: 0, debt_amount: 0, last_payment_date: '', payment_due_date: '', status: 'Aktiv'
  };

  const [formData, setFormData] = useState(initialFormData);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchCompanies = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') params.append(key, value);
      });
      const response = await axios.get(`${API}/companies?${params.toString()}`, { headers });
      setCompanies(response.data);
    } catch (error) {
      toast.error('Şirkətlər yüklənmədi');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchOptions = async () => {
    try {
      const response = await axios.get(`${API}/options/all`, { headers });
      setOptions(response.data);
    } catch (error) {
      console.error('Options fetch error:', error);
    }
  };

  useEffect(() => {
    fetchOptions();
    fetchCompanies();
  }, [fetchCompanies]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCompany) {
        await axios.put(`${API}/companies/${editingCompany.id}`, formData, { headers });
        toast.success('Şirkət yeniləndi');
      } else {
        await axios.post(`${API}/companies`, formData, { headers });
        toast.success('Yeni şirkət əlavə edildi');
      }
      setShowAddModal(false);
      setEditingCompany(null);
      setFormData(initialFormData);
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Xəta baş verdi');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu şirkəti silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/companies/${id}`, { headers });
      toast.success('Şirkət silindi');
      fetchCompanies();
    } catch (error) {
      toast.error('Silinmə zamanı xəta');
    }
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setFormData({ ...initialFormData, ...company });
    setActiveTab('basic');
    setShowAddModal(true);
  };

  const handleView = (company) => {
    setViewingCompany(company);
  };

  const exportToExcel = () => {
    const csvContent = [
      ['Şirkət', 'Sektor', 'Paket', 'Ölçü', 'Sahibkar', 'Telefon', 'Marsol Təmsilçisi', 'Borc', 'Status'].join(','),
      ...filteredCompanies.map(c => [
        `"${c.brand_name}"`, `"${c.sector}"`, `"${c.package}"`, `"${c.company_size}"`,
        `"${c.owner_name}"`, `"${c.owner_phone}"`, `"${c.marsol_representative}"`,
        c.debt_amount || 0, `"${c.status}"`
      ].join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `marsol_sirketler_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Excel faylı yükləndi');
  };

  const clearFilters = () => {
    setFilters({ sector: '', package: '', company_size: '', marsol_representative: '', status: '' });
  };

  const filteredCompanies = companies.filter(c => 
    c.brand_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.sector?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]" data-testid="companies-loading">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} />
      </div>
    );
  }

  // Detail View
  if (viewingCompany) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Toaster position="top-right" richColors />
        <CompanyDetail 
          company={viewingCompany} 
          onBack={() => setViewingCompany(null)}
          onEdit={(c) => { setViewingCompany(null); handleEdit(c); }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="companies-page">
      <Toaster position="top-right" richColors />
      
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>
            Şirkət Məlumatları
          </h1>
          <p className="text-slate-500 text-sm sm:text-base mt-1">Cəmi {companies.length} şirkət</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button onClick={exportToExcel} variant="outline" size="sm" className="text-xs sm:text-sm" data-testid="export-btn">
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Excel Export</span>
          </Button>
          <Button
            onClick={() => { setFormData(initialFormData); setEditingCompany(null); setActiveTab('basic'); setShowAddModal(true); }}
            size="sm"
            className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold text-xs sm:text-sm"
            data-testid="add-company-btn"
          >
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Şirkət əlavə et</span>
            <span className="sm:hidden">Əlavə et</span>
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Şirkət, sahibkar və ya sektor ilə axtar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm"
              data-testid="search-input"
            />
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={activeFilterCount > 0 ? 'border-[#9ACD32] bg-[#9ACD32]/10' : ''}
            data-testid="filter-toggle-btn"
          >
            <Filter className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Filtrlər</span>
            {activeFilterCount > 0 && <Badge className="ml-1 sm:ml-2 bg-[#9ACD32] text-[#3D4F6F] text-xs">{activeFilterCount}</Badge>}
          </Button>
        </div>

        {showFilters && options && (
          <div className="mt-4 pt-4 border-t border-slate-100 animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { key: 'sector', label: 'Sektor', options: options.sectors },
                { key: 'package', label: 'Paket', options: options.packages },
                { key: 'company_size', label: 'Ölçü', options: options.company_sizes },
                { key: 'marsol_representative', label: 'Kurator', options: options.marsol_representatives },
                { key: 'status', label: 'Status', options: options.statuses }
              ].map(f => (
                <div key={f.key}>
                  <Label className="text-xs text-slate-500 mb-1.5 block">{f.label}</Label>
                  <Select value={filters[f.key]} onValueChange={(v) => setFilters({...filters, [f.key]: v})}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Hamısı</SelectItem>
                      {f.options?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-3 text-slate-500 text-xs">
                <X className="w-3 h-3 mr-1" /> Filtrləri təmizlə
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredCompanies.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl p-8 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">Şirkət tapılmadı</p>
          </div>
        ) : (
          filteredCompanies.map(company => (
            <CompanyCard key={company.id} company={company} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} />
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="companies-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Şirkət', 'Sektor', 'Paket', 'Sahibkar', 'Telefon', 'Kurator', 'Borc', 'Status', 'Əməliyyat'].map(h => (
                  <th key={h} className={`text-left font-semibold text-[#3D4F6F] px-4 py-3 text-sm ${h === 'Əməliyyat' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500">
                    <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>Şirkət tapılmadı</p>
                  </td>
                </tr>
              ) : (
                filteredCompanies.map(company => (
                  <tr key={company.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-[#3D4F6F] text-sm">{company.brand_name}</p>
                        <Badge className={`mt-1 text-xs ${getSizeColor(company.company_size)}`}>{company.company_size}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{company.sector}</td>
                    <td className="px-4 py-3"><Badge className={`text-xs ${getPackageColor(company.package)}`}>{company.package}</Badge></td>
                    <td className="px-4 py-3 text-sm">{company.owner_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{company.owner_phone}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{company.marsol_representative}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${company.debt_amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {(company.debt_amount || 0).toLocaleString()} AZN
                      </span>
                    </td>
                    <td className="px-4 py-3"><Badge className={`text-xs ${getStatusColor(company.status)}`}>{company.status}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><ChevronDown className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleView(company)}><Eye className="w-4 h-4 mr-2" />Ətraflı</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(company)}><Pencil className="w-4 h-4 mr-2" />Redaktə</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(company.id)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" />Sil</DropdownMenuItem>
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

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl lg:max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 sm:p-6 pb-0">
            <DialogTitle className="text-lg sm:text-xl font-bold" style={{ color: '#3D4F6F' }}>
              {editingCompany ? 'Şirkəti redaktə et' : 'Yeni şirkət əlavə et'}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[calc(90vh-120px)]">
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 pt-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="flex-wrap h-auto gap-1 mb-4">
                  <TabsTrigger value="basic" className="text-xs">Əsas</TabsTrigger>
                  <TabsTrigger value="owner" className="text-xs">Sahibkar</TabsTrigger>
                  <TabsTrigger value="rep" className="text-xs">Təmsilçi</TabsTrigger>
                  <TabsTrigger value="contract" className="text-xs">Müqavilə</TabsTrigger>
                  <TabsTrigger value="payment" className="text-xs">Ödəniş</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Brend adı *</Label><Input value={formData.brand_name} onChange={(e) => setFormData({...formData, brand_name: e.target.value})} required className="text-sm" /></div>
                    <div><Label className="text-xs">Hüquqi adı</Label><Input value={formData.legal_name} onChange={(e) => setFormData({...formData, legal_name: e.target.value})} className="text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Sektor *</Label>
                      <Select value={formData.sector} onValueChange={(v) => setFormData({...formData, sector: v})}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>{options?.sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Ölçü *</Label>
                      <Select value={formData.company_size} onValueChange={(v) => setFormData({...formData, company_size: v})}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>{options?.company_sizes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Qeydiyyat tarixi</Label><Input type="date" value={formData.registration_date} onChange={(e) => setFormData({...formData, registration_date: e.target.value})} className="text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Ünvan</Label><Input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">Şirkət telefonu</Label><Input value={formData.company_phone} onChange={(e) => setFormData({...formData, company_phone: e.target.value})} className="text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Veb sayt</Label><Input value={formData.company_website} onChange={(e) => setFormData({...formData, company_website: e.target.value})} className="text-sm" /></div>
                    <div>
                      <Label className="text-xs">Referans mənbəsi</Label>
                      <Select value={formData.reference_source} onValueChange={(v) => setFormData({...formData, reference_source: v})}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>{options?.reference_sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="owner" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Sahibkar adı *</Label><Input value={formData.owner_name} onChange={(e) => setFormData({...formData, owner_name: e.target.value})} required className="text-sm" /></div>
                    <div><Label className="text-xs">Əlaqə nömrəsi *</Label><Input value={formData.owner_phone} onChange={(e) => setFormData({...formData, owner_phone: e.target.value})} required className="text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Email</Label><Input type="email" value={formData.owner_email} onChange={(e) => setFormData({...formData, owner_email: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">Sosial media</Label><Input value={formData.owner_social_links} onChange={(e) => setFormData({...formData, owner_social_links: e.target.value})} className="text-sm" /></div>
                  </div>
                  <div><Label className="text-xs">Uşaq sayı</Label><Input type="number" value={formData.children_count} onChange={(e) => setFormData({...formData, children_count: parseInt(e.target.value) || 0})} className="text-sm w-24" /></div>
                </TabsContent>

                <TabsContent value="rep" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Təmsilçi adı</Label><Input value={formData.representative_name} onChange={(e) => setFormData({...formData, representative_name: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">Əlaqə nömrəsi</Label><Input value={formData.representative_phone} onChange={(e) => setFormData({...formData, representative_phone: e.target.value})} className="text-sm" /></div>
                  </div>
                  <div><Label className="text-xs">Email</Label><Input type="email" value={formData.representative_email} onChange={(e) => setFormData({...formData, representative_email: e.target.value})} className="text-sm" /></div>
                </TabsContent>

                <TabsContent value="contract" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Marsol Təmsilçisi *</Label>
                      <Select value={formData.marsol_representative} onValueChange={(v) => setFormData({...formData, marsol_representative: v})}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>{options?.marsol_representatives.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Layihə *</Label>
                      <Select value={formData.joined_project} onValueChange={(v) => setFormData({...formData, joined_project: v})}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>{options?.projects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Paket *</Label>
                      <Select value={formData.package} onValueChange={(v) => setFormData({...formData, package: v})}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>{options?.packages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Başlama tarixi</Label><Input type="date" value={formData.contract_start_date} onChange={(e) => setFormData({...formData, contract_start_date: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">Bitmə tarixi</Label><Input type="date" value={formData.contract_end_date} onChange={(e) => setFormData({...formData, contract_end_date: e.target.value})} className="text-sm" /></div>
                  </div>
                </TabsContent>

                <TabsContent value="payment" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Ümumi məbləğ (AZN)</Label><Input type="number" value={formData.total_amount} onChange={(e) => setFormData({...formData, total_amount: parseFloat(e.target.value) || 0})} className="text-sm" /></div>
                    <div><Label className="text-xs">Ödənilən məbləğ (AZN)</Label><Input type="number" value={formData.paid_amount} onChange={(e) => setFormData({...formData, paid_amount: parseFloat(e.target.value) || 0})} className="text-sm" /></div>
                    <div><Label className="text-xs">Ödəniş son tarixi</Label><Input type="date" value={formData.payment_due_date} onChange={(e) => setFormData({...formData, payment_due_date: e.target.value})} className="text-sm" /></div>
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{options?.statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t mt-6">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="text-sm">Ləğv et</Button>
                <Button type="submit" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold text-sm">
                  {editingCompany ? 'Yadda saxla' : 'Əlavə et'}
                </Button>
              </div>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
