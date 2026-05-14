import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Send, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MeetingRequestModal({ open, onClose, currentUserId, meetingTypes = [], onSent }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    date: '',
    time: '',
    meeting_type: '',
    meeting_mode: 'Offline',
    location: '',
    notes: '',
    recipient_ids: [],
  });
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!open) return;
    axios.get(`${API}/settings/users`, { headers })
      .then(r => setUsers((r.data || []).filter(u => (u.status || 'Aktiv') === 'Aktiv' && u.id !== currentUserId)))
      .catch(() => {});
    // reset form when reopened
    setForm({ date: '', time: '', meeting_type: '', meeting_mode: 'Offline', location: '', notes: '', recipient_ids: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentUserId]);

  const toggleRecipient = (uid) => {
    setForm(prev => ({
      ...prev,
      recipient_ids: prev.recipient_ids.includes(uid)
        ? prev.recipient_ids.filter(x => x !== uid)
        : [...prev.recipient_ids, uid],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.recipient_ids.length === 0) { toast.error('Ən az 1 iştirakçı seçin'); return; }
    if (!form.date || !form.time) { toast.error('Tarix və saat boş ola bilməz'); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/meeting-requests`, form, { headers });
      toast.success(`${form.recipient_ids.length} istifadəçiyə görüş təklifi göndərildi`);
      onSent && onSent();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xəta baş verdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="meeting-request-modal">
        <DialogHeader>
          <DialogTitle className="text-[#3D4F6F]">Görüş istəyi göndər</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Daxili istifadəçilərə görüş təklifi göndərin. Hər iştirakçı təsdiq verdikdə görüş hər iki tərəfin siyahısına əlavə olunur.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="meeting-request-form">
          <div>
            <Label className="text-xs">İştirakçılar *</Label>
            <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1 bg-slate-50">
              {users.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">Aktiv istifadəçi tapılmadı</p>
              ) : users.map(u => {
                const active = form.recipient_ids.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleRecipient(u.id)}
                    className={`w-full text-left flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-xs transition-colors ${active ? 'bg-emerald-100 border border-emerald-300' : 'bg-white hover:bg-slate-100 border border-transparent'}`}
                    data-testid={`recipient-${u.id}`}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-[#3D4F6F]">{u.name}</p>
                      <p className="text-[10px] text-slate-500">{u.email}{u.department ? ` · ${u.department}` : ''}</p>
                    </div>
                    {active && <Badge className="bg-emerald-600 text-white text-[10px]">Seçildi</Badge>}
                  </button>
                );
              })}
            </div>
            {form.recipient_ids.length > 0 && (
              <p className="text-[10px] text-slate-500 mt-1">{form.recipient_ids.length} iştirakçı seçildi</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tarix *</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required data-testid="mr-date" />
            </div>
            <div>
              <Label className="text-xs">Saat *</Label>
              <Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} required data-testid="mr-time" />
            </div>
            <div>
              <Label className="text-xs">Görüş növü</Label>
              <Select value={form.meeting_type || '__none__'} onValueChange={(v) => setForm({ ...form, meeting_type: v === '__none__' ? '' : v })}>
                <SelectTrigger data-testid="mr-type"><SelectValue placeholder="Seçin" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Seçilməyib —</SelectItem>
                  {meetingTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Format</Label>
              <Select value={form.meeting_mode} onValueChange={(v) => setForm({ ...form, meeting_mode: v })}>
                <SelectTrigger data-testid="mr-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Offline">Offline</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Yer / Link</Label>
              <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="məs. Ofis 201 və ya https://meet.google.com/..." data-testid="mr-location" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Qeyd / mövzu</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Görüşün mövzusu" data-testid="mr-notes" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Ləğv et</Button>
            <Button type="submit" className="bg-[#3D4F6F] hover:bg-[#3D4F6F]/90 text-white" disabled={loading} data-testid="mr-submit">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1" />Təklif göndər</>}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


/** Sidebar drawer listing pending meeting requests addressed to current user. */
export function MeetingRequestInbox({ open, onClose, currentUserId, onAccepted }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/meeting-requests`, { headers });
      setRequests(r.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) fetchRequests(); /* eslint-disable-next-line */ }, [open]);

  const respond = async (reqId, action) => {
    setActing(reqId);
    try {
      await axios.post(`${API}/meeting-requests/${reqId}/respond`, { action }, { headers });
      toast.success(action === 'accept' ? 'Görüş qəbul edildi' : 'Görüş rədd edildi');
      fetchRequests();
      onAccepted && onAccepted();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xəta');
    } finally {
      setActing(null);
    }
  };

  // Only show requests where current user is a pending recipient
  const incoming = requests.filter(r => r.recipients?.some(x => x.id === currentUserId && x.status === 'pending'));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="meeting-request-inbox">
        <DialogHeader>
          <DialogTitle className="text-[#3D4F6F]">Görüş təklifləri</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Sizə göndərilmiş və hələ cavablandırılmamış görüş təklifləri.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : incoming.length === 0 ? (
          <p className="text-center text-slate-400 py-10 text-sm">Yeni görüş təklifi yoxdur</p>
        ) : (
          <div className="space-y-2">
            {incoming.map(r => (
              <div key={r.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50" data-testid={`mr-incoming-${r.id}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-sm text-[#3D4F6F]">{r.sender_name}</p>
                    <p className="text-xs text-slate-500">{r.date} {r.time} · {r.meeting_type || 'Görüş'} · {r.meeting_mode}</p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700 text-[10px]">Gözləyir</Badge>
                </div>
                {r.location && <p className="text-xs text-slate-600 mb-1">📍 {r.location}</p>}
                {r.notes && <p className="text-xs text-slate-600 italic mb-2">{r.notes}</p>}
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    onClick={() => respond(r.id, 'accept')}
                    disabled={acting === r.id}
                    data-testid={`mr-accept-${r.id}`}
                  >
                    {acting === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Qəbul et'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                    onClick={() => respond(r.id, 'reject')}
                    disabled={acting === r.id}
                    data-testid={`mr-reject-${r.id}`}
                  >
                    <X className="w-3 h-3 mr-1" />Rədd et
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
