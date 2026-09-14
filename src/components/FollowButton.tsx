import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toggleFollowUser, createFollowRequest, cancelFollowRequest } from '../services/socialService';
import { useAuth } from '../context/AuthContext';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface FollowButtonProps {
  currentUid: string;
  targetUid: string;
  targetUsername: string;
  iFollow: boolean;
  followsMe: boolean;
  isPrivate?: boolean;
  isRequested?: boolean;
  size?: 'sm' | 'md';
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onActionComplete?: () => void;
}

export function FollowButton({
  currentUid,
  targetUid,
  targetUsername,
  iFollow,
  followsMe,
  isPrivate = false,
  isRequested = false,
  size = 'md',
  onShowToast,
  onActionComplete,
}: FollowButtonProps) {
  const { profile } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Real-time synchronization for privacy & follow request states
  const [effectiveIsPrivate, setEffectiveIsPrivate] = useState<boolean>(isPrivate);
  const [effectiveIsRequested, setEffectiveIsRequested] = useState<boolean>(isRequested);

  useEffect(() => {
    setEffectiveIsPrivate(isPrivate);
  }, [isPrivate]);

  useEffect(() => {
    setEffectiveIsRequested(isRequested);
  }, [isRequested]);

  // Real-time listener for target user's account privacy
  useEffect(() => {
    if (!targetUid) return;
    const unsub = onSnapshot(
      doc(db, 'users', targetUid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const priv = Boolean(data?.conta_privada || data?.isPrivate);
          setEffectiveIsPrivate(priv);
        }
      },
      (err) => {
        console.warn('Error listening to target user privacy:', err);
      }
    );
    return () => unsub();
  }, [targetUid]);

  // Real-time listener for follow request status between currentUid and targetUid
  useEffect(() => {
    if (!currentUid || !targetUid) return;
    const reqId = `${currentUid}_${targetUid}`;
    const unsub = onSnapshot(
      doc(db, 'solicitacoes_seguir', reqId),
      (snap) => {
        setEffectiveIsRequested(snap.exists() && snap.data()?.status === 'pendente');
      },
      (err) => {
        console.warn('Error listening to follow request:', err);
      }
    );
    return () => unsub();
  }, [currentUid, targetUid]);

  // If viewing self, don't show follow button
  if (currentUid === targetUid) {
    return null;
  }

  const handleButtonClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (iFollow) {
      // Prompt confirmation to unfollow
      setShowConfirmModal(true);
      return;
    }

    // Double-check target user's privacy in Firestore before deciding follow vs request
    let targetPrivate = effectiveIsPrivate;
    try {
      const snap = await getDoc(doc(db, 'users', targetUid));
      if (snap.exists()) {
        const data = snap.data();
        targetPrivate = Boolean(data?.conta_privada || data?.isPrivate);
        setEffectiveIsPrivate(targetPrivate);
      }
    } catch (err) {
      // fallback to effectiveIsPrivate
    }

    if (targetPrivate) {
      if (effectiveIsRequested) {
        // Cancel request
        setIsLoading(true);
        try {
          await cancelFollowRequest(currentUid, targetUid);
          setEffectiveIsRequested(false);
          onShowToast?.(`Solicitação para @${targetUsername} cancelada.`, 'info');
          onActionComplete?.();
        } catch (err) {
          console.error(err);
          onShowToast?.('Erro ao cancelar solicitação.', 'error');
        } finally {
          setIsLoading(false);
        }
      } else {
        // Send request
        setIsLoading(true);
        try {
          await createFollowRequest(currentUid, targetUid, profile || undefined);
          setEffectiveIsRequested(true);
          onShowToast?.(`Solicitação enviada para @${targetUsername}!`, 'success');
          onActionComplete?.();
        } catch (err) {
          console.error(err);
          onShowToast?.('Erro ao enviar solicitação.', 'error');
        } finally {
          setIsLoading(false);
        }
      }
    } else {
      executeFollowToggle(false);
    }
  };

  const executeFollowToggle = async (currentlyFollowing: boolean) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await toggleFollowUser(
        currentUid,
        targetUid,
        currentlyFollowing,
        profile || undefined
      );
      if (currentlyFollowing) {
        if (onShowToast) onShowToast(`Você deixou de seguir @${targetUsername}`, 'info');
      } else {
        if (onShowToast) {
          onShowToast(
            followsMe
              ? `Agora você e @${targetUsername} são amigos mútuos!`
              : `Você começou a seguir @${targetUsername}`,
            'success'
          );
        }
      }
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      console.error('Error updating follow:', err);
      if (onShowToast) onShowToast('Não foi possível atualizar. Tente novamente.', 'error');
    } finally {
      setIsLoading(false);
      setShowConfirmModal(false);
    }
  };

  const sizeClasses =
    size === 'sm' ? 'px-3.5 py-1.5 text-xs' : 'px-4 sm:px-5 py-2 text-xs sm:text-sm';

  return (
    <>
      {iFollow ? (
        // State: ALREADY FOLLOWING
        <button
          type="button"
          disabled={isLoading}
          onClick={handleButtonClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`${sizeClasses} font-semibold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 ${
            isHovered
              ? 'border-rose-300 text-rose-600 bg-rose-50/70 shadow-xs'
              : 'border-gray-200 text-gray-800 bg-white hover:border-gray-300 shadow-2xs'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
          ) : isHovered ? (
            'Deixar de seguir'
          ) : (
            'Seguindo'
          )}
        </button>
      ) : effectiveIsPrivate ? (
        // State: PRIVATE ACCOUNT AND NOT FOLLOWING YET
        effectiveIsRequested ? (
          <button
            type="button"
            disabled={isLoading}
            onClick={handleButtonClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`${sizeClasses} font-semibold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 ${
              isHovered
                ? 'border-rose-300 text-rose-600 bg-rose-50/70 shadow-xs'
                : 'border-gray-200 text-gray-700 bg-gray-50 hover:border-gray-300 shadow-2xs'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
            ) : isHovered ? (
              'Cancelar solicitação'
            ) : (
              'Solicitado'
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled={isLoading}
            onClick={handleButtonClick}
            className={`${sizeClasses} font-semibold rounded-xl bg-[#548687] hover:bg-[#436e6f] text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-98`}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              'Solicitar'
            )}
          </button>
        )
      ) : followsMe ? (
        // State: FOLLOWS ME, BUT I DON'T FOLLOW BACK
        <button
          type="button"
          disabled={isLoading}
          onClick={handleButtonClick}
          className={`${sizeClasses} font-semibold rounded-xl border border-gray-300 bg-white text-gray-800 hover:border-[#548687] hover:text-[#548687] hover:bg-[#F0F6F6]/50 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-98`}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#548687]" />
          ) : (
            'Seguir de volta'
          )}
        </button>
      ) : (
        // State: DOES NOT FOLLOW
        <button
          type="button"
          disabled={isLoading}
          onClick={handleButtonClick}
          className={`${sizeClasses} font-semibold rounded-xl bg-[#548687] hover:bg-[#436e6f] text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-98`}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
          ) : (
            'Seguir'
          )}
        </button>
      )}

      {/* Unfollow Confirmation Modal */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setShowConfirmModal(false);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-xs w-full p-5 shadow-2xl border border-gray-100 text-center space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 mx-auto flex items-center justify-center font-bold text-lg">
              @
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-base">
                Deixar de seguir @{targetUsername}?
              </h4>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                As publicações e stories deste usuário não aparecerão mais em destaque no seu feed.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => executeFollowToggle(true)}
                disabled={isLoading}
                className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Deixar de seguir</span>
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isLoading}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
