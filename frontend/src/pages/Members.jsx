import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Plus, 
  Download, 
  Search, 
  Filter, 
  X, 
  Loader2,
  Building2,
  Phone,
  Mail,
  User,
  ChevronDown,
  Pencil,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';
import { ScrollArea } from '../components/ui/scroll-area';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getPackageBadgeColor = (pkg) => {
  switch (pkg) {
    case 'Premium': return 'bg-[#3D4F6F] text-white';
    case 'Business Plus': return 'bg-[#9ACD32] text-[#3D4F6F]';
    default: return 'bg-slate-200 text-slate-700';
  }
};

const getSizeBadgeColor = (size) => {
  switch (size) {
    case 'Böyük': return 'bg-blue-100 text-blue-700';
    case 'Orta': return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-600';
  }
};

// Mobile Card Component
const MemberCard = ({ member, onEdit, onDelete }) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100" data-testid={`member-card-${member.id}`}>
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[#3D4F6F] truncate">{member.company_name}</h3>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <Badge className={`text-xs ${getPackageBadgeColor(member.package)}`}>
            {member.package}
          </Badge>
          <Badge className={`text-xs ${getSizeBadgeColor(member.business_size)}`}>
            {member.business_size}
          </Badge>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(member)}>
            <Pencil className="w-4 h-4 mr-2" />
            Redaktə
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete(member.id)} className="text-red-600">
            <Trash2 className="w-4 h-4 mr-2" />
            Sil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2 text-slate-600">
        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{member.sector}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <User className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{member.curator}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{member.director_name} • {member.director_phone}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{member.company_email}</span>
      </div>
    </div>
  </div>
);

