import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Image as ImageIcon,
  Heart,
  MessageCircle,
  RotateCw,
  Sparkles,
  Layers,
  Video,
  Flame,
  UserPlus,
  Loader2,
  Users,
  Compass,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PostItem } from '../types/social';
import { UserProfile } from '../types/user';
import {
  fetchExploreFeed,
  fetchSuggestedUsersForExplore,
  toggleFollowUser,
} from '../services/socialService';
import { FollowButton } from './FollowButton';

interface ExploreViewProps {
  allUsers: UserProfile[];
  myFollowing: Set<string>;
  myFollowers: Set<string>;
  myOutgoingRequests?: Set<string>;
  allFollows?: { followerUid: string; followingUid: string }[];
  onOpenPostDetail?: (post: PostItem) => void;
  onSelectUser?: (uid: string) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onOpenEngagements?: (post: PostItem, tab: 'curtidas' | 'visualizacoes') => void;
}

type ExploreMediaTypeFilter = 'all' | 'video' | 'image' | 'trending';

// Union type for elements in the bento grid
type BentoItem =
  | { type: 'post'; post: PostItem; layoutSize: '2x2' | '2x1' | '1x1' }
  | { type: 'suggested_user'; user: UserProfile; layoutSize: '1x1' };

// Minimum real posts required from unfollowed creators to sustain the Explore grid properly
const MIN_POSTS_FOR_EXPLORE = 6;

