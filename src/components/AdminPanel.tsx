import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, setDoc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { X, Check, AlertCircle, Loader2, Award, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { VerificationRequestItem } from '../types/user';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function AdminPanel({ isOpen, onClose, onShowToast }: AdminPanelProps) {
  const [requests, setRequests] = useState<VerificationRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendente' | 'aprovada' | 'recusada'>('pendente');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const q = query(
      collection(db, 'solicitacoes_verificacao'),
      orderBy('criado_em', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: VerificationRequestItem[] = [];
        snapshot.forEach((docSnap) => {
          loaded.push({ id: docSnap.id, ...docSnap.data() } as VerificationRequestItem);
        });
        setRequests(loaded);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching verification requests:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAction = async (request: VerificationRequestItem, action: 'aprovada' | 'recusada') => {
    setProcessingId(request.id);
    try {
      const now = new Date().toISOString();
      const reqRef = doc(db, 'solicitacoes_verificacao', request.id);
      const userRef = doc(db, 'users', request.usuario_id);

      // 1. Update verification request status
      await updateDoc(reqRef, {
        status: action,
        revisado_em: now,
      });

      // 2. Update user verificado status in users collection
      await updateDoc(userRef, {
        verificado: action === 'aprovada',
        updatedAt: now,
      });

      // 3. Create a nice real-time notification
      const notifRef = doc(collection(db, 'notificacoes'));
      await setDoc(notifRef, {
        id: notifRef.id,
        usuario_destinatario_id: request.usuario_id,
        usuario_origem_id: 'vybe_admin',
        usuario_origem_username: 'vybe',
        usuario_origem_displayName: 'Equipe VYBE',
        usuario_origem_photoURL: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&q=80',
        tipo: action === 'aprovada' ? 'verificacao_aprovada' : 'verificacao_recusada',
        lida: false,
        criado_em: now,
      });

      onShowToast?.(
        `Solicitação de @${request.username} foi ${action === 'aprovada' ? 'APROVADA' : 'RECUSADA'} com sucesso!`,
        'success'
      );
    } catch (err) {
      console.error('Error processing verification request:', err);
      onShowToast?.('Erro ao processar ação. Verifique as permissões ou tente novamente.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (filterStatus === 'todos') return true;
    return r.status === filterStatus;
  });

  return (
    <div
      id="admin-panel-modal"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center">
              <Award className="w-5.5 h-5.5 text-[#548687]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                Painel Administrativo: Selo de Verificado
              </h2>
              <p className="text-xs text-gray-500">
                Aprove ou recuse solicitações de verificação de perfis VYBE.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-gray-100 bg-white flex items-center gap-2 overflow-x-auto">
          {(['pendente', 'aprovada', 'recusada', 'todos'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer capitalize ${
                filterStatus === status
                  ? 'bg-[#548687] text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              {status === 'todos' ? 'Todas' : status} ({requests.filter(r => status === 'todos' ? true : r.status === status).length})
            </button>
          ))}
        </div>

        {/* Request List */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-3">
          {loading ? (
            <div className="py-20 text-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-[#548687] mx-auto" />
              <p className="text-xs text-gray-500">Carregando solicitações...</p>
            </div>
          ) : filteredRequests.length > 0 ? (
            filteredRequests.map((request) => {
              const initial =
                request.displayName?.[0]?.toUpperCase() ||
                request.username?.[0]?.toUpperCase() ||
                'V';

              return (
                <div
                  key={request.id}
                  className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#E1EEEE] text-[#426F70] flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 border border-gray-100">
                      {request.photoURL ? (
                        <img
                          src={request.photoURL}
                          alt={request.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{initial}</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900 text-sm">
                          {request.displayName || 'Sem nome'}
                        </span>
                        <span className="text-xs text-gray-400">
                          @{request.username}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Enviado em: {new Date(request.criado_em).toLocaleDateString('pt-BR')} às {new Date(request.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {request.status === 'pendente' ? (
                      <>
                        <button
                          type="button"
                          disabled={processingId !== null}
                          onClick={() => handleAction(request, 'recusada')}
                          className="px-4 py-2 hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {processingId === request.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <X className="w-3.5 h-3.5 stroke-[2.5]" />
                          )}
                          <span>Recusar</span>
                        </button>
                        <button
                          type="button"
                          disabled={processingId !== null}
                          onClick={() => handleAction(request, 'aprovada')}
                          className="px-4 py-2 bg-[#548687] hover:bg-[#436e6f] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                        >
                          {processingId === request.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          )}
                          <span>Aprovar</span>
                        </button>
                      </>
                    ) : (
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase select-none ${
                          request.status === 'aprovada'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}
                      >
                        {request.status === 'aprovada' ? 'Aprovada' : 'Recusada'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200 space-y-2">
              <ShieldAlert className="w-8 h-8 text-gray-300 mx-auto" />
              <h3 className="font-bold text-gray-800 text-sm">Nenhuma solicitação encontrada</h3>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                Não há registros com o status "{filterStatus === 'todos' ? 'qualquer' : filterStatus}" no momento.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
