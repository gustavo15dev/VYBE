import React, { useState, useRef } from 'react';
import {
  X,
  Image as ImageIcon,
  Type,
  Palette,
  Loader2,
  Sparkles,
  Upload,
  Video,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Film,
} from 'lucide-react';
import { UserProfile } from '../types/user';
import { MediaType } from '../types/social';
import { createStory } from '../services/socialService';
import { optimizeImage, getBase64SizeBytes } from '../utils/mediaOptimizer';

interface StoryCreatorModalProps {
  author: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const BG_PALETTES = [
  { name: 'Deep Forest', color: '#162523' },
  { name: 'Teal VYBE', color: '#548687' },
  { name: 'Midnight', color: '#2C3E50' },
  { name: 'Purple', color: '#6B408B' },
  { name: 'Terracotta', color: '#B55225' },
  { name: 'Ocean', color: '#168478' },
  { name: 'Charcoal', color: '#222831' },
];

export function StoryCreatorModal({
  author,
  isOpen,
  onClose,
  onStoryCreated,
  onShowToast,
}: StoryCreatorModalProps) {
  const [mode, setMode] = useState<MediaType>('text');
  const [caption, setCaption] = useState('');
  const [selectedBg, setSelectedBg] = useState(BG_PALETTES[0].color);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | undefined>(undefined);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  if (!isOpen) return null;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      if (onShowToast) onShowToast('A imagem deve ter no máximo 20MB.', 'error');
      return;
    }

    try {
      const compressed = await optimizeImage(file, {
        maxWidth: 1080,
        maxHeight: 1920,
        quality: 0.8,
        mimeType: 'image/jpeg',
      });
      setMediaPreview(compressed);
      setMode('image');
    } catch (err) {
      console.error('Failed to compress story image:', err);
      if (onShowToast) onShowToast('Erro ao processar imagem.', 'error');
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      if (onShowToast) onShowToast('O vídeo deve ter no máximo 15MB (vídeo leve).', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawUrl = event.target?.result as string;
      const sizeBytes = getBase64SizeBytes(rawUrl);
      if (sizeBytes > 850 * 1024) {
        if (onShowToast) {
          onShowToast('Vídeo muito longo para um story. Selecione um vídeo mais curto.', 'error');
        }
        return;
      }
      setMediaPreview(rawUrl);
      setMode('video');
    };
    reader.readAsDataURL(file);
  };

  const handleLoadedVideoMetadata = () => {
    if (videoPreviewRef.current) {
      const dur = Math.round(videoPreviewRef.current.duration);
      setVideoDuration(dur);
    }
  };

