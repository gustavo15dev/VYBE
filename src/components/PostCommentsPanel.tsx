import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  X,
  Smile,
  MoreHorizontal,
  Send,
  Trash2,
  CornerDownRight,
  MessageSquare,
  Flag,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PostItem, CommentItem } from '../types/social';
import { UserProfile } from '../types/user';
import { FormattedText } from './FormattedText';
import { TextWithAutocomplete } from './TextWithAutocomplete';
import { VerifiedBadge } from './VerifiedBadge';
import {
  subscribeComments,
  createComment,
  toggleCommentLike,
  deleteComment,
  formatEngagementCount,
  togglePostLike,
} from '../services/socialService';
import { PostReactionButton, PostReactionsSummary } from './PostReactions';
import { usePostViewObserver } from '../hooks/usePostViewObserver';

import { ReportTargetType } from '../types/social';

interface PostCommentsPanelProps {
  post: PostItem;
  onClose: () => void;
  onSelectUser?: (uid: string) => void;
  onSelectHashtag?: (tag: string) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  isSidebar?: boolean;
  isModal?: boolean;
  onOpenEngagements?: (post: PostItem, tab: 'curtidas' | 'visualizacoes') => void;
  onOpenReport?: (type: ReportTargetType, id: string) => void;
  onOpenBlock?: (targetUid: string, targetUsername: string) => void;
  onOpenEditPost?: (post: PostItem) => void;
  onConfirmDeletePost?: (post: PostItem) => void;
  allUsers?: UserProfile[];
  myFollowing?: Set<string>;
}

// Quick emoji selection
const QUICK_EMOJIS = ['❤️', '🔥', '👏', '😍', '😂', '🤍', '✨', '🙌', '💯', '🤩'];