export function ExploreView({
  allUsers,
  myFollowing,
  myFollowers,
  myOutgoingRequests = new Set(),
  allFollows = [],
  onOpenPostDetail,
  onSelectUser,
  onShowToast,
  onOpenEngagements,
}: ExploreViewProps) {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<ExploreMediaTypeFilter>('all');
  const [followLoadingUid, setFollowLoadingUid] = useState<string | null>(null);

  // Load explore items
  const loadExploreData = useCallback(
    async (isRefresh = false) => {
      if (!user?.uid) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const filterType =
          mediaFilter === 'video'
            ? 'video'
            : mediaFilter === 'image'
            ? 'image'
            : 'all';

        const [fetchedPosts, fetchedUsers] = await Promise.all([
          fetchExploreFeed(user.uid, myFollowing, allFollows, filterType),
          fetchSuggestedUsersForExplore(user.uid, myFollowing, allUsers, allFollows),
        ]);

        const publicPostsOnly = fetchedPosts.filter((p) => {
          const author = allUsers.find((u) => u.uid === p.authorUid);
          return !author?.conta_privada;
        });

        setPosts(publicPostsOnly);
        setSuggestedUsers(fetchedUsers);
      } catch (err) {
        console.error('Error loading explore data:', err);
        onShowToast?.('Erro ao carregar o feed Explorar.', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.uid, myFollowing, allUsers, allFollows, mediaFilter, onShowToast]
  );

  useEffect(() => {
    loadExploreData();
  }, [loadExploreData]);

  // Construct the Bento Grid layout structure
  // We repeat an aesthetic pattern:
  // Pattern 1 (6 items): [2x2 Post], [1x1 Post], [1x1 User or Post], [1x1 Post], [1x1 Post]
  // Pattern 2 (6 items): [1x1 Post], [2x1 Post], [1x1 Post], [1x1 User or Post], [1x1 Post]
  const bentoItems: BentoItem[] = React.useMemo(() => {
    const items: BentoItem[] = [];
    let postIdx = 0;
    let userIdx = 0;

    while (postIdx < posts.length) {
      const cycleIndex = items.length % 8;

      if (cycleIndex === 0 && postIdx < posts.length) {
        // Large 2x2 featured card (especially video or highly rated post)
        items.push({
          type: 'post',
          post: posts[postIdx++],
          layoutSize: '2x2',
        });
      } else if (cycleIndex === 2 && userIdx < suggestedUsers.length) {
        // Interspersed suggested user card (mockup top right card)
        items.push({
          type: 'suggested_user',
          user: suggestedUsers[userIdx++],
          layoutSize: '1x1',
        });
      } else if (cycleIndex === 6 && postIdx < posts.length) {
        // 2x1 wide card
        items.push({
          type: 'post',
          post: posts[postIdx++],
          layoutSize: '2x1',
        });
      } else if (cycleIndex === 7 && userIdx < suggestedUsers.length) {
        // Secondary suggested user slot
        items.push({
          type: 'suggested_user',
          user: suggestedUsers[userIdx++],
          layoutSize: '1x1',
        });
      } else if (postIdx < posts.length) {
        // Standard 1x1 cell
        items.push({
          type: 'post',
          post: posts[postIdx++],
          layoutSize: '1x1',
        });
      } else {
        break;
      }
    }

    return items;
  }, [posts, suggestedUsers]);

  // Follow / Unfollow handler on suggested cards
  const handleFollowClick = async (e: React.MouseEvent, targetUid: string) => {
    e.stopPropagation();
    if (!user?.uid) return;

    const isCurrentlyFollowing = myFollowing.has(targetUid);
    try {
      setFollowLoadingUid(targetUid);
      await toggleFollowUser(
        user.uid,
        targetUid,
        isCurrentlyFollowing,
        profile || undefined
      );

      if (!isCurrentlyFollowing) {
        onShowToast?.('Você começou a seguir este perfil.', 'success');
      } else {
        onShowToast?.('Você deixou de seguir este perfil.', 'info');
      }
    } catch (err) {
      console.error('Error toggling follow from explore:', err);
      onShowToast?.('Erro ao atualizar seguidor.', 'error');
    } finally {
      setFollowLoadingUid(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 w-full min-h-[calc(100vh-140px)] flex flex-col items-center justify-center py-28 text-gray-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#548687]" />
        <p className="text-sm font-medium text-gray-500">
          Carregando Explorar...
        </p>
      </div>
    );
  }

  // If there isn't enough information to sustain the Explore page properly,
  // do NOT show the explore layout — show ONLY a card stating that there isn't enough info.
  if (!loading && posts.length < MIN_POSTS_FOR_EXPLORE) {
    return (
      <div className="flex-1 w-full min-h-[calc(100vh-140px)] flex items-center justify-center p-4 sm:p-6">
        <div
          id="explore-insufficient-info-card"
          className="w-full max-w-md bg-white rounded-3xl border border-gray-200/90 shadow-xs p-8 sm:p-10 text-center flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#EAF2F2] text-[#548687] flex items-center justify-center mb-5">
            <Compass className="w-8 h-8 stroke-[1.75]" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2.5 tracking-tight">
            Não tem info o suficiente para mostrar o Explorar
          </h2>

          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            A aba Explorar só é exibida quando houver um volume suficiente de publicações de contas que você ainda não segue para sustentar a grade de descoberta.
          </p>

          <button
            type="button"
            onClick={() => loadExploreData(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#548687] hover:bg-[#457273] text-white text-sm font-semibold transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Explorar
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EAF2F2] text-[#548687]">
              <Sparkles className="w-3 h-3" />
              Descoberta
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Publicações em alta de criadores que você ainda não segue.
          </p>
        </div>

        {/* Filter Pills & Refresh Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-[#F1F5F5] p-1 rounded-xl border border-gray-200/50">
            <button
              type="button"
              onClick={() => setMediaFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mediaFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tudo
            </button>
            <button
              type="button"
              onClick={() => setMediaFilter('video')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mediaFilter === 'video'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Video className="w-3.5 h-3.5 text-[#548687]" />
              Vídeos
            </button>
            <button
              type="button"
              onClick={() => setMediaFilter('image')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mediaFilter === 'image'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-[#548687]" />
              Fotos
            </button>
          </div>

          <button
            type="button"
            onClick={() => loadExploreData(true)}
            disabled={refreshing || loading}
            title="Atualizar feed explorar"
            className="flex items-center justify-center p-2.5 rounded-xl bg-white border border-gray-200/80 text-gray-700 hover:bg-[#F1F5F5] hover:text-[#548687] transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <RotateCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#548687]' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {bentoItems.length === 0 ? (
        /* Filter Empty State */
        <div className="flex flex-col items-center justify-center py-20 text-center bg-[#F8FAFA] rounded-3xl border border-dashed border-gray-200 p-8">
          <div className="w-16 h-16 rounded-full bg-[#EAF2F2] text-[#548687] flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            Nenhuma publicação neste filtro
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 max-w-md mb-6">
            Não encontramos publicações para o formato selecionado. Alterne para &quot;Tudo&quot; para ver as demais descobertas.
          </p>
          <button
            type="button"
            onClick={() => setMediaFilter('all')}
            className="px-5 py-2.5 rounded-xl bg-[#548687] hover:bg-[#457273] text-white text-sm font-semibold transition-colors cursor-pointer shadow-xs"
          >
            Ver tudo
          </button>
        </div>
      ) : (
        /* Bento / Mosaic Grid Layout */
        <div
          id="explore-bento-grid"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-[160px] sm:auto-rows-[190px] md:auto-rows-[220px]"
        >
          {bentoItems.map((item, idx) => {
            if (item.type === 'suggested_user') {
              const u = item.user;
              const isFollowing = myFollowing.has(u.uid);
              const userInitial =
                u.displayName?.[0]?.toUpperCase() ||
                u.username?.[0]?.toUpperCase() ||
                'U';

              return (
                <div
                  key={`user-${u.uid}-${idx}`}
                  id={`explore-suggested-user-${u.uid}`}
                  onClick={() => onSelectUser?.(u.uid)}
                  className="group relative flex flex-col items-center justify-center p-4 rounded-2xl sm:rounded-3xl bg-[#FFFFFF] border border-gray-200/90 hover:border-[#548687]/40 shadow-xs hover:shadow-md transition-all cursor-pointer text-center"
                >
                  {/* Avatar circle matching mockup */}
                  <div className="relative mb-2.5">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-lg sm:text-xl overflow-hidden ring-3 ring-[#EAF2F2] group-hover:scale-105 transition-transform">
                      {u.photoURL ? (
                        <img
                          src={u.photoURL}
                          alt={u.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{userInitial}</span>
                      )}
                    </div>
                  </div>

                  {/* Name / Username */}
                  <h4 className="font-bold text-gray-900 text-xs sm:text-sm truncate max-w-[130px] leading-tight">
                    {u.username}
                  </h4>
                  {u.displayName && u.displayName !== u.username && (
                    <p className="text-[11px] text-gray-500 truncate max-w-[130px]">
                      {u.displayName}
                    </p>
                  )}

                  {/* Follow Button */}
                  <div className="mt-2.5 w-full flex justify-center">
                    <FollowButton
                      currentUid={user!.uid}
                      targetUid={u.uid}
                      targetUsername={u.username}
                      iFollow={isFollowing}
                      followsMe={myFollowers.has(u.uid)}
                      isPrivate={u.conta_privada}
                      isRequested={myOutgoingRequests.has(u.uid)} 
                      onShowToast={onShowToast}
                    />
                  </div>
                </div>
              );
            }

            // Post Card
            const p = item.post;
            const isVideo =
              p.mediaType === 'video' ||
              (p.mediaUrls && p.mediaUrls.some((u) => u.includes('mp4') || u.includes('video')));
            const hasMultiple = p.mediaUrls && p.mediaUrls.length > 1;
            const mediaSource =
              p.mediaUrls && p.mediaUrls.length > 0
                ? p.mediaUrls[0]
                : p.mediaUrl || '';

            // Class configurations for bento sizing
            let gridSpanClass = 'col-span-1 row-span-1';
            if (item.layoutSize === '2x2') {
              gridSpanClass = 'col-span-2 row-span-2';
            } else if (item.layoutSize === '2x1') {
              gridSpanClass = 'col-span-2 row-span-1';
            }

            return (
              <div
                key={`post-${p.id}-${idx}`}
                id={`explore-post-${p.id}`}
                onClick={() => onOpenPostDetail?.(p)}
                className={`group relative rounded-2xl sm:rounded-3xl overflow-hidden bg-[#E6EFEF] border border-gray-200/60 shadow-xs hover:shadow-lg transition-all duration-200 cursor-pointer ${gridSpanClass}`}
              >
                {/* Media Image or Background */}
                {mediaSource ? (
                  isVideo ? (
                    <video
                      src={mediaSource}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                      muted
                      playsInline
                      loop
                    />
                  ) : (
                    <img
                      src={mediaSource}
                      alt={p.content || 'Publicação'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )
                ) : (
                  /* Text-only or minimalist placeholder card */
                  <div className="w-full h-full p-4 flex flex-col justify-between bg-[#EAF2F2] text-gray-800">
                    <p className="text-xs sm:text-sm font-medium line-clamp-4 leading-relaxed">
                      {p.content}
                    </p>
                    <span className="text-[10px] text-gray-400">
                      @{p.authorUsername}
                    </span>
                  </div>
                )}

                {/* Center Icon (Play icon for video or Image icon placeholder if no media) */}
                {isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black/35 backdrop-blur-xs flex items-center justify-center text-white border border-white/40 shadow-sm group-hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 sm:w-8 sm:h-8 fill-white/90 stroke-white ml-1" />
                    </div>
                  </div>
                )}

                {!mediaSource && !isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[#548687]/40">
                    <ImageIcon className="w-8 h-8 sm:w-10 sm:h-10 stroke-[1.5]" />
                  </div>
                )}

                {/* Carousel badge icon on top right */}
                {hasMultiple && (
                  <div className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-xs text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                    <Layers className="w-3 h-3" />
                    <span>{p.mediaUrls!.length}</span>
                  </div>
                )}

                {/* Bottom Left Pill Tag for Author (Mockup: 'rafa.oliveira') */}
                <div className="absolute bottom-2.5 left-2.5 z-10">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-white/90 hover:bg-white text-gray-900 shadow-xs backdrop-blur-xs transition-colors">
                    {p.authorUsername}
                  </span>
                </div>

                {/* Hover Engagement Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-4 text-white pointer-events-none">
                  <div className="flex items-center gap-1 text-xs sm:text-sm font-bold drop-shadow-sm">
                    <Heart className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />
                    <span>{p.likes?.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs sm:text-sm font-bold drop-shadow-sm">
                    <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />
                    <span>{p.commentsCount || 0}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
