import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Heart,
  Share2,
  Sparkles,
  MessageSquare,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Film,
  Image as ImageIcon,
  UserPlus,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  Send,
  MoreHorizontal,
  Flag,
  UserX,
  Bookmark,
} from 'lucide-react';
import { UserStoriesGroup, PostItem, ReportTargetType } from '../types/social';
import { UserProfile } from '../types/user';
import { FormattedText } from './FormattedText';
import { VerifiedBadge } from './VerifiedBadge';
import {
  subscribeActiveStories,
  subscribePosts,
  togglePostLike,
  toggleSavePost,
  subscribeSavedPostIds,
  respondToCollaborationInvite,
  STORY_VIEWED_EVENT,
  getLocalViewedStoryIds,
  formatEngagementCount,
} from '../services/socialService';
import { usePostViewObserver } from '../hooks/usePostViewObserver';

interface HomeFeedProps {
  myFollowing: Set<string>;
  allBlockedUids?: Set<string>;
  onOpenStoryViewer: (groups: UserStoriesGroup[], startIndex: number) => void;
  onOpenStoryCreator: () => void;
  onOpenPostCreator: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onSelectUser?: (uid: string) => void;
  onSelectHashtag?: (tag: string) => void;
  onNavigateFriends?: () => void;
  onOpenComments?: (post: PostItem) => void;
  onSharePost?: (post: PostItem) => void;
  onOpenEngagements?: (post: PostItem, tab: 'curtidas' | 'visualizacoes') => void;
  onOpenReport?: (type: ReportTargetType, id: string) => void;
  onOpenBlock?: (targetUid: string, targetUsername: string) => void;
  onOpenEditPost?: (post: PostItem) => void;
  onConfirmDeletePost?: (post: PostItem) => void;
  allUsers?: UserProfile[];
}