export default function Members() {
  const [members, setMembers] = useState([]);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [filters, setFilters] = useState({
    sector: '',
    package: '',
    curator: '',
    business_size: '',
    project: '',
    contract_status: ''
  });

  const [formData, setFormData] = useState({
    company_name: '',
    sector: '',
    package: '',
    curator: '',
    business_size: '',
    director_name: '',
    director_phone: '',
    contact_person: '',
    contact_position: '',
    contact_phone: '',
    company_email: '',
    projects: []
  });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchMembers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') params.append(key, value);
      });
      
      const response = await axios.get(`${API}/members?${params.toString()}`, { headers });
      setMembers(response.data);
    } catch (error) {
      toast.error('Üzvlər yüklənmədi');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchOptions = async () => {
    try {
      const response = await axios.get(`${API}/members/options/all`, { headers });
      setOptions(response.data);
    } catch (error) {
      console.error('Options fetch error:', error);
    }
  };

  useEffect(() => {
    fetchOptions();
    fetchMembers();
  }, [fetchMembers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMember) {
        await axios.put(`${API}/members/${editingMember.id}`, formData, { headers });
        toast.success('Üzv yeniləndi');
      } else {
        await axios.post(`${API}/members`, formData, { headers });
        toast.success('Yeni üzv əlavə edildi');
      }
      setShowAddModal(false);
      setEditingMember(null);
      resetForm();
      fetchMembers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Xəta baş verdi');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu üzvü silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/members/${id}`, { headers });
      toast.success('Üzv silindi');
      fetchMembers();
    } catch (error) {
      toast.error('Silinmə zamanı xəta');
    }
  };

  const handleEdit = (member) => {
    setEditingMember(member);
    setFormData({
      company_name: member.company_name,
      sector: member.sector,
      package: member.package,
      curator: member.curator,
      business_size: member.business_size,
      director_name: member.director_name,
      director_phone: member.director_phone,
      contact_person: member.contact_person,
      contact_position: member.contact_position || '',
      contact_phone: member.contact_phone,
      company_email: member.company_email,
      projects: member.projects || []
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      sector: '',
      package: '',
      curator: '',
      business_size: '',
      director_name: '',
      director_phone: '',
      contact_person: '',
      contact_position: '',
      contact_phone: '',
      company_email: '',
      projects: []
    });
  };

  const exportToExcel = () => {
    const csvContent = [
      ['Şirkət adı', 'Sektor', 'Paket', 'Kurator', 'Ölçü', 'Rəhbər', 'Rəhbər Tel.', 'Əlaqədar', 'Əlaqədar Tel.', 'Email', 'Layihələr'].join(','),
      ...filteredMembers.map(m => [
        `"${m.company_name}"`,
        `"${m.sector}"`,
        `"${m.package}"`,
        `"${m.curator}"`,
        `"${m.business_size}"`,
        `"${m.director_name}"`,
        `"${m.director_phone}"`,
        `"${m.contact_person}"`,
        `"${m.contact_phone}"`,
        `"${m.company_email}"`,
        `"${(m.projects || []).join('; ')}"`
      ].join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `marsol_uzvler_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Excel faylı yükləndi');
  };

  const clearFilters = () => {
    setFilters({
      sector: '',
      package: '',
      curator: '',
      business_size: '',
      project: ''
    });
  };

  const filteredMembers = members.filter(m => {
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      if (!(m.company_name || m.brand_name || '').toLowerCase().includes(t) &&
          !(m.director_name || m.owner_name || '').toLowerCase().includes(t) &&
          !(m.contact_person || m.representative_name || '').toLowerCase().includes(t)) return false;
    }
    if (filters.contract_status && filters.contract_status !== 'all' && (m.contract_status || 'Gözləyir') !== filters.contract_status) return false;
    return true;
  });

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]" data-testid="members-loading">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="members-page">
      <Toaster position="top-right" richColors />
      
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }} data-testid="members-title">
            Üzvlər
          </h1>
          <p className="text-slate-500 text-sm sm:text-base mt-1">Cəmi {members.length} üzv</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            onClick={exportToExcel}
            variant="outline"
            size="sm"
            className="border-[#3D4F6F] text-[#3D4F6F] hover:bg-[#3D4F6F] hover:text-white text-xs sm:text-sm"
            data-testid="export-btn"
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Excel Export</span>
          </Button>
          <Button
            onClick={() => { resetForm(); setEditingMember(null); setShowAddModal(true); }}
            size="sm"
            className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold text-xs sm:text-sm hidden"
            data-testid="add-member-btn"
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
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Axtar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm"
              data-testid="search-input"
            />
          </div>
          
          {/* Filter Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`${activeFilterCount > 0 ? 'border-[#9ACD32] bg-[#9ACD32]/10' : ''}`}
            data-testid="filter-toggle-btn"
          >
            <Filter className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Filtrlər</span>
            {activeFilterCount > 0 && (
              <Badge className="ml-1 sm:ml-2 bg-[#9ACD32] text-[#3D4F6F] text-xs">{activeFilterCount}</Badge>
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && options && (
          <div className="mt-4 pt-4 border-t border-slate-100 animate-fade-in" data-testid="filter-panel">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Sektor</Label>
                <Select value={filters.sector} onValueChange={(v) => setFilters({...filters, sector: v})}>
                  <SelectTrigger className="text-sm" data-testid="filter-sector">
                    <SelectValue placeholder="Hamısı" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Hamısı</SelectItem>
                    {options.sectors.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Paket</Label>
                <Select value={filters.package} onValueChange={(v) => setFilters({...filters, package: v})}>
                  <SelectTrigger className="text-sm" data-testid="filter-package">
                    <SelectValue placeholder="Hamısı" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Hamısı</SelectItem>
                    {options.packages.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Ölçü</Label>
                <Select value={filters.business_size} onValueChange={(v) => setFilters({...filters, business_size: v})}>
                  <SelectTrigger className="text-sm" data-testid="filter-size">
                    <SelectValue placeholder="Hamısı" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Hamısı</SelectItem>
                    {options.business_sizes.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Kurator</Label>
                <Select value={filters.curator} onValueChange={(v) => setFilters({...filters, curator: v})}>
                  <SelectTrigger className="text-sm" data-testid="filter-curator">
                    <SelectValue placeholder="Hamısı" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Hamısı</SelectItem>
                    {options.curators.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Layihə</Label>
                <Select value={filters.project} onValueChange={(v) => setFilters({...filters, project: v})}>
                  <SelectTrigger className="text-sm" data-testid="filter-project">
                    <SelectValue placeholder="Hamısı" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Hamısı</SelectItem>
                    {options.projects.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Müqavilə statusu</Label>
                <Select value={filters.contract_status} onValueChange={(v) => setFilters({...filters, contract_status: v})}>
                  <SelectTrigger className="text-sm" data-testid="filter-contract-status">
                    <SelectValue placeholder="Hamısı" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Hamısı</SelectItem>
                    {(options.contract_statuses || []).map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {activeFilterCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="mt-3 text-slate-500 text-xs"
                data-testid="clear-filters-btn"
              >
                <X className="w-3 h-3 mr-1" />
                Filtrləri təmizlə
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Mobile: Card View */}
      <div className="lg:hidden space-y-3">
        {filteredMembers.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">Üzv tapılmadı</p>
          </div>
        ) : (
          filteredMembers.map((member) => (
            <MemberCard 
              key={member.id} 
              member={member} 
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Desktop: Table View */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="members-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left font-semibold text-[#3D4F6F] px-4 py-3 text-sm">Şirkət</th>
                <th className="text-left font-semibold text-[#3D4F6F] px-4 py-3 text-sm">Sektor</th>
                <th className="text-left font-semibold text-[#3D4F6F] px-4 py-3 text-sm">Paket</th>
                <th className="text-left font-semibold text-[#3D4F6F] px-4 py-3 text-sm">Kurator</th>
                <th className="text-left font-semibold text-[#3D4F6F] px-4 py-3 text-sm">Müqavilə</th>
                <th className="text-left font-semibold text-[#3D4F6F] px-4 py-3 text-sm">Rəhbər</th>
                <th className="text-left font-semibold text-[#3D4F6F] px-4 py-3 text-sm">Əlaqədar</th>
                <th className="text-left font-semibold text-[#3D4F6F] px-4 py-3 text-sm">Email</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>Üzv tapılmadı</p>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.id} className={`border-b transition-colors ${
                    member.days_until_expiry !== null && member.days_until_expiry <= 0 ? 'bg-red-50 border-red-100 hover:bg-red-100/60' :
                    member.days_until_expiry !== null && member.days_until_expiry <= 10 ? 'bg-amber-50 border-amber-100 hover:bg-amber-100/60' :
                    'border-slate-50 hover:bg-slate-50/50'
                  }`} data-testid={`member-row-${member.id}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-[#3D4F6F] text-sm">{member.company_name}</p>
                        <Badge className={`mt-1 text-xs ${getSizeBadgeColor(member.business_size)}`}>
                          {member.business_size}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{member.sector}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${getPackageBadgeColor(member.package)}`}>
                        {member.package}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{member.curator}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs space-y-0.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          member.contract_status === 'Aktiv' ? 'bg-green-100 text-green-700' :
                          member.contract_status === 'Bağlanıb' ? 'bg-blue-100 text-blue-700' :
                          member.contract_status === 'Bitib' || member.contract_status === 'Ləğv edilib' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{member.contract_status || 'Gözləyir'}</span>
                        {member.contract_end_date && (
                          <p className={`text-[10px] ${member.days_until_expiry !== null && member.days_until_expiry <= 10 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                            {member.days_until_expiry !== null && member.days_until_expiry <= 0 ? 'Bitib!' : member.days_until_expiry !== null && member.days_until_expiry <= 10 ? `${member.days_until_expiry} gün qalıb` : member.contract_end_date}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <p className="font-medium text-slate-700">{member.director_name}</p>
                        <p className="text-slate-500 text-xs flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {member.director_phone}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <p className="font-medium text-slate-700">{member.contact_person}</p>
                        <p className="text-slate-500 text-xs flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {member.contact_phone}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-600 text-sm flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {member.company_email}
                      </span>
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
        <DialogContent className="max-w-[95vw] sm:max-w-lg lg:max-w-2xl max-h-[85vh] p-0" data-testid="member-modal">
          <DialogHeader className="p-4 sm:p-6 pb-0">
            <DialogTitle className="text-lg sm:text-xl font-bold" style={{ color: '#3D4F6F' }}>
              {editingMember ? 'Üzvü redaktə et' : 'Yeni şirkət əlavə et'}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[calc(85vh-80px)]">
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 pt-4 space-y-5">
              {/* Company Info */}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4" />
                  Şirkət məlumatları
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs sm:text-sm">Şirkət adı *</Label>
                    <Input
                      value={formData.company_name}
                      onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                      required
                      className="text-sm"
                      data-testid="input-company-name"
                    />
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Email *</Label>
                    <Input
                      type="email"
                      value={formData.company_email}
                      onChange={(e) => setFormData({...formData, company_email: e.target.value})}
                      required
                      className="text-sm"
                      data-testid="input-email"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs sm:text-sm">Sektor *</Label>
                    <Select value={formData.sector} onValueChange={(v) => setFormData({...formData, sector: v})}>
                      <SelectTrigger className="text-sm" data-testid="input-sector">
                        <SelectValue placeholder="Seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {options?.sectors.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Paket *</Label>
                    <Select value={formData.package} onValueChange={(v) => setFormData({...formData, package: v})}>
                      <SelectTrigger className="text-sm" data-testid="input-package">
                        <SelectValue placeholder="Seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {options?.packages.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Ölçü *</Label>
                    <Select value={formData.business_size} onValueChange={(v) => setFormData({...formData, business_size: v})}>
                      <SelectTrigger className="text-sm" data-testid="input-size">
                        <SelectValue placeholder="Seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {options?.business_sizes.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs sm:text-sm">Kurator *</Label>
                  <Select value={formData.curator} onValueChange={(v) => setFormData({...formData, curator: v})}>
                    <SelectTrigger className="text-sm" data-testid="input-curator">
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.curators.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Director Info */}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                  <User className="w-4 h-4" />
                  Rəhbər məlumatları
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs sm:text-sm">Rəhbərin adı *</Label>
                    <Input
                      value={formData.director_name}
                      onChange={(e) => setFormData({...formData, director_name: e.target.value})}
                      required
                      className="text-sm"
                      data-testid="input-director-name"
                    />
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Əlaqə nömrəsi *</Label>
                    <Input
                      value={formData.director_phone}
                      onChange={(e) => setFormData({...formData, director_phone: e.target.value})}
                      required
                      className="text-sm"
                      data-testid="input-director-phone"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Person */}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4" />
                  Əlaqədar şəxs
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs sm:text-sm">Əlaqədar şəxs *</Label>
                    <Input
                      value={formData.contact_person}
                      onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                      required
                      className="text-sm"
                      data-testid="input-contact-person"
                    />
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Vəzifəsi</Label>
                    <Input
                      value={formData.contact_position}
                      onChange={(e) => setFormData({...formData, contact_position: e.target.value})}
                      className="text-sm"
                      data-testid="input-contact-position"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs sm:text-sm">Əlaqə nömrəsi *</Label>
                    <Input
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                      required
                      className="text-sm"
                      data-testid="input-contact-phone"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddModal(false)}
                  className="text-sm"
                  data-testid="cancel-btn"
                >
                  Ləğv et
                </Button>
                <Button 
                  type="submit" 
                  className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold text-sm"
                  data-testid="save-member-btn"
                >
                  {editingMember ? 'Yadda saxla' : 'Əlavə et'}
                </Button>
              </div>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
