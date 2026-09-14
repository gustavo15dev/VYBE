import React, { useState } from 'react';
import { X, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { PostItem } from '../types/social';
import { deletePost } from '../services/socialService';

interface DeletePostConfirmModalProps {
  post: PostItem;
  isOpen: boolean;
  onClose: () => void;
  onPostDeleted: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function DeletePostConfirmModal({
  post,
  isOpen,
  onClose,
  onPostDeleted,
  onShowToast,
}: DeletePostConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !post) return null;

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deletePost(post.id, post.authorUid);
      if (onShowToast) onShowToast('Publicação excluída permanente.', 'success');
      onPostDeleted();
    } catch (err: any) {
      console.error('Error deleting post:', err);
      if (onShowToast) onShowToast(err?.message || 'Erro ao excluir a publicação.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0F1111]/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />
      
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-md w-full overflow-hidden p-6 relative z-10 animate-in zoom-in-95 duration-150">
        {/* Header Close Icon */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon & Title */}
        <div className="flex flex-col items-center text-center space-y-4 pt-2">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shadow-xs">
            <AlertTriangle className="w-7 h-7" />
          </div>
          
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-gray-900">Excluir Publicação?</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
              Tem certeza que deseja excluir esta publicação? Esta ação é irreversível e excluirá permanentemente:
            </p>
          </div>
        </div>

        {/* Detailed warning bullets */}
        <div className="bg-rose-50/50 border border-rose-100/50 rounded-2xl p-4 my-5 text-left text-xs text-rose-800 space-y-1.5 font-medium">
          <div className="flex items-center gap-2">
            <span className="w-1 h-1 bg-rose-600 rounded-full" />
            <span>O conteúdo e todas as fotos/vídeos</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1 h-1 bg-rose-600 rounded-full" />
            <span>Todos os comentários e respostas</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1 h-1 bg-rose-600 rounded-full" />
            <span>Curtidas, visualizações e estatísticas de engajamento</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1 h-1 bg-rose-600 rounded-full" />
            <span>Tags associadas e links de colaboradores</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="w-full order-2 sm:order-1 px-4 py-2.5 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all cursor-pointer disabled:opacity-50 text-center"
          >
            Cancelar
          </button>
          
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full order-1 sm:order-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Excluindo...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Sim, excluir tudo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