export function HomeFeed({
  myFollowing,
  allBlockedUids = new Set(),
  onOpenStoryViewer,
  onOpenStoryCreator,
  onOpenPostCreator,
  onShowToast,
  onSelectUser,
  onSelectHashtag,
  onNavigateFriends,
  onOpenComments,
  onSharePost,
  onOpenEngagements,
  onOpenReport,
  onOpenBlock,
  onOpenEditPost,
  onConfirmDeletePost,
  allUsers = [],
}: HomeFeedProps) {
  const { user, profile } = useAuth();
  const [otherGroups, setOtherGroups] = useState<UserStoriesGroup[]>([]);
  const [myGroup, setMyGroup] = useState<UserStoriesGroup | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [expandedCollabsPostId, setExpandedCollabsPostId] = useState<string | null>(null);
  const [activePostMenuId, setActivePostMenuId] = useState<string | null>(null);

  // Filter out posts and stories from blocked users or auto-hidden posts
  const visibleOtherGroups = otherGroups.filter(
    (g) => !allBlockedUids.has(g.authorUid)
  );

  const visiblePosts = posts.filter((p) => {
    if (allBlockedUids.has(p.authorUid) || (p as any).auto_hidden) {
      return false;
    }
    if (p.authorUid === user?.uid) {
      return true;
    }
    const author = allUsers?.find((u) => u.uid === p.authorUid);
    if (author?.conta_privada) {
      return myFollowing.has(p.authorUid);
    }
    return true;
  });
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeActiveStories(user.uid, myFollowing, (groups, myStoriesGroup) => {
      setOtherGroups(groups);
      setMyGroup(myStoriesGroup);
    });

    return () => unsubscribe();
  }, [user?.uid, myFollowing]);

  // Instant update when a story is marked as viewed in StoryViewer
  useEffect(() => {
    if (!user?.uid) return;

    const handleStoryViewed = () => {
      const localSet = getLocalViewedStoryIds(user.uid);
      setMyGroup((prev) => {
        if (!prev) return prev;
        const hasUnseen = prev.stories.some(
          (s) => !s.viewers.includes(user.uid) && !localSet.has(s.id)
        );
        return { ...prev, hasUnseen };
      });
      setOtherGroups((prev) => {
        return prev.map((g) => {
          const hasUnseen = g.stories.some(
            (s) => !s.viewers.includes(user.uid) && !localSet.has(s.id)
          );
          return { ...g, hasUnseen };
        });
      });
    };

    window.addEventListener(STORY_VIEWED_EVENT, handleStoryViewed);
    return () => window.removeEventListener(STORY_VIEWED_EVENT, handleStoryViewed);
  }, [user?.uid]);

  // Subscribe to real-time posts
  useEffect(() => {
    const unsubscribe = subscribePosts((fetchedPosts) => {
      setPosts(fetchedPosts);
      setLoadingPosts(false);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to saved posts for current user
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeSavedPostIds(user.uid, (ids) => {
      setSavedPostIds(ids);
    });
    return () => unsub();
  }, [user?.uid]);

  // Format relative time
  const formatTime = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  // When clicking on own story circle
  const handleMyStoryClick = () => {
    if (myGroup && myGroup.stories.length > 0) {
      // If user has stories, open viewer with own story as first
      const allGroups = [myGroup, ...visibleOtherGroups];
      onOpenStoryViewer(allGroups, 0);
    } else {
      // If user has no story, open creator directly
      onOpenStoryCreator();
    }
  };

  // When clicking on another followed user's story circle
  const handleOtherStoryClick = (clickedIndex: number) => {
    const hasMyStory = Boolean(myGroup && myGroup.stories.length > 0);
    const allGroups = hasMyStory ? [myGroup!, ...visibleOtherGroups] : visibleOtherGroups;
    const actualIndex = hasMyStory ? clickedIndex + 1 : clickedIndex;
    onOpenStoryViewer(allGroups, actualIndex);
  };

  const handleToggleSavePost = async (post: PostItem) => {
    if (!user?.uid) return;
    const isCurrentlySaved = savedPostIds.has(post.id);
    try {
      const nowSaved = await toggleSavePost(user.uid, post.id, isCurrentlySaved);
      if (onShowToast) {
        onShowToast(
          nowSaved ? 'Publicação salva com sucesso!' : 'Publicação removida dos salvos.',
          'success'
        );
      }
    } catch (err) {
      console.error('Error toggling save post:', err);
      if (onShowToast) {
        onShowToast('Erro ao salvar publicação.', 'error');
      }
    }
  };

  const handleCollabResponse = async (postId: string, response: 'aceito' | 'recusado') => {
    if (!user?.uid) return;
    try {
      await respondToCollaborationInvite(postId, user.uid, response);
      if (onShowToast) {
        if (response === 'aceito') {
          onShowToast('Convite de colaboração aceito! O post agora aparece no seu perfil.', 'success');
        } else {
          onShowToast('Convite de colaboração recusado.', 'info');
        }
      }
    } catch (err: any) {
      console.error('Error responding to collab:', err);
      const msg = err?.message || 'Erro ao responder ao convite.';
      if (onShowToast) onShowToast(msg, 'error');
    }
  };

  const handleTogglePostLike = async (post: PostItem) => {
    if (!user?.uid) return;
    const isLiked = post.likes.includes(user.uid);
    try {
      await togglePostLike(post.id, user.uid, isLiked, profile || undefined);
    } catch (err) {
      console.error('Error toggling post like:', err);
    }
  };

  const myInitial =
    profile?.displayName?.[0]?.toUpperCase() || profile?.username?.[0]?.toUpperCase() || 'V';
  const hasMyStories = Boolean(myGroup && myGroup.stories.length > 0);
  const hasUnseenMyStories = Boolean(myGroup && myGroup.hasUnseen);

  return (
    <div className="flex-1 max-w-xl mx-auto py-6 px-4">
      {/* 
        STORIES HORIZONTAL CAROUSEL (Top of feed)
        Rules applied:
        - Only shows stories from users YOU FOLLOW (or your own story)
        - Colorful Teal Ring (#548687) = Unseen stories
        - Gray Ring (#D1D5DB) = Already viewed
        - '+' badge = Current user to add story
      */}
      <div
        id="stories-carousel-container"
        className="flex items-center gap-4 justify-start mb-8 overflow-x-auto pb-3 pt-2 px-1 scrollbar-none"
      >
        {/* Story Item 1: Current User (Your Story) */}
        <div className="flex flex-col items-center gap-1.5 shrink-0 group">
          <div className="relative">
            <button
              id="btn-current-user-story"
              type="button"
              onClick={handleMyStoryClick}
              className="relative w-15 h-15 rounded-full transition-transform group-hover:scale-105 cursor-pointer flex items-center justify-center focus:outline-none"
            >
              <div
                className={`w-full h-full rounded-full flex items-center justify-center p-[2px] ${
                  !hasMyStories
                    ? 'border border-dashed border-gray-300 bg-transparent'
                    : hasUnseenMyStories
                    ? 'bg-gradient-to-tr from-[#548687] to-[#7BB2B3]'
                    : 'bg-gray-300'
                }`}
              >
                <div className="w-full h-full rounded-full bg-white p-[2.5px] flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-base overflow-hidden">
                    {profile?.photoURL ? (
                      <img
                        src={profile.photoURL}
                        alt="Seu story"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{myInitial}</span>
                    )}
                  </div>
                </div>
              </div>
            </button>

            {/* '+' button overlay */}
            <button
              id="btn-add-story-overlay"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenStoryCreator();
              }}
              title="Adicionar novo story"
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#548687] text-white border-2 border-white flex items-center justify-center shadow-sm hover:scale-115 transition-transform cursor-pointer"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
            </button>
          </div>

          <span className="text-[11px] font-medium text-gray-700 truncate max-w-[64px]">
            {hasMyStories ? 'Seu story' : 'Novo story'}
          </span>
        </div>

        {/* Stories from Followed Users ONLY */}
        {visibleOtherGroups.map((group, index) => {
          const userInit =
            group.authorDisplayName?.[0]?.toUpperCase() ||
            group.authorUsername[0]?.toUpperCase() ||
            'U';

          return (
            <button
              key={group.authorUid}
              id={`story-user-${group.authorUsername}`}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleOtherStoryClick(index);
              }}
              className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer focus:outline-none"
            >
              <div
                className={`w-15 h-15 rounded-full transition-all group-hover:scale-105 flex items-center justify-center p-[2px] ${
                  group.hasUnseen
                    ? 'bg-gradient-to-tr from-[#548687] to-[#7BB2B3]'
                    : 'bg-gray-300'
                }`}
              >
                <div className="w-full h-full rounded-full bg-white p-[2.5px] flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-[#E5ECEC] text-[#345859] flex items-center justify-center font-semibold text-sm overflow-hidden">
                    {group.authorPhotoURL ? (
                      <img
                        src={group.authorPhotoURL}
                        alt={group.authorUsername}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{userInit}</span>
                    )}
                  </div>
                </div>
              </div>

              <span
                className={`text-[11px] truncate max-w-[64px] ${
                  group.hasUnseen
                    ? 'font-semibold text-gray-900'
                    : 'font-medium text-gray-500'
                }`}
              >
                {group.authorUsername}
              </span>
            </button>
          );
        })}

        {/* Empty followed stories hint */}
        {otherGroups.length === 0 && (
          <div className="flex items-center gap-2 pl-2 text-xs text-gray-400 font-medium whitespace-nowrap">
            {myFollowing.size === 0 ? (
              <span className="text-gray-400">
                Siga pessoas para ver os stories de quem você segue aqui.
              </span>
            ) : (
              <span>Nenhum dos seus amigos seguidos postou stories hoje.</span>
            )}
          </div>
        )}
      </div>

      {/* MAIN MULTIMEDIA FEED POSTS */}
      <div className="space-y-6">
        {loadingPosts ? (
          <div className="w-full py-16 flex flex-col items-center justify-center text-gray-400 gap-3">
            <Sparkles className="w-6 h-6 text-[#548687] animate-pulse" />
            <span className="text-xs font-medium">Carregando feed da VYBE...</span>
          </div>
        ) : posts.length === 0 ? (
          /* Clean Empty Feed State */
          <div
            id="feed-empty-state"
            className="w-full bg-white rounded-3xl border border-[#E5EEEE] p-8 sm:p-10 text-center shadow-xs flex flex-col items-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#F0F6F6] text-[#548687] flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8" />
            </div>

            <h3 className="text-base font-bold text-gray-900 mb-1.5">
              Seu feed multimídia está pronto!
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mb-6 leading-relaxed">
              Publique textos, imagens ou vídeos leves para compartilhar seus momentos com a comunidade VYBE.
            </p>

            <div className="flex items-center gap-3">
              <button
                id="btn-empty-create-post"
                type="button"
                onClick={onOpenPostCreator}
                className="py-2.5 px-5 bg-[#548687] hover:bg-[#436e6f] text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-98"
              >
                <Plus className="w-4 h-4" />
                <span>Criar primeira publicação</span>
              </button>
              <button
                id="btn-empty-create-story"
                type="button"
                onClick={onOpenStoryCreator}
                className="py-2.5 px-4 bg-[#F0F6F6] hover:bg-[#E3EFEF] text-[#416869] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Postar um Story
              </button>
            </div>
          </div>
        ) : (
          /* Real Posts List (Multimedia) */
          visiblePosts.map((post) => {
            const isLiked = user?.uid ? post.likes.includes(user.uid) : false;
            const authorInitial =
              post.authorDisplayName?.[0]?.toUpperCase() ||
              post.authorUsername[0]?.toUpperCase() ||
              'U';

            // Check if current user is invited as collaborator with pending status
            const myCollabInvite = user?.uid
              ? post.collaborators?.find((c) => c.usuario_id === user.uid && c.status === 'pendente')
              : null;

            // Accepted collaborators
            const acceptedCollabs = post.collaborators?.filter((c) => c.status === 'aceito') || [];

            // Pending collaborators (for creator viewing)
            const isCreator = user?.uid === post.authorUid;
            const pendingCollabs = isCreator
              ? post.collaborators?.filter((c) => c.status === 'pendente') || []
              : [];

            const midias = post.mediaUrls && post.mediaUrls.length > 0
              ? post.mediaUrls
              : (post.mediaUrl ? [post.mediaUrl] : []);

            return (
              <PostArticleWrapper key={post.id} post={post} currentUid={user?.uid}>
                <article
                  id={`post-card-${post.id}`}
                  className="w-full bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-xs transition-shadow hover:shadow-sm"
                >
                {/* Pending Collaboration Invitation Action Banner */}
                {myCollabInvite && (
                  <div className="bg-[#F0F8F8] border-b border-[#D2E7E7] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 text-xs text-[#285253]">
                      <div className="w-6 h-6 rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <span>
                        <strong className="text-gray-900">@{post.authorUsername}</strong> convidou você para colaborar nesta publicação.
                      </span>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleCollabResponse(post.id, 'aceito')}
                        className="px-3.5 py-1.5 bg-[#548687] hover:bg-[#436e6f] text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Aceitar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCollabResponse(post.id, 'recusado')}
                        className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                )}

                {/* Post Author Header */}
                <div className="px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {acceptedCollabs.length > 0 ? (
                      /* Dual Overlapping Avatars for Collaboration (image.png style) */
                      <div className="relative w-9 h-9 shrink-0">
                        {/* 1. Author Avatar (Top-Left) */}
                        <div
                          onClick={() => onSelectUser?.(post.authorUid)}
                          className="absolute top-0 left-0 w-[22px] h-[22px] rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-[9px] overflow-hidden border-2 border-white shadow-2xs cursor-pointer hover:scale-110 transition-transform z-10"
                          title={`@${post.authorUsername}`}
                        >
                          {post.authorPhotoURL ? (
                            <img
                              src={post.authorPhotoURL}
                              alt={post.authorUsername}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{authorInitial}</span>
                          )}
                        </div>

                        {/* 2. Collaborator Avatar (Bottom-Right Overlapping) */}
                        <div
                          onClick={() => onSelectUser?.(acceptedCollabs[0].usuario_id)}
                          className="absolute bottom-0 right-0 w-[22px] h-[22px] rounded-full bg-[#274647] text-white flex items-center justify-center font-bold text-[9px] overflow-hidden border-2 border-white shadow-xs cursor-pointer hover:scale-110 transition-transform z-20"
                          title={`@${acceptedCollabs[0].usuario_username}`}
                        >
                          {acceptedCollabs[0].usuario_photoURL ? (
                            <img
                              src={acceptedCollabs[0].usuario_photoURL}
                              alt={acceptedCollabs[0].usuario_username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{acceptedCollabs[0].usuario_username[0]?.toUpperCase() || 'C'}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Single User Avatar */
                      <div
                        onClick={() => onSelectUser?.(post.authorUid)}
                        className="w-9 h-9 rounded-full bg-[#548687] text-white flex items-center justify-center font-semibold text-sm overflow-hidden hover:ring-2 hover:ring-[#548687]/40 transition-all cursor-pointer shrink-0"
                      >
                        {post.authorPhotoURL ? (
                          <img
                            src={post.authorPhotoURL}
                            alt={post.authorUsername}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{authorInitial}</span>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col justify-center">
                      {acceptedCollabs.length > 0 ? (
                        /* Joint Usernames in one line */
                        <div className="text-sm text-gray-900 leading-snug flex items-center gap-1.5 flex-wrap relative">
                          <button
                            type="button"
                            onClick={() => onSelectUser?.(post.authorUid)}
                            className="font-semibold text-gray-900 hover:text-[#548687] transition-colors cursor-pointer"
                          >
                            {post.authorUsername}
                          </button>
                          
                          {acceptedCollabs.length === 1 ? (
                            <>
                              <span className="text-xs text-gray-500 font-normal">e</span>
                              <button
                                type="button"
                                onClick={() => onSelectUser?.(acceptedCollabs[0].usuario_id)}
                                className="font-semibold text-gray-900 hover:text-[#548687] transition-colors cursor-pointer"
                              >
                                {acceptedCollabs[0].usuario_username}
                              </button>
                            </>
                          ) : (
                            <div className="relative">
                              <span className="text-xs text-gray-500 font-normal">com</span>
                              <button
                                type="button"
                                onClick={() => setExpandedCollabsPostId(expandedCollabsPostId === post.id ? null : post.id)}
                                className="ml-1.5 font-semibold text-gray-900 hover:text-[#548687] transition-colors cursor-pointer"
                              >
                                {acceptedCollabs.length} outros
                              </button>

                              {/* Collabs Popover */}
                              {expandedCollabsPostId === post.id && (
                                <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg z-50 p-2 animate-in fade-in zoom-in-95">
                                  <div className="text-xs font-semibold text-gray-500 mb-1 px-2">Colaboradores</div>
                                  <div className="space-y-0.5 max-h-40 overflow-y-auto">
                                    {/* Author */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onSelectUser?.(post.authorUid);
                                        setExpandedCollabsPostId(null);
                                      }}
                                      className="w-full flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-lg text-left transition-colors cursor-pointer"
                                    >
                                      <div className="w-5 h-5 rounded-full bg-[#548687] text-white flex items-center justify-center text-[8px] font-bold overflow-hidden shrink-0">
                                        {post.authorPhotoURL ? (
                                          <img src={post.authorPhotoURL} alt={post.authorUsername} className="w-full h-full object-cover" />
                                        ) : (
                                          <span>{authorInitial}</span>
                                        )}
                                      </div>
                                      <span className="text-xs font-medium text-gray-800 truncate">@{post.authorUsername}</span>
                                    </button>
                                    
                                    {/* Accepted Collaborators */}
                                    {acceptedCollabs.map((collab) => (
                                      <button
                                        key={collab.usuario_id}
                                        type="button"
                                        onClick={() => {
                                          onSelectUser?.(collab.usuario_id);
                                          setExpandedCollabsPostId(null);
                                        }}
                                        className="w-full flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-lg text-left transition-colors cursor-pointer"
                                      >
                                        <div className="w-5 h-5 rounded-full bg-[#274647] text-white flex items-center justify-center text-[8px] font-bold overflow-hidden shrink-0">
                                          {collab.usuario_photoURL ? (
                                            <img src={collab.usuario_photoURL} alt={collab.usuario_username} className="w-full h-full object-cover" />
                                          ) : (
                                            <span>{collab.usuario_username[0]?.toUpperCase()}</span>
                                          )}
                                        </div>
                                        <span className="text-xs font-medium text-gray-800 truncate">@{collab.usuario_username}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <span className="text-xs text-gray-400 font-normal">
                            • {formatTime(post.createdAt)}
                          </span>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-900 leading-snug flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onSelectUser?.(post.authorUid)}
                            className="font-semibold hover:text-[#548687] transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <span>{post.authorDisplayName || post.authorUsername}</span>
                            <VerifiedBadge uid={post.authorUid} allUsers={allUsers} size={13} />
                          </button>
                          {/* If they have a display name different from username, show username too */}
                          {post.authorDisplayName && post.authorDisplayName !== post.authorUsername && (
                            <span className="text-xs text-gray-500 font-normal flex items-center gap-1">
                              @{post.authorUsername}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 font-normal">
                            • {formatTime(post.createdAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status badge if author created collab and is pending */}
                    {pendingCollabs.length > 0 && (
                      <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full">
                        Convite com @{pendingCollabs[0].usuario_username} pendente
                      </span>
                    )}

                    {/* Three Dots Post Menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setActivePostMenuId(activePostMenuId === post.id ? null : post.id)
                        }
                        className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                        title="Opções da publicação"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {activePostMenuId === post.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-1 animate-in fade-in zoom-in-95">
                          {user?.uid === post.authorUid ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePostMenuId(null);
                                  onOpenEditPost?.(post);
                                }}
                                className="w-full px-4 py-2.5 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                <span>Editar publicação</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActivePostMenuId(null);
                                  onConfirmDeletePost?.(post);
                                }}
                                className="w-full px-4 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span className="font-bold">Excluir publicação</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePostMenuId(null);
                                  onOpenReport?.('post', post.id);
                                }}
                                className="w-full px-4 py-2.5 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Flag className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>Denunciar publicação</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActivePostMenuId(null);
                                  onOpenBlock?.(post.authorUid, post.authorUsername);
                                }}
                                className="w-full px-4 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <UserX className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>Bloquear @{post.authorUsername}</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Post Media Gallery: Images / Videos */}
                {midias.length > 0 && (
                  <PostMediaGallery midias={midias} />
                )}

                {/* Post Text Content */}
                {post.content && (
                  <div className={`px-4 ${midias.length > 0 ? 'pt-3 pb-3' : 'pb-3'} text-sm text-gray-800 leading-relaxed whitespace-pre-line`}>
                    <FormattedText
                      text={post.content}
                      onSelectUser={onSelectUser}
                      onSelectHashtag={onSelectHashtag}
                      allUsers={allUsers}
                    />
                  </div>
                )}

                {/* Engagements Summary (Likes & Views) */}
                <div className="px-4 pb-2 pt-1 flex items-center justify-between text-xs font-semibold text-gray-500">
                  <button
                    type="button"
                    onClick={() => onOpenEngagements?.(post, 'curtidas')}
                    className="hover:text-gray-900 transition-colors cursor-pointer"
                  >
                    {formatEngagementCount(typeof post.likesCount === 'number' ? post.likesCount : post.likes.length)} curtidas
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenEngagements?.(post, 'visualizacoes')}
                    className="hover:text-gray-900 transition-colors cursor-pointer"
                  >
                    {formatEngagementCount(post.viewsCount || 0)} visualizações
                  </button>
                </div>

                {/* Post Action Bar (Like, Comment, Share, Save) */}
                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-gray-600">
                  <div className="flex items-center gap-4">
                    <button
                      id={`btn-like-post-${post.id}`}
                      type="button"
                      onClick={() => handleTogglePostLike(post)}
                      className="flex items-center gap-1.5 text-xs font-semibold hover:text-gray-900 transition-colors cursor-pointer"
                    >
                      <Heart
                        className={`w-5 h-5 transition-transform active:scale-125 ${
                          isLiked ? 'fill-rose-500 text-rose-500' : 'text-gray-600'
                        }`}
                      />
                      <span>{post.likes.length > 0 ? post.likes.length : 'Curtir'}</span>
                    </button>

                    <button
                      id={`btn-comment-post-${post.id}`}
                      type="button"
                      onClick={() => onOpenComments?.(post)}
                      className="flex items-center gap-1.5 text-xs font-semibold hover:text-gray-900 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-4.5 h-4.5 text-gray-500" />
                      <span>
                        {typeof post.commentsCount === 'number' && post.commentsCount > 0
                          ? `${post.commentsCount}`
                          : 'Comentar'}
                      </span>
                    </button>

                    <button
                      id={`btn-share-post-${post.id}`}
                      type="button"
                      onClick={() => {
                        if (onSharePost) {
                          onSharePost(post);
                        } else if (onShowToast) {
                          onShowToast('Link da publicação copiado!', 'success');
                        }
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                      title="Compartilhar por mensagem"
                    >
                      <Send className="w-4.5 h-4.5" />
                      <span className="hidden sm:inline">Compartilhar</span>
                    </button>
                  </div>

                  <button
                    id={`btn-save-post-${post.id}`}
                    type="button"
                    onClick={() => handleToggleSavePost(post)}
                    className="p-1 text-gray-500 hover:text-[#548687] transition-colors cursor-pointer"
                    title={savedPostIds.has(post.id) ? 'Remover dos salvos' : 'Salvar publicação'}
                  >
                    <Bookmark
                      className={`w-5 h-5 transition-transform active:scale-125 ${
                        savedPostIds.has(post.id)
                          ? 'fill-[#548687] text-[#548687]'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    />
                  </button>
                </div>
              </article>
            </PostArticleWrapper>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Multi-Media Carousel / Gallery for Posts
 */
function PostMediaGallery({ midias }: { midias: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (midias.length === 0) return null;

  const currentMedia = midias[currentIndex];
  const isVideo =
    currentMedia.startsWith('data:video') ||
    currentMedia.endsWith('.mp4') ||
    currentMedia.endsWith('.webm');

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : midias.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < midias.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="w-full bg-black/95 relative overflow-hidden flex items-center justify-center min-h-[340px] max-h-[540px] select-none group/gallery">
      {isVideo ? (
        <VideoFeedPlayer key={currentMedia} mediaUrl={currentMedia} />
      ) : (
        <img
          src={currentMedia}
          alt={`Mídia ${currentIndex + 1}`}
          className="w-full h-auto max-h-[540px] object-contain"
        />
      )}

      {/* Navigation Arrows for multi-media */}
      {midias.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-transform hover:scale-105 cursor-pointer z-20 shadow-md"
            title="Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-transform hover:scale-105 cursor-pointer z-20 shadow-md"
            title="Próxima"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Dots Indicator + Counter Badge */}
          <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-xs text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full z-20 shadow-sm">
            {currentIndex + 1}/{midias.length}
          </div>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 pointer-events-none">
            {midias.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentIndex ? 'w-5 bg-[#548687]' : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Responsive Video Player for Feed Items
 */
function VideoFeedPlayer({ mediaUrl }: { mediaUrl: string; key?: React.Key }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center group cursor-pointer" onClick={togglePlay}>
      <video
        ref={videoRef}
        src={mediaUrl}
        loop
        playsInline
        muted={isMuted}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="w-full h-auto max-h-[520px] object-contain"
      />

      {/* Play/Pause center overlay when paused */}
      {!isPlaying && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity">
          <div className="w-14 h-14 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-xs shadow-lg hover:scale-110 transition-transform">
            <Play className="w-6 h-6 fill-white translate-x-0.5" />
          </div>
        </div>
      )}

      {/* Floating Audio Toggle */}
      <button
        type="button"
        onClick={toggleMute}
        className="absolute bottom-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-transform cursor-pointer shadow-md z-10"
        title={isMuted ? 'Ativar som' : 'Desativar som'}
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
    </div>
  );
}

const PostArticleWrapper: React.FC<{ post: PostItem; currentUid?: string; children: React.ReactNode }> = ({ post, currentUid, children }) => {
  const ref = usePostViewObserver({ postId: post.id, currentUid });
  return <div ref={ref} className="w-full">{children}</div>;
};
