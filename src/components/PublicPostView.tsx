import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { PostItem, CommentItem } from '../types/social';
import { UserProfile } from '../types/user';
import {
  subscribeComments,
  createComment,
  togglePostLike,
  formatEngagementCount,
} from '../services/socialService';
import { FollowButton } from './FollowButton';
import { usePostViewObserver } from '../hooks/usePostViewObserver';
import { FormattedText } from './FormattedText';
import {
  Heart,
  MessageSquare,
  Share2,
  Lock,
  AlertCircle,
  Sparkles,
  ChevronLeft,
  Copy,
  Check,
  Send,
  Loader2,
  Eye,
  Film,
  User,
  MoreHorizontal,
} from 'lucide-react';

interface PublicPostViewProps {
  postId: string;
  currentUid?: string;
  myFollowing?: Set<string>;
  allUsers?: UserProfile[];
  onSelectUser?: (uid: string) => void;
  onSelectHashtag?: (tag: string) => void;
  onOpenAuthModal?: (tab?: 'login' | 'register', featureName?: string) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onOpenEngagements?: (post: PostItem, tab: 'curtidas' | 'visualizacoes') => void;
  onBackHome?: () => void;
}

export function PublicPostView({
  postId,
  currentUid = '',
  myFollowing = new Set(),
  allUsers = [],
  onSelectUser,
  onSelectHashtag,
  onOpenAuthModal,
  onShowToast,
  onOpenEngagements,
  onBackHome,
}: PublicPostViewProps) {
  const { user, profile } = useAuth();
  const isLoggedIn = Boolean(user && user.uid);

  const [post, setPost] = useState<PostItem | null>(null);
  const [authorProfile, setAuthorProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Comment input state for logged in user
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Observer for view counts
  const postViewRef = usePostViewObserver({ postId, currentUid });

  // 1. Subscribe to post document
  useEffect(() => {
    if (!postId) return;
    setLoading(true);

    const postRef = doc(db, 'posts', postId);
    const unsub = onSnapshot(
      postRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          setPost(null);
          setLoading(false);
          return;
        }

        const data = snapshot.data();
        if (data.deleted) {
          setPost(null);
          setLoading(false);
          return;
        }

        const item: PostItem = {
          id: snapshot.id,
          authorUid: data.authorUid || '',
          authorUsername: data.authorUsername || 'usuario',
          authorDisplayName: data.authorDisplayName || data.authorUsername || 'Usuário',
          authorPhotoURL: data.authorPhotoURL || '',
          content: data.content || '',
          mediaUrl: data.mediaUrl || '',
          mediaUrls: data.mediaUrls || [],
          mediaType: data.mediaType || 'image',
          likes: data.likes || [],
          likesCount: typeof data.likesCount === 'number' ? data.likesCount : (data.likes?.length || 0),
          commentsCount: data.commentsCount || 0,
          viewsCount: data.viewsCount || 0,
          createdAt: data.createdAt,
          collaborators: data.collaborators || [],
        };

        setPost(item);

        // Fetch author profile to check privacy
        if (data.authorUid) {
          try {
            const uDoc = await getDoc(doc(db, 'users', data.authorUid));
            if (uDoc.exists()) {
              setAuthorProfile(uDoc.data() as UserProfile);
            }
          } catch (err) {
            console.error('Error fetching author profile:', err);
          }
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error loading post:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [postId]);

  // 2. Subscribe to comments
  useEffect(() => {
    if (!postId) return;
    setCommentsLoading(true);
    const unsub = subscribeComments(postId, (items) => {
      setComments(items);
      setCommentsLoading(false);
    });
    return () => unsub();
  }, [postId]);

  // Privacy Check Logic
  const isAuthorPrivate = authorProfile?.isPrivate ?? false;
  const isOwnPost = currentUid && post?.authorUid === currentUid;
  const isFollowingAuthor = myFollowing.has(post?.authorUid || '');
  const isAcceptedCollab =
    currentUid &&
    post?.collaborators?.some(
      (c) => c.usuario_id === currentUid && c.status === 'aceito'
    );

  const isRestrictedPrivate =
    isAuthorPrivate && !isOwnPost && !isFollowingAuthor && !isAcceptedCollab;

  // Handle Likes
  const handleLikePost = async () => {
    if (!isLoggedIn) {
      if (onOpenAuthModal) {
        onOpenAuthModal('login', 'curtir esta publicação');
      }
      return;
    }
    if (!post || !user?.uid) return;
    const isLiked = post.likes.includes(user.uid);
    try {
      await togglePostLike(post.id, user.uid, isLiked, profile || undefined);
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  // Handle Comment Submission
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      if (onOpenAuthModal) {
        onOpenAuthModal('login', 'comentar nesta publicação');
      }
      return;
    }
    if (!newCommentText.trim() || !post || !profile) return;

    setIsSubmittingComment(true);
    try {
      await createComment({
        postId: post.id,
        author: profile,
        texto: newCommentText.trim(),
      });
      setNewCommentText('');
      if (onShowToast) onShowToast('Comentário publicado!', 'success');
    } catch (err: any) {
      console.error('Error creating comment:', err);
      if (onShowToast) onShowToast(err.message || 'Erro ao comentar.', 'error');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Handle Copy Direct Link
  const handleCopyLink = () => {
    const directUrl = `${window.location.origin}/p/${postId}`;
    navigator.clipboard.writeText(directUrl);
    setCopiedLink(true);
    if (onShowToast) onShowToast('Link do post copiado para a área de transferência!', 'success');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#548687] animate-spin mb-3" />
        <p className="text-sm text-gray-500 font-medium">Carregando publicação VYBE...</p>
      </div>
    );
  }

  // State 3a: Post Not Found
  if (!post) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 sm:p-12 shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Publicação não encontrada</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
            Esta publicação pode ter sido removida pelo autor ou o link que você acessou está incorreto.
          </p>
          <button
            type="button"
            onClick={onBackHome}
            className="px-6 py-2.5 bg-[#548687] text-white font-semibold text-sm rounded-xl hover:bg-[#436e6f] transition-colors cursor-pointer"
          >
            Voltar para a VYBE
          </button>
        </div>
      </div>
    );
  }

  // State 3b: Private Account Guard
  if (isRestrictedPrivate) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm text-center">
          {/* Author Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6 text-left">
            <div
              onClick={() => onSelectUser?.(post.authorUid)}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-11 h-11 rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-sm overflow-hidden">
                {post.authorPhotoURL ? (
                  <img
                    src={post.authorPhotoURL}
                    alt={post.authorUsername}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{(post.authorDisplayName || post.authorUsername)[0]?.toUpperCase()}</span>
                )}
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-sm group-hover:text-[#548687] transition-colors">
                  {post.authorDisplayName || post.authorUsername}
                </div>
                <div className="text-xs text-gray-500">@{post.authorUsername}</div>
              </div>
            </div>

            {/* Follow Button */}
            {isLoggedIn ? (
              <FollowButton
                currentUid={currentUid}
                targetUid={post.authorUid}
                targetUsername={post.authorUsername}
                iFollow={isFollowingAuthor}
                followsMe={false}
                size="sm"
                onShowToast={onShowToast}
              />
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuthModal?.('register', 'seguir esta conta privada')}
                className="px-4 py-1.5 bg-[#548687] text-white text-xs font-semibold rounded-full hover:bg-[#436e6f] transition-colors cursor-pointer"
              >
                Seguir
              </button>
            )}
          </div>

          {/* Lock Screen Notice */}
          <div className="py-8 space-y-3 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-[#EAF2F2] text-[#426F70] flex items-center justify-center mb-2 shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Esta conta é privada</h3>
            <p className="text-xs sm:text-sm text-gray-500 max-w-sm">
              Siga <span className="font-semibold text-gray-800">@{post.authorUsername}</span> para ver suas fotos e vídeos.
            </p>

            {!isLoggedIn && (
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => onOpenAuthModal?.('register')}
                  className="px-6 py-2.5 bg-[#548687] text-white font-semibold text-sm rounded-xl hover:bg-[#436e6f] transition-all shadow-xs cursor-pointer"
                >
                  Criar conta para seguir
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main State: Post Media preview + details
  const mediaUrl = post.mediaUrl || (post.mediaUrls && post.mediaUrls[0]) || '';
  const isVideo =
    post.mediaType === 'video' ||
    (Boolean(mediaUrl) &&
      (mediaUrl.startsWith('data:video') ||
        mediaUrl.endsWith('.mp4') ||
        mediaUrl.endsWith('.webm')));

  const isLikedByMe = user?.uid ? post.likes.includes(user.uid) : false;

  return (
    <div ref={postViewRef} className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      {/* Top Navigation Back button */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBackHome}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-[#548687] transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Voltar ao Feed</span>
        </button>

        <button
          type="button"
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors shadow-2xs cursor-pointer"
        >
          {copiedLink ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-600">Link copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-gray-500" />
              <span>Copiar link</span>
            </>
          )}
        </button>
      </div>

      {/* Main Card Container (Matches mockup image.png layout) */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/80 shadow-lg shadow-black/5 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
        {/* Left Half: Media Section (Columns 7) */}
        <div className="lg:col-span-7 bg-black flex items-center justify-center relative min-h-[300px] sm:min-h-[440px] select-none">
          {mediaUrl ? (
            isVideo ? (
              <video
                src={mediaUrl}
                controls
                autoPlay
                muted
                loop
                className="w-full h-full object-contain max-h-[650px]"
              />
            ) : (
              <img
                src={mediaUrl}
                alt="Media da publicação"
                className="w-full h-full object-contain max-h-[650px]"
                referrerPolicy="no-referrer"
              />
            )
          ) : (
            <div className="p-8 text-white text-center flex flex-col items-center justify-center max-w-md">
              <Film className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-base font-medium leading-relaxed">{post.content}</p>
            </div>
          )}

          {/* Multiple images count badge */}
          {post.mediaUrls && post.mediaUrls.length > 1 && (
            <div className="absolute top-3 right-3 bg-black/70 text-white text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-xs">
              1/{post.mediaUrls.length}
            </div>
          )}
        </div>

        {/* Right Half: Details, Comments & Auth Soft Paywall (Columns 5) */}
        <div className="lg:col-span-5 flex flex-col bg-white border-t lg:border-t-0 lg:border-l border-gray-100 h-full">
          {/* 1. Author Top Header */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div
              onClick={() => onSelectUser?.(post.authorUid)}
              className="flex items-center gap-3 cursor-pointer group min-w-0"
            >
              <div className="w-10 h-10 rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 border border-gray-200 group-hover:scale-105 transition-transform">
                {post.authorPhotoURL ? (
                  <img
                    src={post.authorPhotoURL}
                    alt={post.authorUsername}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{(post.authorDisplayName || post.authorUsername)[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 text-sm group-hover:text-[#548687] transition-colors truncate">
                  {post.authorUsername}
                </div>
                {post.authorDisplayName && (
                  <div className="text-xs text-gray-500 truncate">{post.authorDisplayName}</div>
                )}
              </div>
            </div>

            {/* Follow action button */}
            <div className="shrink-0 ml-2">
              {isLoggedIn ? (
                <FollowButton
                  currentUid={currentUid}
                  targetUid={post.authorUid}
                  targetUsername={post.authorUsername}
                  iFollow={isFollowingAuthor}
                  followsMe={false}
                  size="sm"
                  onShowToast={onShowToast}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenAuthModal?.('register', 'seguir este perfil')}
                  className="px-4 py-1.5 bg-[#548687] text-white text-xs font-semibold rounded-full hover:bg-[#436e6f] transition-all cursor-pointer shadow-2xs"
                >
                  Seguir
                </button>
              )}
            </div>
          </div>

          {/* 2. Caption Area */}
          {post.content && (
            <div className="p-4 border-b border-gray-100 text-xs sm:text-sm text-gray-800 leading-relaxed bg-[#FAFBFB]/50 shrink-0">
              <span
                onClick={() => onSelectUser?.(post.authorUid)}
                className="font-bold text-gray-900 mr-1.5 hover:underline cursor-pointer"
              >
                {post.authorUsername}
              </span>
              <span>
                <FormattedText
                  text={post.content}
                  onSelectUser={onSelectUser}
                  onSelectHashtag={onSelectHashtag}
                  allUsers={allUsers}
                />
              </span>
            </div>
          )}

          {/* 3. Middle Content Area: Logged In Comments vs Guest Soft Paywall */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px]">
            {isLoggedIn ? (
              /* Logged In User: List of real comments */
              commentsLoading ? (
                <div className="py-8 text-center text-gray-400 text-xs">Carregando comentários...</div>
              ) : comments.length > 0 ? (
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2.5 items-start text-xs">
                      <div
                        onClick={() => onSelectUser?.(c.authorUid)}
                        className="w-7 h-7 rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer overflow-hidden mt-0.5"
                      >
                        {c.authorPhotoURL ? (
                          <img src={c.authorPhotoURL} alt={c.authorUsername} className="w-full h-full object-cover" />
                        ) : (
                          <span>{(c.authorDisplayName || c.authorUsername)[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 bg-[#F5F8F8] p-2.5 rounded-2xl">
                        <span
                          onClick={() => onSelectUser?.(c.authorUid)}
                          className="font-semibold text-gray-900 mr-1.5 hover:underline cursor-pointer"
                        >
                          @{c.authorUsername}
                        </span>
                        <span className="text-gray-700 leading-normal">{c.content}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-gray-400 text-xs">
                  Seja o primeiro a comentar nesta publicação!
                </div>
              )
            ) : (
              /* Guest Visitor (Matching exact visual mockup from image.png) */
              <div className="h-full flex flex-col justify-center items-center py-6 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#EAF2F2] text-[#426F70] flex items-center justify-center mb-3 shadow-2xs">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-gray-900 mb-1">Veja mais na VYBE</h4>
                <p className="text-xs text-gray-500 max-w-xs mb-5 leading-relaxed">
                  Entre para curtir, comentar e ver publicações de quem você segue.
                </p>
                <button
                  id="btn-guest-create-account"
                  type="button"
                  onClick={() => onOpenAuthModal?.('register')}
                  className="w-full max-w-[200px] py-2.5 px-5 bg-[#548687] hover:bg-[#436e6f] text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-xs cursor-pointer active:scale-98"
                >
                  Criar conta
                </button>
              </div>
            )}
          </div>

          {/* 4. Bottom Engagement Bar & Actions */}
          <div className="p-4 border-t border-gray-100 bg-white shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleLikePost}
                  className="flex items-center gap-1.5 text-xs font-semibold hover:text-gray-900 transition-colors cursor-pointer"
                >
                  <Heart
                    className={`w-5 h-5 transition-transform active:scale-125 ${
                      isLikedByMe ? 'fill-rose-500 text-rose-500' : 'text-gray-600'
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isLoggedIn && onOpenAuthModal) {
                      onOpenAuthModal('login', 'comentar');
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold hover:text-gray-900 transition-colors cursor-pointer text-gray-600"
                >
                  <MessageSquare className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 text-xs font-semibold hover:text-gray-900 transition-colors cursor-pointer text-gray-600"
                  title="Compartilhar"
                >
                  <Share2 className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* Counters */}
            <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
              <button
                type="button"
                onClick={() => {
                  if (isLoggedIn && onOpenEngagements) {
                    onOpenEngagements(post, 'curtidas');
                  } else if (onOpenAuthModal) {
                    onOpenAuthModal('login', 'ver quem curtiu');
                  }
                }}
                className="hover:text-gray-900 transition-colors cursor-pointer"
              >
                {formatEngagementCount(typeof post.likesCount === 'number' ? post.likesCount : post.likes.length)} curtidas
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isLoggedIn && onOpenEngagements) {
                    onOpenEngagements(post, 'visualizacoes');
                  } else if (onOpenAuthModal) {
                    onOpenAuthModal('login', 'ver estatísticas de visualizações');
                  }
                }}
                className="hover:text-gray-900 transition-colors cursor-pointer text-gray-500"
              >
                {formatEngagementCount(post.viewsCount || 0)} visualizações
              </button>
            </div>

            {/* Comment Input Box for Logged In user */}
            {isLoggedIn ? (
              <form onSubmit={handleSubmitComment} className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Escreva um comentário..."
                  className="flex-1 px-3.5 py-2 bg-[#F1F5F5] border border-transparent focus:border-[#548687]/40 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white transition-all"
                />
                <button
                  type="submit"
                  disabled={!newCommentText.trim() || isSubmittingComment}
                  className="p-2 bg-[#548687] text-white rounded-xl hover:bg-[#436e6f] transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {isSubmittingComment ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            ) : (
              <div
                onClick={() => onOpenAuthModal?.('login', 'comentar')}
                className="mt-3 py-2 px-3 bg-[#F1F5F5] rounded-xl text-xs text-gray-500 flex items-center justify-between cursor-pointer hover:bg-[#E8F0F0] transition-colors"
              >
                <span>Faça login para escrever um comentário...</span>
                <span className="text-[#548687] font-semibold">Entrar</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
