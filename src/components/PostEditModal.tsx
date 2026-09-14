import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Image as ImageIcon,
  Play,
  Plus,
  Loader2,
  Volume2,
  VolumeX,
  MoreHorizontal,
  Users,
} from 'lucide-react';
import { UserProfile } from '../types/user';
import { PostItem } from '../types/social';
import { editPost } from '../services/socialService';
import { optimizeImage, getBase64SizeBytes } from '../utils/mediaOptimizer';
import { TextWithAutocomplete } from './TextWithAutocomplete';

interface PostEditModalProps {
  post: PostItem;
  isOpen: boolean;
  onClose: () => void;
  onPostEdited: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  allUsers?: UserProfile[];
}

interface MediaFileItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  isExisting: boolean; // flag to know if this was already uploaded
}

export function PostEditModal({
  post,
  isOpen,
  onClose,
  onPostEdited,
  onShowToast,
  allUsers = [],
}: PostEditModalProps) {
  const [caption, setCaption] = useState('');
  const [mediaList, setMediaList] = useState<MediaFileItem[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  
  // Video playback state
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize state from existing post
  useEffect(() => {
    if (isOpen && post) {
      setCaption(post.content || '');
      
      const existingMediaUrls = post.mediaUrls && post.mediaUrls.length > 0
        ? post.mediaUrls
        : (post.mediaUrl ? [post.mediaUrl] : []);

      const list: MediaFileItem[] = existingMediaUrls.map((url, idx) => {
        const isVideo =
          post.mediaType === 'video' ||
          url.startsWith('data:video') ||
          url.endsWith('.mp4') ||
          url.endsWith('.webm');
        return {
          id: `existing_${idx}`,
          url,
          type: isVideo ? 'video' : 'image',
          isExisting: true,
        };
      });

      setMediaList(list);
      setActiveMediaIndex(0);
      setIsSubmitting(false);
    }
  }, [isOpen, post]);

  if (!isOpen || !post) return null;

  const handleFilesAdded = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const maxFiles = 10;
    const remainingSlots = maxFiles - mediaList.length;
    if (remainingSlots <= 0) {
      if (onShowToast) onShowToast('Você já atingiu o limite máximo de 10 mídias.', 'error');
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    for (const file of filesToProcess) {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (isVideo) {
        if (onShowToast) onShowToast('O envio de vídeos foi desativado. Por favor, envie apenas fotos.', 'info');
        continue;
      }

      if (!isImage) {
        if (onShowToast) onShowToast('Por favor, selecione imagens válidas.', 'error');
        continue;
      }

      if (file.size > 20 * 1024 * 1024) {
        if (onShowToast) onShowToast('Imagem muito grande. Limite de 20MB.', 'error');
        continue;
      }

      try {
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
            isExisting: false,
          },
        ]);
      } catch (err) {
        console.error('Error optimizing uploaded file:', err);
        if (onShowToast) onShowToast('Erro ao processar imagem.', 'error');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validation: if it is a media post, it must have at least one media item remaining
    if (post.mediaType !== 'text' && mediaList.length === 0) {
      if (onShowToast) {
        onShowToast('Uma publicação com mídias precisa ter pelo menos 1 imagem ou vídeo. Caso prefira, você pode excluir a publicação inteira.', 'error');
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedMediaUrls = mediaList.map((item) => item.url);
      
      await editPost({
        postId: post.id,
        editorUid: post.authorUid,
        newContent: caption,
        newMediaUrls: updatedMediaUrls,
        allUsers,
      });

      if (onShowToast) onShowToast('Publicação editada com sucesso!', 'success');
      onPostEdited();
    } catch (err: any) {
      console.error('Error editing post:', err);
      if (onShowToast) onShowToast(err?.message || 'Erro ao salvar alterações.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeMedia = mediaList[activeMediaIndex];

  return (
    <div className="fixed inset-0 bg-[#0F1111]/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />
      
      <form
        onSubmit={handleSubmit}
        className={`bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col relative z-10 animate-in zoom-in-95 duration-150 ${
          post.mediaType === 'text' ? 'w-full max-w-xl' : 'w-full max-w-4xl'
        }`}
      >
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFilesAdded(e.target.files)}
        />

        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <h2 className="text-base font-bold text-gray-900">Editar publicação</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Body */}
        <div className={post.mediaType === 'text' ? 'p-6' : 'grid grid-cols-1 md:grid-cols-2'}>
          {/* LEFT COLUMN: Media Canvas & Carousel (Only for Image/Video Posts) */}
          {post.mediaType !== 'text' && (
            <div className="bg-[#111313] relative flex flex-col items-center justify-center min-h-[380px] md:min-h-[460px] select-none overflow-hidden group/canvas">
              {mediaList.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-full p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <div className="w-20 h-20 rounded-3xl bg-[#1A1F1F] text-[#426465] flex items-center justify-center mb-3">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                  <span className="text-xs text-gray-400 font-medium">
                    Nenhuma imagem restando. Clique para selecionar do computador.
                  </span>
                </div>
              ) : (
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
                        className="max-h-[460px] w-full object-contain cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setIsVideoMuted(!isVideoMuted)}
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

                  {/* Bottom Media Carousel Overlay */}
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
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

                      {/* Add More Media '+' Dashed Button (Max 10 total) */}
                      {mediaList.length < 10 && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-11 h-11 rounded-xl border-2 border-dashed border-gray-500 hover:border-white text-gray-400 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                          title="Adicionar mais"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="pointer-events-auto bg-black/75 backdrop-blur-xs text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-md">
                      {activeMediaIndex + 1}/{mediaList.length}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RIGHT COLUMN: Edit Caption & Read-only Collaborators */}
          <div className="p-6 flex flex-col justify-between min-h-[420px] bg-white">
            <div className="space-y-4">
              {/* Author Info */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-xs shadow-xs overflow-hidden">
                  {post.authorPhotoURL ? (
                    <img src={post.authorPhotoURL} alt={post.authorUsername} className="w-full h-full object-cover" />
                  ) : (
                    <span>{post.authorDisplayName?.[0]?.toUpperCase() || post.authorUsername[0]?.toUpperCase() || 'V'}</span>
                  )}
                </div>
                <div className="font-semibold text-gray-900 text-sm">
                  @{post.authorUsername} <span className="text-xs text-gray-400 font-normal">(autor)</span>
                </div>
              </div>

              {/* Caption Textarea with Autocomplete */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Legenda da publicação
                </label>
                <TextWithAutocomplete
                  id="input-post-caption-edit"
                  value={caption}
                  onChange={setCaption}
                  placeholder="Escreva uma legenda..."
                  rows={post.mediaType === 'text' ? 7 : 4}
                  isTextarea={true}
                  allUsers={allUsers}
                  className="w-full resize-none focus:outline-none text-sm text-gray-800 placeholder-gray-400 bg-transparent leading-relaxed border border-gray-100 p-2.5 rounded-xl bg-gray-50/50 focus:bg-white focus:border-[#548687]/40 transition-all"
                />
              </div>

              {/* Immutable Collaborators (Read-only list) */}
              {post.collaborators && post.collaborators.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>Colaboradores (Lista fixa)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {post.collaborators.map((collab) => {
                      const cUser = allUsers.find((u) => u.uid === collab.usuario_id);
                      const username = cUser?.username || collab.usuario_username || 'usuario';
                      const isAccepted = collab.status === 'aceito';
                      
                      return (
                        <div
                          key={collab.usuario_id}
                          className="inline-flex items-center gap-2 bg-gray-50 text-gray-600 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200"
                        >
                          <span className="text-gray-700">@{username}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            isAccepted
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-amber-50 text-amber-600'
                          }`}>
                            {isAccepted ? 'Aceito' : 'Pendente'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100 mt-6 bg-white">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-[#548687] hover:bg-[#457273] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar alterações</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
