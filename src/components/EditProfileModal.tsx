import React, { useState, useRef } from 'react';
import { UserProfile } from '../types/user';
import { updateUserProfile } from '../services/authService';
import { X, Camera, Loader2, AlertCircle, Upload, Check } from 'lucide-react';
import { optimizeImage } from '../utils/mediaOptimizer';

interface EditProfileModalProps {
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: (updated: UserProfile) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function EditProfileModal({
  profile,
  isOpen,
  onClose,
  onProfileUpdated,
  onShowToast,
}: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [username, setUsername] = useState(profile.username || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [location, setLocation] = useState(profile.location || '');
  const [photoURL, setPhotoURL] = useState(profile.photoURL || '');
  const [photoInputMode, setPhotoInputMode] = useState<'upload' | 'url'>('upload');
  const [customUrl, setCustomUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor selecione um arquivo de imagem válido.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 15MB.');
      return;
    }

    setError(null);
    try {
      const compressed = await optimizeImage(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.85,
        mimeType: 'image/jpeg',
      });
      setPhotoURL(compressed);
    } catch (err) {
      console.error('Failed to compress avatar:', err);
      setError('Erro ao processar imagem.');
    }
  };

  const handleApplyUrl = () => {
    if (!customUrl.trim()) return;
    setPhotoURL(customUrl.trim());
    setCustomUrl('');
  };

  const handleRemovePhoto = () => {
    setPhotoURL('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername || cleanUsername.length < 3) {
      setError('O nome de usuário deve ter pelo menos 3 caracteres.');
      return;
    }

    const cleanDisplayName = displayName.trim();
    if (!cleanDisplayName) {
      setError('O nome de exibição não pode ficar vazio.');
      return;
    }

    setLoading(true);
    try {
      const updated = await updateUserProfile(
        profile.uid,
        {
          displayName: cleanDisplayName,
          username: cleanUsername,
          bio: bio.trim(),
          location: location.trim(),
          photoURL,
        },
        profile.username
      );

      onProfileUpdated(updated);
      onShowToast?.('Perfil atualizado com sucesso!', 'success');
      onClose();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Falha ao salvar as alterações do perfil.');
    } finally {
      setLoading(false);
    }
  };

  const initial =
    displayName[0]?.toUpperCase() || username[0]?.toUpperCase() || 'V';

  return (
    <div
      id="edit-profile-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        id="edit-profile-modal-dialog"
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">
            Editar perfil
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Photo Section */}
          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-[#F8FAFA] rounded-2xl border border-gray-100">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full bg-[#E1EEEE] text-[#426F70] flex items-center justify-center font-bold text-2xl overflow-hidden border-2 border-[#548687]/30 shadow-xs">
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt="Foto de perfil"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Mudar foto"
              >
                <Camera className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="text-xs font-semibold text-gray-900">
                Foto do Perfil
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-[#548687] text-white text-xs font-semibold rounded-xl hover:bg-[#436e6f] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Escolher arquivo</span>
                </button>

                {photoURL && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-3 py-1.5 border border-gray-200 text-gray-600 hover:text-rose-600 hover:border-rose-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Remover
                  </button>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                Formatos recomendados: JPG ou PNG de até 5MB
              </p>
            </div>
          </div>

          {/* Nome de Exibição */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">
              Nome
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu nome completo"
              maxLength={50}
              required
              className="w-full px-3.5 py-2.5 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#548687] focus:bg-white transition-colors"
            />
          </div>

          {/* Nome de Usuário */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">
              Nome de usuário (@handle)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                placeholder="nome_usuario"
                maxLength={30}
                required
                className="w-full pl-8 pr-3.5 py-2.5 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#548687] focus:bg-white transition-colors"
              />
            </div>
            <p className="text-[11px] text-gray-400">
              Letras minúsculas, números, pontos e underscores.
            </p>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-700">
                Bio
              </label>
              <span className="text-[11px] text-gray-400">{bio.length}/150</span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Escreva algo sobre você..."
              maxLength={150}
              rows={3}
              className="w-full px-3.5 py-2.5 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#548687] focus:bg-white transition-colors resize-none"
            />
          </div>

          {/* Localização */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">
              Localização
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="ex: São Paulo, SP"
              maxLength={60}
              className="w-full px-3.5 py-2.5 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#548687] focus:bg-white transition-colors"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#548687] hover:bg-[#436e6f] text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Salvar alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
