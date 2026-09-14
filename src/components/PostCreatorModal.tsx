import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Image as ImageIcon,
  Play,
  AlignLeft,
  Clock,
  UserPlus,
  ChevronRight,
  Plus,
  Loader2,
  Volume2,
  VolumeX,
  Pause,
  MoreHorizontal,
  Search,
  Check,
  Sparkles,
} from 'lucide-react';
import { UserProfile } from '../types/user';
import { MediaType, PostCollaborator } from '../types/social';
import { createPost } from '../services/socialService';
import { optimizeImage, getBase64SizeBytes } from '../utils/mediaOptimizer';
import { TextWithAutocomplete } from './TextWithAutocomplete';

interface PostCreatorModalProps {
  author: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onOpenStoryCreator?: () => void;
  allUsers?: UserProfile[];
  myFollowers?: Set<string>;
}

type Step = 'select_type' | 'compose';

interface MediaFileItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  duration?: number;
}

export function PostCreatorModal({
  author,
  isOpen,
  onClose,
  onPostCreated,
  onShowToast,
  onOpenStoryCreator,
  allUsers = [],
  myFollowers,
}: PostCreatorModalProps) {
  const [step, setStep] = useState<Step>('select_type');
  const [selectedType, setSelectedType] = useState<'image' | 'video' | 'text' | 'story'>('image');
  
  // Composition form state
  const [caption, setCaption] = useState('');
  const [mediaList, setMediaList] = useState<MediaFileItem[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  
  // Video playback state
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  
  // Collaboration state
  const [isCollabOpen, setIsCollabOpen] = useState(false);
  const [collabSearchQuery, setCollabSearchQuery] = useState('');
  const [selectedCollaborators, setSelectedCollaborators] = useState<UserProfile[]>([]);
  
  // Menu dropdown state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeVideoRef = useRef<HTMLVideoElement>(null);

  // Reset state when opening/closing modal
  useEffect(() => {
    if (isOpen) {
      setStep('select_type');
      setSelectedType('image');
      setCaption('');
      setMediaList([]);
      setActiveMediaIndex(0);
      setIsCollabOpen(false);
      setCollabSearchQuery('');
      setSelectedCollaborators([]);
      setIsMenuOpen(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle selecting one of the 4 card options in Image 1
  const handleSelectType = (type: 'image' | 'video' | 'text' | 'story') => {
    if (type === 'story') {
      onClose();
      if (onOpenStoryCreator) {
        onOpenStoryCreator();
      }
      return;
    }

    setSelectedType(type);
    setStep('compose');

    // If photo or video chosen, trigger file selector after a brief delay
    if (type === 'image' || type === 'video') {
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 100);
    }
  };

  // Process uploaded files (supports multiple images or video)
  const handleFilesAdded = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const maxFiles = 10;
    const remainingSlots = maxFiles - mediaList.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    for (const file of filesToProcess) {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isImage && !isVideo) {
        if (onShowToast) onShowToast('Por favor, selecione imagens ou vídeos válidos.', 'error');
        continue;
      }

      // Check max file sizes
      if (isVideo && file.size > 15 * 1024 * 1024) {
        if (onShowToast) onShowToast('Vídeo muito grande. Limite de 15MB.', 'error');
        continue;
      }
      if (isImage && file.size > 20 * 1024 * 1024) {
        if (onShowToast) onShowToast('Imagem muito grande. Limite de 20MB.', 'error');
        continue;
      }

      try {
        if (isImage) {
          // Dynamically compress and resize image
          const compressedUrl = await optimizeImage(file, {
            maxWidth: 1200,
            maxHeight: 1200,
            quality: 0.78,
            mimeType: 'image/jpeg',
          });

          setMediaList((prev) => [
            ...prev,
            {
              id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              url: compressedUrl,
              type: 'image',
            },
          ]);
        } else if (isVideo) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const rawUrl = event.target?.result as string;
            const sizeBytes = getBase64SizeBytes(rawUrl);
            if (sizeBytes > 850 * 1024) {
              if (onShowToast) {
                onShowToast('Vídeo muito longo ou pesado para o limite da publicação. Tente um vídeo mais curto.', 'error');
              }
              return;
            }
            setMediaList((prev) => [
              ...prev,
              {
                id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                url: rawUrl,
                type: 'video',
              },
            ]);
          };
          reader.readAsDataURL(file);
        }
      } catch (err) {
        console.error('Error optimizing uploaded file:', err);
      }
    }
  };

  const handleRemoveMediaItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setMediaList((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      if (activeMediaIndex >= filtered.length) {
        setActiveMediaIndex(Math.max(0, filtered.length - 1));
      }
      return filtered;
    });
  };

  const toggleVideoPlayback = () => {
    if (!activeVideoRef.current) return;
    if (isVideoPlaying) {
      activeVideoRef.current.pause();
      setIsVideoPlaying(false);
    } else {
      activeVideoRef.current.play();
      setIsVideoPlaying(true);
    }
  };

  const toggleVideoMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeVideoRef.current) return;
    const nextMuted = !isVideoMuted;
    activeVideoRef.current.muted = nextMuted;
    setIsVideoMuted(nextMuted);
  };

  // Filtered list of registered users for collaborator search
  const filteredUsers = allUsers.filter((u) => {
    if (u.uid === author.uid) return false;
    if (myFollowers && !myFollowers.has(u.uid)) return false; // Must be following the author
    if (selectedCollaborators.some((c) => c.uid === u.uid)) return false; // Already selected
    if (!collabSearchQuery.trim()) return true;
    const q = collabSearchQuery.toLowerCase();
    const handle = u.username.toLowerCase();
    const display = (u.displayName || '').toLowerCase();
    return handle.includes(q) || display.includes(q);
  });

  // Handle publishing the post
  const handleSubmit = async () => {
    if (selectedType !== 'text' && mediaList.length === 0) {
      if (onShowToast) onShowToast('Adicione pelo menos uma foto ou vídeo para publicar.', 'error');
      return;
    }

    if (selectedType === 'text' && !caption.trim()) {
      if (onShowToast) onShowToast('Escreva algo para publicar.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Build collaborator invitations array
      const collaborators: PostCollaborator[] = selectedCollaborators.map((collab) => ({
        usuario_id: collab.uid,
        usuario_username: collab.username,
        usuario_displayName: collab.displayName || collab.username,
        usuario_photoURL: collab.photoURL || '',
        status: 'pendente',
      }));

      const mediaUrls = mediaList.map((m) => m.url);
      const mediaType: MediaType = selectedType === 'text' ? 'text' : mediaList[0]?.type || 'image';

      await createPost({
        author,
        content: caption.trim(),
        mediaType,
        mediaUrls,
        mediaUrl: mediaUrls[0] || '',
        collaborators,
        allUsers,
      });

      if (onShowToast) {
        if (selectedCollaborators.length > 0) {
          onShowToast(`Publicado com sucesso! Convites enviados para ${selectedCollaborators.length} colaborador(es).`, 'success');
        } else {
          onShowToast('Publicação criada com sucesso!', 'success');
        }
      }

      onPostCreated();
      onClose();
    } catch (err) {
      console.error('Error creating post:', err);
      if (onShowToast) onShowToast('Erro ao criar publicação. Tente novamente.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeMedia = mediaList[activeMediaIndex];

  return (
    <div
      id="post-creator-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={selectedType === 'image'}
        accept={selectedType === 'video' ? 'video/mp4,video/webm' : 'image/*'}
        className="hidden"
        onChange={(e) => handleFilesAdded(e.target.files)}
      />

      {/* STEP 1: MODAL "Criar publicação" (Card de Seleção Desktop - Imagem 1) */}
      {step === 'select_type' && (
        <div
          id="modal-post-type-selector"
          className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-gray-100 relative animate-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4">
            <h2 className="text-base font-bold text-gray-900">Criar publicação</h2>
            <button
              id="btn-close-type-selector"
              type="button"
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 4 Type Selection Cards */}
          <div className="space-y-2.5 pt-1">
            {/* 1. Foto */}
            <button
              id="btn-select-type-photo"
              type="button"
              onClick={() => handleSelectType('image')}
              className="w-full flex items-center gap-4 p-3.5 rounded-2xl hover:bg-[#F3F8F8] transition-all cursor-pointer group text-left border border-transparent hover:border-[#548687]/20"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#548687] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <ImageIcon className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 group-hover:text-[#548687] transition-colors">
                  Foto
                </div>
                <div className="text-xs text-gray-500">Publicar uma ou mais imagens</div>
              </div>
            </button>

            {/* 2. Vídeo */}
            <button
              id="btn-select-type-video"
              type="button"
              onClick={() => handleSelectType('video')}
              className="w-full flex items-center gap-4 p-3.5 rounded-2xl hover:bg-[#F3F8F8] transition-all cursor-pointer group text-left border border-transparent hover:border-[#548687]/20"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#548687] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Play className="w-6 h-6 fill-white stroke-[2] translate-x-0.5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 group-hover:text-[#548687] transition-colors">
                  Vídeo
                </div>
                <div className="text-xs text-gray-500">Vídeo curto</div>
              </div>
            </button>

            {/* 3. Texto */}
            <button
              id="btn-select-type-text"
              type="button"
              onClick={() => handleSelectType('text')}
              className="w-full flex items-center gap-4 p-3.5 rounded-2xl hover:bg-[#F3F8F8] transition-all cursor-pointer group text-left border border-transparent hover:border-[#548687]/20"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#548687] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <AlignLeft className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 group-hover:text-[#548687] transition-colors">
                  Texto
                </div>
                <div className="text-xs text-gray-500">Publicação só com texto</div>
              </div>
            </button>

            {/* 4. Story */}
            <button
              id="btn-select-type-story"
              type="button"
              onClick={() => handleSelectType('story')}
              className="w-full flex items-center gap-4 p-3.5 rounded-2xl hover:bg-[#F3F8F8] transition-all cursor-pointer group text-left border border-transparent hover:border-[#142826]/20"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#142826] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Clock className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 group-hover:text-[#142826] transition-colors">
                  Story
                </div>
                <div className="text-xs text-gray-500">Some em 24 horas</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: COMPOSIÇÃO DE POST (Design Imagens 2 & 3) */}
      {step === 'compose' && (
        <div
          id="modal-post-composition"
          className={`bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 ${
            selectedType === 'text' ? 'w-full max-w-xl' : 'w-full max-w-4xl'
          }`}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
            <h2 className="text-base font-bold text-gray-900">Criar nova publicação</h2>
            <div className="flex items-center gap-2 relative">
              {/* More options ("...") */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                  title="Mais opções"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>

                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-30 text-xs text-gray-700">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setStep('select_type');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F3F8F8] font-medium transition-colors cursor-pointer"
                    >
                      Trocar tipo de publicação
                    </button>
                    {mediaList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          setMediaList([]);
                          setActiveMediaIndex(0);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-600 font-medium transition-colors cursor-pointer"
                      >
                        Limpar todas as fotos/vídeos
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                id="btn-close-composer"
                type="button"
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Body */}
          <div className={selectedType === 'text' ? 'p-6' : 'grid grid-cols-1 md:grid-cols-2'}>
            {/* LEFT COLUMN: Media Canvas & Carousel (Foto / Vídeo) */}
            {selectedType !== 'text' && (
              <div className="bg-[#111313] relative flex flex-col items-center justify-center min-h-[380px] md:min-h-[460px] select-none overflow-hidden group/canvas">
                {mediaList.length === 0 ? (
                  /* Empty state placeholder (Screenshot 3) */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/5 transition-colors"
                  >
                    <div className="w-20 h-20 rounded-3xl bg-[#1A1F1F] text-[#426465] flex items-center justify-center mb-3">
                      {selectedType === 'video' ? (
                        <Play className="w-10 h-10 fill-current translate-x-0.5" />
                      ) : (
                        <ImageIcon className="w-10 h-10" />
                      )}
                    </div>
                    <span className="text-xs text-gray-400 font-medium max-w-xs">
                      Clique ou arraste {selectedType === 'video' ? 'um vídeo curto' : 'fotos'} aqui
                    </span>
                    <button
                      type="button"
                      className="mt-4 px-4 py-2 bg-[#548687] text-white text-xs font-semibold rounded-xl hover:bg-[#467374] transition-colors cursor-pointer"
                    >
                      Selecionar do computador
                    </button>
                  </div>
                ) : (
                  /* Active Media View */
                  <div className="w-full h-full flex items-center justify-center relative">
                    {activeMedia?.type === 'video' ? (
                      <div className="relative w-full h-full flex items-center justify-center bg-black">
                        <video
                          ref={activeVideoRef}
                          src={activeMedia.url}
                          autoPlay
                          loop
                          muted={isVideoMuted}
                          playsInline
                          onClick={toggleVideoPlayback}
                          className="max-h-[460px] w-full object-contain cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={toggleVideoMute}
                          className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer"
                        >
                          {isVideoMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                      </div>
                    ) : (
                      <img
                        src={activeMedia?.url}
                        alt="Preview"
                        className="max-h-[460px] w-full object-contain"
                      />
                    )}

                    {/* Bottom Media Carousel & Thumbnails Overlay (Screenshots 2 & 3) */}
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                      {/* Left: Thumbnail list + Add Button */}
                      <div className="flex items-center gap-2 pointer-events-auto bg-black/60 backdrop-blur-md p-1.5 rounded-2xl max-w-[80%] overflow-x-auto scrollbar-none">
                        {mediaList.map((item, idx) => {
                          const isActive = activeMediaIndex === idx;
                          return (
                            <div
                              key={item.id}
                              onClick={() => setActiveMediaIndex(idx)}
                              className={`relative w-11 h-11 rounded-xl overflow-hidden cursor-pointer shrink-0 border-2 transition-all ${
                                isActive ? 'border-[#548687] ring-2 ring-[#548687]/50 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                              }`}
                            >
                              {item.type === 'video' ? (
                                <video src={item.url} className="w-full h-full object-cover" />
                              ) : (
                                <img src={item.url} alt="Thumb" className="w-full h-full object-cover" />
                              )}

                              {/* Remove individual thumbnail */}
                              <button
                                type="button"
                                onClick={(e) => handleRemoveMediaItem(e, item.id)}
                                className="absolute top-0.5 right-0.5 p-0.5 bg-black/80 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer"
                                title="Remover"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          );
                        })}

                        {/* Add More Media '+' Dashed Button */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-11 h-11 rounded-xl border-2 border-dashed border-gray-500 hover:border-white text-gray-400 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                          title="Adicionar mais"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Right: Counter Badge "1/3" */}
                      <div className="pointer-events-auto bg-black/75 backdrop-blur-xs text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-md">
                        {activeMediaIndex + 1}/{mediaList.length}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RIGHT COLUMN (or Full Width for Text): Author, Caption, Collaborator, Actions */}
            <div className="p-6 flex flex-col justify-between min-h-[420px] bg-white">
              <div className="space-y-4">
                {/* Author Info */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-xs shadow-xs overflow-hidden">
                    {author.photoURL ? (
                      <img src={author.photoURL} alt={author.username} className="w-full h-full object-cover" />
                    ) : (
                      <span>{author.displayName?.[0]?.toUpperCase() || author.username[0]?.toUpperCase() || 'V'}</span>
                    )}
                  </div>
                  <div className="font-semibold text-gray-900 text-sm">
                    você
                  </div>
                </div>

                {/* Caption Textarea with Autocomplete */}
                <div>
                  <TextWithAutocomplete
                    id="input-post-caption"
                    value={caption}
                    onChange={setCaption}
                    placeholder={
                      selectedType === 'text'
                        ? 'O que você está pensando? Escreva sua publicação...'
                        : 'Escreva uma legenda...'
                    }
                    rows={selectedType === 'text' ? 7 : 4}
                    isTextarea={true}
                    allUsers={allUsers}
                    myFollowing={myFollowers}
                    className="w-full resize-none focus:outline-none text-sm text-gray-800 placeholder-gray-400 bg-transparent leading-relaxed"
                  />
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Collaborator Section */}
                <div>
                  <div className="space-y-3">
                    <button
                      id="btn-add-collaborator"
                      type="button"
                      onClick={() => setIsCollabOpen(!isCollabOpen)}
                      className="w-full flex items-center justify-between py-2 text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <UserPlus className="w-5 h-5 text-[#548687]" />
                        <span className="text-sm font-medium text-gray-800 group-hover:text-[#548687] transition-colors">
                          Adicionar colaborador
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedCollaborators.length > 0 && (
                          <span className="text-[10px] font-bold bg-[#548687] text-white px-2 py-0.5 rounded-full">
                            {selectedCollaborators.length}/10
                          </span>
                        )}
                        <ChevronRight
                          className={`w-4 h-4 text-gray-400 transition-transform ${
                            isCollabOpen ? 'rotate-90 text-[#548687]' : ''
                          }`}
                        />
                      </div>
                    </button>

                    {/* Selected Collaborators Pills */}
                    {selectedCollaborators.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedCollaborators.map((collab) => (
                          <div
                            key={collab.uid}
                            className="inline-flex items-center gap-2 bg-[#F1F6F6] text-gray-800 px-3 py-1.5 rounded-full text-xs font-semibold border border-[#D5E5E5]"
                          >
                            <div className="w-5 h-5 rounded-full bg-[#548687] text-white flex items-center justify-center text-[10px] font-bold overflow-hidden">
                              {collab.photoURL ? (
                                <img
                                  src={collab.photoURL}
                                  alt={collab.username}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>{collab.username[0].toUpperCase()}</span>
                              )}
                            </div>
                            <span>@{collab.username}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedCollaborators((prev) => prev.filter((c) => c.uid !== collab.uid))
                              }
                              className="text-gray-400 hover:text-gray-700 ml-0.5 cursor-pointer"
                              title="Remover colaborador"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Collaborator Search Popover */}
                    {isCollabOpen && (
                      <div className="mt-2 p-3 bg-[#F8FAFA] rounded-2xl border border-gray-100 space-y-2 animate-in fade-in">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={collabSearchQuery}
                            onChange={(e) => setCollabSearchQuery(e.target.value)}
                            placeholder="Buscar entre seus seguidores..."
                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#548687]"
                            autoFocus
                          />
                        </div>

                        <div className="max-h-36 overflow-y-auto space-y-1">
                          {filteredUsers.length > 0 ? (
                            filteredUsers.map((u) => (
                              <button
                                key={u.uid}
                                type="button"
                                onClick={() => {
                                  if (selectedCollaborators.length >= 10) {
                                    if (onShowToast) onShowToast('Limite máximo de 10 colaboradores.', 'error');
                                    return;
                                  }
                                  setSelectedCollaborators((prev) => [...prev, u]);
                                  setCollabSearchQuery('');
                                }}
                                className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white text-left transition-colors cursor-pointer group/item"
                              >
                                <div className="w-7 h-7 rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-[10px] shrink-0 overflow-hidden">
                                  {u.photoURL ? (
                                    <img src={u.photoURL} alt={u.username} className="w-full h-full object-cover" />
                                  ) : (
                                    <span>{u.username[0].toUpperCase()}</span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-semibold text-gray-900 group-hover/item:text-[#548687] truncate">
                                    @{u.username}
                                  </div>
                                  {u.displayName && (
                                    <div className="text-[10px] text-gray-500 truncate">{u.displayName}</div>
                                  )}
                                </div>
                                <Plus className="w-3.5 h-3.5 text-[#548687] opacity-0 group-hover/item:opacity-100 transition-opacity" />
                              </button>
                            ))
                          ) : (
                            <div className="text-center py-3 text-[11px] text-gray-400">
                              Nenhum seguidor encontrado
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Action Buttons (Right Aligned) */}
              <div className="pt-6 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  id="btn-cancel-post"
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="btn-submit-post"
                  type="button"
                  onClick={handleSubmit}
                  disabled={
                    isSubmitting ||
                    (selectedType !== 'text' && mediaList.length === 0) ||
                    (selectedType === 'text' && !caption.trim())
                  }
                  className="px-6 py-2.5 rounded-xl bg-[#548687] hover:bg-[#467374] disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-98"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Publicar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
