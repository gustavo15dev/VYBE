import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  SquarePen,
  Mail,
  ChevronLeft,
  Users,
  Image as ImageIcon,
  Send,
  Loader2,
  X,
  Check,
  Edit2,
  Smile,
  AlertCircle,
  MessageCircle,
  Play,
  ArrowUpRight,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  ConversationItem,
  ChatMessage,
  MessageContentType,
  PostPreviewData,
  PostItem,
} from '../types/social';
import { UserProfile } from '../types/user';
import { VerifiedBadge } from './VerifiedBadge';
import {
  subscribeConversations,
  subscribeMessages,
  sendMessage,
  respondToSolicitation,
  createGroupConversation,
  getOrCreateIndividualConversation,
  updateGroupName,
  markConversationAsRead,
  checkMutualFollow,
  getPostById,
} from '../services/socialService';
import { optimizeImage } from '../utils/mediaOptimizer';

interface MessagesViewProps {
  allUsers?: UserProfile[];
  myFollowing?: Set<string>;
  initialTargetUid?: string | null;
  onSelectUser?: (uid: string) => void;
  onOpenPostDetail?: (post: PostItem) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function MessagesView({
  allUsers = [],
  myFollowing = new Set(),
  initialTargetUid = null,
  onSelectUser,
  onOpenPostDetail,
  onShowToast,
}: MessagesViewProps) {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [viewingSolicitations, setViewingSolicitations] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // New Chat modal state
  const [newChatTab, setNewChatTab] = useState<'individual' | 'grupo'>('individual');
  const [newChatSearch, setNewChatSearch] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Map users by UID
  const usersMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    allUsers.forEach((u) => map.set(u.uid, u));
    return map;
  }, [allUsers]);

  // Real-time conversations subscription
  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = subscribeConversations(profile.uid, (convs) => {
      setConversations(convs);
    });
    return () => unsub();
  }, [profile?.uid]);

  // Auto-open target user conversation if requested
  useEffect(() => {
    if (!initialTargetUid || !profile?.uid || initialTargetUid === profile.uid) return;
    const targetUser = usersMap.get(initialTargetUid) || ({ uid: initialTargetUid, username: 'usuário' } as UserProfile);
    handleStartIndividualChat(targetUser);
  }, [initialTargetUid, profile?.uid]);

  // Separate regular conversations from pending solicitations
  const { regularConversations, pendingSolicitations, myPendingRequests } = useMemo(() => {
    const regular: ConversationItem[] = [];
    const incomingSolicitations: ConversationItem[] = [];
    const outgoingPending: ConversationItem[] = [];

    conversations.forEach((c) => {
      if (c.status === 'pendente') {
        if (c.destinatario_id === profile?.uid) {
          incomingSolicitations.push(c);
        } else if (c.solicitante_id === profile?.uid) {
          outgoingPending.push(c);
          regular.push(c); // Sender sees it in their list with pending status
        }
      } else if (c.status === 'ativa') {
        regular.push(c);
      }
    });

    return {
      regularConversations: regular,
      pendingSolicitations: incomingSolicitations,
      myPendingRequests: outgoingPending,
    };
  }, [conversations, profile?.uid]);

  // Active conversation object
  const activeConv = useMemo(() => {
    return conversations.find((c) => c.id === activeConvId) || null;
  }, [conversations, activeConvId]);

  // Real-time messages for active conversation
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }

    const unsub = subscribeMessages(activeConvId, (msgs) => {
      setMessages(msgs);
      if (profile?.uid) {
        markConversationAsRead(activeConvId, profile.uid);
      }
    });

    return () => unsub();
  }, [activeConvId, profile?.uid]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-select first conversation on load if none selected
  useEffect(() => {
    if (!activeConvId && regularConversations.length > 0 && !viewingSolicitations) {
      setActiveConvId(regularConversations[0].id);
    }
  }, [regularConversations, activeConvId, viewingSolicitations]);

  // Helper for formatting timestamp (e.g. 2h, 1d, 3d)
  const formatShortTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const now = Date.now();
      const diff = Math.max(0, now - new Date(dateStr).getTime());
      const mins = Math.floor(diff / (1000 * 60));
      if (mins < 1) return 'agora';
      if (mins < 60) return `${mins}m`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h`;
      const days = Math.floor(hours / 24);
      return `${days}d`;
    } catch {
      return '';
    }
  };

  // Get other user in a 1-on-1 conversation
  const getOtherUser = (conv: ConversationItem): UserProfile | null => {
    if (!profile) return null;
    const otherUid = conv.participantes.find((u) => u !== profile.uid);
    return otherUid ? usersMap.get(otherUid) || null : null;
  };

  // Send message handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeConv || !profile || isSending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);

    try {
      await sendMessage({
        conversaId: activeConv.id,
        autor: profile,
        tipo: 'texto',
        conteudo: textToSend,
      });
    } catch (err: any) {
      console.error(err);
      if (onShowToast) onShowToast(err.message || 'Erro ao enviar mensagem.', 'error');
      setInputText(textToSend); // Restore text on failure
    } finally {
      setIsSending(false);
    }
  };

  // Upload image message handler
  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConv || !profile) return;

    if (file.size > 15 * 1024 * 1024) {
      if (onShowToast) onShowToast('A imagem deve ter no máximo 15MB.', 'error');
      return;
    }

    setIsUploadingImage(true);
    try {
      const base64 = await optimizeImage(file, {
        maxWidth: 1080,
        maxHeight: 1080,
        quality: 0.75,
      });

      await sendMessage({
        conversaId: activeConv.id,
        autor: profile,
        tipo: 'imagem',
        conteudo: base64,
      });
    } catch (err: any) {
      console.error(err);
      if (onShowToast) onShowToast(err.message || 'Erro ao enviar foto.', 'error');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Responding to solicitation
  const handleSolicitationAction = async (action: 'Aceitar' | 'Recusar') => {
    if (!activeConv) return;
    try {
      await respondToSolicitation(activeConv.id, action);
      if (action === 'Aceitar') {
        if (onShowToast) onShowToast('Solicitação aceita! Conversa liberada.', 'success');
      } else {
        if (onShowToast) onShowToast('Solicitação recusada.', 'info');
        setActiveConvId(null);
      }
    } catch (err: any) {
      console.error(err);
      if (onShowToast) onShowToast(err.message || 'Erro ao processar solicitação.', 'error');
    }
  };

  // Update group name
  const handleSaveGroupName = async () => {
    if (!activeConv || !groupNameInput.trim()) return;
    try {
      await updateGroupName(activeConv.id, groupNameInput);
      setEditingGroupName(false);
      if (onShowToast) onShowToast('Nome do grupo atualizado!', 'success');
    } catch (err: any) {
      console.error(err);
      if (onShowToast) onShowToast('Erro ao atualizar nome.', 'error');
    }
  };

  // Followed users available to add in group or message
  const followedUsers = useMemo(() => {
    return allUsers.filter((u) => myFollowing.has(u.uid) && u.uid !== profile?.uid);
  }, [allUsers, myFollowing, profile?.uid]);

  // Filtered users for new chat modal
  const filteredUsers = useMemo(() => {
    const q = newChatSearch.toLowerCase().trim();
    const source = newChatTab === 'grupo' ? followedUsers : allUsers.filter((u) => u.uid !== profile?.uid);
    if (!q) return source;
    return source.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.displayName || '').toLowerCase().includes(q)
    );
  }, [newChatSearch, newChatTab, followedUsers, allUsers, profile?.uid]);

  // Start 1-on-1 chat
  const handleStartIndividualChat = async (targetUser: UserProfile) => {
    if (!profile) return;
    setIsCreatingChat(true);
    try {
      const conv = await getOrCreateIndividualConversation(profile.uid, targetUser.uid);
      setActiveConvId(conv.id);
      setIsNewChatModalOpen(false);
      setViewingSolicitations(false);
    } catch (err: any) {
      console.error(err);
      if (onShowToast) onShowToast('Erro ao iniciar conversa.', 'error');
    } finally {
      setIsCreatingChat(false);
    }
  };

  // Create Group Chat
  const handleCreateGroup = async () => {
    if (!profile || selectedGroupMembers.length === 0 || !newGroupName.trim()) return;
    setIsCreatingChat(true);
    try {
      const conv = await createGroupConversation(
        profile.uid,
        selectedGroupMembers,
        newGroupName.trim()
      );
      setActiveConvId(conv.id);
      setIsNewChatModalOpen(false);
      setSelectedGroupMembers([]);
      setNewGroupName('');
      if (onShowToast) onShowToast('Grupo criado com sucesso!', 'success');
    } catch (err: any) {
      console.error(err);
      if (onShowToast) onShowToast('Erro ao criar grupo.', 'error');
    } finally {
      setIsCreatingChat(false);
    }
  };

  const isPendingReceiver =
    activeConv?.status === 'pendente' && activeConv.destinatario_id === profile?.uid;

  const isPendingSender =
    activeConv?.status === 'pendente' && activeConv.solicitante_id === profile?.uid;

  const otherUser = activeConv ? getOtherUser(activeConv) : null;

  return (
    <div className="flex-1 flex h-[calc(100vh-65px)] bg-white overflow-hidden">
      {/* Hidden File Input for Image uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelected}
        accept="image/*"
        className="hidden"
      />

      {/* LEFT COLUMN: Conversations or Solicitations List */}
      <div className="w-80 sm:w-96 border-r border-gray-100 flex flex-col h-full shrink-0 bg-white">
        {/* Header: Title or Back to Conversations */}
        <div className="p-4 flex items-center justify-between border-b border-gray-100">
          {viewingSolicitations ? (
            <button
              type="button"
              onClick={() => setViewingSolicitations(false)}
              className="flex items-center gap-2 text-base font-bold text-gray-900 hover:text-[#548687] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Solicitações</span>
            </button>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Mensagens</h2>
              <button
                type="button"
                onClick={() => setIsNewChatModalOpen(true)}
                className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                title="Nova mensagem ou grupo"
              >
                <SquarePen className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Solicitations Button (Only visible on main list) */}
        {!viewingSolicitations && (
          <div className="p-3 border-b border-gray-100/70">
            <button
              type="button"
              onClick={() => {
                setViewingSolicitations(true);
                if (pendingSolicitations.length > 0) {
                  setActiveConvId(pendingSolicitations[0].id);
                }
              }}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#F1F5F5] hover:bg-[#E5ECEC] rounded-2xl transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#548687] shadow-2xs">
                  <Mail className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-gray-900">Solicitações</span>
              </div>

              {pendingSolicitations.length > 0 && (
                <span className="bg-[#548687] text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {pendingSolicitations.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Scrollable list of chats */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {viewingSolicitations ? (
            /* Pending Solicitations List */
            pendingSolicitations.length > 0 ? (
              pendingSolicitations.map((conv) => {
                const target = getOtherUser(conv);
                const isSelected = activeConvId === conv.id;
                const displayName = target?.displayName || target?.username || 'Usuário';

                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`p-3.5 flex items-center gap-3.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#F1F5F5]/80' : 'hover:bg-[#FAFBFB]'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-base overflow-hidden shrink-0">
                      {target?.photoURL ? (
                        <img
                          src={target.photoURL}
                          alt={displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{displayName[0]?.toUpperCase() || 'U'}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1">
                          <span>{target?.username || displayName}</span>
                          <VerifiedBadge verified={target?.verificado} size={13} />
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {formatShortTime(conv.atualizado_em)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {conv.ultima_mensagem?.texto || 'Quer enviar uma mensagem...'}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-gray-400 text-sm">
                Nenhuma solicitação de mensagem no momento.
              </div>
            )
          ) : (
            /* Regular Conversations List */
            regularConversations.length > 0 ? (
              regularConversations.map((conv) => {
                const isGroup = conv.tipo === 'grupo';
                const target = isGroup ? null : getOtherUser(conv);
                const isSelected = activeConvId === conv.id;
                const displayName = isGroup
                  ? conv.nome_grupo || 'Grupo'
                  : target?.username || target?.displayName || 'Usuário';

                // Determine subtitle message preview
                let previewText = conv.ultima_mensagem?.texto || 'Iniciar conversa';
                if (conv.ultima_mensagem?.autor_id === profile?.uid) {
                  previewText = `Você: ${conv.ultima_mensagem.texto}`;
                } else if (isGroup && conv.ultima_mensagem) {
                  const author = usersMap.get(conv.ultima_mensagem.autor_id);
                  if (author) {
                    previewText = `${author.username}: ${conv.ultima_mensagem.texto}`;
                  }
                }

                const isUnread =
                  Boolean(conv.ultima_mensagem &&
                  !conv.ultima_mensagem.lida &&
                  conv.ultima_mensagem.autor_id !== profile?.uid);

                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`p-3.5 flex items-center gap-3.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#F1F5F5]' : 'hover:bg-[#FAFBFB]'
                    }`}
                  >
                    {/* Avatar with group badge if group */}
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-base overflow-hidden">
                        {isGroup ? (
                          conv.foto_grupo ? (
                            <img
                              src={conv.foto_grupo}
                              alt={displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Users className="w-6 h-6 text-white" />
                          )
                        ) : target?.photoURL ? (
                          <img
                            src={target.photoURL}
                            alt={displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{displayName[0]?.toUpperCase() || 'U'}</span>
                        )}
                      </div>

                      {isGroup && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-700 shadow-2xs">
                          <Users className="w-3 h-3 text-[#548687]" />
                        </div>
                      )}
                    </div>

                    {/* Chat Text Preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm truncate flex items-center gap-1 ${
                            isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-900'
                          }`}
                        >
                          <span>{displayName}</span>
                          {!isGroup && target && (
                            <VerifiedBadge verified={target.verificado} size={13} />
                          )}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {formatShortTime(conv.atualizado_em)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-0.5">
                        <p
                          className={`text-xs truncate ${
                            isUnread ? 'font-semibold text-gray-900' : 'text-gray-500'
                          }`}
                        >
                          {previewText}
                        </p>
                        {isUnread && (
                          <div className="w-2 h-2 rounded-full bg-[#548687] shrink-0 ml-2" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-gray-400 text-sm">
                Nenhuma conversa ainda. Clique no ícone de lápis para iniciar!
              </div>
            )
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Chat Area or Solicitation Preview */}
      <div className="flex-1 flex flex-col h-full bg-[#FAFBFB] overflow-hidden">
        {activeConv ? (
          isPendingReceiver ? (
            /* MODE: Preview of Pending Solicitation (Exact design of Image 2) */
            <div className="flex-1 flex flex-col justify-between h-full bg-white">
              {/* Solicitation Header */}
              <div className="p-4 border-b border-gray-100 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-sm overflow-hidden">
                  {otherUser?.photoURL ? (
                    <img
                      src={otherUser.photoURL}
                      alt={otherUser.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{otherUser?.username?.[0]?.toUpperCase() || 'U'}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {otherUser?.username || 'Usuário'}
                  </h3>
                  <p className="text-xs text-gray-500">Não segue você mutuamente</p>
                </div>
              </div>

              {/* Centered Notice and single message preview */}
              <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-lg mx-auto text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-[#E1EEEE] flex items-center justify-center text-[#548687] font-bold text-2xl overflow-hidden">
                  {otherUser?.photoURL ? (
                    <img
                      src={otherUser.photoURL}
                      alt={otherUser.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{otherUser?.username?.[0]?.toUpperCase() || 'U'}</span>
                  )}
                </div>

                <p className="text-sm text-gray-600 leading-relaxed max-w-sm">
                  Vocês precisam se seguir mutuamente para conversar livremente. Enquanto isso, apenas uma mensagem pode ser enviada.
                </p>

                {/* Single message bubble */}
                {messages.length > 0 && (
                  <div className="w-full text-left">
                    {messages.map((msg) => (
                      <div key={msg.id} className="flex justify-start">
                        {msg.tipo === 'post_compartilhado' ? (
                          <div
                            onClick={() => {
                              if (msg.post_preview && onOpenPostDetail) {
                                onOpenPostDetail({
                                  id: msg.post_preview.id,
                                  authorUid: '',
                                  authorUsername: msg.post_preview.authorUsername,
                                  authorDisplayName: msg.post_preview.authorDisplayName,
                                  authorPhotoURL: msg.post_preview.authorPhotoURL,
                                  content: msg.post_preview.content,
                                  mediaUrl: msg.post_preview.mediaUrl,
                                  mediaType: msg.post_preview.mediaType || 'image',
                                  createdAt: msg.criado_em,
                                  likes: [],
                                });
                              }
                            }}
                            className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs max-w-xs cursor-pointer hover:shadow-md transition-shadow"
                          >
                            {msg.post_preview?.mediaUrl && (
                              <img
                                src={msg.post_preview.mediaUrl}
                                alt="Post"
                                className="w-full h-48 object-cover"
                              />
                            )}
                            <div className="p-3 flex items-center gap-2 bg-white">
                              <span className="text-xs font-semibold text-gray-900">
                                @{msg.post_preview?.authorUsername}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-100 text-gray-900 rounded-2xl rounded-bl-xs px-5 py-3 text-sm max-w-md shadow-2xs">
                            {msg.conteudo}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Action Bar: [ Recusar ] and [ Aceitar ] */}
              <div className="p-6 border-t border-gray-100 flex items-center justify-center gap-4 bg-white">
                <button
                  type="button"
                  onClick={() => handleSolicitationAction('Recusar')}
                  className="flex-1 max-w-[200px] py-3 px-6 rounded-xl border border-gray-300 bg-white text-gray-800 text-sm font-semibold hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs text-center"
                >
                  Recusar
                </button>
                <button
                  type="button"
                  onClick={() => handleSolicitationAction('Aceitar')}
                  className="flex-1 max-w-[200px] py-3 px-6 rounded-xl bg-[#548687] text-white text-sm font-semibold hover:bg-[#436e6f] transition-colors cursor-pointer shadow-xs text-center"
                >
                  Aceitar
                </button>
              </div>
            </div>
          ) : (
            /* MODE: Active Chat (Exact design of Image 1) */
            <div className="flex-1 flex flex-col h-full bg-white">
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                      {activeConv.tipo === 'grupo' ? (
                        <Users className="w-5 h-5 text-white" />
                      ) : otherUser?.photoURL ? (
                        <img
                          src={otherUser.photoURL}
                          alt={otherUser.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>
                          {otherUser?.username?.[0]?.toUpperCase() ||
                            activeConv.nome_grupo?.[0]?.toUpperCase() ||
                            'U'}
                        </span>
                      )}
                    </div>
                    {activeConv.tipo === 'grupo' && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-700">
                        <Users className="w-2.5 h-2.5 text-[#548687]" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    {activeConv.tipo === 'grupo' ? (
                      editingGroupName ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={groupNameInput}
                            onChange={(e) => setGroupNameInput(e.target.value)}
                            className="text-sm font-bold border border-gray-300 rounded px-2 py-0.5"
                          />
                          <button
                            type="button"
                            onClick={handleSaveGroupName}
                            className="text-xs bg-[#548687] text-white px-2 py-1 rounded"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingGroupName(false)}
                            className="text-xs text-gray-500"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-base font-bold text-gray-900 truncate">
                            {activeConv.nome_grupo}
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              setGroupNameInput(activeConv.nome_grupo || '');
                              setEditingGroupName(true);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-700"
                            title="Editar nome"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    ) : (
                      <h3
                        onClick={() => otherUser && onSelectUser?.(otherUser.uid)}
                        className="text-base font-bold text-gray-900 truncate cursor-pointer hover:underline flex items-center gap-1"
                      >
                        <span>{otherUser?.username || 'Usuário'}</span>
                        <VerifiedBadge verified={otherUser?.verificado} size={14} />
                      </h3>
                    )}
                    <p className="text-xs text-gray-400 truncate">
                      {activeConv.tipo === 'grupo'
                        ? `${activeConv.participantes.length} participantes`
                        : `@${otherUser?.username || 'usuario'}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages Flow */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {messages.map((msg) => {
                  const isMine = msg.autor_id === profile?.uid;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      {/* Sender label in groups if not mine */}
                      {!isMine && activeConv.tipo === 'grupo' && msg.autor_username && (
                        <span className="text-[11px] font-semibold text-gray-500 mb-1 ml-2">
                          @{msg.autor_username}
                        </span>
                      )}

                      {/* Content rendering according to type */}
                      {msg.tipo === 'texto' && (
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed max-w-sm sm:max-w-md break-words ${
                            isMine
                              ? 'bg-[#548687] text-white rounded-br-xs shadow-2xs'
                              : 'bg-gray-100 text-gray-900 rounded-bl-xs'
                          }`}
                        >
                          {msg.conteudo}
                        </div>
                      )}

                      {msg.tipo === 'imagem' && (
                        <div className="rounded-2xl overflow-hidden max-w-xs border border-gray-100 shadow-xs">
                          <img
                            src={msg.conteudo}
                            alt="Foto enviada"
                            className="w-full h-auto max-h-72 object-cover"
                          />
                        </div>
                      )}

                      {msg.tipo === 'post_compartilhado' && (
                        <SharedPostMessageBubble
                          msg={msg}
                          isMine={isMine}
                          onOpenPostDetail={onOpenPostDetail}
                          onSelectUser={onSelectUser}
                        />
                      )}

                      <span className="text-[10px] text-gray-400 mt-1 px-1">
                        {formatShortTime(msg.criado_em)}
                      </span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Input bar or Pending notice */}
              <div className="p-3 sm:p-4 border-t border-gray-100 bg-white">
                {isPendingSender ? (
                  /* Sender sees disabled box while pending */
                  <div className="p-3 bg-[#F1F5F5] rounded-2xl text-center text-xs text-gray-600 flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4 text-[#548687]" />
                    <span>
                      Aguardando resposta da solicitação. Apenas uma mensagem pode ser enviada enquanto pendente.
                    </span>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSendMessage}
                    className="flex items-center gap-2 sm:gap-3"
                  >
                    {/* Image Upload Button */}
                    <button
                      type="button"
                      disabled={isUploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                      title="Enviar foto"
                    >
                      {isUploadingImage ? (
                        <Loader2 className="w-5 h-5 animate-spin text-[#548687]" />
                      ) : (
                        <ImageIcon className="w-5 h-5" />
                      )}
                    </button>

                    {/* Text Input with rounded pill style */}
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Mensagem..."
                        className="w-full bg-[#F1F5F5] rounded-full px-5 py-2.5 text-sm text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-[#548687]/40 placeholder:text-gray-400"
                      />
                    </div>

                    {/* Send Button */}
                    <button
                      type="submit"
                      disabled={!inputText.trim() || isSending}
                      className={`p-2.5 rounded-full transition-colors ${
                        inputText.trim() && !isSending
                          ? 'bg-[#548687] text-white hover:bg-[#436e6f] cursor-pointer shadow-xs'
                          : 'text-gray-300 cursor-default'
                      }`}
                    >
                      {isSending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )
        ) : (
          /* Empty State when no conversation is selected */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
            <div className="w-16 h-16 rounded-full bg-[#E1EEEE] text-[#548687] flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Suas Mensagens</h3>
            <p className="text-sm text-gray-500 max-w-sm mb-6">
              Envie fotos, mensagens privadas ou compartilhe publicações com seus amigos.
            </p>
            <button
              type="button"
              onClick={() => setIsNewChatModalOpen(true)}
              className="px-6 py-2.5 bg-[#548687] text-white rounded-full text-sm font-semibold hover:bg-[#436e6f] transition-all cursor-pointer shadow-xs"
            >
              Enviar mensagem
            </button>
          </div>
        )}
      </div>

      {/* NEW CHAT / NEW GROUP MODAL */}
      {isNewChatModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsNewChatModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Nova Mensagem</h3>
              <button
                type="button"
                onClick={() => setIsNewChatModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toggle Individual vs Grupo */}
            <div className="p-3 border-b border-gray-100 flex gap-2">
              <button
                type="button"
                onClick={() => setNewChatTab('individual')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                  newChatTab === 'individual'
                    ? 'bg-[#548687] text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Conversa Direta
              </button>
              <button
                type="button"
                onClick={() => setNewChatTab('grupo')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                  newChatTab === 'grupo'
                    ? 'bg-[#548687] text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Criar Grupo
              </button>
            </div>

            {/* If Group, input for group name */}
            {newChatTab === 'grupo' && (
              <div className="p-3 border-b border-gray-100 bg-[#FAFBFB]">
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Nome do Grupo:
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Ex: Trip SP 🌊"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#548687]/40"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  * Apenas amigos que você segue podem ser adicionados ao grupo.
                </p>
              </div>
            )}

            {/* Search filter */}
            <div className="p-3 border-b border-gray-100 bg-[#FAFBFB]">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  placeholder="Pesquisar por nome ou @handle..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#548687]/40"
                />
              </div>
            </div>

            {/* Users List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((targetUser) => {
                  const isSelected = selectedGroupMembers.includes(targetUser.uid);

                  return (
                    <div
                      key={targetUser.uid}
                      onClick={() => {
                        if (newChatTab === 'individual') {
                          handleStartIndividualChat(targetUser);
                        } else {
                          setSelectedGroupMembers((prev) =>
                            prev.includes(targetUser.uid)
                              ? prev.filter((id) => id !== targetUser.uid)
                              : [...prev, targetUser.uid]
                          );
                        }
                      }}
                      className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[#F8FAFA] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-sm overflow-hidden">
                          {targetUser.photoURL ? (
                            <img
                              src={targetUser.photoURL}
                              alt={targetUser.username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>
                              {(targetUser.displayName || targetUser.username)[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {targetUser.displayName || targetUser.username}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            @{targetUser.username}
                          </p>
                        </div>
                      </div>

                      {newChatTab === 'grupo' && (
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-[#548687] border-[#548687] text-white'
                              : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-gray-400 text-sm">
                  {newChatTab === 'grupo'
                    ? 'Você precisa seguir pessoas para adicioná-las a um grupo.'
                    : 'Nenhum usuário encontrado.'}
                </div>
              )}
            </div>

            {/* Modal Footer (for Group confirmation) */}
            {newChatTab === 'grupo' && (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-white">
                <span className="text-xs text-gray-500 font-medium">
                  {selectedGroupMembers.length}{' '}
                  {selectedGroupMembers.length === 1 ? 'membro selecionado' : 'membros selecionados'}
                </span>
                <button
                  type="button"
                  disabled={selectedGroupMembers.length === 0 || !newGroupName.trim() || isCreatingChat}
                  onClick={handleCreateGroup}
                  className="px-5 py-2 rounded-xl bg-[#548687] text-white text-xs font-bold hover:bg-[#436e6f] disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                >
                  {isCreatingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Grupo'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Enhanced Shared Post Message Bubble Card
 * Displays the original author's name, username, and avatar,
 * the post's media (image/video) or styled text snippet,
 * and allows clicking to open the post in full detail with comments.
 */
function SharedPostMessageBubble({
  msg,
  isMine,
  onOpenPostDetail,
  onSelectUser,
}: {
  msg: ChatMessage;
  isMine: boolean;
  onOpenPostDetail?: (post: PostItem) => void;
  onSelectUser?: (uid: string) => void;
}) {
  const [fetchedPost, setFetchedPost] = useState<PostItem | null>(null);

  useEffect(() => {
    const postId = msg.conteudo;
    if (!postId) return;

    let isMounted = true;
    // If post_preview is missing or has missing author info, fetch fresh post from Firestore
    if (!msg.post_preview || !msg.post_preview.authorUsername) {
      getPostById(postId).then((p) => {
        if (isMounted && p) {
          setFetchedPost(p);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [msg.conteudo, msg.post_preview]);

  const authorUsername =
    msg.post_preview?.authorUsername ||
    fetchedPost?.authorUsername ||
    'autor';
  const authorDisplayName =
    msg.post_preview?.authorDisplayName ||
    fetchedPost?.authorDisplayName ||
    authorUsername;
  const authorPhotoURL =
    msg.post_preview?.authorPhotoURL ||
    fetchedPost?.authorPhotoURL;
  const authorUid =
    msg.post_preview?.authorUid ||
    fetchedPost?.authorUid ||
    '';
  const content =
    msg.post_preview?.content ||
    fetchedPost?.content ||
    '';
  const mediaUrl =
    msg.post_preview?.mediaUrl ||
    fetchedPost?.mediaUrl ||
    (fetchedPost?.mediaUrls && fetchedPost.mediaUrls.length > 0 ? fetchedPost.mediaUrls[0] : '') ||
    '';
  const mediaType =
    msg.post_preview?.mediaType ||
    fetchedPost?.mediaType ||
    (mediaUrl ? 'image' : 'text');
  const likesCount =
    typeof msg.post_preview?.likesCount === 'number'
      ? msg.post_preview.likesCount
      : (fetchedPost?.likes?.length || 0);

  const initial = (authorDisplayName || authorUsername || 'U')[0]?.toUpperCase();

  const handleOpen = () => {
    if (!onOpenPostDetail) return;
    if (fetchedPost) {
      onOpenPostDetail(fetchedPost);
    } else {
      onOpenPostDetail({
        id: msg.post_preview?.id || msg.conteudo,
        authorUid: authorUid,
        authorUsername: authorUsername,
        authorDisplayName: authorDisplayName,
        authorPhotoURL: authorPhotoURL,
        content: content,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        createdAt: msg.criado_em,
        likes: [],
      });
    }
  };

  return (
    <div
      onClick={handleOpen}
      className={`rounded-2xl border overflow-hidden shadow-xs hover:shadow-md transition-all max-w-[280px] sm:max-w-xs cursor-pointer group select-none text-left ${
        isMine ? 'bg-white border-[#548687]/30' : 'bg-white border-gray-200/90'
      }`}
    >
      {/* 1. Header of the Shared Post: Who published it */}
      <div className="px-3 py-2.5 bg-gray-50/90 border-b border-gray-100 flex items-center justify-between gap-2">
        <div
          onClick={(e) => {
            if (authorUid && onSelectUser) {
              e.stopPropagation();
              onSelectUser(authorUid);
            }
          }}
          className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 rounded-full bg-[#548687] text-white text-xs font-bold flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-white shadow-2xs">
            {authorPhotoURL ? (
              <img src={authorPhotoURL} alt={authorUsername} className="w-full h-full object-cover" />
            ) : (
              <span>{initial}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-900 truncate leading-tight">
              {authorDisplayName}
            </div>
            <div className="text-[10px] text-gray-400 truncate leading-tight">
              @{authorUsername}
            </div>
          </div>
        </div>

        <span className="text-[9px] font-semibold text-[#548687] bg-[#EAF4F4] px-2 py-0.5 rounded-full shrink-0">
          Publicação
        </span>
      </div>

      {/* 2. Media Preview or Text Snippet */}
      {mediaUrl ? (
        <div className="relative w-full h-44 sm:h-48 bg-black/90 flex items-center justify-center overflow-hidden">
          {mediaType === 'video' || mediaUrl.includes('.mp4') || mediaUrl.startsWith('data:video') ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <video src={mediaUrl} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-xs">
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                </div>
              </div>
            </div>
          ) : (
            <img
              src={mediaUrl}
              alt="Publicação"
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          )}
        </div>
      ) : content ? (
        /* Text-only post card styling */
        <div className="p-3.5 bg-gradient-to-br from-[#F4F9F9] to-[#E9F3F3] border-b border-gray-100 flex items-start gap-2.5">
          <FileText className="w-4 h-4 text-[#548687] shrink-0 mt-0.5" />
          <p className="text-xs text-gray-800 line-clamp-3 italic leading-relaxed font-medium">
            "{content}"
          </p>
        </div>
      ) : (
        <div className="w-full h-28 bg-[#F0F6F6] flex flex-col items-center justify-center text-[#548687]">
          <ImageIcon className="w-6 h-6 opacity-60" />
          <span className="text-xs mt-1 font-medium">Publicação</span>
        </div>
      )}

      {/* 3. Post Caption / Description (if media exists and has caption) */}
      {mediaUrl && content && (
        <div className="px-3 py-2 text-xs text-gray-700 leading-snug line-clamp-2 border-b border-gray-100 bg-white">
          <span className="font-semibold text-gray-900 mr-1.5">@{authorUsername}</span>
          <span>{content}</span>
        </div>
      )}

      {/* 4. Action Footer: View original post */}
      <div className="px-3 py-2 bg-white flex items-center justify-between text-xs text-gray-500 group-hover:bg-gray-50 transition-colors">
        <span className="text-[11px] font-semibold text-[#548687] group-hover:underline flex items-center gap-1">
          <span>Ver publicação completa</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </span>
        {likesCount > 0 && (
          <span className="text-[10px] text-gray-400 font-medium">
            ❤️ {likesCount}
          </span>
        )}
      </div>
    </div>
  );
}