export function PostCommentsPanel({
  post,
  onClose,
  onSelectUser,
  onSelectHashtag,
  onShowToast,
  isSidebar = true,
  isModal = false,
  onOpenEngagements,
  onOpenReport,
  onOpenBlock,
  onOpenEditPost,
  onConfirmDeletePost,
  allUsers = [],
  myFollowing = new Set(),
}: PostCommentsPanelProps) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Replying state: stores the target comment being replied to
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    rootCommentId: string;
    username: string;
  } | null>(null);

  // Pagination / visibility state for reply threads: Set of rootCommentIds that are expanded
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  const handleTogglePostLike = async () => {
    if (!user?.uid) return;
    const isLiked = post.likes.includes(user.uid);
    try {
      await togglePostLike(post.id, user.uid, isLiked, profile || undefined);
    } catch (err) {
      console.error('Error toggling post like:', err);
    }
  };

  // Input ref for auto-focusing when replying
  const inputRef = useRef<HTMLInputElement>(null);
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  usePostViewObserver({ postId: post.id, currentUid: user?.uid });

  // Real-time listener for comments on this post
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeComments(post.id, (loadedComments) => {
      setComments(loadedComments);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [post.id]);

  // Format relative time: "2h", "40min", "1d"
  const formatCommentTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'agora';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d`;
      const diffWeeks = Math.floor(diffDays / 7);
      return `${diffWeeks}sem`;
    } catch {
      return '';
    }
  };

  // Organize comments into root comments and replies grouped by root id
  const rootComments: CommentItem[] = [];
  const repliesByRootId: Record<string, CommentItem[]> = {};

  // First pass: identify root comments
  comments.forEach((c) => {
    if (!c.comentario_pai_id) {
      rootComments.push(c);
    }
  });

  // Second pass: map replies to their root comment
  comments.forEach((c) => {
    if (c.comentario_pai_id) {
      // Find root ancestor
      let rootId = c.comentario_pai_id;
      // If the parent is itself a reply, find its root
      const parent = comments.find((item) => item.id === c.comentario_pai_id);
      if (parent && parent.comentario_pai_id) {
        rootId = parent.comentario_pai_id;
      }

      if (!repliesByRootId[rootId]) {
        repliesByRootId[rootId] = [];
      }
      repliesByRootId[rootId].push(c);
    }
  });

  // Handle like toggle on a comment
  const handleToggleLike = async (comment: CommentItem) => {
    if (!user?.uid) return;
    const isLiked = Array.isArray(comment.liked_by) && comment.liked_by.includes(user.uid);
    try {
      await toggleCommentLike(comment.id, user.uid, isLiked, profile || undefined);
    } catch (err) {
      console.error('Error toggling comment like:', err);
      if (onShowToast) onShowToast('Erro ao curtir comentário.', 'error');
    }
  };

  // Handle initiating a reply
  const handleStartReply = (comment: CommentItem, rootCommentId: string) => {
    setReplyingTo({
      commentId: comment.id,
      rootCommentId,
      username: comment.autor_username,
    });
    // Prepend @username to input text if not already present
    const mention = `@${comment.autor_username} `;
    if (!commentText.startsWith(mention)) {
      setCommentText(mention);
    }
    inputRef.current?.focus();
  };

  // Handle submitting a comment or reply
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !profile) {
      if (onShowToast) onShowToast('Faça login para comentar.', 'error');
      return;
    }

    const trimmed = commentText.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      await createComment({
        postId: post.id,
        author: profile,
        texto: trimmed,
        comentario_pai_id: replyingTo ? replyingTo.rootCommentId : null,
        resposta_para_username: replyingTo ? replyingTo.username : undefined,
        allUsers,
      });

      setCommentText('');
      setReplyingTo(null);
      setShowEmojiPicker(false);

      // Scroll to bottom of comments
      setTimeout(() => {
        if (commentsContainerRef.current) {
          commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
        }
      }, 100);
    } catch (err) {
      console.error('Error creating comment:', err);
      if (onShowToast) onShowToast('Erro ao publicar comentário.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle expanding a thread's replies
  const toggleThread = (rootId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(rootId)) {
        next.delete(rootId);
      } else {
        next.add(rootId);
      }
      return next;
    });
  };

  // Handle deleting a comment
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Deseja excluir este comentário?')) return;
    try {
      await deleteComment(commentId, post.id);
      if (onShowToast) onShowToast('Comentário excluído.', 'info');
    } catch (err) {
      console.error('Error deleting comment:', err);
      if (onShowToast) onShowToast('Erro ao excluir comentário.', 'error');
    }
  };

  const authorInitial =
    post.authorDisplayName?.[0]?.toUpperCase() ||
    post.authorUsername?.[0]?.toUpperCase() ||
    'U';

  const mediaUrls = post.mediaUrls && post.mediaUrls.length > 0
    ? post.mediaUrls
    : (post.mediaUrl ? [post.mediaUrl] : []);
  const primaryMedia = mediaUrls[0] || '';
  const isVideo =
    post.mediaType === 'video' ||
    primaryMedia.startsWith('data:video') ||
    primaryMedia.endsWith('.mp4') ||
    primaryMedia.endsWith('.webm');

  // The actual comments panel content (Right Column in image.png)
  const commentsPanelContent = (
    <div className="flex flex-col h-full bg-white relative">
      {/* 1. Header (Cabeçalho do post como em image.png) */}
      <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <div
            onClick={() => onSelectUser?.(post.authorUid)}
            className="w-8 h-8 rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
          >
            {post.authorPhotoURL ? (
              <img src={post.authorPhotoURL} alt={post.authorUsername} className="w-full h-full object-cover" />
            ) : (
              <span>{authorInitial}</span>
            )}
          </div>
          <div className="min-w-0 text-sm leading-snug">
            <span
              onClick={() => onSelectUser?.(post.authorUid)}
              className="font-bold text-gray-900 mr-1.5 cursor-pointer hover:text-[#548687] transition-colors"
            >
              {post.authorUsername}
            </span>
            <span className="text-gray-700 whitespace-pre-line break-words text-[13px]">
              <FormattedText
                text={post.content || ''}
                onSelectUser={onSelectUser}
                onSelectHashtag={onSelectHashtag}
                allUsers={allUsers}
              />
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 relative">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              title="Mais opções"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-1 animate-in fade-in zoom-in-95">
                {user?.uid === post.authorUid ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
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
                        setShowMenu(false);
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
                        setShowMenu(false);
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
                        setShowMenu(false);
                        onOpenBlock?.(post.authorUid, post.authorUsername);
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      <span>Bloquear @{post.authorUsername}</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            title="Fechar comentários"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Comments List with internal scroll */}
      <div
        ref={commentsContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-sm"
      >
        {loading ? (
          <div className="py-12 text-center text-xs text-gray-400">
            Carregando comentários...
          </div>
        ) : rootComments.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <MessageSquare className="w-8 h-8 text-gray-300 mx-auto stroke-1" />
            <p className="text-xs font-semibold text-gray-700">Ainda não há comentários</p>
            <p className="text-[11px] text-gray-400">Seja o primeiro a deixar uma resposta!</p>
          </div>
        ) : (
          rootComments.map((root) => {
            const replies = repliesByRootId[root.id] || [];
            const isThreadExpanded = expandedThreads.has(root.id);
            // Show first 1 reply by default, expand on demand
            const visibleReplies = isThreadExpanded ? replies : replies.slice(0, 1);
            const hiddenRepliesCount = replies.length - visibleReplies.length;

            const isRootLiked =
              user?.uid && Array.isArray(root.liked_by) && root.liked_by.includes(user.uid);

            const rootAuthorInitial =
              root.autor_displayName?.[0]?.toUpperCase() ||
              root.autor_username?.[0]?.toUpperCase() ||
              'U';

            return (
              <div key={root.id} className="space-y-3 group/root">
                {/* Root Comment Item (image.png style) */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div
                      onClick={() => onSelectUser?.(root.autor_id)}
                      className="w-7 h-7 rounded-full bg-[#E1EEEE] text-[#548687] flex items-center justify-center font-bold text-[10px] shrink-0 overflow-hidden cursor-pointer mt-0.5"
                    >
                      {root.autor_photoURL ? (
                        <img src={root.autor_photoURL} alt={root.autor_username} className="w-full h-full object-cover" />
                      ) : (
                        <span>{rootAuthorInitial}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-[13px] leading-snug">
                      <div>
                        <span
                          onClick={() => onSelectUser?.(root.autor_id)}
                          className="inline-flex items-center gap-1 font-bold text-gray-900 mr-1.5 cursor-pointer hover:text-[#548687] transition-colors align-middle"
                        >
                          <span>{root.autor_username}</span>
                          <VerifiedBadge uid={root.autor_id} allUsers={allUsers} size={12} />
                        </span>
                        <span className="text-gray-800 break-words whitespace-pre-line">
                          <FormattedText
                            text={root.texto}
                            onSelectUser={onSelectUser}
                            onSelectHashtag={onSelectHashtag}
                            allUsers={allUsers}
                          />
                        </span>
                      </div>

                      {/* Sub-row: Time • Curtidas • Responder */}
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 font-medium">
                        <span>{formatCommentTime(root.criado_em)}</span>
                        {root.likes_count > 0 && (
                          <span>
                            {root.likes_count} {root.likes_count === 1 ? 'curtida' : 'curtidas'}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartReply(root, root.id)}
                          className="text-gray-500 font-semibold hover:text-gray-900 transition-colors cursor-pointer"
                        >
                          Responder
                        </button>
                        {user?.uid !== root.autor_id && (
                          <button
                            type="button"
                            onClick={() => onOpenReport?.('comentario', root.id)}
                            className="opacity-0 group-hover/root:opacity-100 text-gray-300 hover:text-amber-600 transition-opacity cursor-pointer"
                            title="Denunciar comentário"
                          >
                            <Flag className="w-3 h-3" />
                          </button>
                        )}
                        {user?.uid === root.autor_id && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(root.id)}
                            className="opacity-0 group-hover/root:opacity-100 text-gray-300 hover:text-red-500 transition-opacity cursor-pointer"
                            title="Excluir comentário"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Heart Like Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleLike(root)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer shrink-0 mt-0.5"
                    title={isRootLiked ? 'Descurtir' : 'Curtir'}
                  >
                    <Heart
                      className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
                        isRootLiked
                          ? 'fill-rose-500 text-rose-500'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    />
                  </button>
                </div>

                {/* Nested Replies (Visual rule: only 1 indent level, as shown in image.png) */}
                {replies.length > 0 && (
                  <div className="pl-9 space-y-3">
                    {visibleReplies.map((reply) => {
                      const isReplyLiked =
                        user?.uid &&
                        Array.isArray(reply.liked_by) &&
                        reply.liked_by.includes(user.uid);
                      const replyAuthorInitial =
                        reply.autor_displayName?.[0]?.toUpperCase() ||
                        reply.autor_username?.[0]?.toUpperCase() ||
                        'U';

                      return (
                        <div
                          key={reply.id}
                          className="flex items-start justify-between gap-2.5 group/reply"
                        >
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <div
                              onClick={() => onSelectUser?.(reply.autor_id)}
                              className="w-6 h-6 rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-[9px] shrink-0 overflow-hidden cursor-pointer mt-0.5"
                            >
                              {reply.autor_photoURL ? (
                                <img
                                  src={reply.autor_photoURL}
                                  alt={reply.autor_username}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>{replyAuthorInitial}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 text-[13px] leading-snug">
                              <div>
                                <span
                                  onClick={() => onSelectUser?.(reply.autor_id)}
                                  className="inline-flex items-center gap-1 font-bold text-gray-900 mr-1.5 cursor-pointer hover:text-[#548687] transition-colors align-middle"
                                >
                                  <span>{reply.autor_username}</span>
                                  <VerifiedBadge uid={reply.autor_id} allUsers={allUsers} size={12} />
                                </span>
                                {reply.resposta_para_username && (
                                  <span className="text-[#548687] font-medium mr-1">
                                    @{reply.resposta_para_username}
                                  </span>
                                )}
                                <span className="text-gray-800 break-words whitespace-pre-line">
                                  <FormattedText
                                    text={reply.texto}
                                    onSelectUser={onSelectUser}
                                    onSelectHashtag={onSelectHashtag}
                                    allUsers={allUsers}
                                  />
                                </span>
                              </div>

                              {/* Sub-row: Time • Curtidas • Responder */}
                              <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 font-medium">
                                <span>{formatCommentTime(reply.criado_em)}</span>
                                {reply.likes_count > 0 && (
                                  <span>
                                    {reply.likes_count}{' '}
                                    {reply.likes_count === 1 ? 'curtida' : 'curtidas'}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleStartReply(reply, root.id)}
                                  className="text-gray-500 font-semibold hover:text-gray-900 transition-colors cursor-pointer"
                                >
                                  Responder
                                </button>
                                {user?.uid === reply.autor_id && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(reply.id)}
                                    className="opacity-0 group-hover/reply:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                                    title="Excluir comentário"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Heart Like Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleLike(reply)}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer shrink-0 mt-0.5"
                            title={isReplyLiked ? 'Descurtir' : 'Curtir'}
                          >
                            <Heart
                              className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
                                isReplyLiked
                                  ? 'fill-rose-500 text-rose-500'
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}

                    {/* Ver mais respostas / Ocultar respostas (image.png style: "— Ver mais 2 respostas") */}
                    {replies.length > 1 && (
                      <div className="pt-1">
                        {!isThreadExpanded && hiddenRepliesCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => toggleThread(root.id)}
                            className="text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <span className="text-gray-300 font-normal">—</span>
                            <span>
                              Ver mais {hiddenRepliesCount}{' '}
                              {hiddenRepliesCount === 1 ? 'resposta' : 'respostas'}
                            </span>
                          </button>
                        ) : isThreadExpanded ? (
                          <button
                            type="button"
                            onClick={() => toggleThread(root.id)}
                            className="text-xs font-semibold text-gray-400 hover:text-gray-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <span className="text-gray-300 font-normal">—</span>
                            <span>Ocultar respostas</span>
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Engagements Summary & Action Bar */}
      <div className="bg-white border-t border-gray-100 flex flex-col shrink-0">
        <PostReactionsSummary
          post={post}
          onOpenEngagements={onOpenEngagements}
          onOpenComments={() => inputRef.current?.focus()}
          className="px-4 pt-2 pb-1"
        />
        <div className="px-4 py-2 border-t border-gray-50 flex items-center justify-between text-gray-600">
          <div className="flex items-center gap-4">
            <PostReactionButton
              post={post}
              currentUid={user?.uid}
              userProfile={profile || undefined}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.focus()}
              className="flex items-center gap-1.5 text-xs font-semibold hover:text-gray-900 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4.5 h-4.5 text-gray-500" />
              <span>Comentar</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Replying Notice Banner (if active) */}
      {replyingTo && (
        <div className="px-4 py-1.5 bg-[#F1F6F6] border-t border-[#D5E5E5] flex items-center justify-between text-xs text-gray-600 animate-in fade-in">
          <div className="flex items-center gap-1.5 truncate">
            <CornerDownRight className="w-3.5 h-3.5 text-[#548687] shrink-0" />
            <span>
              Respondendo a <strong className="text-gray-900">@{replyingTo.username}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setReplyingTo(null);
              setCommentText('');
            }}
            className="text-gray-400 hover:text-gray-700 p-0.5 cursor-pointer"
            title="Cancelar resposta"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4. Quick Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-14 left-4 z-20 bg-white border border-gray-100 rounded-2xl shadow-xl p-2 flex items-center gap-1.5 animate-in fade-in zoom-in-95">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setCommentText((prev) => prev + emoji);
                setShowEmojiPicker(false);
                inputRef.current?.focus();
              }}
              className="text-lg p-1.5 hover:bg-gray-100 rounded-lg transition-transform hover:scale-125 cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* 5. Fixed Bottom Input Bar (image.png style) */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-gray-100 flex items-center gap-2.5 bg-white shrink-0"
      >
        {/* Emoji Button */}
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className={`p-1.5 text-gray-500 hover:text-gray-800 rounded-full transition-colors cursor-pointer ${
            showEmojiPicker ? 'text-[#548687] bg-[#F1F6F6]' : ''
          }`}
          title="Inserir emoji"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Input with Autocomplete for # and @ */}
        <TextWithAutocomplete
          value={commentText}
          onChange={setCommentText}
          placeholder={replyingTo ? `Respondendo a @${replyingTo.username}...` : 'Adicione um comentário...'}
          isTextarea={false}
          allUsers={allUsers}
          myFollowing={myFollowing}
          className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />

        {/* Publicar Button (disabled/dimmed when empty, active solid teal when typed) */}
        <button
          type="submit"
          disabled={!commentText.trim() || isSubmitting}
          className={`text-sm font-semibold transition-all px-2 py-1 select-none ${
            commentText.trim() && !isSubmitting
              ? 'text-[#548687] hover:text-[#436e6f] cursor-pointer active:scale-95'
              : 'text-[#548687]/30 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? '...' : 'Publicar'}
        </button>
      </form>
    </div>
  );

  // If in Modal Mode: 2 columns exactly like image.png (Left: media full height, Right: comments panel)
  if (isModal) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-3xl w-full max-w-4xl h-[85vh] max-h-[700px] overflow-hidden shadow-2xl flex flex-col md:flex-row border border-gray-100 animate-in fade-in zoom-in-95"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left Column: Post Media (Image/Video in spotlight occupying full height) */}
          <div className="hidden md:flex flex-1 bg-black items-center justify-center relative overflow-hidden">
            {primaryMedia ? (
              isVideo ? (
                <video
                  src={primaryMedia}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={primaryMedia}
                  alt="Post media"
                  className="w-full h-full object-contain"
                />
              )
            ) : (
              <div className="p-8 text-center text-white max-w-sm">
                <p className="text-lg font-medium whitespace-pre-line leading-relaxed">
                  {post.content}
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Comments Panel */}
          <div className="w-full md:w-[380px] lg:w-[420px] h-full flex flex-col border-l border-gray-100">
            {commentsPanelContent}
          </div>
        </div>
      </div>
    );
  }

  // Sidebar Mode (occupies the column of "Sugestão pra você" in main layout)
  return (
    <div className="w-80 h-[calc(100vh-68px)] flex flex-col bg-white">
      {commentsPanelContent}
    </div>
  );
}
