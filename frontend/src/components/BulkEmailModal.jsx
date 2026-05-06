import { useState } from 'react';
import axios from 'axios';
import { Loader2, Send, X, Mail } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Reusable Bulk Email modal — sends an email via Resend to selected internal
 * recipients (companies, members, contacts, project leads).
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   recipientType: 'companies' | 'members' | 'contacts' | 'project_leads'
 *   ids: string[]           — entity ids to resolve
 *   summary: string         — banner text e.g. "12 şirkət seçildi"
 */
export default function BulkEmailModal({ open, onClose, recipientType, ids, summary }) {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async () => {
    if (!subject.trim() || !html.trim()) { toast.error('Mövzu və məzmun tələb olunur'); return; }
    if (!ids?.length) { toast.error('Alıcı seçilməyib'); return; }
    if (!window.confirm(`${ids.length} qeydə email göndərilsin? (Email-i olmayanlar atlanır)`)) return;
    setSending(true); setResult(null);
    try {
      const r = await axios.post(`${API}/marketing/email/bulk`, {
        recipient_type: recipientType,
        ids,
        subject,
        html,
      }, { headers });
      setResult(r.data);
      if (r.data.sent > 0) toast.success(`${r.data.sent} email göndərildi`);
      if (r.data.failed > 0) toast.error(`${r.data.failed} göndərilə bilmədi`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Göndərmə xətası');
    } finally { setSending(false); }
  };

  const close = () => { setSubject(''); setHtml(''); setResult(null); onClose(); };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#3D4F6F]"><Mail className="w-5 h-5" /> Toplu email göndər</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <span className="font-semibold">{summary}</span>
            <span className="text-xs ml-2 text-blue-700">— hər qeydin contact_email/owner_email-ləri istifadə olunur</span>
          </div>
          <div>
            <Label className="text-xs">Mövzu *</Label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 mt-1" placeholder="Email mövzusu" data-testid="bulk-email-subject" />
          </div>
          <div>
            <Label className="text-xs">HTML məzmun *</Label>
            <textarea value={html} onChange={(e) => setHtml(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 mt-1 min-h-[180px] font-mono" placeholder="<p>Hörmətli üzv,</p><p>...</p>" data-testid="bulk-email-html" />
            <div className="text-[11px] text-slate-500 mt-1">Sadə HTML: &lt;p&gt;, &lt;b&gt;, &lt;a href&gt;, &lt;br&gt;... — Marsol şablonu avtomatik tətbiq olunur</div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Göndərici: <Badge className="bg-[#3D4F6F] text-white text-[10px]">Marsol Group</Badge></span>
            <span>Provayder: Resend</span>
          </div>
          {result && (
            <div className="border border-slate-200 rounded-lg p-3 text-sm bg-slate-50">
              <p><span className="font-semibold text-green-700">{result.sent}</span> göndərildi · <span className="font-semibold text-red-600">{result.failed}</span> xəta · cəmi <span className="font-semibold">{result.total}</span> alıcı</p>
              {result.failures && result.failures.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer text-red-700">Xətalar ({result.failures.length})</summary>
                  <ul className="mt-2 space-y-1 max-h-40 overflow-auto">
                    {result.failures.map((f, i) => <li key={i} className="text-[11px] text-slate-600">{f.email} {f.name && <>({f.name})</>} — <span className="text-red-600">{f.error || 'göndərilmədi'}</span></li>)}
                  </ul>
                </details>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={close} disabled={sending} data-testid="bulk-email-cancel"><X className="w-4 h-4 mr-1" />Bağla</Button>
            <Button onClick={handleSend} disabled={sending || !subject.trim() || !html.trim()} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="bulk-email-send">
              {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              Göndər
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
