import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Plus, Download, Search, Filter, X, Loader2, User, Phone, Mail, 
  MoreVertical, Eye, ChevronLeft, Calendar, Briefcase, GraduationCap,
  MapPin, CreditCard, Clock, ChevronDown, Pencil, Trash2, Upload, MinusCircle, PlusCircle, FileText, Image
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

const ProfileAvatar = ({ employee, size = 'md' }) => {
  const sizeClasses = { sm: 'w-8 h-8 text-sm', md: 'w-12 h-12 text-lg', lg: 'w-20 h-20 text-2xl' };
  const initial = employee.first_name?.charAt(0) || employee.full_name?.charAt(0) || 'E';
  const displayName = employee.first_name && employee.last_name ? `${employee.first_name} ${employee.last_name}` : employee.full_name;
  
  if (employee.photo_url) {
    return <img src={employee.photo_url.startsWith('http') ? employee.photo_url : `${process.env.REACT_APP_BACKEND_URL}${employee.photo_url}`} alt={displayName} className={`${sizeClasses[size]} rounded-full object-cover border-2 border-slate-200`} />;
  }
  return <div className={`${sizeClasses[size]} rounded-full bg-[#3D4F6F] flex items-center justify-center text-white font-bold`}>{initial}</div>;
};

const getDisplayName = (emp) => emp.first_name && emp.last_name ? `${emp.first_name} ${emp.last_name}` : emp.full_name || '';