  const toggleVideoPlayback = () => {
    if (!videoPreviewRef.current) return;
    if (isVideoPlaying) {
      videoPreviewRef.current.pause();
      setIsVideoPlaying(false);
    } else {
      videoPreviewRef.current.play();
      setIsVideoPlaying(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'text' && !caption.trim()) {
      if (onShowToast) onShowToast('Digite um texto para o seu story.', 'error');
      return;
    }

    if ((mode === 'image' || mode === 'video') && !mediaPreview) {
      if (onShowToast) onShowToast('Selecione uma foto ou vídeo para o story.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await createStory({
        author,
        caption: caption.trim(),
        mediaType: mode,
        mediaUrl: mode !== 'text' ? (mediaPreview || undefined) : undefined,
        bgColor: selectedBg,
        videoDuration: mode === 'video' ? videoDuration : undefined,
      });

      if (onShowToast) {
        onShowToast('Seu story foi publicado com sucesso na VYBE!', 'success');
      }
      onStoryCreated();
      onClose();
    } catch (err: any) {
      console.error('Failed to create story:', err);
      if (onShowToast) {
        onShowToast(err.message || 'Erro ao publicar story.', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const authorInit =
    author.displayName?.[0]?.toUpperCase() || author.username[0]?.toUpperCase() || 'V';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      {/* Modal Card with Wide 2-Column Layout */}
      <div
        id="story-creator-modal-card"
        className="bg-white rounded-3xl w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95"
      >
        {/* Header Bar */}
        <div className="px-6 py-3.5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#F0F6F6] text-[#548687] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-none">
                Criar Story (24h)
              </h3>
              <span className="text-[11px] text-gray-400 font-normal">
                Disponível apenas para os seguidores que você possui
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Column Main Content (Preview on the left, Controls on the right) */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto md:overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-5 p-5 sm:p-6"
        >
          {/* LEFT COLUMN: Story Phone Preview */}
          <div className="md:col-span-5 flex flex-col items-center justify-center bg-[#F8FAFA] rounded-2xl p-4 border border-gray-100/80">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
              Prévia do Story
            </div>

            {/* Simulated Phone Screen */}
            <div
              className="relative w-full max-w-[210px] sm:max-w-[230px] aspect-[9/16] rounded-2xl overflow-hidden shadow-lg border-2 border-black/10 flex flex-col justify-between transition-colors duration-300 bg-black"
              style={{ backgroundColor: mode === 'text' ? selectedBg : '#000000' }}
            >
              {/* Header preview inside story */}
              <div className="relative z-20 p-2.5 bg-gradient-to-b from-black/70 to-transparent flex items-center gap-2 text-white">
                <div className="w-6 h-6 rounded-full bg-[#548687] text-white flex items-center justify-center text-[10px] font-bold border border-white/40 overflow-hidden">
                  {author.photoURL ? (
                    <img src={author.photoURL} alt={author.username} className="w-full h-full object-cover" />
                  ) : (
                    <span>{authorInit}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[11px] font-semibold truncate leading-none">
                    {author.username}
                  </span>
                  <span className="text-[9px] text-white/70">agora</span>
                </div>
              </div>

              {/* Center Content Preview */}
              <div className="relative flex-1 flex items-center justify-center overflow-hidden">
                {mode === 'image' && mediaPreview ? (
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    className="w-full h-full object-contain pointer-events-none"
                  />
                ) : mode === 'video' && mediaPreview ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <video
                      ref={videoPreviewRef}
                      src={mediaPreview}
                      autoPlay
                      loop
                      muted={isVideoMuted}
                      onLoadedMetadata={handleLoadedVideoMetadata}
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={toggleVideoPlayback}
                      className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 z-30"
                    >
                      {isVideoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    </button>
                  </div>
                ) : mode === 'text' && caption.trim() ? (
                  <div className="p-4 text-center">
                    <p className="text-white text-sm sm:text-base font-bold leading-snug drop-shadow-md break-words max-w-full">
                      {caption}
                    </p>
                  </div>
                ) : (
                  <div className="text-white/40 text-xs italic px-3 text-center">
                    {mode === 'video'
                      ? 'Nenhum vídeo selecionado'
                      : mode === 'image'
                      ? 'Nenhuma imagem selecionada'
                      : 'O texto digitado aparecerá aqui'}
                  </div>
                )}
              </div>

              {/* Caption Overlay in Image / Video mode */}
              {mode !== 'text' && caption.trim() && (
                <div className="relative z-20 p-2.5 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-white text-[10px] line-clamp-2 bg-black/40 backdrop-blur-xs px-2 py-1 rounded-md">
                    {caption}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Interactive Controls & Actions */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* Mode Switcher Tabs */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Formato do Story
                </label>
                <div className="flex bg-[#F1F5F5] p-1 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('text');
                      setMediaPreview(null);
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      mode === 'text'
                        ? 'bg-white text-gray-900 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Type className="w-4 h-4 text-[#548687]" />
                    <span>Texto & Cor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('image');
                      if (!mediaPreview) imageInputRef.current?.click();
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      mode === 'image'
                        ? 'bg-white text-gray-900 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4 text-[#548687]" />
                    <span>Foto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('video');
                      if (!mediaPreview) videoInputRef.current?.click();
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      mode === 'video'
                        ? 'bg-white text-gray-900 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Video className="w-4 h-4 text-[#548687]" />
                    <span>Vídeo Leve</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Inputs based on Mode */}
              {mode === 'text' ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-700">
                      Mensagem do Story
                    </label>
                    <span className="text-[10px] text-gray-400">
                      {caption.length}/200
                    </span>
                  </div>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value.slice(0, 200))}
                    placeholder="Escreva sua mensagem do dia..."
                    rows={4}
                    className="w-full bg-[#F9FBFC] border border-gray-200 rounded-2xl p-3 text-xs sm:text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#548687] focus:bg-white resize-none transition-colors"
                  />
                </div>
              ) : mode === 'image' ? (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-700">
                    Imagem do Story
                  </label>

                  {mediaPreview ? (
                    <div className="flex items-center gap-3 bg-[#F8FAFA] p-2.5 rounded-xl border border-gray-200/80">
                      <img
                        src={mediaPreview}
                        alt="Preview"
                        className="w-12 h-12 rounded-lg object-cover border"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-800 truncate">
                          Foto selecionada
                        </div>
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          className="text-[11px] text-[#548687] hover:underline font-semibold cursor-pointer"
                        >
                          Trocar foto
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMediaPreview(null)}
                        className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remover"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => imageInputRef.current?.click()}
                      className="cursor-pointer flex items-center justify-center gap-3 p-4 border-2 border-dashed border-gray-200 hover:border-[#548687] rounded-2xl bg-[#F9FBFC] hover:bg-[#F0F6F6] transition-colors group text-center"
                    >
                      <div className="w-9 h-9 rounded-full bg-white shadow-2xs flex items-center justify-center text-[#548687] group-hover:scale-110 transition-transform">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-semibold text-gray-800">
                          Carregar foto do dispositivo
                        </div>
                        <div className="text-[10px] text-gray-400">
                          PNG, JPG ou WEBP (até 10MB)
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Legenda (opcional)
                    </label>
                    <input
                      type="text"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Adicione uma legenda..."
                      className="w-full px-3 py-2 bg-[#F9FBFC] border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#548687] focus:bg-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-700">
                    Vídeo Leve do Story
                  </label>

                  {mediaPreview ? (
                    <div className="flex items-center gap-3 bg-[#F8FAFA] p-2.5 rounded-xl border border-gray-200/80">
                      <div className="w-12 h-12 rounded-lg bg-black flex items-center justify-center text-white">
                        <Film className="w-6 h-6 text-[#548687]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-800 truncate">
                          Vídeo leve selecionado
                        </div>
                        <button
                          type="button"
                          onClick={() => videoInputRef.current?.click()}
                          className="text-[11px] text-[#548687] hover:underline font-semibold cursor-pointer"
                        >
                          Trocar vídeo
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMediaPreview(null)}
                        className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remover"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => videoInputRef.current?.click()}
                      className="cursor-pointer flex items-center justify-center gap-3 p-4 border-2 border-dashed border-gray-200 hover:border-[#548687] rounded-2xl bg-[#F9FBFC] hover:bg-[#F0F6F6] transition-colors group text-center"
                    >
                      <div className="w-9 h-9 rounded-full bg-white shadow-2xs flex items-center justify-center text-[#548687] group-hover:scale-110 transition-transform">
                        <Video className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-semibold text-gray-800">
                          Carregar vídeo leve do dispositivo
                        </div>
                        <div className="text-[10px] text-gray-400">
                          MP4 ou WebM (até 25MB)
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Legenda (opcional)
                    </label>
                    <input
                      type="text"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Adicione uma legenda ao vídeo..."
                      className="w-full px-3 py-2 bg-[#F9FBFC] border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#548687] focus:bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Hidden File Inputs */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime"
                onChange={handleVideoChange}
                className="hidden"
              />

              {/* Background Color Swatches (for text stories) */}
              {mode === 'text' && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Palette className="w-3.5 h-3.5 text-[#548687]" />
                    <label className="text-xs font-bold text-gray-700">
                      Cor de fundo
                    </label>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    {BG_PALETTES.map((item) => (
                      <button
                        key={item.color}
                        type="button"
                        onClick={() => setSelectedBg(item.color)}
                        title={item.name}
                        className={`w-7 h-7 rounded-full border border-black/10 transition-all cursor-pointer shrink-0 ${
                          selectedBg === item.color
                            ? 'scale-115 ring-2 ring-[#548687] ring-offset-2'
                            : 'hover:scale-105 opacity-85 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: item.color }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                id="btn-publish-story"
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 bg-[#548687] hover:bg-[#436e6f] text-white font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Publicando...</span>
                  </>
                ) : (
                  <span>Publicar Story</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
