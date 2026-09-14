export interface UserNotificationPreferences {
  likes?: boolean;
  comments?: boolean;
  followers?: boolean;
  messages?: boolean;
  collab?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  birthDate: string;
  country: string;
  photoURL?: string;
  bio?: string;
  location?: string;
  isPrivate?: boolean;
  conta_privada?: boolean;
  dmPermission?: 'everyone' | 'following';
  storyViewsPermission?: 'everyone' | 'following' | 'nobody';
  notificationPreferences?: UserNotificationPreferences;
  twoFactorEnabled?: boolean;
  blockedUsers?: string[];
  createdAt: string;
  updatedAt?: string;
  verificado?: boolean;
  eh_admin?: boolean;
  conta_criador?: boolean;
  onboarding_concluido?: boolean;
}

export interface VerificationRequestItem {
  id: string;
  usuario_id: string;
  status: 'pendente' | 'aprovada' | 'recusada';
  criado_em: string;
  revisado_em?: string;
  // Denormalized user info for the admin list
  username?: string;
  displayName?: string;
  photoURL?: string;
}
