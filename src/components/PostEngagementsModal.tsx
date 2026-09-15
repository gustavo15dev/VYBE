import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Lock, Users, Eye, Heart, Loader2 } from 'lucide-react';
import { PostItem, PostLikerProfile, ReactionEmoji } from '../types/social';
import { UserProfile } from '../types/user';
import {
  getPostLikers,
  getPostViewers,
  formatEngagementCount,
  subscribeOutgoingFollowRequests,
} from '../services/socialService';
import { FollowButton } from './FollowButton';
import { VerifiedBadge } from './VerifiedBadge';

export type EngagementTab = 'curtidas' | 'visualizacoes';

interface PostEngagementsModalProps {
  post: PostItem | null;
  isOpen: boolean;
  initialTab?: EngagementTab;
  onClose: () => void;
  currentUid: string;
  allUsers: UserProfile[];
  myFollowing: Set<string>;
  myFollowers: Set<string>;
  onSelectUser?: (uid: string) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function PostEngagementsModal({
  post,
  isOpen,
  initialTab = 'curtidas',
  onClose,
  currentUid,
  allUsers,
  myFollowing,
  myFollowers,
  onSelectUser,
  onShowToast,
}: PostEngagementsModalProps) {
  const [activeTab, setActiveTab] = useState<EngagementTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReactionFilter, setSelectedReactionFilter] = useState<ReactionEmoji | 'all'>('all');
  const [likers, setLikers] = useState<PostLikerProfile[]>([]);
  const [viewers, setViewers] = useState<UserProfile[]>([]);
  const [canViewViewersList, setCanViewViewersList] = useState(false);
  const [isLoadingLikers, setIsLoadingLikers] = useState(false);
  const [isLoadingViewers, setIsLoadingViewers] = useState(false);
  const [myOutgoingRequests, setMyOutgoingRequests] = useState<Set<string>>(new Set());

  // Listen to outgoing follow requests
  useEffect(() => {
    if (!currentUid) return;
    const unsub = subscribeOutgoingFollowRequests(currentUid, (reqs) => {
      setMyOutgoingRequests(reqs);
    });
    return () => unsub();
  }, [currentUid]);

