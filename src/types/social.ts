import { UserProfile } from './user';

export type MediaType = 'text' | 'image' | 'video';

export interface PostCollaborator {
  usuario_id: string;
  usuario_username: string;
  usuario_displayName: string;
  usuario_photoURL?: string;
  status: 'pendente' | 'aceito' | 'recusado';
}

export interface StoryItem {
  id: string;
  authorUid: string;
  authorUsername: string;
  authorDisplayName: string;
  authorPhotoURL?: string;
  mediaType?: MediaType;
  mediaUrl?: string;
  caption?: string;
  bgColor?: string;
  videoDuration?: number;
  createdAt: string; // ISO string
  expiresAt: string; // ISO string
  viewers: string[]; // array of uids
  likes?: string[]; // array of uids
}

export interface UserStoriesGroup {
  authorUid: string;
  authorUsername: string;
  authorDisplayName: string;
  authorPhotoURL?: string;
  hasUnseen: boolean;
  isCurrentUser: boolean;
  stories: StoryItem[];
  latestCreatedAt: string;
}

export const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '🔥', '👏'] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];

export interface CurtidaItem {
  id: string; // ${postId}_${usuario_id}
  post_id: string;
  usuario_id: string;
  tipo: 'curtir' | 'reacao';
  emoji: ReactionEmoji | null;
  criado_em: string;
}

export interface VisualizacaoItem {
  id: string;
  post_id: string;
  usuario_id: string;
  criado_em: string;
}

export interface HashtagItem {
  id: string;
  nome: string; // único, sem o #, ex: "viagem"
  contagem_posts: number;
}

export interface PostHashtagItem {
  id: string;
  post_id: string;
  hashtag_id: string;
}

export interface MentionItem {
  id: string;
  post_id?: string | null;
  comentario_id?: string | null;
  usuario_mencionado_id: string;
  criado_em: string;
}

export interface PostItem {
  id: string;
  authorUid: string;
  authorUsername: string;
  authorDisplayName: string;
  authorPhotoURL?: string;
  content: string; // legenda
  hashtags?: string[]; // array de nomes de hashtags sem #
  mediaType?: MediaType; // tipo: "image" | "video" | "text"
  mediaUrls?: string[]; // midias: []
  mediaUrl?: string;
  thumbnailUrl?: string;
  videoDuration?: number;
  collaborators?: PostCollaborator[]; // colaboradores: [{ usuario_id, status: "pendente" | "aceito" | "recusado" }]
  createdAt: string; // criado_em: timestamp
  editado_em?: string; // timestamp de edição opcional
  likes: string[]; // likes
  likesCount?: number;
  reactionsSummary?: Record<string, number>; // { '❤️': 10, '🔥': 4, ... }
  userReactions?: Record<string, { tipo: 'curtir' | 'reacao'; emoji: ReactionEmoji | null }>;
  viewsCount?: number;
  commentsCount?: number;
}

export interface PostLikerProfile extends UserProfile {
  reactionType?: 'curtir' | 'reacao';
  reactionEmoji?: ReactionEmoji | null;
}

export interface UserRelationship {
  user: UserProfile;
  iFollow: boolean; // eu_sigo_essa_pessoa
  followsMe: boolean; // essa_pessoa_me_segue
  mutualFriendsCount: number; // amigos_em_comum_count
}

export interface CommentItem {
  id: string;
  post_id: string;
  autor_id: string;
  autor_username: string;
  autor_displayName?: string;
  autor_photoURL?: string;
  texto: string;
  comentario_pai_id: string | null; // null = comentário raiz, senão é resposta a outro comentário
  criado_em: string; // ISO string
  likes_count: number;
  liked_by?: string[]; // uids de quem curtiu
  resposta_para_username?: string; // username a quem se está respondendo
}

export type MessageContentType = 'texto' | 'imagem' | 'post_compartilhado';

export interface PostPreviewData {
  id: string;
  authorUid?: string;
  authorUsername: string;
  authorDisplayName?: string;
  authorPhotoURL?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: MediaType;
  likesCount?: number;
}

export interface ChatMessage {
  id: string;
  conversa_id: string;
  autor_id: string;
  autor_username?: string;
  tipo: MessageContentType;
  conteudo: string; // texto, URL de imagem, ou post_id
  criado_em: string;
  lida: boolean;
  post_preview?: PostPreviewData;
}

export type ConversationType = 'individual' | 'grupo';
export type ConversationStatus = 'ativa' | 'pendente' | 'bloqueada_permanente';

export interface ConversationItem {
  id: string;
  tipo: ConversationType;
  participantes: string[]; // array de uids dos participantes
  criado_em: string;
  status: ConversationStatus;
  nome_grupo?: string;
  foto_grupo?: string;
  solicitante_id?: string;
  destinatario_id?: string;
  ultima_mensagem?: {
    texto: string;
    autor_id: string;
    tipo?: MessageContentType;
    criado_em: string;
    lida: boolean;
  };
  atualizado_em: string;
}

export type NotificationType =
  | 'curtida_post'
  | 'comentario'
  | 'novo_seguidor'
  | 'convite_colaboracao'
  | 'curtida_comentario'
  | 'solicitacao_mensagem'
  | 'solicitacao_seguir'
  | 'mencao'
  | 'verificacao_aprovada'
  | 'verificacao_recusada';

export interface FollowRequestItem {
  id: string;
  solicitante_id: string;
  usuario_alvo_id: string;
  status: 'pendente' | 'aceita' | 'recusada';
  criado_em: string;
}

export interface NotificationItem {
  id: string;
  usuario_destinatario_id: string;
  usuario_origem_id: string; // quem gerou a ação (ex: quem curtiu)
  usuario_origem_username?: string;
  usuario_origem_displayName?: string;
  usuario_origem_photoURL?: string;
  tipo: NotificationType;
  post_id?: string | null;
  comentario_id?: string | null;
  conteudo_extra?: string | null; // e.g. snippet do comentário ou legenda
  emoji?: ReactionEmoji | null;
  lida: boolean;
  criado_em: string;
}

export interface AggregatedNotification {
  id: string; // Group ID
  tipo: NotificationType;
  post_id?: string | null;
  comentario_id?: string | null;
  emoji?: ReactionEmoji | null;
  usuario_origem_principal: {
    uid: string;
    username: string;
    displayName: string;
    photoURL?: string;
  };
  outros_usuarios_count: number; // e.g., 4 se forem 5 curtidas
  usuarios_origem: Array<{
    uid: string;
    username: string;
    displayName: string;
    photoURL?: string;
  }>;
  notificacao_ids: string[];
  todas_lidas: boolean;
  mais_recente_em: string;
  conteudo_extra?: string | null;
  post_preview?: {
    id: string;
    mediaUrl?: string;
    mediaType?: MediaType;
    content?: string;
  };
}

export type ReportTargetType = 'post' | 'comentario' | 'usuario' | 'story';

export type ReportReason =
  | 'nudez'
  | 'discurso_odio'
  | 'violencia'
  | 'bullying'
  | 'falso'
  | 'spam'
  | 'nao_gosto';

export interface ReportItem {
  id: string;
  denunciante_id: string;
  denunciado_id?: string;
  alvo_tipo: ReportTargetType;
  alvo_id: string;
  motivo: ReportReason;
  status: 'pendente' | 'revisada' | 'arquivada';
  criado_em: string;
}

export interface BlockItem {
  id: string;
  usuario_bloqueador_id: string;
  usuario_bloqueado_id: string;
  blockerFollowedBlocked?: boolean;
  blockedFollowedBlocker?: boolean;
  criado_em: string;
}



