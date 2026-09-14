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
}
