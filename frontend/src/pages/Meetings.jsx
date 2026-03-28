import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Plus, Loader2, Calendar, Clock, MapPin, User, Building2,
  MoreVertical, Pencil, Trash2, Phone, FileText, CheckCircle2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Toaster, toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const meetingTypes = ['Satış görüşü', 'Daxili iclas', 'Müştəri görüşü', 'Partnyor görüşü', 'Təqdimat'];

const getTypeColor = (type) => {
  switch (type) {
    case 'Satış görüşü': return 'bg-green-100 text-green-700';
    case 'Daxili iclas': return 'bg-blue-100 text-blue-700';
    case 'Müştəri görüşü': return 'bg-purple-100 text-purple-700';
    case 'Partnyor görüşü': return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-700';
  }
};

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('all');

  const initialFormData = {
    employee: '', meeting_setter: '', date: new Date().toISOString().split('T')[0],
    time: '10:00', company: '', contact_person: '', project: '', meeting_type: '',
    location: '', result: '', next_meeting: '', notes: ''
  };

  const [formData, setFormData] = useState(initialFormData);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchMeetings = useCallback(async () => {
    try {
      const params = filter !== 'all' ? `?meeting_type=${filter}` : '';
      const response = await axios.get(`${API}/meetings${params}`, { headers });
      setMeetings(response.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/meetings`, formData, { headers });
      toast.success('Görüş əlavə edildi');
      setShowModal(false);
      setFormData(initialFormData);
      fetchMeetings();
    } catch (error) {
      toast.error('Xəta baş verdi');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu görüşü silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/meetings/${id}`, { headers });
      toast.success('Görüş silindi');
      fetchMeetings();
    } catch (error) {
      toast.error('Silinmə zamanı xəta');
    }
  };

  // Group meetings by date
  const groupedMeetings = meetings.reduce((acc, meeting) => {
    const date = meeting.date || 'Tarixsiz';
    if (!acc[date]) acc[date] = [];
    acc[date].push(meeting);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedMeetings).sort((a, b) => new Date(b) - new Date(a));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="meetings-page">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Görüşlər</h1>
          <p className="text-slate-500 text-sm mt-1">Cəmi {meetings.length} görüş</p>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px] text-sm">
              <SelectValue placeholder="Hamısı" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Hamısı</SelectItem>
              {meetingTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setFormData(initialFormData); setShowModal(true); }}
            className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold text-xs sm:text-sm">
            <Plus className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Görüş əlavə et</span>
          </Button>
        </div>
      </div>

      {/* Meetings Timeline */}
      {sortedDates.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500">Görüş tapılmadı</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#3D4F6F] flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <h2 className="font-semibold text-[#3D4F6F]">
                  {new Date(date).toLocaleDateString('az-AZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </h2>
              </div>
              
              <div className="ml-5 border-l-2 border-slate-200 pl-8 space-y-4">
                {groupedMeetings[date].map(meeting => (
                  <div key={meeting.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 relative">
                    {/* Timeline dot */}
                    <div className="absolute -left-[41px] top-5 w-4 h-4 rounded-full bg-[#9ACD32] border-4 border-white shadow" />
                    
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`text-xs ${getTypeColor(meeting.meeting_type)}`}>
                            {meeting.meeting_type}
                          </Badge>
                          <span className="text-sm text-slate-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {meeting.time}
                          </span>
                        </div>
                        
                        {meeting.company && (
                          <p className="font-semibold text-[#3D4F6F] flex items-center gap-2 mb-1">
                            <Building2 className="w-4 h-4" />
                            {meeting.company}
                          </p>
                        )}
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600 mt-2">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5" />
                            <span>{meeting.employee}</span>
                          </div>
                          {meeting.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{meeting.location}</span>
                            </div>
                          )}
                          {meeting.contact_person && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5" />
                              <span>{meeting.contact_person}</span>
                            </div>
                          )}
                        </div>

                        {meeting.result && (
                          <div className="mt-3 p-2 bg-green-50 rounded-lg text-sm">
                            <span className="text-green-700 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              Nəticə:
                            </span>
                            <p className="text-green-600 mt-1">{meeting.result}</p>
                          </div>
                        )}

                        {meeting.notes && (
                          <p className="text-sm text-slate-500 mt-2 italic">"{meeting.notes}"</p>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDelete(meeting.id)} className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />Sil
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>Görüş əlavə et</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Əməkdaş *</Label><Input value={formData.employee} onChange={(e) => setFormData({...formData, employee: e.target.value})} required className="text-sm" /></div>
              <div><Label className="text-xs">Görüş təyin edən</Label><Input value={formData.meeting_setter} onChange={(e) => setFormData({...formData, meeting_setter: e.target.value})} className="text-sm" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Tarix *</Label><Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required className="text-sm" /></div>
              <div><Label className="text-xs">Saat *</Label><Input type="time" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} required className="text-sm" /></div>
              <div>
                <Label className="text-xs">Növ *</Label>
                <Select value={formData.meeting_type} onValueChange={(v) => setFormData({...formData, meeting_type: v})}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{meetingTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Şirkət</Label><Input value={formData.company} onChange={(e) => setFormData({...formData, company: e.target.value})} className="text-sm" /></div>
              <div><Label className="text-xs">Əlaqədar şəxs</Label><Input value={formData.contact_person} onChange={(e) => setFormData({...formData, contact_person: e.target.value})} className="text-sm" /></div>
            </div>
            <div><Label className="text-xs">Məkan</Label><Input value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className="text-sm" /></div>
            <div><Label className="text-xs">Nəticə</Label><Input value={formData.result} onChange={(e) => setFormData({...formData, result: e.target.value})} className="text-sm" /></div>
            <div><Label className="text-xs">Qeydlər</Label><Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="text-sm" rows={2} /></div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Ləğv et</Button>
              <Button type="submit" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold">Əlavə et</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
