import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { PostItem, ReactionEmoji, REACTION_EMOJIS } from '../types/social';
import { UserProfile } from '../types/user';
import {
  setPostReaction,
  getTopReactions,
  formatEngagementCount,
} from '../services/socialService';

interface PostReactionButtonProps {
  post: PostItem;
  currentUid?: string;
  userProfile?: UserProfile;
  onRequireAuth?: () => void;
  className?: string;
}

export const PostReactionButton: React.FC<PostReactionButtonProps> = ({
  post,
  currentUid,
  userProfile,
  onRequireAuth,
  className = '',
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActiveRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine current user's active reaction
  const userReaction = currentUid ? post.userReactions?.[currentUid] : null;
  const isLikedByList = Boolean(currentUid && Array.isArray(post.likes) && post.likes.includes(currentUid));
  const activeEmoji: ReactionEmoji | null =
    userReaction?.emoji || (isLikedByList ? '❤️' : null);
  const hasActiveReaction = Boolean(activeEmoji || isLikedByList);

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPicker]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const handleSelectEmoji = async (emoji: ReactionEmoji) => {
    setShowPicker(false);
    if (!currentUid) {
      onRequireAuth?.();
      return;
    }
    try {
      if (activeEmoji === emoji) {
        // Toggle off
        await setPostReaction(post.id, currentUid, null, userProfile);
      } else {
        await setPostReaction(
          post.id,
          currentUid,
          { tipo: 'reacao', emoji },
          userProfile
        );
      }
    } catch (err) {
      console.error('Error selecting reaction emoji:', err);
    }
  };

  const handleQuickClick = async () => {
    if (isLongPressActiveRef.current) {
      isLongPressActiveRef.current = false;
      return;
    }
    if (!currentUid) {
      onRequireAuth?.();
      return;
    }
    if (showPicker) {
      setShowPicker(false);
      return;
    }

    try {
      if (hasActiveReaction) {
        // Toggle off
        await setPostReaction(post.id, currentUid, null, userProfile);
      } else {
        // Quick like (curtir simples)
        await setPostReaction(
          post.id,
          currentUid,
          { tipo: 'curtir', emoji: null },
          userProfile
        );
      }
    } catch (err) {
      console.error('Error handling quick like:', err);
    }
  };

  // Touch and pointer long-press handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    isLongPressActiveRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      setShowPicker(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
    }, 380);
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePointerCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Optional desktop hover expansion after small pause
  const handleMouseEnter = () => {
    setIsHovered(true);
    hoverTimerRef.current = setTimeout(() => {
      setShowPicker(true);
    }, 600);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 
        FLOATING EMOJI REACTIONS PANEL 
        Shown when long-pressing the heart or holding pointer
      */}
      {showPicker && (
        <div
          id={`reactions-picker-${post.id}`}
          className="absolute bottom-full left-0 mb-2.5 z-40 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-xl shadow-black/10 border border-gray-100/80 flex items-center gap-2.5 animate-in fade-in zoom-in-95 duration-150 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {REACTION_EMOJIS.map((emoji) => {
            const isSelected = activeEmoji === emoji;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSelectEmoji(emoji)}
                className={`p-1 text-2xl transition-all transform hover:scale-135 active:scale-110 cursor-pointer rounded-full relative group ${
                  isSelected ? 'scale-120 drop-shadow-sm' : ''
                }`}
                title={`Reagir com ${emoji}`}
              >
                <span>{emoji}</span>
                {isSelected && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#548687] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Action Button */}
      <button
        id={`btn-react-post-${post.id}`}
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowPicker(true);
        }}
        onClick={handleQuickClick}
        className="flex items-center gap-1.5 text-xs font-semibold hover:text-gray-900 transition-colors cursor-pointer select-none"
        title="Toque rápido para curtir, segure para reagir com emoji"
      >
        {activeEmoji && activeEmoji !== '❤️' ? (
          <span className="text-xl leading-none transition-transform active:scale-125 select-none drop-shadow-xs">
            {activeEmoji}
          </span>
        ) : (
          <Heart
            className={`w-5 h-5 transition-transform active:scale-125 ${
              hasActiveReaction
                ? 'fill-rose-500 text-rose-500'
                : 'text-gray-600'
            }`}
          />
        )}
        <span className={hasActiveReaction ? 'text-gray-900 font-bold' : 'text-gray-600'}>
          {hasActiveReaction
            ? activeEmoji && activeEmoji !== '❤️'
              ? activeEmoji
              : 'Curtiu'
            : 'Curtir'}
        </span>
      </button>
    </div>
  );
};

interface PostReactionsSummaryProps {
  post: PostItem;
  onOpenEngagements?: (post: PostItem, tab: 'curtidas' | 'visualizacoes') => void;
  onOpenComments?: (post: PostItem) => void;
  className?: string;
}

export const PostReactionsSummary: React.FC<PostReactionsSummaryProps> = ({
  post,
  onOpenEngagements,
  onOpenComments,
  className = '',
}) => {
  const totalLikes = typeof post.likesCount === 'number' ? post.likesCount : (post.likes?.length || 0);
  const totalComments = post.commentsCount || 0;
  const topReactions = getTopReactions(post.reactionsSummary, totalLikes);

  // If there are no likes and no comments, we don't render an empty summary bar
  if (totalLikes <= 0 && totalComments <= 0 && (!post.viewsCount || post.viewsCount <= 0)) {
    return null;
  }

  return (
    <div
      className={`px-4 pb-2 pt-1 flex items-center justify-between text-xs font-semibold text-gray-500 select-none ${className}`}
    >
      {/* Left side: Clustered top emoji bubbles + formatted count */}
      {totalLikes > 0 ? (
        <button
          id={`summary-reactions-${post.id}`}
          type="button"
          onClick={() => onOpenEngagements?.(post, 'curtidas')}
          className="flex items-center gap-1.5 hover:text-gray-900 transition-colors cursor-pointer group"
          title="Ver quem curtiu e reagiu"
        >
          {topReactions.length > 0 && (
            <div className="flex items-center -space-x-1.5 shrink-0">
              {topReactions.map((item, idx) => (
                <span
                  key={item.emoji}
                  className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[11px] border border-white shadow-xs select-none"
                  style={{ zIndex: 5 - idx }}
                >
                  {item.emoji}
                </span>
              ))}
            </div>
          )}
          <span className="group-hover:underline decoration-[#548687]/40">
            {formatEngagementCount(totalLikes)}
          </span>
        </button>
      ) : (
        <span />
      )}

      {/* Right side: Comments count (mockup style) */}
      <div className="flex items-center gap-3">
        {typeof post.viewsCount === 'number' && post.viewsCount > 0 && (
          <button
            type="button"
            onClick={() => onOpenEngagements?.(post, 'visualizacoes')}
            className="hover:text-gray-900 text-gray-400 transition-colors cursor-pointer text-[11px]"
          >
            {formatEngagementCount(post.viewsCount)} views
          </button>
        )}

        {totalComments > 0 && (
          <button
            id={`summary-comments-${post.id}`}
            type="button"
            onClick={() => onOpenComments?.(post)}
            className="hover:text-gray-900 transition-colors cursor-pointer"
          >
            {formatEngagementCount(totalComments)}{' '}
            {totalComments === 1 ? 'comentário' : 'comentários'}
          </button>
        )}
      </div>
    </div>
  );
};
