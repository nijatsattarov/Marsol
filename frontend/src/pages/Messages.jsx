import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Plus, Search, Loader2, Send, User, ArrowLeft, MessageCircle
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
      setUsers(usersRes.data.filter(u => u.id !== currentUser.id));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

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

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!msgText.trim() || !activeConv) return;
    try {
      await axios.post(`${API}/messages/${activeConv.id}`, { text: msgText }, { headers });
      setMsgText('');
      fetchMessages(activeConv.id);
      fetchConversations();
    } catch { toast.error('Mesaj göndərilmədi'); }
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
    if (!conv?.participant_names) return 'Naməlum';
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
        <Button onClick={() => setShowNewChat(true)} size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="new-chat-btn">
          <Plus className="w-4 h-4 mr-1" />Yeni söhbət
        </Button>
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
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${msg.sender_id === currentUser.id ? 'bg-[#3D4F6F] text-white rounded-br-sm' : 'bg-white text-slate-700 rounded-bl-sm shadow-sm'}`} data-testid={`msg-${msg.id}`}>
                      <p>{msg.text}</p>
                      <p className={`text-[10px] mt-1 ${msg.sender_id === currentUser.id ? 'text-white/60' : 'text-slate-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('az', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={sendMessage} className="p-3 border-t border-slate-100 flex gap-2">
                <Input value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder="Mesaj yazın..." className="text-sm flex-1" data-testid="msg-input" />
                <Button type="submit" size="sm" className="bg-[#3D4F6F] hover:bg-[#2A364C] text-white" data-testid="msg-send-btn">
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
    </div>
  );
}
