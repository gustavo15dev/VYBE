import { useState } from 'react';
import { X, ChevronRight, CheckCircle2 } from 'lucide-react';
import { ReportReason, ReportTargetType } from '../types/social';
import { createReport } from '../services/socialService';

interface ReportModalProps {
  isOpen: boolean;
  targetType: ReportTargetType;
  targetId: string;
  currentUid?: string;
  onClose: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onOpenAuthModal?: () => void;
}

const REASON_OPTIONS: { reason: ReportReason; label: string }[] = [
  { reason: 'nudez', label: 'Nudez ou conteúdo sexual' },
  { reason: 'discurso_odio', label: 'Discurso de ódio ou símbolos' },
  { reason: 'violencia', label: 'Violência ou conteúdo perigoso' },
  { reason: 'bullying', label: 'Bullying ou assédio' },
  { reason: 'falso', label: 'Falso ou enganoso' },
  { reason: 'spam', label: 'Spam' },
  { reason: 'nao_gosto', label: 'Não gosto disso' },
];

export function ReportModal({
  isOpen,
  targetType,
  targetId,
  currentUid,
  onClose,
  onShowToast,
  onOpenAuthModal,
}: ReportModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const getTitle = () => {
    switch (targetType) {
      case 'post':
        return 'Denunciar publicação';
      case 'comentario':
        return 'Denunciar comentário';
      case 'usuario':
        return 'Denunciar perfil';
      case 'story':
        return 'Denunciar story';
      default:
        return 'Denunciar';
    }
  };

  const handleSelectReason = async (reason: ReportReason) => {
    if (!currentUid) {
      onClose();
      onOpenAuthModal?.();
      return;
    }

    try {
      setSubmitting(true);
      await createReport({
        denunciante_id: currentUid,
        alvo_tipo: targetType,
        alvo_id: targetId,
        motivo: reason,
      });

      setSubmitted(true);
      onShowToast?.('Denúncia enviada, obrigado por ajudar a manter a comunidade segura.', 'success');
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed to submit report:', err);
      onShowToast?.('Erro ao enviar denúncia. Tente novamente.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white relative">
          <h3 className="w-full text-center text-sm font-bold text-gray-900 tracking-tight">
            {getTitle()}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {submitted ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#548687] animate-bounce" />
            <p className="text-sm font-semibold text-gray-900">Denúncia enviada</p>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
              Obrigado por ajudar a manter a comunidade segura. Sua denúncia é totalmente anônima.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
            {REASON_OPTIONS.map((item) => (
              <button
                key={item.reason}
                type="button"
                disabled={submitting}
                onClick={() => handleSelectReason(item.reason)}
                className="w-full px-5 py-3.5 text-left text-xs sm:text-sm font-medium text-gray-800 hover:bg-gray-50 flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50"
              >
                <span>{item.label}</span>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