  // Sync initial tab when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSearchQuery('');
      setSelectedReactionFilter('all');
    }
  }, [isOpen, initialTab, post?.id]);

  const isAuthor = Boolean(post && currentUid && post.authorUid === currentUid);

  // Fetch likers and viewers when post is open
  useEffect(() => {
    if (!isOpen || !post) return;

    let isMounted = true;

    // 1. Fetch Likers (Public)
    setIsLoadingLikers(true);
    getPostLikers(post.id)
      .then((users) => {
        if (isMounted) {
          setLikers(users);
          setIsLoadingLikers(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load likers:', err);
        if (isMounted) setIsLoadingLikers(false);
      });

    // 2. Fetch Viewers (Restricted to post author)
    setIsLoadingViewers(true);
    getPostViewers(post.id, post.authorUid, currentUid)
      .then(({ viewers: vList, canViewList }) => {
        if (isMounted) {
          setViewers(vList);
          setCanViewViewersList(canViewList);
          setIsLoadingViewers(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load viewers:', err);
        if (isMounted) setIsLoadingViewers(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, post?.id, post?.authorUid, currentUid]);

  // Fallback counts
  const totalLikesCount = useMemo(() => {
    if (!post) return 0;
    if (typeof post.likesCount === 'number') {
      return Math.max(post.likesCount, likers.length, post.likes.length);
    }
    return Math.max(post.likes.length, likers.length);
  }, [post, likers.length]);

  const totalViewsCount = useMemo(() => {
    if (!post) return 0;
    const postViews = post.viewsCount || 0;
    return Math.max(postViews, viewers.length);
  }, [post, viewers.length]);

  // Available reaction emojis among current likers
  const availableEmojiFilters = useMemo(() => {
    const counts: Record<string, number> = {};
    likers.forEach((l) => {
      const em = l.reactionEmoji || '❤️';
      counts[em] = (counts[em] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [likers]);

  // Filtered lists based on search and reaction emoji filter
  const filteredLikers = useMemo(() => {
    let result = likers;
    if (selectedReactionFilter !== 'all') {
      result = result.filter((u) => (u.reactionEmoji || '❤️') === selectedReactionFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (u.displayName && u.displayName.toLowerCase().includes(q))
      );
    }
    return result;
  }, [likers, selectedReactionFilter, searchQuery]);

  const filteredViewers = useMemo(() => {
    if (!searchQuery.trim()) return viewers;
    const q = searchQuery.toLowerCase().trim();
    return viewers.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.displayName && u.displayName.toLowerCase().includes(q))
    );
  }, [viewers, searchQuery]);

  if (!isOpen || !post) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="modal-post-engagements"
        className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (image.png style: X close icon + Title) */}
        <div className="relative px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <button
            id="btn-close-engagements"
            type="button"
            onClick={onClose}
            className="p-1.5 -ml-1 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-gray-900 text-base sm:text-lg flex-1 text-center pr-6">
            Detalhes da publicação
          </h2>
        </div>

        {/* 2 Tabs: Curtidas and Visualizações (image.png style) */}
        <div className="grid grid-cols-2 border-b border-gray-100 shrink-0 bg-white">
          <button
            id="tab-engagements-curtidas"
            type="button"
            onClick={() => setActiveTab('curtidas')}
            className={`py-3.5 px-4 text-sm font-semibold transition-all relative cursor-pointer text-center ${
              activeTab === 'curtidas'
                ? 'text-gray-900 font-bold'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>Curtidas · {formatEngagementCount(totalLikesCount)}</span>
            {activeTab === 'curtidas' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#548687] rounded-t-full transition-all" />
            )}
          </button>

          <button
            id="tab-engagements-visualizacoes"
            type="button"
            onClick={() => setActiveTab('visualizacoes')}
            className={`py-3.5 px-4 text-sm font-semibold transition-all relative cursor-pointer text-center ${
              activeTab === 'visualizacoes'
                ? 'text-gray-900 font-bold'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>Visualizações · {formatEngagementCount(totalViewsCount)}</span>
            {activeTab === 'visualizacoes' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#548687] rounded-t-full transition-all" />
            )}
          </button>
        </div>

        {/* Search Input (image.png style: pill with icon) - only shown when tab is listable */}
        {(activeTab === 'curtidas' || isAuthor) && (
          <div className="p-3 border-b border-gray-100 bg-[#FAFCFC] shrink-0">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
              <input
                id="input-search-engagements"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar"
                className="w-full pl-9.5 pr-4 py-2 bg-gray-100/90 text-sm text-gray-900 rounded-xl placeholder:text-gray-400 focus:outline-none focus:ring-1.5 focus:ring-[#548687] focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Reaction Emoji Filter Chips Bar */}
        {activeTab === 'curtidas' && availableEmojiFilters.length > 1 && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white border-b border-gray-100 overflow-x-auto no-scrollbar shrink-0">
            <button
              id="filter-reaction-all"
              type="button"
              onClick={() => setSelectedReactionFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                selectedReactionFilter === 'all'
                  ? 'bg-[#548687] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todas ({likers.length})
            </button>
            {availableEmojiFilters.map(([emoji, count]) => (
              <button
                key={emoji}
                id={`filter-reaction-${emoji}`}
                type="button"
                onClick={() => setSelectedReactionFilter(emoji as ReactionEmoji)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 flex items-center gap-1 transition-colors cursor-pointer ${
                  selectedReactionFilter === emoji
                    ? 'bg-[#548687] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{emoji}</span>
                <span className="text-[11px] opacity-90">{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Content Body: Scrollable Users List or Privacy Notice */}
        <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[500px]">
          {/* TAB 1: CURTIDAS */}
          {activeTab === 'curtidas' && (
            <div>
              {isLoadingLikers ? (
                <div className="py-16 text-center flex flex-col items-center justify-center gap-2.5">
                  <Loader2 className="w-6 h-6 animate-spin text-[#548687]" />
                  <span className="text-xs text-gray-400">Carregando curtidas...</span>
                </div>
              ) : filteredLikers.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {filteredLikers.map((targetUser) => {
                    const iFollow = myFollowing.has(targetUser.uid);
                    const followsMe = myFollowers.has(targetUser.uid);
                    const initial =
                      targetUser.displayName?.[0]?.toUpperCase() ||
                      targetUser.username[0]?.toUpperCase() ||
                      'V';
                    const reactionEmoji = targetUser.reactionEmoji || '❤️';

                    return (
                      <div
                        key={targetUser.uid}
                        className="flex items-center justify-between px-4 py-3 hover:bg-[#F8FAFA] transition-colors"
                      >
                        {/* User info */}
                        <div
                          onClick={() => {
                            onSelectUser?.(targetUser.uid);
                            onClose();
                          }}
                          className="flex items-center gap-3 min-w-0 cursor-pointer group flex-1 mr-2"
                        >
                          <div className="relative shrink-0">
                            <div className="w-11 h-11 rounded-full bg-[#E1EEEE] text-[#426F70] flex items-center justify-center font-bold text-sm overflow-hidden border border-gray-100 group-hover:scale-105 transition-transform">
                              {targetUser.photoURL ? (
                                <img
                                  src={targetUser.photoURL}
                                  alt={targetUser.username}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>{initial}</span>
                              )}
                            </div>
                            {/* Emoji reaction badge */}
                            <div
                              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white shadow-xs border border-white flex items-center justify-center text-[11px] select-none"
                              title={`Reagiu com ${reactionEmoji}`}
                            >
                              {reactionEmoji}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 text-sm leading-snug truncate group-hover:text-[#548687] transition-colors flex items-center gap-1">
                              <span>{targetUser.username}</span>
                              <VerifiedBadge verified={targetUser.verificado} size={14} />
                            </div>
                            <div className="text-xs text-gray-500 leading-tight mt-0.5 truncate">
                              {followsMe ? (
                                <span className="text-gray-500">Segue você</span>
                              ) : targetUser.displayName ? (
                                <span>{targetUser.displayName}</span>
                              ) : (
                                <span>Membro VYBE</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Follow Button */}
                        <div className="shrink-0">
                          <FollowButton
                            currentUid={currentUid}
                            targetUid={targetUser.uid}
                            targetUsername={targetUser.username}
                            iFollow={iFollow}
                            followsMe={followsMe}
                            isPrivate={Boolean(targetUser.conta_privada || targetUser.isPrivate)}
                            isRequested={myOutgoingRequests.has(targetUser.uid)}
                            size="sm"
                            onShowToast={onShowToast}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : searchQuery.trim() ? (
                <div className="py-16 px-4 text-center space-y-2">
                  <Search className="w-8 h-8 text-gray-300 mx-auto stroke-1" />
                  <p className="text-xs font-semibold text-gray-700">Nenhum resultado</p>
                  <p className="text-[11px] text-gray-400">
                    Nenhum usuário com curtida corresponde a "{searchQuery}".
                  </p>
                </div>
              ) : (
                <div className="py-16 px-4 text-center space-y-2">
                  <Heart className="w-8 h-8 text-gray-300 mx-auto stroke-1" />
                  <p className="text-xs font-semibold text-gray-700">Ainda não há curtidas</p>
                  <p className="text-[11px] text-gray-400">
                    Seja a primeira pessoa a curtir esta publicação!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VISUALIZAÇÕES */}
          {activeTab === 'visualizacoes' && (
            <div>
              {/* PRIVACY RULE: If user is NOT the author of the post */}
              {!isAuthor ? (
                <div className="p-8 text-center flex flex-col items-center justify-center space-y-4 my-auto">
                  <div className="w-14 h-14 rounded-full bg-[#EAF2F2] flex items-center justify-center text-[#548687]">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5 max-w-xs">
                    <h3 className="font-bold text-gray-900 text-sm">
                      Lista visível apenas para o autor
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Por privacidade da comunidade VYBE, a lista detalhada de quem visualizou este post está disponível somente para quem o publicou (@{post.authorUsername}).
                    </p>
                  </div>
                  <div className="px-4 py-2 bg-gray-50 rounded-2xl border border-gray-200/70 inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
                    <Eye className="w-4 h-4 text-[#548687]" />
                    <span>Total público: {formatEngagementCount(totalViewsCount)} visualizações</span>
                  </div>
                </div>
              ) : isLoadingViewers ? (
                /* Author loading state */
                <div className="py-16 text-center flex flex-col items-center justify-center gap-2.5">
                  <Loader2 className="w-6 h-6 animate-spin text-[#548687]" />
                  <span className="text-xs text-gray-400">Carregando visualizações...</span>
                </div>
              ) : filteredViewers.length > 0 ? (
                /* Author viewing the list of viewers (image.png style) */
                <div className="divide-y divide-gray-50">
                  {filteredViewers.map((targetUser) => {
                    const iFollow = myFollowing.has(targetUser.uid);
                    const followsMe = myFollowers.has(targetUser.uid);
                    const initial =
                      targetUser.displayName?.[0]?.toUpperCase() ||
                      targetUser.username[0]?.toUpperCase() ||
                      'V';

                    return (
                      <div
                        key={targetUser.uid}
                        className="flex items-center justify-between px-4 py-3 hover:bg-[#F8FAFA] transition-colors"
                      >
                        {/* User info */}
                        <div
                          onClick={() => {
                            onSelectUser?.(targetUser.uid);
                            onClose();
                          }}
                          className="flex items-center gap-3 min-w-0 cursor-pointer group flex-1 mr-2"
                        >
                          <div className="w-11 h-11 rounded-full bg-[#E1EEEE] text-[#426F70] flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 border border-gray-100 group-hover:scale-105 transition-transform">
                            {targetUser.photoURL ? (
                              <img
                                src={targetUser.photoURL}
                                alt={targetUser.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{initial}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 text-sm leading-snug truncate group-hover:text-[#548687] transition-colors flex items-center gap-1">
                              <span>{targetUser.username}</span>
                              <VerifiedBadge verified={targetUser.verificado} size={14} />
                            </div>
                            <div className="text-xs text-gray-500 leading-tight mt-0.5 truncate">
                              {followsMe ? (
                                <span className="text-gray-500">Segue você</span>
                              ) : targetUser.displayName ? (
                                <span>{targetUser.displayName}</span>
                              ) : (
                                <span>Visualizou seu post</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Follow Button */}
                        <div className="shrink-0">
                          <FollowButton
                            currentUid={currentUid}
                            targetUid={targetUser.uid}
                            targetUsername={targetUser.username}
                            iFollow={iFollow}
                            followsMe={followsMe}
                            isPrivate={Boolean(targetUser.conta_privada || targetUser.isPrivate)}
                            isRequested={myOutgoingRequests.has(targetUser.uid)}
                            size="sm"
                            onShowToast={onShowToast}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : searchQuery.trim() ? (
                <div className="py-16 px-4 text-center space-y-2">
                  <Search className="w-8 h-8 text-gray-300 mx-auto stroke-1" />
                  <p className="text-xs font-semibold text-gray-700">Nenhum resultado</p>
                  <p className="text-[11px] text-gray-400">
                    Nenhum espectador corresponde a "{searchQuery}".
                  </p>
                </div>
              ) : (
                <div className="py-16 px-4 text-center space-y-2">
                  <Eye className="w-8 h-8 text-gray-300 mx-auto stroke-1" />
                  <p className="text-xs font-semibold text-gray-700">Nenhuma visualização ainda</p>
                  <p className="text-[11px] text-gray-400">
                    Quando outros usuários passarem e ficarem no seu post, eles aparecerão aqui.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
