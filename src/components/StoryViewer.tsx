import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  MoreHorizontal,
  Heart,
  Send,
  Trash2,
} from 'lucide-react';
import { UserStoriesGroup, StoryItem } from '../types/social';
import { markStoryAsViewed, toggleStoryLike, deleteStory } from '../services/socialService';

interface StoryViewerProps {
  groups: UserStoriesGroup[];
  initialGroupIndex: number;
  currentUid: string;
  onClose: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const DEFAULT_STORY_DURATION_MS = 6000; // 6 seconds for static image/text

export function StoryViewer({
  groups,
  initialGroupIndex,
  currentUid,
  onClose,
  onShowToast,
}: StoryViewerProps) {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  const activeGroup = groups[groupIndex];
  const activeStory: StoryItem | undefined = activeGroup?.stories[storyIndex];

  const progressIntervalRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isVideoStory =
    activeStory?.mediaType === 'video' ||
    (Boolean(activeStory?.mediaUrl) &&
      (activeStory?.mediaUrl?.startsWith('data:video') ||
        activeStory?.mediaUrl?.endsWith('.mp4') ||
        activeStory?.mediaUrl?.endsWith('.webm')));

  // Calculate relative time (e.g. "2h", "15m", "agora")
  const getRelativeTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    if (diffMinutes < 1) return 'agora';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return '1d';
  };

