import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types/user';
import { PostItem, ReportTargetType } from '../types/social';
import {
  subscribeUserPosts,
  subscribeUserProfileStats,
  unblockUser,
  subscribeSavedPostIds,
  fetchSavedPosts,
} from '../services/socialService';
import { FollowButton } from './FollowButton';
import { EditProfileModal } from './EditProfileModal';
import { PostCommentsPanel } from './PostCommentsPanel';
import { VerifiedBadge } from './VerifiedBadge';
import {
  Grid3X3,
  Play,
  Bookmark,
  MapPin,
  Share2,
  MoreHorizontal,
  MessageCircle,
  Heart,
  Loader2,
  Camera,
  Plus,
  X,
  Ban,
  Flag,
  UserX,
} from 'lucide-react';

interface ProfileViewProps {
  targetUid: string;
  currentUid: string;
  currentUserProfile: UserProfile;
  myFollowing: Set<string>;
  myFollowers: Set<string>;
  myBlockedUsers?: Set<string>;
  usersWhoBlockedMe?: Set<string>;
  myOutgoingRequests?: Set<string>;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onOpenPostCreator?: () => void;
  onProfileUpdated?: (updated: UserProfile) => void;
  onSelectUser?: (uid: string) => void;
  onOpenChat?: (targetUid: string) => void;
  onOpenEngagements?: (post: PostItem, tab: 'curtidas' | 'visualizacoes') => void;
  onNavigateSettings?: () => void;
  onOpenReport?: (type: ReportTargetType, id: string) => void;
  onOpenBlock?: (targetUid: string, targetUsername: string) => void;
  onOpenEditPost?: (post: PostItem) => void;
  onConfirmDeletePost?: (post: PostItem) => void;
}

type ProfileTab = 'posts' | 'videos' | 'saved';

