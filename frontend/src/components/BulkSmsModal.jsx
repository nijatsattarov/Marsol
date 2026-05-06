import { useState } from 'react';
import axios from 'axios';
import { Loader2, Send, X } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Reusable Bulk SMS modal.
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   recipientType: 'companies' | 'members' | 'contacts'
 *   ids: string[]              // ids to send to
 *   summary: string            // e.g. "12 şirkət seçildi"
 *   suggestedTemplate?: string // pre-filled text
 */
export default function BulkSmsModal({ open, onClose, recipientType, ids, summary, suggestedTemplate = '' }) {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const [text, setText] = useState(suggestedTemplate);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const charCount = text.length;
  const smsCount = charCount === 0 ? 0
    : (/[^\x00-\x7F]/.test(text)
        ? Math.ceil(charCount / 67)   // unicode
        : Math.ceil(charCount / 153)); // gsm

  const handleSend = async () => {
    if (!text.trim()) { toast.error('Mətn boş ola bilməz'); return; }
    if (!ids || ids.length === 0) { toast.error('Alıcı seçilməyib'); return; }
    if (!window.confirm(`${ids.length} qeyd üçün SMS göndərilsin?\nTəxmini ${ids.length * (smsCount || 1)} SMS sərf olunacaq.`)) return;
    setSending(true); setResult(null);
    try {
      const r = await axios.post(`${API}/sms/bulk`, {
        text,
        recipient_type: recipientType,
        ids,
      }, { headers });
      setResult(r.data);
      if (r.data.sent > 0) toast.success(`${r.data.sent} SMS göndərildi`);
      if (r.data.failed > 0) toast.error(`${r.data.failed} göndərilə bilmədi`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Göndərmə xətası');
    } finally {
      setSending(false);
    }
  };

  const close = () => { setText(suggestedTemplate); setResult(null); onClose(); };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#3D4F6F]">
            <Send className="w-5 h-5" /> Toplu SMS göndər
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
            <span className="font-semibold">{summary}</span>
            <span className="text-xs ml-2 text-amber-700">— Hər şirkət üçün sahibkar/nümayəndə/şirkət telefonları kombinə edilir</span>
          </div>

          <div>
            <Label className="text-xs">Mətn</Label>
            <textarea
              className="w-full text-sm border border-slate-200 rounded-lg p-2 mt-1 min-h-[120px]"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="SMS mətnini yazın... ({name} kimi yer tutucular dəstəklənir)"
              data-testid="bulk-sms-text"
            />
            <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
              <span>{charCount} simvol · təxminən {smsCount} SMS / nömrə</span>
              <span>Sender ID: <Badge className="bg-[#3D4F6F] text-white text-[10px]">MARSOL</Badge></span>
            </div>
          </div>

          {result && (
            <div className="border border-slate-200 rounded-lg p-3 text-sm bg-slate-50">
              <p><span className="font-semibold text-green-700">{result.sent}</span> göndərildi · <span className="font-semibold text-red-600">{result.failed}</span> xəta · cəmi <span className="font-semibold">{result.total}</span> nömrə</p>
              {result.failures && result.failures.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer text-red-700">Xətalar ({result.failures.length})</summary>
                  <ul className="mt-2 space-y-1 max-h-40 overflow-auto">
                    {result.failures.map((f, i) => (
                      <li key={i} className="text-[11px] text-slate-600">
                        <span className="font-mono">{f.phone}</span> {f.name && <>({f.name})</>} — <span className="text-red-600">{f.error}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={close} disabled={sending} data-testid="bulk-sms-cancel">
              <X className="w-4 h-4 mr-1" /> Bağla
            </Button>
            <Button onClick={handleSend} disabled={sending || !text.trim()} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="bulk-sms-send">
              {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              Göndər
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
