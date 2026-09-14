import { useState } from 'react';
import { Ban, MoreHorizontal } from 'lucide-react';
import { blockUser } from '../services/socialService';

interface BlockModalProps {
  isOpen: boolean;
  targetUid: string;
  targetUsername: string;
  currentUid?: string;
  onClose: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onOpenAuthModal?: () => void;
  onBlockedSuccess?: () => void;
}

export function BlockModal({
  isOpen,
  targetUid,
  targetUsername,
  currentUid,
  onClose,
  onShowToast,
  onOpenAuthModal,
  onBlockedSuccess,
}: BlockModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const cleanUsername = targetUsername.toLowerCase().replace(/^@/, '');

  const handleConfirmBlock = async () => {
    if (!currentUid) {
      onClose();
      onOpenAuthModal?.();
      return;
    }

    try {
      setLoading(true);
      await blockUser(currentUid, targetUid);
      onShowToast?.(`@${cleanUsername} foi bloqueado.`, 'info');
      onBlockedSuccess?.();
      onClose();
    } catch (err) {
      console.error('Error blocking user:', err);
      onShowToast?.('Erro ao bloquear usuário. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 p-6 flex flex-col items-center text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Right Menu Icon */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>

        {/* Centered Ban Circle Icon */}
        <div className="w-14 h-14 rounded-full bg-red-50/90 text-[#B94A4A] flex items-center justify-center mb-4 mt-2 shadow-2xs">
          <Ban className="w-7 h-7 stroke-[2.2]" />
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-gray-900 mb-2">
          Bloquear @{cleanUsername}?
        </h3>

        {/* Subtitle / Description */}
        <p className="text-xs sm:text-sm text-gray-500 leading-relaxed px-2 mb-6 max-w-xs">
          Ele não poderá mais ver seu perfil, posts, ou enviar mensagens. Ele não será notificado do bloqueio.
        </p>

        {/* Action Buttons Stack */}
        <div className="w-full space-y-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={handleConfirmBlock}
            className="w-full bg-[#B94A4A] hover:bg-[#A33B3B] active:bg-[#8F3232] text-white py-3 rounded-xl font-semibold text-xs sm:text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Bloqueando...' : 'Bloquear'}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="w-full bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 py-3 rounded-xl font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
