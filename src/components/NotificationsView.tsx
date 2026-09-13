import React, { useState, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  UserPlus,
  Users,
  Mail,
  AtSign,
  CheckCheck,
  Loader2,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  NotificationItem,
  AggregatedNotification,
  PostItem,
} from '../types/social';
import {
  subscribeNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  toggleFollowUser,
  respondToCollaborationInvite,
  getPostById,
} from '../services/socialService';
import {
  aggregateNotifications,
  groupNotificationsByDate,
  formatNotificationTime,
} from '../utils/notificationUtils';

interface NotificationsViewProps {
  myFollowing: Set<string>;
  onSelectUser?: (uid: string) => void;
  onOpenPostDetail?: (post: PostItem) => void;
  onNavigateMessages?: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function NotificationsView({
  myFollowing,
  onSelectUser,
  onOpenPostDetail,
  onNavigateMessages,
  onShowToast,
}: NotificationsViewProps) {
  const { user, profile } = useAuth();
  const [rawNotifications, setRawNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsMap, setPostsMap] = useState<Record<string, PostItem | null>>({});
  const [collabStatusMap, setCollabStatusMap] = useState<
    Record<string, 'aceito' | 'recusado' | 'pendente'>
  >({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // 1. Subscribe to real-time notifications
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeNotifications(user.uid, (notifs) => {
      setRawNotifications(notifs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // 2. Aggregate notifications
  const aggregated = React.useMemo(() => {
    return aggregateNotifications(rawNotifications);
  }, [rawNotifications]);

  // 3. Group by date: HOJE, ESTA SEMANA, MAIS ANTIGAS
  const dateGroups = React.useMemo(() => {
    return groupNotificationsByDate(aggregated);
  }, [aggregated]);

  // 4. Load post thumbnails for notifications with post_id
  useEffect(() => {
    const postIdsToFetch = new Set<string>();
    for (const notif of aggregated) {
      if (notif.post_id && !postsMap[notif.post_id] && postsMap[notif.post_id] !== null) {
        postIdsToFetch.add(notif.post_id);
      }
    }

    if (postIdsToFetch.size === 0) return;

    postIdsToFetch.forEach(async (pId) => {
      try {
        const post = await getPostById(pId);
        setPostsMap((prev) => ({ ...prev, [pId]: post }));
      } catch {
        setPostsMap((prev) => ({ ...prev, [pId]: null }));
      }
    });
  }, [aggregated, postsMap]);

  // Mark all as read handler
  const handleMarkAllAsRead = async () => {
    if (rawNotifications.length === 0) return;
    const unreadIds = rawNotifications.filter((n) => !n.lida).map((n) => n.id);
    if (unreadIds.length === 0) {
      onShowToast?.('Todas as notificações já estão lidas.', 'info');
      return;
    }

    try {
      await markAllNotificationsAsRead(unreadIds);
      onShowToast?.('Notificações marcadas como lidas.', 'success');
    } catch (e) {
      console.error('Error marking all notifications as read:', e);
      onShowToast?.('Erro ao marcar como lidas.', 'error');
    }
  };

  // Click on a notification row
  const handleNotificationClick = async (group: AggregatedNotification) => {
    // Mark as read if not read
    if (!group.todas_lidas) {
      markAllNotificationsAsRead(group.notificacao_ids).catch(() => {});
    }

    // Handle navigation depending on type
    if (group.tipo === 'solicitacao_mensagem') {
      onNavigateMessages?.();
      return;
    }

    if ((group.tipo === 'curtida_post' || group.tipo === 'comentario' || group.tipo === 'curtida_comentario') && group.post_id) {
      const post = postsMap[group.post_id];
      if (post && onOpenPostDetail) {
        onOpenPostDetail(post);
      } else if (group.post_id) {
        // Fetch and open
        try {
          const fetched = await getPostById(group.post_id);
          if (fetched && onOpenPostDetail) {
            onOpenPostDetail(fetched);
          }
        } catch {
          onShowToast?.('Publicação não encontrada.', 'info');
        }
      }
      return;
    }

    if (group.tipo === 'novo_seguidor') {
      onSelectUser?.(group.usuario_origem_principal.uid);
      return;
    }
  };

  // Follow back action
  const handleFollowToggle = async (
    e: React.MouseEvent,
    targetUid: string,
    isCurrentlyFollowing: boolean
  ) => {
    e.stopPropagation();
    if (!user?.uid) return;

    try {
      setActionLoadingId(targetUid);
      await toggleFollowUser(user.uid, targetUid, isCurrentlyFollowing, profile || undefined);
      if (!isCurrentlyFollowing) {
        onShowToast?.('Você começou a seguir este usuário.', 'success');
      } else {
        onShowToast?.('Você deixou de seguir este usuário.', 'info');
      }
    } catch (err) {
      console.error('Error toggling follow from notification:', err);
      onShowToast?.('Erro ao atualizar seguidor.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Respond to collab invitation
  const handleCollabResponse = async (
    e: React.MouseEvent,
    group: AggregatedNotification,
    response: 'aceito' | 'recusado'
  ) => {
    e.stopPropagation();
    if (!user?.uid || !group.post_id) return;

    try {
      setActionLoadingId(group.id);
      await respondToCollaborationInvite(group.post_id, user.uid, response);
      setCollabStatusMap((prev) => ({ ...prev, [group.id]: response }));
      markAllNotificationsAsRead(group.notificacao_ids).catch(() => {});

      if (response === 'aceito') {
        onShowToast?.('Convite de colaboração aceito com sucesso!', 'success');
      } else {
        onShowToast?.('Convite de colaboração recusado.', 'info');
      }
    } catch (err: any) {
      console.error('Error responding to collab:', err);
      const msg = err?.message || 'Erro ao responder convite de colaboração.';
      onShowToast?.(msg, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Render overlay icon badge on avatar
  const renderAvatarBadge = (tipo: NotificationItem['tipo']) => {
    switch (tipo) {
      case 'curtida_post':
      case 'curtida_comentario':
        return (
          <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-[#0F4C5C] text-white flex items-center justify-center border-1.5 border-white shadow-xs">
            <Heart className="w-2.5 h-2.5 fill-white" />
          </span>
        );
      case 'comentario':
        return (
          <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-[#548687] text-white flex items-center justify-center border-1.5 border-white shadow-xs">
            <MessageCircle className="w-2.5 h-2.5 fill-white stroke-[1.5]" />
          </span>
        );
      case 'novo_seguidor':
        return (
          <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-[#548687] text-white flex items-center justify-center border-1.5 border-white shadow-xs">
            <UserPlus className="w-2.5 h-2.5 stroke-[2.5]" />
          </span>
        );
      case 'convite_colaboracao':
        return (
          <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-[#274647] text-white flex items-center justify-center border-1.5 border-white shadow-xs">
            <Users className="w-2.5 h-2.5 stroke-[2.5]" />
          </span>
        );
      case 'solicitacao_mensagem':
        return (
          <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-[#45B6B0] text-white flex items-center justify-center border-1.5 border-white shadow-xs">
            <Mail className="w-2.5 h-2.5 stroke-[2.5]" />
          </span>
        );
      case 'mencao':
        return (
          <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-[#548687] text-white flex items-center justify-center border-1.5 border-white shadow-xs">
            <AtSign className="w-2.5 h-2.5 stroke-[2.5]" />
          </span>
        );
      default:
        return null;
    }
  };

  // Render individual notification row
  const renderNotificationItem = (group: AggregatedNotification) => {
    const principal = group.usuario_origem_principal;
    const authorInit =
      principal.displayName?.[0]?.toUpperCase() ||
      principal.username?.[0]?.toUpperCase() ||
      'U';
    const isFollowingPrincipal = myFollowing.has(principal.uid);
    const postData = group.post_id ? postsMap[group.post_id] : null;
    const collabStatus = collabStatusMap[group.id];

    return (
      <div
        key={group.id}
        id={`notif-item-${group.id}`}
        onClick={() => handleNotificationClick(group)}
        className={`group flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl transition-all cursor-pointer ${
          !group.todas_lidas
            ? 'bg-[#F2F7F7]/90 hover:bg-[#EAF2F2] border border-[#548687]/15'
            : 'bg-[#F8FAFA] hover:bg-[#F1F5F5] border border-gray-100/80'
        }`}
      >
        {/* Left Side: Avatar + Text */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Avatar with icon badge */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectUser?.(principal.uid);
              }}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#548687] text-white flex items-center justify-center font-bold text-sm sm:text-base overflow-hidden hover:opacity-90 transition-opacity cursor-pointer"
            >
              {principal.photoURL ? (
                <img
                  src={principal.photoURL}
                  alt={principal.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{authorInit}</span>
              )}
            </button>
            {renderAvatarBadge(group.tipo)}
          </div>

          {/* Description text */}
          <div className="text-xs sm:text-sm text-gray-800 leading-snug min-w-0 flex-1">
            <span
              onClick={(e) => {
                e.stopPropagation();
                onSelectUser?.(principal.uid);
              }}
              className="font-bold text-gray-900 hover:text-[#548687] transition-colors cursor-pointer"
            >
              {principal.username}
            </span>

            {/* If aggregated multiple users */}
            {group.outros_usuarios_count > 0 && (
              <span className="font-semibold text-gray-800">
                {' '}
                e mais {group.outros_usuarios_count}
              </span>
            )}

            {/* Action text per type */}
            {group.tipo === 'curtida_post' && (
              <span>
                {group.outros_usuarios_count > 0
                  ? ' curtiram sua publicação'
                  : ' curtiu sua publicação'}
              </span>
            )}

            {group.tipo === 'curtida_comentario' && (
              <span>
                {group.outros_usuarios_count > 0
                  ? ' curtiram seu comentário'
                  : ' curtiu seu comentário'}
              </span>
            )}

            {group.tipo === 'comentario' && (
              <span>
                {group.outros_usuarios_count > 0
                  ? ' comentaram na sua publicação'
                  : group.conteudo_extra
                  ? `: "${group.conteudo_extra}"`
                  : ' comentou na sua publicação'}
              </span>
            )}

            {group.tipo === 'novo_seguidor' && (
              <span> começou a seguir você</span>
            )}

            {group.tipo === 'convite_colaboracao' && (
              <span> te convidou como colaborador</span>
            )}

            {group.tipo === 'solicitacao_mensagem' && (
              <span> quer te enviar uma mensagem</span>
            )}

            {group.tipo === 'mencao' && (
              <span> mencionou você</span>
            )}

            {/* Time */}
            <span className="text-gray-400 font-normal ml-1 whitespace-nowrap">
              · {formatNotificationTime(group.mais_recente_em)}
            </span>
          </div>
        </div>

        {/* Right Side: Action Button or Media Thumbnail */}
        <div className="shrink-0 flex items-center gap-2">
          {/* 1. Novo Seguidor Action Button */}
          {group.tipo === 'novo_seguidor' && (
            <button
              id={`btn-follow-notif-${principal.uid}`}
              type="button"
              disabled={actionLoadingId === principal.uid}
              onClick={(e) =>
                handleFollowToggle(e, principal.uid, isFollowingPrincipal)
              }
              className={`px-4 py-1.5 rounded-xl font-semibold text-xs sm:text-sm transition-all cursor-pointer shadow-2xs ${
                isFollowingPrincipal
                  ? 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  : 'bg-[#548687] hover:bg-[#457273] text-white hover:shadow-sm'
              }`}
            >
              {actionLoadingId === principal.uid ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isFollowingPrincipal ? (
                'Seguindo'
              ) : (
                'Seguir'
              )}
            </button>
          )}

          {/* 2. Convite de Colaboração Action Buttons */}
          {group.tipo === 'convite_colaboracao' && (
            <div className="flex items-center gap-1.5">
              {collabStatus === 'aceito' ? (
                <span className="text-xs font-semibold text-[#548687] bg-teal-50 border border-teal-200/80 px-3 py-1 rounded-xl">
                  Aceito
                </span>
              ) : collabStatus === 'recusado' ? (
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-xl">
                  Recusado
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={actionLoadingId === group.id}
                    onClick={(e) => handleCollabResponse(e, group, 'recusado')}
                    className="px-3 sm:px-3.5 py-1.5 rounded-xl font-medium text-xs sm:text-sm bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Recusar
                  </button>
                  <button
                    type="button"
                    disabled={actionLoadingId === group.id}
                    onClick={(e) => handleCollabResponse(e, group, 'aceito')}
                    className="px-3 sm:px-3.5 py-1.5 rounded-xl font-semibold text-xs sm:text-sm bg-[#548687] hover:bg-[#457273] text-white transition-colors cursor-pointer shadow-2xs"
                  >
                    Aceitar
                  </button>
                </>
              )}
            </div>
          )}

          {/* 3. Post / Comment Thumbnail Miniature */}
          {(group.tipo === 'curtida_post' ||
            group.tipo === 'comentario' ||
            group.tipo === 'curtida_comentario') && (
            <div
              onClick={() => {
                if (postData && onOpenPostDetail) {
                  onOpenPostDetail(postData);
                }
              }}
              title="Ver publicação"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gray-100 border border-gray-200/90 overflow-hidden shrink-0 flex items-center justify-center hover:opacity-85 transition-opacity"
            >
              {postData?.mediaUrl ? (
                <img
                  src={postData.mediaUrl}
                  alt="Post"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full p-1 bg-[#F1F5F5] flex items-center justify-center text-[9px] text-gray-500 text-center font-medium line-clamp-2">
                  {postData?.content || 'Post'}
                </div>
              )}
            </div>
          )}

          {/* 4. Solicitacao de Mensagem */}
          {group.tipo === 'solicitacao_mensagem' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateMessages?.();
              }}
              className="px-3.5 py-1.5 rounded-xl font-semibold text-xs sm:text-sm bg-[#548687] hover:bg-[#457273] text-white transition-colors cursor-pointer shadow-2xs"
            >
              Ver chat
            </button>
          )}
        </div>
      </div>
    );
  };

  const hasAnyNotifications =
    dateGroups.hoje.length > 0 ||
    dateGroups.estaSemana.length > 0 ||
    dateGroups.maisAntigas.length > 0;

  const unreadCount = rawNotifications.filter((n) => !n.lida).length;

  return (
    <div className="flex-1 max-w-2xl mx-auto py-6 px-4 sm:px-6">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Notificações
          </h1>
          {unreadCount > 0 && (
            <p className="text-xs sm:text-sm text-[#548687] font-medium mt-0.5">
              Você tem {unreadCount} {unreadCount === 1 ? 'notificação nova' : 'notificações novas'}
            </p>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#548687] hover:text-[#457273] bg-[#F1F5F5] hover:bg-[#E8EFF0] px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Marcar como lidas</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#548687]" />
          <p className="text-sm font-medium text-gray-500">
            Carregando suas notificações...
          </p>
        </div>
      ) : !hasAnyNotifications ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-[#F1F5F5] text-[#548687] flex items-center justify-center mb-4">
            <Heart className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-semibold text-gray-800 mb-1">
            Nenhuma notificação por enquanto
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 max-w-sm">
            Quando outros usuários curtirem suas publicações, comentarem, seguirem
            você ou te convidarem para colaborar, as novidades aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* HOJE Section */}
          {dateGroups.hoje.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5 px-1">
                HOJE
              </h2>
              <div className="space-y-2">
                {dateGroups.hoje.map(renderNotificationItem)}
              </div>
            </div>
          )}

          {/* ESTA SEMANA Section */}
          {dateGroups.estaSemana.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5 px-1">
                ESTA SEMANA
              </h2>
              <div className="space-y-2">
                {dateGroups.estaSemana.map(renderNotificationItem)}
              </div>
            </div>
          )}

          {/* MAIS ANTIGAS Section */}
          {dateGroups.maisAntigas.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5 px-1">
                MAIS ANTIGAS
              </h2>
              <div className="space-y-2">
                {dateGroups.maisAntigas.map(renderNotificationItem)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
