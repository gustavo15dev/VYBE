import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Send,
  Check,
  Users,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PostItem, ConversationItem, PostPreviewData } from '../types/social';
import { UserProfile } from '../types/user';
import {
  subscribeConversations,
  getOrCreateIndividualConversation,
  sendMessage,
} from '../services/socialService';

interface SharePostModalProps {
  post: PostItem | null;
  isOpen: boolean;
  onClose: () => void;
  allUsers?: UserProfile[];
  myFollowing?: Set<string>;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function SharePostModal({
  post,
  isOpen,
  onClose,
  allUsers = [],
  myFollowing = new Set(),
  onShowToast,
}: SharePostModalProps) {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.uid || !isOpen) return;
    const unsub = subscribeConversations(profile.uid, (convs) => {
      setConversations(convs);
    });
    return () => unsub();
  }, [profile?.uid, isOpen]);

  if (!isOpen || !post || !profile) return null;

  // Map users for easy lookup
  const usersMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    allUsers.forEach((u) => map.set(u.uid, u));
    return map;
  }, [allUsers]);

  // People followed by current user
  const followedUsers = useMemo(() => {
    return allUsers.filter((u) => myFollowing.has(u.uid) && u.uid !== profile.uid);
  }, [allUsers, myFollowing, profile.uid]);

  // Filter conversations and users based on search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations.slice(0, 8);
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => {
      if (c.tipo === 'grupo') {
        return (c.nome_grupo || '').toLowerCase().includes(q);
      }
      const otherUid = c.participantes.find((uid) => uid !== profile.uid);
      const otherUser = otherUid ? usersMap.get(otherUid) : null;
      if (!otherUser) return false;
      return (
        otherUser.username.toLowerCase().includes(q) ||
        (otherUser.displayName || '').toLowerCase().includes(q)
      );
    });
  }, [conversations, searchQuery, profile.uid, usersMap]);

  const filteredFollowedUsers = useMemo(() => {
    if (!searchQuery.trim()) return followedUsers;
    const q = searchQuery.toLowerCase();
    return followedUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.displayName || '').toLowerCase().includes(q)
    );
  }, [followedUsers, searchQuery]);

  const postPreview: PostPreviewData = {
    id: post.id,
    authorUid: post.authorUid || '',
    authorUsername: post.authorUsername || '',
    authorDisplayName: post.authorDisplayName || post.authorUsername || '',
    authorPhotoURL: post.authorPhotoURL || '',
    content: post.content || '',
    mediaUrl: post.mediaUrl || (post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls[0] : ''),
    mediaType: post.mediaType || (post.mediaUrl || post.mediaUrls?.length ? 'image' : 'text'),
    likesCount: post.likes?.length || 0,
  };

  const handleSendToConversation = async (conv: ConversationItem) => {
    if (sentMap[conv.id] || sendingId) return;
    setSendingId(conv.id);

    try {
      await sendMessage({
        conversaId: conv.id,
        autor: profile,
        tipo: 'post_compartilhado',
        conteudo: post.id,
        postPreview,
      });

      setSentMap((prev) => ({ ...prev, [conv.id]: true }));
      if (onShowToast) onShowToast('Publicação enviada!', 'success');
    } catch (err: any) {
      console.error(err);
      if (onShowToast) onShowToast(err.message || 'Erro ao enviar publicação.', 'error');
    } finally {
      setSendingId(null);
    }
  };

  const handleSendToUser = async (targetUser: UserProfile) => {
    if (sentMap[targetUser.uid] || sendingId) return;
    setSendingId(targetUser.uid);

    try {
      const conv = await getOrCreateIndividualConversation(profile.uid, targetUser.uid);
      await sendMessage({
        conversaId: conv.id,
        autor: profile,
        tipo: 'post_compartilhado',
        conteudo: post.id,
        postPreview,
      });

      setSentMap((prev) => ({ ...prev, [targetUser.uid]: true, [conv.id]: true }));
      if (onShowToast) onShowToast(`Publicação enviada para @${targetUser.username}!`, 'success');
    } catch (err: any) {
      console.error(err);
      if (onShowToast) onShowToast(err.message || 'Erro ao enviar publicação.', 'error');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Compartilhar</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-gray-100 bg-[#FAFBFB]">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar pessoa ou grupo..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#548687]/40"
            />
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 divide-y divide-gray-100/70">
          {/* Quick Recent Conversations */}
          {filteredConversations.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
                Conversas Recentes
              </span>
              <div className="space-y-1.5">
                {filteredConversations.map((conv) => {
                  const isGroup = conv.tipo === 'grupo';
                  const otherUid = conv.participantes.find((u) => u !== profile.uid);
                  const otherUser = otherUid ? usersMap.get(otherUid) : null;
                  const displayName = isGroup
                    ? conv.nome_grupo || 'Grupo'
                    : otherUser?.displayName || otherUser?.username || 'Usuário';
                  const handle = isGroup ? `${conv.participantes.length} membros` : `@${otherUser?.username || 'usuario'}`;
                  const isSent = sentMap[conv.id];
                  const isBusy = sendingId === conv.id;

                  return (
                    <div
                      key={conv.id}
                      className="flex items-center justify-between p-2 rounded-2xl hover:bg-[#F8FAFA] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-sm overflow-hidden">
                            {isGroup ? (
                              <Users className="w-5 h-5 text-white" />
                            ) : otherUser?.photoURL ? (
                              <img
                                src={otherUser.photoURL}
                                alt={displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{displayName[0]?.toUpperCase() || 'U'}</span>
                            )}
                          </div>
                          {isGroup && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-700 shadow-xs">
                              <Users className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {displayName}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{handle}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isSent || isBusy}
                        onClick={() => handleSendToConversation(conv)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSent
                            ? 'bg-gray-100 text-gray-500 cursor-default'
                            : 'bg-[#548687] text-white hover:bg-[#436e6f] shadow-xs'
                        }`}
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isSent ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-green-600" />
                            <span>Enviado</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3 h-3" />
                            <span>Enviar</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Followed Users */}
          {filteredFollowedUsers.length > 0 && (
            <div className="pt-3 space-y-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
                Amigos que você segue
              </span>
              <div className="space-y-1.5">
                {filteredFollowedUsers.map((targetUser) => {
                  const isSent = sentMap[targetUser.uid];
                  const isBusy = sendingId === targetUser.uid;

                  return (
                    <div
                      key={targetUser.uid}
                      className="flex items-center justify-between p-2 rounded-2xl hover:bg-[#F8FAFA] transition-colors"
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
                            <span>{(targetUser.displayName || targetUser.username)[0]?.toUpperCase()}</span>
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

                      <button
                        type="button"
                        disabled={isSent || isBusy}
                        onClick={() => handleSendToUser(targetUser)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSent
                            ? 'bg-gray-100 text-gray-500 cursor-default'
                            : 'bg-[#548687] text-white hover:bg-[#436e6f] shadow-xs'
                        }`}
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isSent ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-green-600" />
                            <span>Enviado</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3 h-3" />
                            <span>Enviar</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {filteredConversations.length === 0 && filteredFollowedUsers.length === 0 && (
            <div className="py-10 text-center text-gray-400 text-sm">
              Nenhuma pessoa ou grupo encontrado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