  const handleNextStory = useCallback(() => {
    if (!activeGroup) {
      onClose();
      return;
    }
    if (storyIndex < activeGroup.stories.length - 1) {
      setStoryIndex((prev) => prev + 1);
      setProgress(0);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((prev) => prev + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [activeGroup, storyIndex, groupIndex, groups.length, onClose]);

  const handlePrevStory = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1];
      setGroupIndex((prev) => prev - 1);
      setStoryIndex(prevGroup.stories.length - 1);
      setProgress(0);
    } else {
      setProgress(0);
    }
  }, [storyIndex, groupIndex, groups]);

  // Mark active story as viewed
  useEffect(() => {
    if (activeStory && currentUid) {
      markStoryAsViewed(activeStory.id, currentUid);
    }
  }, [activeStory, currentUid]);

  // Video playback management
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPaused) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  }, [isPaused, storyIndex, groupIndex]);

  // Handle Video Time Update for progress
  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (dur && dur > 0) {
      const current = videoRef.current.currentTime;
      const pct = (current / dur) * 100;
      setProgress(pct);
    }
  };

  // Static Progress timer (for non-video stories)
  useEffect(() => {
    if (isVideoStory) return;
    if (isPaused || !activeStory) return;

    const stepMs = 50;
    const increment = (stepMs / DEFAULT_STORY_DURATION_MS) * 100;

    progressIntervalRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNextStory();
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isVideoStory, isPaused, activeStory, handleNextStory]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        handleNextStory();
      } else if (e.key === 'ArrowLeft') {
        handlePrevStory();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextStory, handlePrevStory, onClose]);

  if (!activeGroup || !activeStory) {
    return null;
  }

  const isLikedByMe = activeStory.likes?.includes(currentUid) ?? false;
  const isMyStory = activeStory.authorUid === currentUid;

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleStoryLike(activeStory.id, currentUid, isLikedByMe);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    if (onShowToast) {
      onShowToast(`Mensagem enviada para @${activeStory.authorUsername}!`, 'success');
    }
    setMessageInput('');
  };

  const handleDeleteThisStory = async () => {
    if (!confirm('Deseja excluir este story?')) return;
    try {
      await deleteStory(activeStory.id);
      if (onShowToast) onShowToast('Story excluído.', 'info');
      handleNextStory();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      id="story-fullscreen-viewer"
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-0 sm:p-4 backdrop-blur-md select-none"
    >
      {/* Background backdrop close button */}
      <button
        onClick={onClose}
        className="hidden sm:block absolute top-6 right-6 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors z-50 cursor-pointer"
        aria-label="Fechar stories"
      >
        <X className="w-7 h-7" />
      </button>

      {/* Story Card Container */}
      <div
        className="relative w-full h-full sm:h-[92vh] sm:max-w-[420px] sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between"
        style={{
          backgroundColor: isVideoStory ? '#000000' : (activeStory.bgColor || '#142523'),
        }}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Top Gradient Overlay */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-20 pointer-events-none" />

        {/* Progress Bars (one for each story in active group) */}
        <div className="relative z-30 pt-3.5 px-3.5 flex items-center gap-1.5">
          {activeGroup.stories.map((story, idx) => {
            let fillPct = 0;
            if (idx < storyIndex) fillPct = 100;
            else if (idx === storyIndex) fillPct = progress;

            return (
              <div
                key={story.id}
                className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-white transition-all duration-75 ease-linear"
                  style={{ width: `${fillPct}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Story Header (Avatar, Username, Time, Audio, Options, Close) */}
        <div className="relative z-30 px-4 pt-3 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#548687] border-2 border-white/40 flex items-center justify-center font-semibold text-sm overflow-hidden shrink-0">
              {activeStory.authorPhotoURL ? (
                <img
                  src={activeStory.authorPhotoURL}
                  alt={activeStory.authorUsername}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>
                  {activeStory.authorUsername[0]?.toUpperCase() || 'V'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm drop-shadow-sm">
                {activeStory.authorUsername}
              </span>
              <span className="text-white/60 text-xs font-normal drop-shadow-sm">
                {getRelativeTime(activeStory.createdAt)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {isVideoStory && (
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="p-1.5 text-white/90 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                title={isMuted ? 'Desmutar' : 'Mutar'}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowOptions(!showOptions)}
                className="p-1.5 text-white/90 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                title="Mais opções"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>

              {showOptions && (
                <div className="absolute right-0 mt-2 w-44 bg-[#1F3331] text-white rounded-xl shadow-xl border border-white/10 p-1.5 z-40 text-xs animate-in fade-in">
                  {isMyStory && (
                    <button
                      onClick={handleDeleteThisStory}
                      className="w-full flex items-center gap-2 px-3 py-2 text-rose-300 hover:bg-rose-500/20 rounded-lg text-left cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir este story</span>
                    </button>
                  )}
                  <div className="px-3 py-2 text-white/60 text-[11px]">
                    Visualizações: {activeStory.viewers.length}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/90 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Story Body / Media Content */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden p-0 sm:p-4">
          {isVideoStory && activeStory.mediaUrl ? (
            <video
              ref={videoRef}
              src={activeStory.mediaUrl}
              autoPlay
              playsInline
              muted={isMuted}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleNextStory}
              className="w-full h-full object-contain pointer-events-none"
            />
          ) : activeStory.mediaUrl ? (
            <img
              src={activeStory.mediaUrl}
              alt="Story"
              className="w-full h-full object-contain pointer-events-none"
            />
          ) : (
            <div className="text-center px-6 max-w-xs pointer-events-none">
              <p className="text-white text-xl sm:text-2xl font-bold leading-relaxed drop-shadow-md">
                {activeStory.caption || 'Sem texto'}
              </p>
            </div>
          )}

          {/* Optional Caption Overlay when photo/video is present */}
          {activeStory.mediaUrl && activeStory.caption && (
            <div className="absolute bottom-6 left-4 right-4 z-20 pointer-events-none">
              <div className="bg-black/60 backdrop-blur-sm text-white text-xs sm:text-sm px-3.5 py-2 rounded-xl">
                {activeStory.caption}
              </div>
            </div>
          )}

          {/* Interactive Navigation Tap Zones (Left 35% / Right 65%) */}
          <div
            className="absolute inset-y-0 left-0 w-1/3 cursor-pointer z-10"
            onClick={(e) => {
              e.stopPropagation();
              handlePrevStory();
            }}
          />
          <div
            className="absolute inset-y-0 right-0 w-2/3 cursor-pointer z-10"
            onClick={(e) => {
              e.stopPropagation();
              handleNextStory();
            }}
          />
        </div>

        {/* Bottom Gradient Overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-20 pointer-events-none" />

        {/* Footer: "Enviar mensagem", Like & Share Icons */}
        <div
          className="relative z-30 px-4 pb-4 pt-2 flex items-center gap-3 text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <form
            onSubmit={handleSendMessage}
            className="flex-1 flex items-center bg-white/15 hover:bg-white/20 border border-white/25 rounded-full px-4 py-2.5 transition-colors focus-within:bg-white/25 focus-within:border-white/40"
          >
            <input
              type="text"
              placeholder="Enviar mensagem"
              value={messageInput}
              onFocus={() => setIsPaused(true)}
              onBlur={() => setIsPaused(false)}
              onChange={(e) => setMessageInput(e.target.value)}
              className="w-full bg-transparent text-sm text-white placeholder-white/70 outline-none"
            />
          </form>

          <button
            type="button"
            onClick={handleToggleLike}
            className="p-2 rounded-full hover:bg-white/10 transition-transform active:scale-125 cursor-pointer"
            title="Curtir story"
          >
            <Heart
              className={`w-6 h-6 transition-colors ${
                isLikedByMe ? 'fill-rose-500 text-rose-500' : 'text-white'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => {
              if (onShowToast) onShowToast('Link do story copiado!', 'success');
            }}
            className="p-2 rounded-full hover:bg-white/10 transition-transform active:scale-125 cursor-pointer"
            title="Compartilhar"
          >
            <Send className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