export function ProfileView({
  targetUid,
  currentUid,
  currentUserProfile,
  myFollowing,
  myFollowers,
  myBlockedUsers = new Set(),
  usersWhoBlockedMe = new Set(),
  myOutgoingRequests = new Set(),
  onShowToast,
  onOpenPostCreator,
  onProfileUpdated,
  onSelectUser,
  onOpenChat,
  onOpenEngagements,
  onNavigateSettings,
  onOpenReport,
  onOpenBlock,
  onOpenEditPost,
  onConfirmDeletePost,
}: ProfileViewProps) {
  const isOwnProfile = targetUid === currentUid;
  const isBlockedByMe = myBlockedUsers.has(targetUid);
  const isBlockedByThem = usersWhoBlockedMe.has(targetUid);
  const isBlockedRelation = !isOwnProfile && (isBlockedByMe || isBlockedByThem);

  const [profile, setProfile] = useState<UserProfile | null>(
    isOwnProfile ? currentUserProfile : null
  );
  const [loadingProfile, setLoadingProfile] = useState(!isOwnProfile);
  const [stats, setStats] = useState({ postsCount: 0, followersCount: 0, followingCount: 0 });
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [savedPosts, setSavedPosts] = useState<PostItem[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  // 1. Subscribe to profile document
  useEffect(() => {
    if (isOwnProfile) {
      setProfile(currentUserProfile);
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    const userRef = doc(db, 'users', targetUid);
    const unsub = onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          setProfile(null);
        }
        setLoadingProfile(false);
      },
      (err) => {
        console.error('Error listening to user profile:', err);
        setLoadingProfile(false);
      }
    );

    return () => unsub();
  }, [targetUid, isOwnProfile, currentUserProfile]);

  // 2. Subscribe to user stats (posts, followers, following)
  useEffect(() => {
    const unsubStats = subscribeUserProfileStats(targetUid, (newStats) => {
      setStats(newStats);
    });
    return () => unsubStats();
  }, [targetUid]);

  // 3. Subscribe to posts created by this user
  useEffect(() => {
    const unsubPosts = subscribeUserPosts(targetUid, (userPosts) => {
      setPosts(userPosts);
    });
    return () => unsubPosts();
  }, [targetUid]);

  // 4. Subscribe to saved posts for profile owner
  useEffect(() => {
    if (!isOwnProfile || !currentUid) return;
    const unsub = subscribeSavedPostIds(currentUid, async (ids) => {
      setSavedPostIds(ids);
      const loaded = await fetchSavedPosts(ids);
      setSavedPosts(loaded);
    });
    return () => unsub();
  }, [isOwnProfile, currentUid]);

  // Enforce tab security: non-owners cannot be in saved tab
  useEffect(() => {
    if (!isOwnProfile && activeTab === 'saved') {
      setActiveTab('posts');
    }
  }, [isOwnProfile, activeTab]);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      onShowToast?.('Link do perfil copiado para a área de transferência!', 'success');
    } else {
      onShowToast?.(`Perfil de @${profile?.username}`, 'info');
    }
  };

  const handleOpenMessage = () => {
    if (onOpenChat && targetUid) {
      onOpenChat(targetUid);
    } else {
      onShowToast?.(
        `Abrindo conversa com @${profile?.username}...`,
        'info'
      );
    }
  };

  if (loadingProfile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin text-[#548687] mb-2" />
        <span className="text-sm font-medium">Carregando perfil...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 max-w-2xl mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-400">
          <X className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">Perfil não encontrado</h2>
        <p className="text-xs text-gray-500 mt-1">
          Este usuário não existe ou a conta foi removida.
        </p>
      </div>
    );
  }

  if (isBlockedRelation) {
    return (
      <div className="flex-1 max-w-xl mx-auto py-16 px-4 text-center animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-full bg-red-50 text-[#B94A4A] flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-2xs">
          <Ban className="w-8 h-8 stroke-[2]" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Esta conta não está disponível</h2>
        <p className="text-xs sm:text-sm text-gray-500 max-w-xs mx-auto leading-relaxed mb-6">
          {isBlockedByMe
            ? 'Você bloqueou este usuário. Para ver as publicações dele, você precisará desbloqueá-lo.'
            : 'Este perfil não está disponível ou a conta foi restrita.'}
        </p>
        {isBlockedByMe && (
          <button
            type="button"
            onClick={async () => {
              try {
                await unblockUser(currentUid, targetUid);
                onShowToast?.('Usuário desbloqueado.', 'success');
              } catch (e) {
                onShowToast?.('Erro ao desbloquear.', 'error');
              }
            }}
            className="px-5 py-2.5 bg-[#B94A4A] hover:bg-[#A33B3B] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            Desbloquear conta
          </button>
        )}
      </div>
    );
  }

  const initial =
    profile.displayName?.[0]?.toUpperCase() ||
    profile.username[0]?.toUpperCase() ||
    'V';

  const iFollow = myFollowing.has(targetUid);
  const followsMe = myFollowers.has(targetUid);

  return (
    <div id="profile-page-container" className="flex-1 max-w-4xl mx-auto py-8 px-4 sm:px-8">
      {/* Top Profile Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10 pb-8 border-b border-gray-100">
        {/* Large Avatar */}
        <div className="shrink-0 relative mx-auto sm:mx-0">
          <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-[#E1EEEE] text-[#426F70] flex items-center justify-center font-bold text-3xl sm:text-4xl overflow-hidden border-2 border-[#548687]/20 shadow-xs">
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{initial}</span>
            )}
          </div>
        </div>

        {/* Profile Info Details */}
        <div className="flex-1 min-w-0 w-full sm:w-auto space-y-4">
          {/* Row 1: Username & Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 justify-between sm:justify-start">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-1.5">
              {profile.username}
              <VerifiedBadge verified={profile.verificado} size={18} />
            </h1>

            <div className="flex items-center gap-2">
              {isOwnProfile ? (
                <>
                  <button
                    id="btn-profile-edit"
                    type="button"
                    onClick={() => {
                      if (onNavigateSettings) {
                        onNavigateSettings();
                      } else {
                        setIsEditModalOpen(true);
                      }
                    }}
                    className="px-4 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 text-xs sm:text-sm font-semibold rounded-xl transition-colors shadow-2xs cursor-pointer"
                  >
                    Editar perfil
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="px-3.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 text-xs sm:text-sm font-semibold rounded-xl transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                    title="Compartilhar"
                  >
                    <Share2 className="w-3.5 h-3.5 text-gray-600" />
                    <span className="hidden sm:inline">Compartilhar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onShowToast?.('Opções do perfil', 'info')}
                    className="p-1.5 border border-gray-300 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  {/* Follow Button */}
                  <FollowButton
                    currentUid={currentUid}
                    targetUid={targetUid}
                    targetUsername={profile.username}
                    iFollow={iFollow}
                    followsMe={followsMe}
                    isPrivate={profile.conta_privada}
                    isRequested={myOutgoingRequests.has(targetUid)}
                    onShowToast={onShowToast}
                  />

                  {/* Message button */}
                  <button
                    type="button"
                    onClick={handleOpenMessage}
                    className="px-4 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 text-xs sm:text-sm font-semibold rounded-xl transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-gray-600" />
                    <span>Mensagem</span>
                  </button>

                  {/* More options button with popover */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                      className="p-1.5 border border-gray-300 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
                      title="Mais opções"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {showOptionsMenu && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-1 animate-in fade-in zoom-in-95">
                        <button
                          type="button"
                          onClick={() => {
                            setShowOptionsMenu(false);
                            onOpenReport?.('usuario', targetUid);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <Flag className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Denunciar perfil</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowOptionsMenu(false);
                            onOpenBlock?.(targetUid, profile.username);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <UserX className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Bloquear @{profile.username}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Row 2: Real Stats (posts, seguidores, seguindo) */}
          <div className="flex items-center gap-6 text-sm text-gray-700">
            <div className="flex items-center gap-1">
              <span className="font-bold text-gray-900">{stats.postsCount}</span>
              <span className="text-gray-500">posts</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-gray-900">{stats.followersCount}</span>
              <span className="text-gray-500">
                {stats.followersCount === 1 ? 'seguidor' : 'seguidores'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-gray-900">{stats.followingCount}</span>
              <span className="text-gray-500">seguindo</span>
            </div>
          </div>

          {/* Row 3: Display Name, Bio, Location */}
          <div className="space-y-1 text-sm">
            <div className="font-bold text-gray-900 leading-snug">
              {profile.displayName || profile.username}
            </div>

            {profile.bio && (
              <p className="text-gray-700 whitespace-pre-line leading-relaxed text-xs sm:text-sm">
                {profile.bio}
              </p>
            )}

            {profile.location && (
              <div className="flex items-center gap-1 text-xs text-gray-500 pt-0.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span>{profile.location}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {Boolean(profile.conta_privada || (profile as any).isPrivate) && !isOwnProfile && !iFollow ? (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 bg-white mt-4 border-t border-gray-100">
          <div className="w-16 h-16 rounded-full border-2 border-gray-900 flex items-center justify-center">
            <svg
              width="24"
              height="30"
              viewBox="0 0 24 30"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-10 text-gray-900"
            >
              <rect x="3" y="12" width="18" height="15" rx="3" stroke="currentColor" strokeWidth="2.5"/>
              <path d="M7 12V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="12" cy="19.5" r="2.5" fill="currentColor"/>
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-[15px] mb-1">
              Esta conta é privada
            </h3>
            <p className="text-gray-500 text-sm">
              Siga para ver as publicações e stories de @{profile.username}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Tabs Row: POSTS, VÍDEOS, SALVOS (Salvos only for account owner) */}
          <div className="flex items-center justify-center gap-8 sm:gap-12 border-b border-gray-100 text-xs sm:text-sm font-semibold mt-2">
            <button
              type="button"
              onClick={() => setActiveTab('posts')}
              className={`py-3 flex items-center gap-2 relative transition-colors cursor-pointer tracking-wider uppercase ${
                activeTab === 'posts'
                  ? 'text-gray-900 font-bold'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              <span>Posts</span>
              {activeTab === 'posts' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#548687] rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('videos')}
              className={`py-3 flex items-center gap-2 relative transition-colors cursor-pointer tracking-wider uppercase ${
                activeTab === 'videos'
                  ? 'text-gray-900 font-bold'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              <Play className="w-4 h-4" />
              <span>Vídeos</span>
              {activeTab === 'videos' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#548687] rounded-full" />
              )}
            </button>

            {isOwnProfile && (
              <button
                type="button"
                onClick={() => setActiveTab('saved')}
                className={`py-3 flex items-center gap-2 relative transition-colors cursor-pointer tracking-wider uppercase ${
                  activeTab === 'saved'
                    ? 'text-gray-900 font-bold'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                <Bookmark className="w-4 h-4" />
                <span>Salvos</span>
                {activeTab === 'saved' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#548687] rounded-full" />
                )}
              </button>
            )}
          </div>

          {/* Tab Content Grid */}
          <div className="pt-6">
            {activeTab === 'posts' && (
              <>
                {posts.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                    {posts.map((post) => {
                      const mediaUrl = post.mediaUrl || (post.mediaUrls && post.mediaUrls[0]) || '';
                      const isVideo =
                        post.mediaType === 'video' ||
                        (Boolean(mediaUrl) &&
                          (mediaUrl.startsWith('data:video') ||
                            mediaUrl.endsWith('.mp4') ||
                            mediaUrl.endsWith('.webm')));

                      const isCollab = Array.isArray(post.collaborators) &&
                        post.collaborators.some((c) => c.usuario_id === targetUid && c.status === 'aceito');

                      return (
                        <div
                          key={post.id}
                          onClick={() => setSelectedPost(post)}
                          className="group relative aspect-square bg-[#F1F5F5] rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer shadow-2xs"
                        >
                          {isVideo && mediaUrl ? (
                            <div className="relative w-full h-full bg-black flex items-center justify-center">
                              <video
                                src={mediaUrl}
                                muted
                                playsInline
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-md">
                                <Play className="w-3.5 h-3.5 fill-white" />
                              </div>
                            </div>
                          ) : mediaUrl ? (
                            <img
                              src={mediaUrl}
                              alt={post.content || 'Publicação'}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full p-4 flex flex-col justify-between bg-gradient-to-br from-[#E1EEEE] to-[#F1F5F5] text-gray-800">
                              <p className="text-xs sm:text-sm font-medium line-clamp-4">
                                {post.content}
                              </p>
                              <span className="text-[10px] text-gray-400 self-end">
                                {new Date(post.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}

                          {/* Multiple images indicator */}
                          {post.mediaUrls && post.mediaUrls.length > 1 && (
                            <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                              1/{post.mediaUrls.length}
                            </div>
                          )}

                          {/* Collaboration badge */}
                          {isCollab && (
                            <div className="absolute bottom-2 left-2 bg-[#548687]/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-xs">
                              Colab
                            </div>
                          )}

                          {/* Overlay on hover showing Likes */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-4 font-bold text-sm">
                            <div className="flex items-center gap-1.5">
                              <Heart className="w-5 h-5 fill-white" />
                              <span>{post.likes?.length || 0}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-16 text-center space-y-3 bg-[#F9FBFC] rounded-3xl border border-dashed border-gray-200">
                    <div className="w-14 h-14 rounded-full bg-[#E1EEEE] text-[#548687] flex items-center justify-center mx-auto">
                      <Camera className="w-7 h-7" />
                    </div>
                    <h3 className="font-bold text-gray-800 text-base">
                      Ainda não há publicações
                    </h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      {isOwnProfile
                        ? 'Compartilhe momentos, fotos e novidades com os seus amigos na VYBE!'
                        : `@${profile.username} ainda não compartilhou nenhuma foto ou texto.`}
                    </p>
                    {isOwnProfile && onOpenPostCreator && (
                      <button
                        type="button"
                        onClick={onOpenPostCreator}
                        className="mt-2 px-4 py-2 bg-[#548687] hover:bg-[#436e6f] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Criar primeira publicação</span>
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === 'videos' && (
              <>
                {posts.filter(
                  (p) =>
                    p.mediaType === 'video' ||
                    (Boolean(p.mediaUrl) &&
                      (p.mediaUrl?.startsWith('data:video') ||
                        p.mediaUrl?.endsWith('.mp4') ||
                        p.mediaUrl?.endsWith('.webm')))
                ).length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                    {posts
                      .filter(
                        (p) =>
                          p.mediaType === 'video' ||
                          (Boolean(p.mediaUrl) &&
                            (p.mediaUrl?.startsWith('data:video') ||
                              p.mediaUrl?.endsWith('.mp4') ||
                              p.mediaUrl?.endsWith('.webm')))
                      )
                      .map((post) => (
                        <div
                          key={post.id}
                          onClick={() => setSelectedPost(post)}
                          className="group relative aspect-square bg-black rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer shadow-2xs flex items-center justify-center"
                        >
                          <video
                            src={post.mediaUrl}
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-md">
                            <Play className="w-3.5 h-3.5 fill-white" />
                          </div>
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-4 font-bold text-sm">
                            <div className="flex items-center gap-1.5">
                              <Heart className="w-5 h-5 fill-white" />
                              <span>{post.likes?.length || 0}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="py-16 text-center space-y-2 bg-[#F9FBFC] rounded-3xl border border-dashed border-gray-200">
                    <Play className="w-10 h-10 text-gray-300 mx-auto" />
                    <h3 className="font-bold text-gray-800 text-sm">
                      Nenhum vídeo publicado
                    </h3>
                    <p className="text-xs text-gray-500">
                      {isOwnProfile
                        ? 'Vídeos leves que você compartilhar aparecerão aqui.'
                        : `@${profile.username} ainda não publicou vídeos.`}
                    </p>
                  </div>
                )}
              </>
            )}

            {activeTab === 'saved' && (
              <>
                {savedPosts.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                    {savedPosts.map((post) => {
                      const mediaUrl = post.mediaUrl || (post.mediaUrls && post.mediaUrls[0]) || '';
                      const isVideo =
                        post.mediaType === 'video' ||
                        (Boolean(mediaUrl) &&
                          (mediaUrl.startsWith('data:video') ||
                            mediaUrl.endsWith('.mp4') ||
                            mediaUrl.endsWith('.webm')));

                      return (
                        <div
                          key={post.id}
                          onClick={() => setSelectedPost(post)}
                          className="group relative aspect-square bg-[#F1F5F5] rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer shadow-2xs"
                        >
                          {isVideo && mediaUrl ? (
                            <div className="relative w-full h-full bg-black flex items-center justify-center">
                              <video
                                src={mediaUrl}
                                muted
                                playsInline
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-md">
                                <Play className="w-3.5 h-3.5 fill-white" />
                              </div>
                            </div>
                          ) : mediaUrl ? (
                            <img
                              src={mediaUrl}
                              alt={post.content || 'Publicação salva'}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full p-4 flex flex-col justify-between bg-gradient-to-br from-[#E1EEEE] to-[#F1F5F5] text-gray-800">
                              <p className="text-xs sm:text-sm font-medium line-clamp-4">
                                {post.content}
                              </p>
                              <span className="text-[10px] text-gray-400 self-end">
                                {new Date(post.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}

                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-4 font-bold text-sm">
                            <div className="flex items-center gap-1.5">
                              <Heart className="w-5 h-5 fill-white" />
                              <span>{post.likes?.length || 0}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MessageCircle className="w-5 h-5 fill-white" />
                              <span>{post.commentsCount || 0}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-16 text-center space-y-2 bg-[#F9FBFC] rounded-3xl border border-dashed border-gray-200">
                    <Bookmark className="w-10 h-10 text-gray-300 mx-auto" />
                    <h3 className="font-bold text-gray-800 text-sm">
                      Nenhuma publicação salva
                    </h3>
                    <p className="text-xs text-gray-500">
                      Salve publicações tocando no ícone de marcador para vê-las aqui.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Post Detail & Comments 2-Column Modal */}
      {selectedPost && (
        <PostCommentsPanel
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onSelectUser={onSelectUser}
          onShowToast={onShowToast}
          isModal={true}
          onOpenEngagements={onOpenEngagements}
          onOpenReport={onOpenReport}
          onOpenBlock={onOpenBlock}
          onOpenEditPost={onOpenEditPost}
          onConfirmDeletePost={onConfirmDeletePost}
        />
      )}

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <EditProfileModal
          profile={profile}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onProfileUpdated={(updated) => {
            setProfile(updated);
            onProfileUpdated?.(updated);
          }}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}
