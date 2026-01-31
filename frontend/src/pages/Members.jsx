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
  Trash2
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';

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
    project: ''
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
        if (value) params.append(key, value);
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

  const filteredMembers = members.filter(m => 
    m.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.director_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.contact_person.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" data-testid="members-loading">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8" data-testid="members-page">
      <Toaster position="top-right" richColors />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#3D4F6F' }} data-testid="members-title">
            Üzvlər
          </h1>
          <p className="text-slate-500 mt-1">Cəmi {members.length} üzv</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            onClick={exportToExcel}
            variant="outline"
            className="border-[#3D4F6F] text-[#3D4F6F] hover:bg-[#3D4F6F] hover:text-white"
            data-testid="export-btn"
          >
            <Download className="w-4 h-4 mr-2" />
            Excel Export
          </Button>
          <Button
            onClick={() => { resetForm(); setEditingMember(null); setShowAddModal(true); }}
            className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold"
            data-testid="add-member-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Şirkət əlavə et
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Şirkət, rəhbər və ya əlaqədar adı ilə axtar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="search-input"
            />
          </div>
          
          {/* Filter Toggle */}
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`${activeFilterCount > 0 ? 'border-[#9ACD32] bg-[#9ACD32]/10' : ''}`}
            data-testid="filter-toggle-btn"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtrlər
            {activeFilterCount > 0 && (
              <Badge className="ml-2 bg-[#9ACD32] text-[#3D4F6F]">{activeFilterCount}</Badge>
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && options && (
          <div className="mt-4 pt-4 border-t border-slate-100 animate-fade-in" data-testid="filter-panel">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Sektor</Label>
                <Select value={filters.sector} onValueChange={(v) => setFilters({...filters, sector: v})}>
                  <SelectTrigger data-testid="filter-sector">
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
                  <SelectTrigger data-testid="filter-package">
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
                  <SelectTrigger data-testid="filter-size">
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
                  <SelectTrigger data-testid="filter-curator">
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
                  <SelectTrigger data-testid="filter-project">
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
            </div>
            
            {activeFilterCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="mt-4 text-slate-500"
                data-testid="clear-filters-btn"
              >
                <X className="w-4 h-4 mr-1" />
                Filtrləri təmizlə
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <Table data-testid="members-table">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold text-[#3D4F6F]">Şirkət</TableHead>
                <TableHead className="font-semibold text-[#3D4F6F]">Sektor</TableHead>
                <TableHead className="font-semibold text-[#3D4F6F]">Paket</TableHead>
                <TableHead className="font-semibold text-[#3D4F6F]">Kurator</TableHead>
                <TableHead className="font-semibold text-[#3D4F6F]">Rəhbər</TableHead>
                <TableHead className="font-semibold text-[#3D4F6F]">Əlaqədar</TableHead>
                <TableHead className="font-semibold text-[#3D4F6F]">Email</TableHead>
                <TableHead className="font-semibold text-[#3D4F6F] text-right">Əməliyyat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                    <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>Üzv tapılmadı</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers.map((member) => (
                  <TableRow key={member.id} className="hover:bg-slate-50 transition-colors" data-testid={`member-row-${member.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-semibold text-[#3D4F6F]">{member.company_name}</p>
                        <Badge className={`mt-1 text-xs ${getSizeBadgeColor(member.business_size)}`}>
                          {member.business_size}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{member.sector}</TableCell>
                    <TableCell>
                      <Badge className={getPackageBadgeColor(member.package)}>
                        {member.package}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">{member.curator}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium text-slate-700">{member.director_name}</p>
                        <p className="text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {member.director_phone}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium text-slate-700">{member.contact_person}</p>
                        <p className="text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {member.contact_phone}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-600 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {member.company_email}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`member-actions-${member.id}`}>
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(member)} data-testid={`edit-member-${member.id}`}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Redaktə et
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(member.id)}
                            className="text-red-600"
                            data-testid={`delete-member-${member.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Sil
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="member-modal">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold" style={{ color: '#3D4F6F' }}>
              {editingMember ? 'Üzvü redaktə et' : 'Yeni şirkət əlavə et'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            {/* Company Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Şirkət məlumatları
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Şirkət adı *</Label>
                  <Input
                    value={formData.company_name}
                    onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                    required
                    data-testid="input-company-name"
                  />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={formData.company_email}
                    onChange={(e) => setFormData({...formData, company_email: e.target.value})}
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Sektor *</Label>
                  <Select value={formData.sector} onValueChange={(v) => setFormData({...formData, sector: v})}>
                    <SelectTrigger data-testid="input-sector">
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
                  <Label>Paket *</Label>
                  <Select value={formData.package} onValueChange={(v) => setFormData({...formData, package: v})}>
                    <SelectTrigger data-testid="input-package">
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
                  <Label>Ölçü *</Label>
                  <Select value={formData.business_size} onValueChange={(v) => setFormData({...formData, business_size: v})}>
                    <SelectTrigger data-testid="input-size">
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
                <Label>Kurator *</Label>
                <Select value={formData.curator} onValueChange={(v) => setFormData({...formData, curator: v})}>
                  <SelectTrigger data-testid="input-curator">
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
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4" />
                Rəhbər məlumatları
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Rəhbərin adı *</Label>
                  <Input
                    value={formData.director_name}
                    onChange={(e) => setFormData({...formData, director_name: e.target.value})}
                    required
                    data-testid="input-director-name"
                  />
                </div>
                <div>
                  <Label>Rəhbər əlaqə nömrəsi *</Label>
                  <Input
                    value={formData.director_phone}
                    onChange={(e) => setFormData({...formData, director_phone: e.target.value})}
                    required
                    data-testid="input-director-phone"
                  />
                </div>
              </div>
            </div>

            {/* Contact Person */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Əlaqədar şəxs
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Əlaqədar şəxs *</Label>
                  <Input
                    value={formData.contact_person}
                    onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                    required
                    data-testid="input-contact-person"
                  />
                </div>
                <div>
                  <Label>Əlaqə nömrəsi *</Label>
                  <Input
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                    required
                    data-testid="input-contact-phone"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowAddModal(false)}
                data-testid="cancel-btn"
              >
                Ləğv et
              </Button>
              <Button 
                type="submit" 
                className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold"
                data-testid="save-member-btn"
              >
                {editingMember ? 'Yadda saxla' : 'Əlavə et'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
