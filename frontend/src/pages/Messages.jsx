import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Plus, Search, Loader2, Send, User, ArrowLeft, MessageCircle, Users, X, Paperclip
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Toaster, toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Messages() {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msgText, setMsgText] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', members: [] });
  const [savingGroup, setSavingGroup] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchConversations = useCallback(async () => {
    try {
      const [convRes, usersRes] = await Promise.all([
        axios.get(`${API}/messages/conversations`, { headers }),
        axios.get(`${API}/settings/users`, { headers }),
      ]);
      setConversations(convRes.data);
      setUsers(usersRes.data.filter(u => u.id !== currentUser.id && (u.status || 'Aktiv') === 'Aktiv'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line

  const createGroup = async () => {
    if (!groupForm.name.trim() || groupForm.members.length < 1) {
      toast.error('Qrup adı və ən azı 1 üzv tələb olunur'); return;
    }
    setSavingGroup(true);
    try {
      const res = await axios.post(`${API}/messages/conversations`, {
        participant_ids: groupForm.members,
        name: groupForm.name,
      }, { headers });
      toast.success('Qrup yaradıldı');
      setShowNewGroup(false);
      setGroupForm({ name: '', description: '', members: [] });
      await fetchConversations();
      openConversation(res.data);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Xəta'); }
    finally { setSavingGroup(false); }
  };

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const fetchMessages = async (convId) => {
    try {
      const res = await axios.get(`${API}/messages/${convId}`, { headers });
      setMessages(res.data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) { console.error(err); }
  };

  const openConversation = (conv) => {
    setActiveConv(conv);
    fetchMessages(conv.id);
  };

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!activeConv) return;
    if (!msgText.trim()) return;
    try {
      await axios.post(`${API}/messages/${activeConv.id}`, { text: msgText }, { headers });
      setMsgText('');
      fetchMessages(activeConv.id);
      fetchConversations();
    } catch { toast.error('Mesaj göndərilmədi'); }
  };

  const handleAttachment = async (files) => {
    if (!activeConv || !files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const upRes = await axios.post(`${API}/upload`, fd, {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' },
        });
        const attachment = {
          url: upRes.data?.url,
          name: file.name,
          mime_type: file.type,
          bytes: file.size,
          resource_type: upRes.data?.resource_type || 'auto',
        };
        await axios.post(`${API}/messages/${activeConv.id}`, { attachment }, { headers });
      }
      toast.success('Fayl göndərildi');
      fetchMessages(activeConv.id);
      fetchConversations();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Fayl göndərilmədi');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startNewChat = async () => {
    if (!selectedUser) return;
    try {
      const res = await axios.post(`${API}/messages/conversations`, { participant_id: selectedUser }, { headers });
      setShowNewChat(false);
      setSelectedUser('');
      await fetchConversations();
      openConversation(res.data);
    } catch { toast.error('Xəta baş verdi'); }
  };

  const getOtherName = (conv) => {
    if (!conv) return 'Naməlum';
    if (conv.is_group) return conv.name || `Qrup (${conv.participants?.length || 0})`;
    if (!conv.participant_names) return 'Naməlum';
    const otherId = conv.participants?.find(id => id !== currentUser.id);
    return conv.participant_names[otherId] || 'Naməlum';
  };

  const filteredConvs = conversations.filter(c => {
    if (!searchTerm) return true;
    return getOtherName(c).toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-[calc(100vh-56px)] lg:h-screen flex flex-col" data-testid="messages-page">
      <Toaster position="top-right" richColors />

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: '#3D4F6F' }}>Mesajlar</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowNewGroup(true)} size="sm" variant="outline" data-testid="new-group-btn">
            <Users className="w-4 h-4 mr-1" />Yeni qrup
          </Button>
          <Button onClick={() => setShowNewChat(true)} size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="new-chat-btn">
            <Plus className="w-4 h-4 mr-1" />Yeni söhbət
          </Button>
        </div>
      </div>

      <div className="flex-1 flex bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden min-h-0">
        {/* Conversations List */}
        <div className={`w-full sm:w-80 border-r border-slate-100 flex flex-col ${activeConv ? 'hidden sm:flex' : 'flex'}`}>
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Söhbət axtar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 text-sm" data-testid="msg-search" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Groups section */}
            {groups.length > 0 && (
              <div className="border-b border-slate-100">
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Users className="w-3 h-3" />Qruplar ({groups.length})</p>
                {groups.map(g => (
                  <div key={g.id} className="w-full text-left p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors" data-testid={`group-${g.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: g.color || '#9ACD32' }}>
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-[#3D4F6F] truncate">{g.name}</p>
                        <p className="text-xs text-slate-500 truncate">{g.members?.length || 0} üzv {g.description ? `· ${g.description}` : ''}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {filteredConvs.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Söhbət yoxdur</p>
                <p className="text-xs mt-1">Yeni söhbət başladın</p>
              </div>
            ) : (
              filteredConvs.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv)}
                  className={`w-full text-left p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${activeConv?.id === conv.id ? 'bg-[#3D4F6F]/5 border-l-2 border-l-[#3D4F6F]' : ''}`}
                  data-testid={`conv-${conv.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#3D4F6F] flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-semibold">{getOtherName(conv).charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[#3D4F6F] truncate">{getOtherName(conv)}</p>
                      <p className="text-xs text-slate-500 truncate">{conv.last_message || 'Söhbət başladın...'}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col ${!activeConv ? 'hidden sm:flex' : 'flex'}`}>
          {activeConv ? (
            <>
              <div className="p-3 border-b border-slate-100 flex items-center gap-3">
                <Button variant="ghost" size="sm" className="sm:hidden" onClick={() => setActiveConv(null)}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="w-8 h-8 rounded-full bg-[#3D4F6F] flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">{getOtherName(activeConv).charAt(0).toUpperCase()}</span>
                </div>
                <p className="font-semibold text-sm text-[#3D4F6F]">{getOtherName(activeConv)}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {messages.length === 0 && <p className="text-center text-sm text-slate-400 py-10">Mesaj yoxdur. Söhbət başladın!</p>}
                {messages.map(msg => {
                  const mine = msg.sender_id === currentUser.id;
                  const att = msg.attachment;
                  const isImage = att && (att.mime_type || '').startsWith('image/');
                  const isVideo = att && (att.mime_type || '').startsWith('video/');
                  return (
                    <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${mine ? 'bg-[#3D4F6F] text-white rounded-br-sm' : 'bg-white text-slate-700 rounded-bl-sm shadow-sm'}`} data-testid={`msg-${msg.id}`}>
                        {!mine && activeConv?.is_group && (
                          <p className="text-[10px] font-semibold mb-1 opacity-70">{msg.sender_name}</p>
                        )}
                        {att && (
                          <div className="mb-1" data-testid={`msg-attachment-${msg.id}`}>
                            {isImage ? (
                              <a href={att.url} target="_blank" rel="noreferrer">
                                <img src={att.url} alt={att.name} className="max-w-full max-h-60 rounded-lg" />
                              </a>
                            ) : isVideo ? (
                              <video controls src={att.url} className="max-w-full max-h-60 rounded-lg" />
                            ) : (
                              <a href={att.url} target="_blank" rel="noreferrer" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs ${mine ? 'bg-white/15 hover:bg-white/25' : 'bg-slate-100 hover:bg-slate-200'}`}>
                                <Paperclip className="w-3.5 h-3.5" />
                                <span className="truncate max-w-[180px]">{att.name}</span>
                              </a>
                            )}
                          </div>
                        )}
                        {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                        <p className={`text-[10px] mt-1 ${mine ? 'text-white/60' : 'text-slate-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('az', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={sendMessage} className="p-3 border-t border-slate-100 flex gap-2 items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  multiple
                  onChange={(e) => handleAttachment(e.target.files)}
                  data-testid="msg-file-input"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Fayl əlavə et"
                  data-testid="msg-attach-btn"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4 text-[#3D4F6F]" />}
                </Button>
                <Input value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder="Mesaj yazın..." className="text-sm flex-1" data-testid="msg-input" />
                <Button type="submit" size="sm" className="bg-[#3D4F6F] hover:bg-[#2A364C] text-white" disabled={!msgText.trim()} data-testid="msg-send-btn">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <MessageCircle className="w-14 h-14 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Söhbət seçin və ya yeni söhbət başladın</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>Yeni söhbət</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">İstifadəçi seçin *</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="text-sm" data-testid="new-chat-user-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewChat(false)}>Ləğv et</Button>
              <Button onClick={startNewChat} className="bg-[#3D4F6F] hover:bg-[#2A364C] text-white" data-testid="start-chat-btn">Başla</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Group Modal */}
      <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>Yeni qrup yarat</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Qrup adı *</Label>
              <Input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} className="text-sm" placeholder="məs. Satış qrupu" data-testid="group-name" />
            </div>
            <div>
              <Label className="text-xs">Təsvir</Label>
              <Input value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} className="text-sm" />
            </div>
            <div>
              <Label className="text-xs">Üzvlər * ({groupForm.members.length} seçildi)</Label>
              <div className="mt-1 max-h-[220px] overflow-y-auto border rounded-md p-2 space-y-1" data-testid="group-members-list">
                {users.map(u => (
                  <label key={u.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={groupForm.members.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) setGroupForm({ ...groupForm, members: [...groupForm.members, u.id] });
                        else setGroupForm({ ...groupForm, members: groupForm.members.filter(m => m !== u.id) });
                      }}
                      className="accent-[#9ACD32]"
                      data-testid={`group-member-${u.id}`}
                    />
                    <span>{u.name} <span className="text-xs text-slate-400">({u.role})</span></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setShowNewGroup(false)}>Ləğv et</Button>
              <Button onClick={createGroup} disabled={savingGroup} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125]" data-testid="create-group-btn">
                {savingGroup ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Users className="w-4 h-4 mr-1" />}
                Yarat
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
