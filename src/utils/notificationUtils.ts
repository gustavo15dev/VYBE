import { NotificationItem, AggregatedNotification } from '../types/social';

/**
 * Formats relative time according to mockup:
 * e.g., '20min', '1h', '3h', '2d', '4d', '1sem', '2m'
 */
export function formatNotificationTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'agora';

    const diffMin = Math.floor(diffMs / (1000 * 60));
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;

    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 5) return `${diffWeeks}sem`;

    const diffMonths = Math.floor(diffDays / 30);
    return `${Math.max(1, diffMonths)}m`;
  } catch {
    return '';
  }
}

/**
 * Aggregates notifications:
 * - If multiple users liked the same post -> "carlos_v e mais 4 curtiram sua publicação"
 * - If multiple users liked the same comment -> "carlos_v e mais 8 curtiram seu comentário"
 * - If multiple users commented on the same post -> "carlos_v e mais 2 comentaram na sua publicação"
 * - New followers, collab invitations, and message solicitations remain individual or distinct.
 */
export function aggregateNotifications(
  rawList: NotificationItem[]
): AggregatedNotification[] {
  if (!rawList || rawList.length === 0) return [];

  const groupMap = new Map<string, NotificationItem[]>();

  // Process in chronological order (or reverse) to group
  for (const item of rawList) {
    let key = '';

    if (item.tipo === 'curtida_post' && item.post_id) {
      key = `curtida_post_${item.post_id}`;
    } else if (item.tipo === 'curtida_comentario' && item.comentario_id) {
      key = `curtida_comentario_${item.comentario_id}`;
    } else if (item.tipo === 'comentario' && item.post_id) {
      // Group multiple comments on the same post if without distinct snippet or by post
      key = `comentario_${item.post_id}`;
    } else if (item.tipo === 'novo_seguidor') {
      key = `novo_seguidor_${item.usuario_origem_id}`;
    } else if (item.tipo === 'convite_colaboracao') {
      key = `convite_colaboracao_${item.post_id || ''}_${item.usuario_origem_id}`;
    } else if (item.tipo === 'solicitacao_mensagem') {
      key = `solicitacao_mensagem_${item.usuario_origem_id}`;
    } else {
      key = `single_${item.id}`;
    }

    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(item);
  }

  const aggregatedList: AggregatedNotification[] = [];

  groupMap.forEach((items, groupKey) => {
    // Sort items newest first
    const sorted = [...items].sort(
      (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
    );

    const newest = sorted[0];

    // Collect unique authors in the group
    const uniqueUsersMap = new Map<
      string,
      { uid: string; username: string; displayName: string; photoURL?: string }
    >();

    for (const it of sorted) {
      if (!uniqueUsersMap.has(it.usuario_origem_id)) {
        uniqueUsersMap.set(it.usuario_origem_id, {
          uid: it.usuario_origem_id,
          username: it.usuario_origem_username || 'usuario',
          displayName:
            it.usuario_origem_displayName ||
            it.usuario_origem_username ||
            'Usuário',
          photoURL: it.usuario_origem_photoURL,
        });
      }
    }

    const uniqueUsers = Array.from(uniqueUsersMap.values());
    const principalUser = uniqueUsers[0] || {
      uid: newest.usuario_origem_id,
      username: newest.usuario_origem_username || 'usuario',
      displayName: newest.usuario_origem_displayName || 'Usuário',
      photoURL: newest.usuario_origem_photoURL,
    };

    const othersCount = Math.max(0, uniqueUsers.length - 1);
    const allRead = sorted.every((it) => it.lida === true);

    aggregatedList.push({
      id: groupKey,
      tipo: newest.tipo,
      post_id: newest.post_id,
      comentario_id: newest.comentario_id,
      emoji: newest.emoji || null,
      usuario_origem_principal: principalUser,
      outros_usuarios_count: othersCount,
      usuarios_origem: uniqueUsers,
      notificacao_ids: sorted.map((s) => s.id),
      todas_lidas: allRead,
      mais_recente_em: newest.criado_em,
      conteudo_extra: newest.conteudo_extra,
    });
  });

  // Sort overall aggregated list by newest timestamp
  return aggregatedList.sort(
    (a, b) =>
      new Date(b.mais_recente_em).getTime() -
      new Date(a.mais_recente_em).getTime()
  );
}

export interface DateGroupedNotifications {
  hoje: AggregatedNotification[];
  estaSemana: AggregatedNotification[];
  maisAntigas: AggregatedNotification[];
}

/**
 * Groups aggregated notifications into date sections:
 * - HOJE (< 24h)
 * - ESTA SEMANA (24h - 7d)
 * - MAIS ANTIGAS (> 7d)
 */
export function groupNotificationsByDate(
  aggregatedList: AggregatedNotification[]
): DateGroupedNotifications {
  const result: DateGroupedNotifications = {
    hoje: [],
    estaSemana: [],
    maisAntigas: [],
  };

  const now = new Date().getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

  for (const item of aggregatedList) {
    const itemTime = new Date(item.mais_recente_em).getTime();
    const diff = now - itemTime;

    if (diff <= ONE_DAY_MS) {
      result.hoje.push(item);
    } else if (diff <= SEVEN_DAYS_MS) {
      result.estaSemana.push(item);
    } else {
      result.maisAntigas.push(item);
    }
  }

  return result;
}
