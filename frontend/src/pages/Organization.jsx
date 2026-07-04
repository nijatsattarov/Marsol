import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Plus, Search, Loader2, Calendar, MapPin, Users2, Clock,
  Pencil, Trash2, ChevronRight, Phone, PhoneOff, PhoneCall,
  CheckCircle2, XCircle, Sparkles, RefreshCw, X, Building2,
  ArrowRightLeft, UserPlus, Eye, MessageCircle, Link, AlertTriangle,
  ExternalLink, Send
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';
import { usePermissions, canEdit } from '../context/PermissionContext';
import { formatDate } from '../lib/dateUtils';
import { DatePickerAz, TimeSelectAz } from '../components/DateTimePickerAz';
import { validateRequired } from '../lib/validate';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const EVENT_TYPES = ['Breakfast', 'Ofis ziyarəti', 'Mafia', 'Sosial fəaliyyət', 'Təlim', 'B2B görüş'];
const EVENT_STATUSES = ['Planlaşdırılır', 'Aktiv', 'Tamamlandı', 'Ləğv edildi'];

const emptyEvent = {
  name: '', event_type: '', date: '', time: '', venue: '', location_link: '',
  participant_limit: 20, host_company_id: '', host_company_name: '',
  status: 'Planlaşdırılır', notes: '',
  venue_photos: [],          // array of {url, filename}
  venue_video_links: [],     // array of strings (YouTube / Vimeo URLs)
};

function formatWhatsAppLink(phone, event, ownerName) {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('0')) cleaned = '994' + cleaned.substring(1);
  if (!cleaned.startsWith('+') && !cleaned.startsWith('994')) cleaned = '994' + cleaned;
  cleaned = cleaned.replace('+', '');

  const eventType = event.event_type === 'Breakfast' ? 'işgüzar səhər yeməyinə' :
    event.event_type === 'Ofis ziyarəti' ? 'ofis ziyarətinə' :
    event.event_type === 'Mafia' ? 'Mafia oyununa' :
    event.event_type === 'B2B görüş' ? 'B2B görüşə' :
    event.event_type === 'Təlim' ? 'təlimə' :
    event.event_type === 'Sosial fəaliyyət' ? 'sosial fəaliyyətə' : 'fəaliyyətə';

  let msg = `Hörmətli ${ownerName}, sizi ${event.date} tarixində`;
  if (event.time) msg += ` saat ${event.time}-da`;
  msg += ` ${event.venue || 'Marsol Group'}-da baş tutacaq ${eventType} dəvət edirik.`;
  if (event.location_link) msg += `\n\nMəkan: ${event.location_link}`;
  msg += `\n\nMarsol Group`;

  return `https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}`;
}