// Employee Detail View
const EmployeeDetail = ({ employee, onBack, onEdit }) => {
  if (!employee) return null;
  const displayName = getDisplayName(employee);
  
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-1" /> Geri</Button>
          <div className="flex items-center gap-3">
            <ProfileAvatar employee={employee} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold" style={{ color: '#3D4F6F' }}>{displayName}</h1>
                {employee.employee_code && <Badge className="bg-slate-200 text-slate-700 text-xs">{employee.employee_code}</Badge>}
              </div>
              <p className="text-sm text-slate-500">{employee.position} • {employee.department}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className={getStatusColor(employee.status)}>{employee.status}</Badge>
          <Button size="sm" onClick={() => onEdit(employee)}><Pencil className="w-4 h-4 mr-1" /> Redaktə</Button>
        </div>
      </div>

      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="personal" className="text-xs sm:text-sm">Şəxsi</TabsTrigger>
          <TabsTrigger value="education" className="text-xs sm:text-sm">Təhsil</TabsTrigger>
          <TabsTrigger value="contact" className="text-xs sm:text-sm">Əlaqə</TabsTrigger>
          <TabsTrigger value="contract" className="text-xs sm:text-sm">Müqavilə</TabsTrigger>
          <TabsTrigger value="salary" className="text-xs sm:text-sm">Əmək haqqı</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs sm:text-sm">Sənədlər</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard icon={CreditCard} label="Əməkdaş ID" value={employee.employee_code} />
            <InfoCard icon={User} label="Ad" value={employee.first_name} />
            <InfoCard icon={User} label="Soyad" value={employee.last_name} />
            <InfoCard icon={User} label="Ata adı" value={employee.father_name} />
            <InfoCard icon={Calendar} label="Doğum tarixi" value={employee.birth_date} />
            <InfoCard icon={User} label="Cins" value={employee.gender} />
            <InfoCard icon={CreditCard} label="Ş.V. seriya №" value={employee.id_card_number} />
            <InfoCard icon={CreditCard} label="FİN kod" value={employee.fin_code} />
            <InfoCard icon={User} label="Ailə vəziyyəti" value={employee.marital_status} />
            <InfoCard icon={User} label="Uşaq sayı" value={employee.children_count?.toString()} />
          </div>
          {employee.children_birth_dates?.length > 0 && (
            <div className="bg-blue-50 rounded-xl p-4">
              <h4 className="font-semibold text-blue-800 mb-2 text-sm">Uşaqların doğum tarixləri</h4>
              <div className="flex flex-wrap gap-2">
                {employee.children_birth_dates.map((d, i) => (
                  <Badge key={i} className="bg-blue-100 text-blue-700">{i+1}. uşaq: {d || '-'}</Badge>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="education" className="space-y-4">
          {employee.educations?.length > 0 ? employee.educations.map((edu, i) => (
            <div key={i} className="p-4 bg-slate-50 rounded-xl space-y-2">
              <h4 className="font-semibold text-sm text-[#3D4F6F]">Təhsil {i + 1}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoCard icon={GraduationCap} label="Təhsil səviyyəsi" value={edu.education_level} />
                <InfoCard icon={GraduationCap} label="Təhsil müəssisəsi" value={edu.education_institution} />
                <InfoCard icon={GraduationCap} label="İxtisas" value={edu.specialty} />
                <InfoCard icon={Calendar} label="Qəbul tarixi" value={edu.admission_date} />
                <InfoCard icon={Calendar} label="Bitirdiyi tarix" value={edu.graduation_date} />
              </div>
            </div>
          )) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoCard icon={GraduationCap} label="Təhsil səviyyəsi" value={employee.education_level} />
              <InfoCard icon={GraduationCap} label="Təhsil müəssisəsi" value={employee.education_institution} />
              <InfoCard icon={GraduationCap} label="İxtisas" value={employee.specialty} />
              <InfoCard icon={Calendar} label="Qəbul tarixi" value={employee.admission_date} />
              <InfoCard icon={Calendar} label="Bitirdiyi tarix" value={employee.graduation_date} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard icon={MapPin} label="Qeydiyyat ünvanı" value={employee.registration_address} />
            <InfoCard icon={MapPin} label="Faktiki ünvan" value={employee.actual_address} />
            <InfoCard icon={Phone} label="Korporativ telefon" value={employee.company_phone} />
            <InfoCard icon={Phone} label="Şəxsi telefon" value={employee.personal_phone} />
            <InfoCard icon={Mail} label="Şəxsi email" value={employee.personal_email} />
            <InfoCard icon={Mail} label="Korporativ email" value={employee.corporate_email} />
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
            <InfoCard icon={Calendar} label="Müqavilənin bağlanma tarixi" value={employee.contract_signing_date || employee.contract_start_date} />
            <InfoCard icon={Calendar} label="İşə başlama tarixi" value={employee.work_start_date} />
            <InfoCard icon={Calendar} label="Müqavilənin bitmə tarixi" value={employee.contract_indefinite ? 'Müddətsiz' : employee.contract_end_date} />
            <InfoCard icon={Calendar} label="Sınaq müddəti bitmə" value={employee.probation_end_date} />
            <InfoCard icon={Briefcase} label="Vəzifə dəyişikliyi" value={employee.position_change ? 'Bəli' : 'Xeyr'} />
            <InfoCard icon={Briefcase} label="Əməyin ödənilməsi" value={employee.payment_system} />
            <InfoCard icon={Clock} label="İş qrafiki" value={employee.work_schedule} />
            <InfoCard icon={Calendar} label="Əsas məzuniyyət" value={`${employee.main_vacation_days || 21} gün`} />
            <InfoCard icon={Calendar} label="Əlavə məzuniyyət" value={`${employee.additional_vacation_days || 0} gün`} />
            <InfoCard icon={Clock} label="Xatırlatma" value={employee.contract_reminder ? 'Aktiv' : 'Deaktiv'} />
          </div>
          {(employee.position_instructions_file || employee.employment_contract_file || employee.position_change_file) && (
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold text-sm text-slate-700 mb-3">Müqavilə sənədləri</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {employee.position_instructions_file && (
                  <a href={employee.position_instructions_file.startsWith('http') ? employee.position_instructions_file : `${process.env.REACT_APP_BACKEND_URL}${employee.position_instructions_file}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100"><FileText className="w-5 h-5 text-blue-500" /><span className="text-sm">Vəzifə təlimatları</span></a>
                )}
                {employee.employment_contract_file && (
                  <a href={employee.employment_contract_file.startsWith('http') ? employee.employment_contract_file : `${process.env.REACT_APP_BACKEND_URL}${employee.employment_contract_file}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100"><FileText className="w-5 h-5 text-green-500" /><span className="text-sm">Əmək müqaviləsi</span></a>
                )}
                {employee.position_change_file && (
                  <a href={employee.position_change_file.startsWith('http') ? employee.position_change_file : `${process.env.REACT_APP_BACKEND_URL}${employee.position_change_file}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100"><FileText className="w-5 h-5 text-amber-500" /><span className="text-sm">Vəzifə dəyişikliyi</span></a>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="salary" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-xl p-5 text-center">
              <p className="text-xs text-slate-500 mb-1">Gross əmək haqqı</p>
              <p className="text-2xl font-bold" style={{ color: '#3D4F6F' }}>{(employee.gross_salary || 0).toLocaleString()} AZN</p>
            </div>
            <div className="bg-green-50 rounded-xl p-5 text-center">
              <p className="text-xs text-green-600 mb-1">Net əmək haqqı</p>
              <p className="text-2xl font-bold text-green-600">{(employee.net_salary || 0).toLocaleString()} AZN</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-5 text-center">
              <p className="text-xs text-blue-600 mb-1">Əlavə</p>
              <p className="text-2xl font-bold text-blue-600">{(employee.salary_supplement || 0).toLocaleString()} AZN</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-5 text-center">
              <p className="text-xs text-amber-600 mb-1">Mükafatlar</p>
              <p className="text-lg font-bold text-amber-600">{employee.bonuses || '-'}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employee.criminal_record_scan && (
              <a href={employee.criminal_record_scan.startsWith('http') ? employee.criminal_record_scan : `${process.env.REACT_APP_BACKEND_URL}${employee.criminal_record_scan}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100">
                <FileText className="w-5 h-5 text-red-500" /><span className="text-sm font-medium">Məhkumluq skanı</span>
              </a>
            )}
            {employee.health_certificate_scan && (
              <a href={employee.health_certificate_scan.startsWith('http') ? employee.health_certificate_scan : `${process.env.REACT_APP_BACKEND_URL}${employee.health_certificate_scan}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100">
                <FileText className="w-5 h-5 text-green-500" /><span className="text-sm font-medium">Sağlamlıq arayışı</span>
              </a>
            )}
          </div>
          {employee.certificate_scans?.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm text-amber-800 mb-2">Sertifikatlar</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {employee.certificate_scans.map((cert, i) => (
                  <a key={i} href={cert.startsWith('http') ? cert : `${process.env.REACT_APP_BACKEND_URL}${cert}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl hover:bg-amber-100">
                    <GraduationCap className="w-5 h-5 text-amber-500" /><span className="text-sm">Sertifikat {i+1}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          {employee.document_scans?.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm text-slate-700 mb-2">Digər sənədlər</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {employee.document_scans.map((doc, i) => (
                  <a key={i} href={doc.startsWith('http') ? doc : `${process.env.REACT_APP_BACKEND_URL}${doc}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100">
                    <FileText className="w-5 h-5 text-blue-500" /><span className="text-sm">Sənəd {i+1}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          {!employee.criminal_record_scan && !employee.health_certificate_scan && (!employee.certificate_scans || employee.certificate_scans.length === 0) && (!employee.document_scans || employee.document_scans.length === 0) && (
            <p className="text-center text-slate-400 py-8">Sənəd yoxdur</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Mobile Card
const EmployeeCard = ({ employee, onView, onEdit, onDelete }) => {
  const displayName = getDisplayName(employee);
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <ProfileAvatar employee={employee} size="sm" />
          <div>
            <h3 className="font-semibold text-[#3D4F6F]">{displayName}</h3>
            <p className="text-xs text-slate-500">{employee.employee_code} • {employee.position}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(employee)}><Eye className="w-4 h-4 mr-2" />Ətraflı</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(employee)}><Pencil className="w-4 h-4 mr-2" />Redaktə</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(employee.id)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" />Sil</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-slate-600"><Briefcase className="w-3.5 h-3.5" /><span>{employee.department}</span></div>
        <div className="flex items-center gap-2 text-slate-600"><Phone className="w-3.5 h-3.5" /><span>{employee.personal_phone}</span></div>
        <div className="flex items-center justify-between mt-2">
          <Badge className={`text-xs ${getStatusColor(employee.status)}`}>{employee.status}</Badge>
          <span className="text-xs text-slate-500">{(employee.net_salary || 0).toLocaleString()} AZN</span>
        </div>
      </div>
    </div>
  );
};

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
  const [uploading, setUploading] = useState(false);

  const departments = ['Satış', 'Marketing', 'HR', 'Maliyyə', 'Layihə', 'İT', 'İdarəetmə'];
  const statuses = ['Aktiv', 'Qeyri-aktiv', 'Sınaq müddətində'];
  const genders = ['Kişi', 'Qadın'];
  const educationLevels = ['Ali', 'Orta-ixtisas', 'Orta', 'Natamam ali'];
  const maritalStatuses = ['Evli', 'Subay', 'Boşanmış'];

  const emptyEducation = { education_level: '', education_institution: '', specialty: '', admission_date: '', graduation_date: '' };

  const initialFormData = {
    photo_url: '', first_name: '', last_name: '', father_name: '', birth_date: '', gender: '',
    id_card_number: '', fin_code: '',
    educations: [{ ...emptyEducation }],
    marital_status: '', children_count: 0, children_birth_dates: [],
    registration_address: '', actual_address: '',
    company_phone: '', personal_phone: '', personal_email: '', corporate_email: '',
    emergency_contact_name: '', emergency_contact_relation: '', emergency_contact_phone: '',
    department: '', position: '', contract_signing_date: '', work_start_date: '',
    contract_end_date: '', contract_indefinite: false, probation_end_date: '',
    contract_reminder: true, position_change: false,
    salary_supplement: 0, bonuses: '', payment_system: '',
    position_instructions_file: '', employment_contract_file: '', position_change_file: '',
    main_vacation_days: 21, additional_vacation_days: 0,
    gross_salary: 0, net_salary: 0, work_schedule: '',
    criminal_record_scan: '', health_certificate_scan: '', certificate_scans: [], document_scans: [],
    status: 'Aktiv'
  };

  const [formData, setFormData] = useState(initialFormData);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const uploadFile = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      setUploading(true);
      const res = await axios.post(`${API}/upload`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
      return res.data.url;
    } catch { toast.error('Fayl yüklənmədi'); return ''; }
    finally { setUploading(false); }
  };

  const handleFileUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await uploadFile(file);
    if (url) setFormData(prev => ({ ...prev, [field]: url }));
  };

  const handleMultiFileUpload = async (e, field = 'document_scans') => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const urls = [];
    for (const file of files) {
      const url = await uploadFile(file);
      if (url) urls.push(url);
    }
    setFormData(prev => ({ ...prev, [field]: [...(prev[field] || []), ...urls] }));
  };

  const addEducation = () => setFormData(prev => ({ ...prev, educations: [...(prev.educations || []), { ...emptyEducation }] }));
  const removeEducation = (idx) => { if ((formData.educations || []).length <= 1) return; setFormData(prev => ({ ...prev, educations: prev.educations.filter((_, i) => i !== idx) })); };
  const updateEducation = (idx, field, value) => { const eds = [...(formData.educations || [])]; eds[idx] = { ...eds[idx], [field]: value }; setFormData({ ...formData, educations: eds }); };

  const updateChildrenCount = (delta) => {
    const newCount = Math.max(0, (formData.children_count || 0) + delta);
    const dates = [...(formData.children_birth_dates || [])];
    while (dates.length < newCount) dates.push('');
    setFormData({ ...formData, children_count: newCount, children_birth_dates: dates.slice(0, newCount) });
  };

  const updateChildDate = (idx, value) => {
    const dates = [...(formData.children_birth_dates || [])];
    dates[idx] = value;
    setFormData({ ...formData, children_birth_dates: dates });
  };

  const fetchEmployees = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => { if (value && value !== 'all') params.append(key, value); });
      const response = await axios.get(`${API}/employees?${params.toString()}`, { headers });
      setEmployees(response.data);
    } catch { toast.error('Əməkdaşlar yüklənmədi'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Build full_name for backward compat
    const submitData = { ...formData, full_name: `${formData.first_name} ${formData.last_name}`.trim() };
    try {
      if (editingEmployee) {
        await axios.put(`${API}/employees/${editingEmployee.id}`, submitData, { headers });
        toast.success('Əməkdaş yeniləndi');
      } else {
        await axios.post(`${API}/employees`, submitData, { headers });
        toast.success('Yeni əməkdaş əlavə edildi');
      }
      setShowModal(false); setEditingEmployee(null); setFormData(initialFormData); fetchEmployees();
    } catch (error) { toast.error(error.response?.data?.detail || 'Xəta baş verdi'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu əməkdaşı silmək istədiyinizə əminsiniz?')) return;
    try { await axios.delete(`${API}/employees/${id}`, { headers }); toast.success('Əməkdaş silindi'); fetchEmployees(); }
    catch { toast.error('Silinmə zamanı xəta'); }
  };

  const handleEdit = (emp) => {
    setEditingEmployee(emp);
    const data = { ...initialFormData, ...emp };
    if (!data.first_name && data.full_name) {
      const parts = data.full_name.split(' ');
      data.first_name = parts[0] || '';
      data.last_name = parts.slice(1).join(' ') || '';
    }
    if (!data.children_birth_dates) data.children_birth_dates = [];
    while (data.children_birth_dates.length < (data.children_count || 0)) data.children_birth_dates.push('');
    if (!data.personal_email && data.email) data.personal_email = data.email;
    // Backward compat: migrate old single education to educations array
    if (!data.educations || data.educations.length === 0) {
      data.educations = [{ education_level: data.education_level || '', education_institution: data.education_institution || '', specialty: data.specialty || '', admission_date: data.admission_date || '', graduation_date: data.graduation_date || '' }];
    }
    // Backward compat: contract_start_date → contract_signing_date
    if (!data.contract_signing_date && data.contract_start_date) data.contract_signing_date = data.contract_start_date;
    if (!data.certificate_scans) data.certificate_scans = [];
    if (!data.document_scans) data.document_scans = [];
    setFormData(data);
    setActiveTab('personal');
    setShowModal(true);
  };

  const exportToExcel = () => {
    const csvContent = [
      ['ID', 'Ad', 'Soyad', 'Şöbə', 'Vəzifə', 'Telefon', 'Email', 'Gross', 'Net', 'Status'].join(','),
      ...filteredEmployees.map(e => [
        `"${e.employee_code || ''}"`, `"${e.first_name || ''}"`, `"${e.last_name || ''}"`,
        `"${e.department}"`, `"${e.position}"`, `"${e.personal_phone}"`,
        `"${e.personal_email || e.email || ''}"`, e.gross_salary || 0, e.net_salary || 0, `"${e.status}"`
      ].join(','))
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `marsol_emekdaslar_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Excel faylı yükləndi');
  };

  const filteredEmployees = employees.filter(e => {
    const name = getDisplayName(e).toLowerCase();
    const term = searchTerm.toLowerCase();
    return name.includes(term) || e.position?.toLowerCase().includes(term) || e.department?.toLowerCase().includes(term) || e.employee_code?.toLowerCase().includes(term);
  });

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length;

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} /></div>;

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
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Insan Resurları</h1>
          <p className="text-slate-500 text-sm mt-1">Cəmi {employees.length} əməkdaş</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={exportToExcel} variant="outline" size="sm" className="text-xs sm:text-sm" data-testid="export-btn">
            <Download className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Excel Export</span>
          </Button>
          <Button onClick={() => { setFormData(initialFormData); setEditingEmployee(null); setActiveTab('personal'); setShowModal(true); }}
            size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold text-xs sm:text-sm" data-testid="add-employee-btn">
            <Plus className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Əməkdaş əlavə et</span><span className="sm:hidden">Əlavə et</span>
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 sm:p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Axtar (ad, vəzifə, ID)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 text-sm" data-testid="search-input" />
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
                <SelectContent><SelectItem value="all">Hamısı</SelectItem>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Hamısı</SelectItem>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredEmployees.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl p-8 text-center"><User className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p className="text-slate-500">Əməkdaş tapılmadı</p></div>
        ) : filteredEmployees.map(emp => <EmployeeCard key={emp.id} employee={emp} onView={setViewingEmployee} onEdit={handleEdit} onDelete={handleDelete} />)}
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {['ID', 'Əməkdaş', 'Şöbə', 'Vəzifə', 'Telefon', 'Email', 'Əmək haqqı', 'Status', ''].map(h => (
                <th key={h} className={`text-left font-semibold text-[#3D4F6F] px-4 py-3 text-sm ${!h ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-slate-500"><User className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p>Əməkdaş tapılmadı</p></td></tr>
            ) : filteredEmployees.map(emp => (
              <tr key={emp.id} className="border-b border-slate-50 hover:bg-slate-50/50" data-testid={`employee-row-${emp.id}`}>
                <td className="px-4 py-3 text-xs text-slate-500 font-mono">{emp.employee_code}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ProfileAvatar employee={emp} size="sm" />
                    <span className="font-medium text-sm">{getDisplayName(emp)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{emp.department}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{emp.position}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{emp.personal_phone}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{emp.personal_email || emp.corporate_email || emp.email}</td>
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
            ))}
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
                  <TabsTrigger value="education" className="text-xs">Təhsil</TabsTrigger>
                  <TabsTrigger value="contact" className="text-xs">Əlaqə</TabsTrigger>
                  <TabsTrigger value="contract" className="text-xs">Müqavilə</TabsTrigger>
                  <TabsTrigger value="salary" className="text-xs">Əmək haqqı</TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs">Sənədlər</TabsTrigger>
                </TabsList>

                {/* ŞƏXSİ TAB */}
                <TabsContent value="personal" className="space-y-4" data-testid="personal-tab">
                  {/* Photo upload */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {formData.photo_url ? (
                        <img src={formData.photo_url.startsWith('http') ? formData.photo_url : `${process.env.REACT_APP_BACKEND_URL}${formData.photo_url}`} alt="Profile" className="w-20 h-24 rounded-lg object-cover border-2 border-slate-200" />
                      ) : (
                        <div className="w-20 h-24 rounded-lg bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center">
                          <Image className="w-6 h-6 text-slate-400" />
                          <span className="text-[10px] text-slate-400 mt-1">3x4</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs font-semibold">Profil şəkli (3x4)</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <label className="cursor-pointer">
                          <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'photo_url')} className="hidden" data-testid="photo-upload" />
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                            <Upload className="w-3.5 h-3.5" /> {uploading ? 'Yüklənir...' : 'Şəkil seç'}
                          </span>
                        </label>
                        {formData.photo_url && <Button type="button" variant="ghost" size="sm" onClick={() => setFormData({...formData, photo_url: ''})}><X className="w-3.5 h-3.5 text-red-500" /></Button>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Ad *</Label><Input value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} required className="text-sm" data-testid="first-name-input" placeholder="Ad" /></div>
                    <div><Label className="text-xs">Soyad *</Label><Input value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} required className="text-sm" data-testid="last-name-input" placeholder="Soyad" /></div>
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
                    <div><Label className="text-xs">Qeydiyyat ünvanı</Label><Input value={formData.registration_address} onChange={(e) => setFormData({...formData, registration_address: e.target.value})} className="text-sm" /></div>
                  </div>

                  {/* Children */}
                  <div className="p-3 bg-slate-50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Uşaqların sayı</Label>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => updateChildrenCount(-1)} className="h-8 w-8 p-0" data-testid="children-minus"><MinusCircle className="w-5 h-5 text-red-500" /></Button>
                        <span className="text-lg font-bold w-8 text-center" style={{ color: '#3D4F6F' }}>{formData.children_count || 0}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => updateChildrenCount(1)} className="h-8 w-8 p-0" data-testid="children-plus"><PlusCircle className="w-5 h-5 text-green-500" /></Button>
                      </div>
                    </div>
                    {formData.children_count > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {Array.from({ length: formData.children_count }).map((_, i) => (
                          <div key={i}>
                            <Label className="text-xs">{i+1}. uşağın doğum tarixi</Label>
                            <Input type="date" value={formData.children_birth_dates?.[i] || ''} onChange={(e) => updateChildDate(i, e.target.value)} className="text-sm" data-testid={`child-date-${i}`} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* TƏHSİL TAB */}
                <TabsContent value="education" className="space-y-4" data-testid="education-tab">
                  {(formData.educations || []).map((edu, ei) => (
                    <div key={ei} className="p-4 bg-slate-50 rounded-lg space-y-3 relative">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-[#3D4F6F]">Təhsil {ei + 1}</h4>
                        {(formData.educations || []).length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeEducation(ei)} data-testid={`remove-education-${ei}`}><X className="w-4 h-4 text-red-500" /></Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Təhsil səviyyəsi</Label>
                          <Select value={edu.education_level} onValueChange={(v) => updateEducation(ei, 'education_level', v)}>
                            <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                            <SelectContent>{educationLevels.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div><Label className="text-xs">Təhsil müəssisəsi</Label><Input value={edu.education_institution} onChange={(e) => updateEducation(ei, 'education_institution', e.target.value)} className="text-sm" placeholder="Universitet / Kollec" /></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div><Label className="text-xs">İxtisas</Label><Input value={edu.specialty} onChange={(e) => updateEducation(ei, 'specialty', e.target.value)} className="text-sm" placeholder="İxtisas adı" /></div>
                        <div><Label className="text-xs">Qəbul tarixi</Label><Input type="date" value={edu.admission_date} onChange={(e) => updateEducation(ei, 'admission_date', e.target.value)} className="text-sm" /></div>
                        <div><Label className="text-xs">Bitirdiyi tarix</Label><Input type="date" value={edu.graduation_date} onChange={(e) => updateEducation(ei, 'graduation_date', e.target.value)} className="text-sm" /></div>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addEducation} className="w-full border-dashed" data-testid="add-education-btn">
                    <PlusCircle className="w-4 h-4 mr-2 text-green-500" /> Təhsil əlavə et
                  </Button>
                </TabsContent>

                {/* ƏLAQƏ TAB */}
                <TabsContent value="contact" className="space-y-4" data-testid="contact-tab">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Şəxsi telefon *</Label><Input value={formData.personal_phone} onChange={(e) => setFormData({...formData, personal_phone: e.target.value})} required className="text-sm" /></div>
                    <div><Label className="text-xs">Korporativ telefon</Label><Input value={formData.company_phone} onChange={(e) => setFormData({...formData, company_phone: e.target.value})} className="text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Şəxsi email</Label><Input type="email" value={formData.personal_email} onChange={(e) => setFormData({...formData, personal_email: e.target.value})} className="text-sm" data-testid="personal-email" /></div>
                    <div><Label className="text-xs">Korporativ email</Label><Input type="email" value={formData.corporate_email} onChange={(e) => setFormData({...formData, corporate_email: e.target.value})} className="text-sm" data-testid="corporate-email" /></div>
                  </div>
                  <div><Label className="text-xs">Faktiki ünvan</Label><Input value={formData.actual_address} onChange={(e) => setFormData({...formData, actual_address: e.target.value})} className="text-sm" /></div>
                  <h4 className="font-semibold text-sm text-slate-700 pt-2">Təcili əlaqə</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Ad</Label><Input value={formData.emergency_contact_name} onChange={(e) => setFormData({...formData, emergency_contact_name: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">Yaxınlıq dərəcəsi</Label><Input value={formData.emergency_contact_relation} onChange={(e) => setFormData({...formData, emergency_contact_relation: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">Telefon</Label><Input value={formData.emergency_contact_phone} onChange={(e) => setFormData({...formData, emergency_contact_phone: e.target.value})} className="text-sm" /></div>
                  </div>
                </TabsContent>

                {/* MÜQAVİLƏ TAB */}
                <TabsContent value="contract" className="space-y-4" data-testid="contract-tab">
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Müqavilənin bağlanma tarixi</Label><Input type="date" value={formData.contract_signing_date} onChange={(e) => setFormData({...formData, contract_signing_date: e.target.value})} className="text-sm" data-testid="contract-signing-date" /></div>
                    <div><Label className="text-xs">İşə başlama tarixi</Label><Input type="date" value={formData.work_start_date} onChange={(e) => setFormData({...formData, work_start_date: e.target.value})} className="text-sm" data-testid="work-start-date" /></div>
                    <div>
                      <Label className="text-xs">Müqavilənin bitmə tarixi</Label>
                      <div className="flex items-center gap-2">
                        <Input type="date" value={formData.contract_indefinite ? '' : formData.contract_end_date} onChange={(e) => setFormData({...formData, contract_end_date: e.target.value})} className="text-sm flex-1" disabled={formData.contract_indefinite} />
                        <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                          <input type="checkbox" checked={formData.contract_indefinite || false} onChange={(e) => setFormData({...formData, contract_indefinite: e.target.checked, contract_end_date: e.target.checked ? '' : formData.contract_end_date})} className="rounded" data-testid="contract-indefinite" />
                          <span className="text-xs text-slate-600">Müddətsiz</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Sınaq müddətinin bitmə tarixi</Label><Input type="date" value={formData.probation_end_date} onChange={(e) => setFormData({...formData, probation_end_date: e.target.value})} className="text-sm" /></div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={formData.contract_reminder || false} onChange={(e) => setFormData({...formData, contract_reminder: e.target.checked})} className="rounded" data-testid="contract-reminder" />
                        <span className="text-xs text-slate-600">Xatırlatma (bitməsinə 1 ay qalmış)</span>
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Vəzifə dəyişikliyi</Label>
                      <Select value={formData.position_change ? 'Bəli' : 'Xeyr'} onValueChange={(v) => setFormData({...formData, position_change: v === 'Bəli'})}>
                        <SelectTrigger className="text-sm" data-testid="position-change-select"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="Bəli">Bəli</SelectItem><SelectItem value="Xeyr">Xeyr</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Əməyin ödənilməsi sistemi</Label>
                      <Select value={formData.payment_system} onValueChange={(v) => setFormData({...formData, payment_system: v})}>
                        <SelectTrigger className="text-sm" data-testid="payment-system-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent><SelectItem value="Vaxtamuzd">Vaxtamuzd</SelectItem><SelectItem value="İşəmuzd">İşəmuzd</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Əsas məzuniyyət (gün)</Label><Input type="number" value={formData.main_vacation_days} onChange={(e) => setFormData({...formData, main_vacation_days: parseInt(e.target.value) || 0})} className="text-sm" /></div>
                    <div><Label className="text-xs">Əlavə məzuniyyət (gün)</Label><Input type="number" value={formData.additional_vacation_days} onChange={(e) => setFormData({...formData, additional_vacation_days: parseInt(e.target.value) || 0})} className="text-sm" /></div>
                    <div><Label className="text-xs">İş qrafiki</Label><Input value={formData.work_schedule} onChange={(e) => setFormData({...formData, work_schedule: e.target.value})} placeholder="Məs: 09:00-18:00" className="text-sm" /></div>
                  </div>
                  {/* Fayl yükləmələr */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                      <Label className="text-xs font-semibold">Vəzifə təlimatları</Label>
                      {formData.position_instructions_file ? (
                        <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-green-500" /><span className="text-xs text-green-600 flex-1">Yüklənib</span><Button type="button" variant="ghost" size="sm" onClick={() => setFormData({...formData, position_instructions_file: ''})}><X className="w-3.5 h-3.5 text-red-500" /></Button></div>
                      ) : (
                        <label className="cursor-pointer"><input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleFileUpload(e, 'position_instructions_file')} className="hidden" data-testid="position-instructions-upload" /><span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 rounded-lg border border-slate-200"><Upload className="w-3.5 h-3.5" /> Fayl seç</span></label>
                      )}
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                      <Label className="text-xs font-semibold">Əmək müqaviləsi</Label>
                      {formData.employment_contract_file ? (
                        <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-green-500" /><span className="text-xs text-green-600 flex-1">Yüklənib</span><Button type="button" variant="ghost" size="sm" onClick={() => setFormData({...formData, employment_contract_file: ''})}><X className="w-3.5 h-3.5 text-red-500" /></Button></div>
                      ) : (
                        <label className="cursor-pointer"><input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleFileUpload(e, 'employment_contract_file')} className="hidden" data-testid="employment-contract-upload" /><span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 rounded-lg border border-slate-200"><Upload className="w-3.5 h-3.5" /> Fayl seç</span></label>
                      )}
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                      <Label className="text-xs font-semibold">Vəzifə dəyişikliyi faylı</Label>
                      {formData.position_change_file ? (
                        <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-green-500" /><span className="text-xs text-green-600 flex-1">Yüklənib</span><Button type="button" variant="ghost" size="sm" onClick={() => setFormData({...formData, position_change_file: ''})}><X className="w-3.5 h-3.5 text-red-500" /></Button></div>
                      ) : (
                        <label className="cursor-pointer"><input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleFileUpload(e, 'position_change_file')} className="hidden" data-testid="position-change-upload" /><span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 rounded-lg border border-slate-200"><Upload className="w-3.5 h-3.5" /> Fayl seç</span></label>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* ƏMƏK HAQQI TAB */}
                <TabsContent value="salary" className="space-y-4" data-testid="salary-tab">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Gross əmək haqqı (AZN)</Label><Input type="number" value={formData.gross_salary} onChange={(e) => setFormData({...formData, gross_salary: parseFloat(e.target.value) || 0})} className="text-sm" /></div>
                    <div><Label className="text-xs">Net əmək haqqı (AZN)</Label><Input type="number" value={formData.net_salary} onChange={(e) => setFormData({...formData, net_salary: parseFloat(e.target.value) || 0})} className="text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Əmək haqqına əlavə (AZN)</Label><Input type="number" value={formData.salary_supplement} onChange={(e) => setFormData({...formData, salary_supplement: parseFloat(e.target.value) || 0})} className="text-sm" data-testid="salary-supplement" /></div>
                    <div><Label className="text-xs">Mükafatlar</Label><Input value={formData.bonuses} onChange={(e) => setFormData({...formData, bonuses: e.target.value})} placeholder="Mükafat məlumatları" className="text-sm" data-testid="bonuses-input" /></div>
                  </div>
                </TabsContent>

                {/* SƏNƏDLƏR TAB */}
                <TabsContent value="documents" className="space-y-4" data-testid="documents-tab">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                      <Label className="text-xs font-semibold">Məhkumluq skanı</Label>
                      {formData.criminal_record_scan ? (
                        <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-green-500" /><span className="text-xs text-green-600 truncate flex-1">Yüklənib</span><Button type="button" variant="ghost" size="sm" onClick={() => setFormData({...formData, criminal_record_scan: ''})}><X className="w-3.5 h-3.5 text-red-500" /></Button></div>
                      ) : (
                        <label className="cursor-pointer"><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileUpload(e, 'criminal_record_scan')} className="hidden" data-testid="criminal-record-upload" /><span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 rounded-lg border border-slate-200"><Upload className="w-3.5 h-3.5" /> Fayl seç</span></label>
                      )}
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                      <Label className="text-xs font-semibold">Sağlamlıq arayışı skanı</Label>
                      {formData.health_certificate_scan ? (
                        <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-green-500" /><span className="text-xs text-green-600 truncate flex-1">Yüklənib</span><Button type="button" variant="ghost" size="sm" onClick={() => setFormData({...formData, health_certificate_scan: ''})}><X className="w-3.5 h-3.5 text-red-500" /></Button></div>
                      ) : (
                        <label className="cursor-pointer"><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileUpload(e, 'health_certificate_scan')} className="hidden" data-testid="health-cert-upload" /><span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 rounded-lg border border-slate-200"><Upload className="w-3.5 h-3.5" /> Fayl seç</span></label>
                      )}
                    </div>
                  </div>
                  {/* Sertifikat skanları */}
                  <div className="p-4 bg-amber-50 rounded-lg space-y-3">
                    <Label className="text-xs font-semibold text-amber-800">Sertifikatlar</Label>
                    {formData.certificate_scans?.length > 0 && (
                      <div className="space-y-1">
                        {formData.certificate_scans.map((cert, i) => (
                          <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2">
                            <GraduationCap className="w-4 h-4 text-amber-500" />
                            <span className="text-xs truncate flex-1">Sertifikat {i+1}</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setFormData({...formData, certificate_scans: formData.certificate_scans.filter((_, j) => j !== i)})}><X className="w-3.5 h-3.5 text-red-500" /></Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="cursor-pointer">
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" multiple onChange={(e) => handleMultiFileUpload(e, 'certificate_scans')} className="hidden" data-testid="certificate-scans-upload" />
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors">
                        <Upload className="w-3.5 h-3.5" /> Sertifikat əlavə et
                      </span>
                    </label>
                  </div>
                  {/* Digər sənədlər */}
                  <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                    <Label className="text-xs font-semibold">Digər sənədlər</Label>
                    {formData.document_scans?.length > 0 && (
                      <div className="space-y-1">
                        {formData.document_scans.map((doc, i) => (
                          <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2">
                            <FileText className="w-4 h-4 text-blue-500" />
                            <span className="text-xs truncate flex-1">Sənəd {i+1}</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setFormData({...formData, document_scans: formData.document_scans.filter((_, j) => j !== i)})}><X className="w-3.5 h-3.5 text-red-500" /></Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="cursor-pointer">
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" multiple onChange={(e) => handleMultiFileUpload(e, 'document_scans')} className="hidden" data-testid="document-scans-upload" />
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors">
                        <Upload className="w-3.5 h-3.5" /> Sənəd əlavə et
                      </span>
                    </label>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t mt-6">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="text-sm">Ləğv et</Button>
                <Button type="submit" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold text-sm" disabled={uploading} data-testid="submit-employee-btn">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
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
