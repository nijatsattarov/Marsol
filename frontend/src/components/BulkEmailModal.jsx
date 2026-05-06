import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Send, X, Mail } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Reusable Bulk Email modal — sends an email through Mailchimp.
 * The selected recipients are upserted into the chosen Mailchimp audience and
 * a regular campaign is created targeting only them (via a static segment).
 */
export default function BulkEmailModal({ open, onClose, recipientType, ids, summary }) {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const [audiences, setAudiences] = useState([]);
  const [audienceId, setAudienceId] = useState('');
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [fromName, setFromName] = useState('Marsol Group');
  const [replyTo, setReplyTo] = useState('info@marsol.az');
  const [html, setHtml] = useState('');
  const [sendNow, setSendNow] = useState(false);
  const [loadingAudiences, setLoadingAudiences] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoadingAudiences(true);
    axios.get(`${API}/marketing/mailchimp/audiences`, { headers })
      .then(r => setAudiences(r.data.audiences || []))
      .catch(() => setAudiences([]))
      .finally(() => setLoadingAudiences(false));
  }, [open]); // eslint-disable-line

  const handleSend = async () => {
    if (!audienceId) { toast.error('Mailchimp auditoriyası seçin'); return; }
    if (!subject.trim() || !html.trim()) { toast.error('Mövzu və məzmun tələb olunur'); return; }
    if (!ids?.length) { toast.error('Alıcı seçilməyib'); return; }
    const action = sendNow ? 'göndərilsin' : 'qaralama olaraq saxlansın';
    if (!window.confirm(`${ids.length} qeyd Mailchimp auditoriyasına əlavə ediləcək və yalnız onlara hədəflənmiş kampaniya ${action}. Davam edək?`)) return;
    setSending(true); setResult(null);
    try {
      const r = await axios.post(`${API}/marketing/email/bulk`, {
        recipient_type: recipientType,
        ids,
        audience_id: audienceId,
        subject,
        preview_text: previewText,
        from_name: fromName,
        reply_to: replyTo,
        html,
        send_now: sendNow,
      }, { headers });
      setResult(r.data);
      if (r.data.campaign_status === 'sent') toast.success(`Kampaniya göndərildi (${r.data.synced_to_audience} alıcı)`);
      else toast.success(`Qaralama yaradıldı (${r.data.synced_to_audience} alıcı)`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Göndərmə xətası');
    } finally { setSending(false); }
  };

  const close = () => {
    setAudienceId(''); setSubject(''); setPreviewText(''); setHtml(''); setSendNow(false); setResult(null); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#3D4F6F]"><Mail className="w-5 h-5" /> Toplu email göndər (Mailchimp)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <span className="font-semibold">{summary}</span>
            <span className="text-xs ml-2 text-blue-700">— alıcılar Mailchimp auditoriyasına abunəçi kimi əlavə olunur, sonra yalnız onlara kampaniya göndərilir</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Mailchimp auditoriyası *</Label>
              <Select value={audienceId} onValueChange={setAudienceId}>
                <SelectTrigger className="text-sm" data-testid="bulk-email-audience"><SelectValue placeholder={loadingAudiences ? 'Yüklənir...' : 'Seçin'} /></SelectTrigger>
                <SelectContent>
                  {audiences.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.member_count})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Göndərən ad</Label>
              <input value={fromName} onChange={(e) => setFromName(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Reply-to email</Label>
              <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Preview text</Label>
              <input value={previewText} onChange={(e) => setPreviewText(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 mt-1" placeholder="Inbox-da görünür" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Mövzu *</Label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 mt-1" placeholder="Email mövzusu" data-testid="bulk-email-subject" />
          </div>
          <div>
            <Label className="text-xs">HTML məzmun *</Label>
            <textarea value={html} onChange={(e) => setHtml(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 mt-1 min-h-[180px] font-mono" placeholder="<p>Hörmətli üzv,</p>" data-testid="bulk-email-html" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} className="accent-[#9ACD32]" data-testid="bulk-email-send-now" />
            İndi göndər (yoxdursa Mailchimp-də qaralama olaraq saxlanır)
          </label>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Provayder: <Badge className="bg-yellow-100 text-yellow-700 text-[10px]">Mailchimp</Badge></span>
            <span>Open/Click avtomatik track olunur</span>
          </div>
          {result && (
            <div className="border border-slate-200 rounded-lg p-3 text-sm bg-slate-50">
              <p>
                <strong className="text-green-700">{result.synced_to_audience}</strong> auditoriyaya əlavə edildi · 
                <strong className="text-blue-700"> {result.segment_member_count}</strong> seqmentə daxil oldu · 
                Kampaniya: <strong>{result.campaign_status}</strong>
                {result.upsert_failed > 0 && <> · <strong className="text-red-600">{result.upsert_failed}</strong> uğursuz</>}
              </p>
              {result.failures && result.failures.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer text-red-700">Xətalar ({result.failures.length})</summary>
                  <ul className="mt-2 space-y-1 max-h-40 overflow-auto">
                    {result.failures.map((f, i) => <li key={i} className="text-[11px] text-slate-600">{f.email} — <span className="text-red-600">{f.error}</span></li>)}
                  </ul>
                </details>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={close} disabled={sending} data-testid="bulk-email-cancel"><X className="w-4 h-4 mr-1" />Bağla</Button>
            <Button onClick={handleSend} disabled={sending || !audienceId || !subject.trim() || !html.trim()} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="bulk-email-send">
              {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              {sendNow ? 'Göndər' : 'Qaralama olaraq saxla'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