export default function Organization() {
  const [events, setEvents] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyEvent);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestCount, setSuggestCount] = useState(20);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [invLoading, setInvLoading] = useState(false);
  const [searchCompany, setSearchCompany] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [whatsAppTarget, setWhatsAppTarget] = useState(null);
  const [customPhone, setCustomPhone] = useState('');
  const [sectorWarning, setSectorWarning] = useState(null);

  // Öhdəliklər siyahısı — replaces the removed "Manual əlavə et" flow.
  // Loaded lazily when an event is selected.
  const [obligations, setObligations] = useState([]);
  const [oblLoading, setOblLoading] = useState(false);
  const [oblSearch, setOblSearch] = useState('');
  const [oblPackageFilter, setOblPackageFilter] = useState('all');

  const token = localStorage.getItem('token');
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'organization');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchEvents = useCallback(async () => {
    try {
      const [evRes, cmpRes] = await Promise.all([
        axios.get(`${API}/events`, { headers }),
        axios.get(`${API}/options/companies`, { headers }),
      ]);
      setEvents(evRes.data);
      setCompanies(cmpRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const fetchInvitations = async (eventId) => {
    try {
      setInvLoading(true);
      const res = await axios.get(`${API}/invitations?event_id=${eventId}`, { headers });
      setInvitations(res.data);
    } catch (err) { console.error(err); }
    finally { setInvLoading(false); }
  };

  const openEventModal = (event = null) => {
    if (event) { setEditing(event); setForm({ ...event }); }
    else { setEditing(null); setForm(emptyEvent); }
    setShowEventModal(true);
  };

  const handleEventSubmit = async (e) => {
    e.preventDefault();
    if (!validateRequired([
      [form.name, 'Fəaliyyət adı'],
      [form.event_type, 'Növ'],
      [form.date, 'Tarix'],
      [form.participant_limit, 'İştirakçı limiti'],
    ])) return;
    try {
      if (editing) {
        const updated = await axios.put(`${API}/events/${editing.id}`, form, { headers });
        toast.success('Fəaliyyət yeniləndi');
        if (selectedEvent?.id === editing.id) setSelectedEvent(updated.data);
      } else {
        await axios.post(`${API}/events`, form, { headers });
        toast.success('Fəaliyyət yaradıldı');
      }
      setShowEventModal(false);
      fetchEvents();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm('Bu fəaliyyəti silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/events/${id}`, { headers });
      toast.success('Fəaliyyət silindi');
      if (selectedEvent?.id === id) { setSelectedEvent(null); setInvitations([]); }
      fetchEvents();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const selectEvent = (event) => {
    setSelectedEvent(event);
    fetchInvitations(event.id);
    setSuggestions([]);
    setShowSuggestions(false);
    fetchObligations();
  };

  const fetchObligations = async () => {
    setOblLoading(true);
    try {
      const year = new Date().getFullYear();
      const res = await axios.get(`${API}/obligations/dashboard?year=${year}`, { headers });
      // Sort by priority_score DESC (urgent first) — matches Öhdəliklər page.
      const sorted = [...(res.data.obligations || [])].sort(
        (a, b) => (b.priority_score || 0) - (a.priority_score || 0)
      );
      setObligations(sorted);
    } catch {
      toast.error('Öhdəliklər siyahısı yüklənmədi');
    } finally {
      setOblLoading(false);
    }
  };

  const handleQuickInvite = async (companyId, status) => {
    if (!selectedEvent) return;
    try {
      await axios.post(`${API}/events/${selectedEvent.id}/quick-invite`,
        { company_id: companyId, status }, { headers });
      toast.success(`${status} olaraq qeyd olundu`);
      fetchInvitations(selectedEvent.id);
    } catch (err) {
      if (err.response?.status === 409) {
        toast.warning('Bu şirkət artıq bu fəaliyyətə dəvət olunub');
      } else {
        toast.error('Əməliyyat alınmadı');
      }
    }
  };

  const handleAutoSuggest = async () => {
    if (!selectedEvent) return;
    try {
      setInvLoading(true);
      const res = await axios.post(`${API}/events/${selectedEvent.id}/auto-suggest`,
        { count: suggestCount }, { headers });
      setSuggestions(res.data.suggestions);
      setShowSuggestions(true);
      toast.success(`${res.data.suggestions.length} şirkət təklif olundu (sektor toqquşması nəzərə alındı)`);
    } catch { toast.error('Xəta baş verdi'); }
    finally { setInvLoading(false); }
  };

  const handleBulkInvite = async (companyIds) => {
    if (!selectedEvent) return;
    try {
      const res = await axios.post(`${API}/invitations/bulk`,
        { event_id: selectedEvent.id, company_ids: companyIds }, { headers });
      toast.success(`${res.data.created} dəvət yaradıldı`);
      fetchInvitations(selectedEvent.id);
      setShowSuggestions(false);
      setSuggestions([]);
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleCallStatus = async (invId, callStatus, participationStatus = '') => {
    try {
      await axios.put(`${API}/invitations/${invId}/call`,
        { call_status: callStatus, participation_status: participationStatus }, { headers });
      toast.success('Status yeniləndi');
      fetchInvitations(selectedEvent.id);
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleRemoveInvitation = async (invId) => {
    try {
      await axios.delete(`${API}/invitations/${invId}`, { headers });
      toast.success('Dəvət silindi');
      fetchInvitations(selectedEvent.id);
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleSaveInvitationNote = async (invId, notes) => {
    try {
      await axios.put(`${API}/invitations/${invId}/notes`, { notes }, { headers });
      toast.success('Qeyd saxlandı');
      // Update local state without refetch to keep focus
      setInvitations(prev => prev.map(i => i.id === invId ? { ...i, notes } : i));
    } catch { toast.error('Qeyd saxlanılmadı'); }
  };

  const removeSuggestion = (companyId) => {
    setSuggestions(prev => prev.filter(s => s.company_id !== companyId));
  };

  const checkSectorConflict = async (companyId) => {
    if (!selectedEvent) return null;
    try {
      const res = await axios.post(`${API}/events/${selectedEvent.id}/check-sector-conflict`,
        { company_id: companyId }, { headers });
      return res.data;
    } catch { return null; }
  };

  const addManualCompany = async (companyId) => {
    if (!selectedEvent) return;
    const conflict = await checkSectorConflict(companyId);
    if (conflict?.conflict) {
      setSectorWarning({ companyId, ...conflict });
      return;
    }
    await doAddCompany(companyId);
  };

  const doAddCompany = async (companyId) => {
    const company = companies.find(c => c.id === companyId);
    try {
      await axios.post(`${API}/invitations`, {
        event_id: selectedEvent.id,
        event_name: selectedEvent.name,
        event_type: selectedEvent.event_type,
        event_date: selectedEvent.date,
        company_id: companyId,
        company_name: company?.brand_name || ''
      }, { headers });
      toast.success('Dəvət əlavə edildi');
      fetchInvitations(selectedEvent.id);
      setShowInviteModal(false);
      setSectorWarning(null);
    } catch { toast.error('Xəta baş verdi'); }
  };

  const openWhatsApp = (inv) => {
    const company = companies.find(c => c.id === inv.company_id);
    setWhatsAppTarget({ inv, company });
    setCustomPhone('');
    setShowWhatsAppModal(true);
  };

  const sendWhatsApp = async (phone) => {
    if (!whatsAppTarget || !selectedEvent) return;
    const cleaned = (phone || '').replace(/\D/g, '');
    if (!cleaned) { toast.error('Telefon nömrəsi yoxdur'); return; }
    try {
      // 1) Generate branded invitation card on backend (Cloudinary URL + wa.me link)
      toast.info('Dəvətnamə hazırlanır...');
      const res = await axios.post(
        `${API}/invitations/${whatsAppTarget.inv.id}/generate-card`,
        { phone, guest_name: whatsAppTarget.company?.owner_name || whatsAppTarget.inv.company_name },
        { headers }
      );
      const { url, whatsapp_link, filename } = res.data || {};
      if (!url) { toast.error('Dəvətnamə yaradıla bilmədi'); return; }

      // 2) Fetch the PNG as a Blob (so we can share it as a real bitmap)
      let file = null;
      try {
        const imgResp = await fetch(url, { mode: 'cors' });
        const blob = await imgResp.blob();
        file = new File([blob], filename || 'invitation.png', { type: 'image/png' });
      } catch (e) {
        // fall through to fallback
      }

      // 3) Web Share API: native share (mobile) — opens WhatsApp with image attached
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: selectedEvent.name,
            text: decodeURIComponent((whatsapp_link.split('?text=')[1] || '').replace(/\+/g, ' ')),
          });
          setShowWhatsAppModal(false);
          toast.success('Dəvətnamə şəkli paylaşıldı');
          return;
        } catch (e) {
          // user cancelled, fall through to fallback
          if (e?.name === 'AbortError') return;
        }
      }

      // 4) Desktop fallback: download PNG file + open WhatsApp Web
      if (file) {
        const objUrl = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
      }
      // Also try to copy the image to clipboard (Chrome/Edge support)
      try {
        if (file && navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': file })]);
          toast.success('Şəkil endirildi və yaddaşa kopyalandı. WhatsApp-da Ctrl+V ilə yapışdırın.');
        } else {
          toast.success('Şəkil endirildi. WhatsApp-da şəkli əlavə edin (sürükləyib qoyun və ya skrepka düyməsindən seçin).');
        }
      } catch (e) {
        toast.success('Şəkil endirildi. WhatsApp-da şəkli əlavə edin.');
      }
      window.open(whatsapp_link, '_blank');
      setShowWhatsAppModal(false);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.detail || 'Dəvətnamə yaradıla bilmədi');
    }
  };

  const filteredEvents = events.filter(e => {
    if (filterType !== 'all' && e.event_type !== filterType) return false;
    return true;
  });

  const invitedCompanyIds = new Set(invitations.map(i => i.company_id));
  const availableCompanies = companies.filter(c =>
    !invitedCompanyIds.has(c.id) &&
    (searchCompany ? c.brand_name?.toLowerCase().includes(searchCompany.toLowerCase()) : true)
  );

  const getCallBadge = (inv) => {
    if (inv.call_status === 'Cavab verdi' && inv.participation_status === 'Qatılır')
      return <Badge className="bg-green-100 text-green-700 text-xs">Qatılır</Badge>;
    if (inv.call_status === 'Cavab verdi' && inv.participation_status === 'Qatılmır')
      return <Badge className="bg-red-100 text-red-700 text-xs">Qatılmır</Badge>;
    if (inv.call_status === 'Cavab vermədi')
      return <Badge className="bg-amber-100 text-amber-700 text-xs">Cavab vermədi</Badge>;
    return <Badge className="bg-slate-100 text-slate-600 text-xs">Gözləyir</Badge>;
  };

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="organization-page">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Fəaliyyətlər</h1>
          <p className="text-slate-500 text-sm mt-1">Həftəlik fəaliyyət planlaması və dəvət idarəetməsi</p>
        </div>
        <Button onClick={() => openEventModal()} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="add-event-btn">
          <Plus className="w-4 h-4 mr-1" />Yeni Fəaliyyət
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Events List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[#3D4F6F]">Fəaliyyətlər</h2>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px] text-xs h-8"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Hamısı</SelectItem>
                  {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 max-h-[65vh] overflow-y-auto" data-testid="events-list">
              {filteredEvents.length === 0 && <p className="text-center text-slate-400 text-sm py-8">Fəaliyyət yoxdur</p>}
              {filteredEvents.map(event => (
                <div
                  key={event.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedEvent?.id === event.id ? 'border-[#9ACD32] bg-[#9ACD32]/5' : 'border-slate-100 hover:border-slate-200'}`}
                  onClick={() => selectEvent(event)}
                  data-testid={`event-card-${event.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[#3D4F6F] truncate">{event.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <Badge className="text-[10px] bg-[#3D4F6F]/10 text-[#3D4F6F]">{event.event_type}</Badge>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{event.date}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        {event.venue && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.venue}</span>}
                        <span className="flex items-center gap-1"><Users2 className="w-3 h-3" />Limit: {event.participant_limit}</span>
                      </div>
                      {event.location_link && (
                        <a href={event.location_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 mt-1 text-xs text-blue-500 hover:text-blue-700" onClick={(e) => e.stopPropagation()}>
                          <ExternalLink className="w-3 h-3" />Xəritə
                        </a>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button onClick={(e) => { e.stopPropagation(); openEventModal(event); }} className="p-1 hover:bg-slate-100 rounded"><Pencil className="w-3.5 h-3.5 text-slate-400" /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Invitations Panel */}
        <div className="lg:col-span-2">
          {!selectedEvent ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-400">Sol tərəfdən fəaliyyət seçin</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Event Header */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[#3D4F6F]">{selectedEvent.name}</h2>
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                      <Badge className="bg-[#3D4F6F]/10 text-[#3D4F6F]">{selectedEvent.event_type}</Badge>
                      <span>{selectedEvent.date} {selectedEvent.time}</span>
                      {selectedEvent.venue && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{selectedEvent.venue}</span>}
                    </div>
                    {selectedEvent.host_company_name && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Building2 className="w-3 h-3" />Ev sahibi: <strong>{selectedEvent.host_company_name}</strong></p>
                    )}
                    {selectedEvent.location_link && (
                      <a href={selectedEvent.location_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-blue-500 hover:text-blue-700">
                        <ExternalLink className="w-3 h-3" />Google Maps
                      </a>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#3D4F6F]">{invitations.length}<span className="text-sm font-normal text-slate-400">/{selectedEvent.participant_limit}</span></p>
                    <p className="text-xs text-slate-400">Dəvət olunub</p>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 flex flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={suggestCount}
                    onChange={(e) => setSuggestCount(parseInt(e.target.value) || 0)}
                    className="w-20 h-8 text-sm"
                    min={1}
                    data-testid="suggest-count-input"
                  />
                  <Button
                    size="sm"
                    onClick={handleAutoSuggest}
                    disabled={invLoading}
                    className="bg-[#3D4F6F] hover:bg-[#2A364C] text-white h-8"
                    data-testid="auto-suggest-btn"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1" />Avto təklif
                  </Button>
                </div>
              </div>

              {/* Suggestions Panel */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4" data-testid="suggestions-panel">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-amber-800 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />Təklif olunan şirkətlər ({suggestions.length})
                      <span className="text-xs font-normal text-amber-600">(sektor toqquşması nəzərə alınıb)</span>
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleBulkInvite(suggestions.map(s => s.company_id))}
                        className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] h-7 text-xs"
                        data-testid="invite-all-btn"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />Hamısını dəvət et
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setShowSuggestions(false); setSuggestions([]); }} className="h-7 text-xs">
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {suggestions.map((s, idx) => (
                      <div key={s.company_id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-amber-100">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-amber-600 font-mono w-6">#{idx + 1}</span>
                          <div>
                            <p className="text-sm font-medium text-[#3D4F6F]">{s.company_name}</p>
                            <p className="text-xs text-slate-500">
                              {s.package} · Qalan: <strong className="text-red-600">{s.remaining_quota}</strong>/{s.total_quota}
                              {s.sector && <span className="text-slate-400 ml-1">· {s.sector}</span>}
                              {s.days_remaining < 90 && <span className="text-red-500 ml-1">({s.days_remaining} gün qalıb)</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleBulkInvite([s.company_id])} className="h-7 text-xs text-green-600 hover:text-green-700">
                            <CheckCircle2 className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => removeSuggestion(s.company_id)} className="h-7 text-xs text-red-500 hover:text-red-600">
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invitations List */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-[#3D4F6F]">Dəvət siyahısı ({invitations.length})</h3>
                  <div className="flex gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" />{invitations.filter(i => i.participation_status === 'Qatılır').length} qatılır</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" />{invitations.filter(i => i.participation_status === 'Qatılmır').length} rədd</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" />{invitations.filter(i => i.call_status === 'Cavab vermədi').length} cavabsız</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300" />{invitations.filter(i => i.call_status === 'Gözləyir').length} gözləyir</span>
                  </div>
                </div>
                {invLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#3D4F6F]" /></div>
                ) : invitations.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">Hələ dəvət yoxdur. "Avto təklif" istifadə edin.</div>
                ) : (
                  <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto" data-testid="invitations-list">
                    {invitations.map((inv, idx) => (
                      <div key={inv.id} className="px-3 py-2.5 hover:bg-slate-50/50" data-testid={`invitation-row-${inv.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-xs text-slate-400 font-mono w-6">{idx + 1}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#3D4F6F] truncate">{inv.company_name}</p>
                              <p className="text-xs text-slate-400">
                                {inv.called_by && `Zəng: ${inv.called_by}`}
                                {inv.called_at && ` · ${formatDate(inv.called_at)}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getCallBadge(inv)}

                            {/* WhatsApp button */}
                            <button
                              onClick={() => openWhatsApp(inv)}
                              className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                              title="WhatsApp ilə dəvət göndər"
                              data-testid={`invitation-row-whatsapp-btn-${inv.id}`}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>

                            {/* Call status buttons */}
                            {(inv.call_status === 'Gözləyir' || inv.call_status === 'Cavab vermədi') && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleCallStatus(inv.id, 'Cavab verdi', 'Qatılır')}
                                  className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                                  title="Qatılır"
                                  data-testid={`call-accept-${inv.id}`}
                                >
                                  <PhoneCall className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleCallStatus(inv.id, 'Cavab verdi', 'Qatılmır')}
                                  className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
                                  title="Qatılmır"
                                  data-testid={`call-decline-${inv.id}`}
                                >
                                  <PhoneOff className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleCallStatus(inv.id, 'Cavab vermədi')}
                                  className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition-colors"
                                  title="Cavab vermədi"
                                  data-testid={`call-noanswer-${inv.id}`}
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            <button onClick={() => handleRemoveInvitation(inv.id)} className="p-1 hover:bg-red-50 rounded">
                              <Trash2 className="w-3.5 h-3.5 text-red-300 hover:text-red-500" />
                            </button>
                          </div>
                        </div>
                        {/* Per-invitation note (e.g. non-attendance reason) */}
                        <div className="ml-9 mt-1.5">
                          <input
                            type="text"
                            defaultValue={inv.notes || ''}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v !== (inv.notes || '')) handleSaveInvitationNote(inv.id, v);
                            }}
                            placeholder="Qeyd / qatılmama səbəbi..."
                            className="w-full text-[11px] px-2 py-1 rounded border border-slate-200 bg-slate-50/40 focus:bg-white focus:border-[#9ACD32] focus:outline-none transition-colors"
                            data-testid={`invitation-note-${inv.id}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* --- ÖHDƏLİKLƏR SİYAHISI (replaces Manual əlavə et) --- */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4" data-testid="obligations-panel">
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm text-[#3D4F6F]">
                    Öhdəliklər siyahısı ({obligations.filter(o => {
                      const s = oblSearch.toLowerCase();
                      const matchS = !s || (o.company_name || '').toLowerCase().includes(s) || (o.owner_name || '').toLowerCase().includes(s);
                      const matchP = oblPackageFilter === 'all' || o.package === oblPackageFilter;
                      return matchS && matchP;
                    }).length})
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input value={oblSearch} onChange={(e) => setOblSearch(e.target.value)} placeholder="Şirkət axtar..." className="h-8 pl-7 text-xs w-48" data-testid="obl-search" />
                    </div>
                    <Select value={oblPackageFilter} onValueChange={setOblPackageFilter}>
                      <SelectTrigger className="h-8 text-xs w-32" data-testid="obl-package-filter"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Bütün paketlər</SelectItem>
                        {Array.from(new Set(obligations.map(o => o.package).filter(Boolean))).map(p =>
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {oblLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-[#3D4F6F]" /></div>
                ) : (
                  <div className="border border-slate-100 rounded-lg overflow-hidden max-h-[500px] overflow-y-auto" data-testid="obligations-table">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr className="text-left text-slate-600">
                          <th className="p-2">Şirkət</th>
                          <th className="p-2">Paket</th>
                          <th className="p-2 text-center">Qalıb</th>
                          <th className="p-2 text-center">Müddət</th>
                          <th className="p-2 text-right">Əməliyyat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {obligations.filter(o => {
                          const s = oblSearch.toLowerCase();
                          const matchS = !s || (o.company_name || '').toLowerCase().includes(s) || (o.owner_name || '').toLowerCase().includes(s);
                          const matchP = oblPackageFilter === 'all' || o.package === oblPackageFilter;
                          return matchS && matchP;
                        }).map((o) => {
                          const alreadyInvited = invitedCompanyIds.has(o.company_id);
                          const daysColor = o.days_remaining < 30 ? 'text-red-600 font-semibold' : o.days_remaining < 90 ? 'text-amber-600' : 'text-slate-500';
                          return (
                            <tr key={o.company_id} className={`border-t border-slate-100 hover:bg-slate-50 ${alreadyInvited ? 'bg-slate-50/60 opacity-70' : ''}`} data-testid={`obl-row-${o.company_id}`}>
                              <td className="p-2">
                                <div className="font-medium text-[#3D4F6F]">{o.company_name}</div>
                                {o.owner_name && <div className="text-[10px] text-slate-500">{o.owner_name}</div>}
                              </td>
                              <td className="p-2 text-slate-600">{o.package || '-'}</td>
                              <td className="p-2 text-center font-mono">
                                <span className={o.remaining_quota <= 0 ? 'text-emerald-600' : o.remaining_quota <= 2 ? 'text-red-600 font-bold' : 'text-slate-700'}>
                                  {o.remaining_quota}/{o.total_quota}
                                </span>
                              </td>
                              <td className={`p-2 text-center ${daysColor}`}>{o.days_remaining}g</td>
                              <td className="p-2">
                                <div className="flex items-center gap-1 justify-end">
                                  <button
                                    onClick={() => handleQuickInvite(o.company_id, 'Qatılır')}
                                    className="w-7 h-7 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors"
                                    title="Qatılır (dəvət olunmuş və gələcək)"
                                    data-testid={`quick-invite-yes-${o.company_id}`}
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleQuickInvite(o.company_id, 'Qatılmır')}
                                    className="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors"
                                    title="Qatılmır (dəvət olunmuş amma rədd)"
                                    data-testid={`quick-invite-no-${o.company_id}`}
                                  >
                                    <PhoneOff className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleQuickInvite(o.company_id, 'Cavab vermədi')}
                                    className="w-7 h-7 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-600 flex items-center justify-center transition-colors"
                                    title="Cavab vermədi (kvota tükənmir)"
                                    data-testid={`quick-invite-noans-${o.company_id}`}
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {obligations.length === 0 && !oblLoading && (
                          <tr><td colSpan={5} className="text-center p-4 text-slate-400">Öhdəlik siyahısı boşdur</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Event Form Modal */}
      <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>{editing ? 'Fəaliyyəti redaktə et' : 'Yeni Fəaliyyət'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEventSubmit} className="space-y-4" data-testid="event-form">
            <div>
              <Label className="text-xs">Fəaliyyət adı *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="text-sm" data-testid="event-name-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Növ *</Label>
                <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tarix *</Label>
                <DatePickerAz value={form.date} onChange={(v) => setForm({ ...form, date: v })} required testId="event-date-input" />
              </div>
              <div>
                <Label className="text-xs">Saat</Label>
                <TimeSelectAz value={form.time} onChange={(v) => setForm({ ...form, time: v })} testId="event-time-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Məkan</Label>
                <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">İştirakçı limiti *</Label>
                <Input type="number" value={form.participant_limit} onChange={(e) => setForm({ ...form, participant_limit: parseInt(e.target.value) || 0 })} className="text-sm" min={1} data-testid="event-limit-input" />
              </div>
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><Link className="w-3 h-3" />Google Maps linki</Label>
              <Input
                value={form.location_link}
                onChange={(e) => setForm({ ...form, location_link: e.target.value })}
                placeholder="https://maps.google.com/..."
                className="text-sm"
                data-testid="event-location-link"
              />
            </div>

            {/* Venue photos — file upload only (no URL pasting) */}
            <div className="border border-slate-200 rounded-md p-2 bg-slate-50">
              <Label className="text-xs font-medium flex items-center gap-1 mb-1.5">Məkan şəkilləri (fayl)</Label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  e.target.value = '';
                  if (!files.length) return;
                  const token = localStorage.getItem('token');
                  const uploaded = [];
                  for (const f of files) {
                    try {
                      const fd = new FormData();
                      fd.append('file', f);
                      const r = await axios.post(`${API}/upload`, fd, { headers: { Authorization: `Bearer ${token}` } });
                      uploaded.push({ url: r.data.url, filename: r.data.filename });
                    } catch (_err) { toast.error(`${f.name} yüklənmədi`); }
                  }
                  if (uploaded.length) {
                    setForm(prev => ({ ...prev, venue_photos: [...(prev.venue_photos || []), ...uploaded] }));
                    toast.success(`${uploaded.length} şəkil yükləndi`);
                  }
                }}
                className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-[#3D4F6F] file:text-white"
                data-testid="venue-photo-upload"
              />
              {(form.venue_photos || []).length > 0 && (
                <div className="grid grid-cols-4 gap-1 mt-2">
                  {form.venue_photos.map((p, i) => (
                    <div key={i} className="relative group">
                      <img src={p.url} alt={p.filename || ''} className="w-full h-16 object-cover rounded border" />
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, venue_photos: prev.venue_photos.filter((_, idx) => idx !== i) }))}
                        className="absolute top-0.5 right-0.5 bg-white/90 hover:bg-red-500 hover:text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] shadow"
                        aria-label="Sil"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Venue videos — links only (YouTube/Vimeo etc.) */}
            <div className="border border-slate-200 rounded-md p-2 bg-slate-50">
              <Label className="text-xs font-medium flex items-center gap-1 mb-1.5">Məkan videoları (link)</Label>
              {(form.venue_video_links || []).map((v, i) => (
                <div key={i} className="flex gap-1 mb-1">
                  <Input
                    value={v}
                    onChange={(e) => setForm(prev => ({
                      ...prev,
                      venue_video_links: prev.venue_video_links.map((x, idx) => idx === i ? e.target.value : x)
                    }))}
                    placeholder="https://youtube.com/watch?v=..."
                    className="text-xs h-7"
                  />
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, venue_video_links: prev.venue_video_links.filter((_, idx) => idx !== i) }))}
                    className="text-red-500 hover:text-red-700 px-1 text-xs"
                  >×</button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, venue_video_links: [...(prev.venue_video_links || []), ''] }))}
                className="text-xs text-[#3D4F6F] hover:underline mt-1"
                data-testid="add-video-link-btn"
              >+ Video linki əlavə et</button>
            </div>
            {form.event_type === 'Ofis ziyarəti' && (
              <div>
                <Label className="text-xs">Ev sahibi şirkət (ofis sahibi)</Label>
                <Select value={form.host_company_id} onValueChange={(v) => {
                  const c = companies.find(x => x.id === v);
                  setForm({ ...form, host_company_id: v, host_company_name: c?.brand_name || '' });
                }}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Şirkət seçin" /></SelectTrigger>
                  <SelectContent>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.brand_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Qeyd</Label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full min-h-[60px] p-2 text-sm border rounded-lg resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowEventModal(false)}>Ləğv et</Button>
              <Button type="submit" className="bg-[#3D4F6F] hover:bg-[#2A364C] text-white" data-testid="event-submit-btn">{editing ? 'Yadda saxla' : 'Yarat'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manual Add Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>Şirkət əlavə et</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Şirkət axtar..."
                value={searchCompany}
                onChange={(e) => setSearchCompany(e.target.value)}
                className="pl-10 text-sm"
                data-testid="search-company-input"
              />
            </div>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {availableCompanies.map(c => (
                <button
                  key={c.id}
                  onClick={() => addManualCompany(c.id)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors text-left"
                  data-testid={`add-company-${c.id}`}
                >
                  <div>
                    <p className="text-sm font-medium text-[#3D4F6F]">{c.brand_name}</p>
                    <p className="text-xs text-slate-500">
                      {c.owner_name} · {c.package}
                      {c.sector && <span className="text-slate-400"> · {c.sector}</span>}
                      {c.sub_sector && <span className="text-slate-400"> · {c.sub_sector}</span>}
                    </p>
                  </div>
                  <Plus className="w-4 h-4 text-[#9ACD32]" />
                </button>
              ))}
              {availableCompanies.length === 0 && <p className="text-center text-slate-400 text-sm py-4">Şirkət tapılmadı</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sector Conflict Warning Modal */}
      <Dialog open={!!sectorWarning} onOpenChange={(open) => { if (!open) setSectorWarning(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600"><AlertTriangle className="w-5 h-5" />Sektor toqquşması</DialogTitle>
          </DialogHeader>
          {sectorWarning && (
            <div className="space-y-4">
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                <p className="text-sm text-amber-800">
                  Bu şirkətin <strong>{sectorWarning.conflict_value}</strong> {sectorWarning.conflict_type}u artıq siyahıda mövcuddur:
                </p>
                <p className="text-sm font-semibold text-amber-900 mt-1">{sectorWarning.conflicting_company}</p>
              </div>
              <p className="text-xs text-slate-500">Yenə də əlavə etmək istəyirsiniz?</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setSectorWarning(null)}>Ləğv et</Button>
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={() => doAddCompany(sectorWarning.companyId)}
                  data-testid="confirm-sector-conflict"
                >
                  Bəli, əlavə et
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* WhatsApp Modal */}
      <Dialog open={showWhatsAppModal} onOpenChange={setShowWhatsAppModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: '#3D4F6F' }}>
              <MessageCircle className="w-5 h-5 text-green-600" />WhatsApp Dəvət
            </DialogTitle>
          </DialogHeader>
          {whatsAppTarget && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <p className="text-sm font-medium text-[#3D4F6F]">{whatsAppTarget.inv.company_name}</p>
                <p className="text-xs text-slate-500">{whatsAppTarget.company?.owner_name}</p>
              </div>

              {/* Owner phone */}
              {whatsAppTarget.company?.owner_phone && (
                <button
                  onClick={() => sendWhatsApp(whatsAppTarget.company.owner_phone)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 transition-colors"
                  data-testid="whatsapp-owner-phone"
                >
                  <div>
                    <p className="text-sm font-medium text-green-800">Sahibkar nömrəsi</p>
                    <p className="text-xs text-green-600">{whatsAppTarget.company.owner_phone}</p>
                  </div>
                  <Send className="w-4 h-4 text-green-600" />
                </button>
              )}

              {/* Company phone */}
              {whatsAppTarget.company?.company_phone && whatsAppTarget.company.company_phone !== whatsAppTarget.company.owner_phone && (
                <button
                  onClick={() => sendWhatsApp(whatsAppTarget.company.company_phone)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 transition-colors"
                  data-testid="whatsapp-company-phone"
                >
                  <div>
                    <p className="text-sm font-medium text-green-800">Şirkət nömrəsi</p>
                    <p className="text-xs text-green-600">{whatsAppTarget.company.company_phone}</p>
                  </div>
                  <Send className="w-4 h-4 text-green-600" />
                </button>
              )}

              {/* Custom phone */}
              <div>
                <Label className="text-xs text-slate-500">Başqa nömrəyə göndər</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="+994 50 123 4567"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    className="text-sm flex-1"
                    data-testid="whatsapp-custom-phone"
                  />
                  <Button
                    size="sm"
                    onClick={() => sendWhatsApp(customPhone)}
                    disabled={!customPhone.trim()}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid="whatsapp-send-custom"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Preview */}
              {selectedEvent && (
                <div className="bg-green-50/50 rounded-lg p-3 border border-green-100">
                  <p className="text-[10px] text-green-700 font-medium mb-1">Dəvətnamə şəkli (PNG) + mətn:</p>
                  <p className="text-xs text-green-800 whitespace-pre-wrap">
                    {`Hörmətli ${whatsAppTarget.company?.owner_name || whatsAppTarget.inv.company_name},\nSizi "${selectedEvent.name}" tədbirinə dəvət edirik.\nTarix: ${selectedEvent.date}${selectedEvent.time ? ` ${selectedEvent.time}` : ''}${selectedEvent.venue ? `\nÜnvan: ${selectedEvent.venue}` : ''}\n\nDəvətnamə şəkli WhatsApp mesajında avtomatik göstəriləcək.`}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
