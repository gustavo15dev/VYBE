import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, UserNotificationPreferences } from '../types/user';
import {
  updateUserProfile,
  isUsernameAvailable,
  changeUserPassword,
} from '../services/authService';
import { blockUser as blockUserSocial, unblockUser as unblockUserSocial } from '../services/socialService';
import { optimizeImage } from '../utils/mediaOptimizer';
import {
  User,
  Lock,
  Bell,
  Shield,
  Ban,
  LogOut,
  Camera,
  Check,
  Loader2,
  X,
  AlertCircle,
  Upload,
  CheckCircle2,
  KeyRound,
  Smartphone,
  MessageCircle,
  Heart,
  Users,
  Eye,
  UserX,
} from 'lucide-react';

export type SettingsTab =
  | 'profile'
  | 'privacy'
  | 'notifications'
  | 'security'
  | 'blocked';

interface SettingsViewProps {
  currentUserProfile: UserProfile;
  allUsers: UserProfile[];
  initialTab?: SettingsTab;
  onProfileUpdated: (updated: UserProfile) => void;
  onLogoutRequested: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function SettingsView({
  currentUserProfile,
  allUsers,
  initialTab = 'profile',
  onProfileUpdated,
  onLogoutRequested,
  onShowToast,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // Profile Edit State
  const [displayName, setDisplayName] = useState(currentUserProfile.displayName || '');
  const [username, setUsername] = useState(currentUserProfile.username || '');
  const [bio, setBio] = useState(currentUserProfile.bio || '');
  const [location, setLocation] = useState(currentUserProfile.location || '');
  const [photoURL, setPhotoURL] = useState(currentUserProfile.photoURL || '');

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Privacy State
  const [isPrivate, setIsPrivate] = useState<boolean>(currentUserProfile.isPrivate ?? false);
  const [dmPermission, setDmPermission] = useState<'everyone' | 'following'>(
    currentUserProfile.dmPermission || 'everyone'
  );
  const [storyViewsPermission, setStoryViewsPermission] = useState<'everyone' | 'following' | 'nobody'>(
    currentUserProfile.storyViewsPermission || 'everyone'
  );

  // Notifications State
  const [notifPrefs, setNotifPrefs] = useState<UserNotificationPreferences>({
    likes: currentUserProfile.notificationPreferences?.likes ?? true,
    comments: currentUserProfile.notificationPreferences?.comments ?? true,
    followers: currentUserProfile.notificationPreferences?.followers ?? true,
    messages: currentUserProfile.notificationPreferences?.messages ?? true,
    collab: currentUserProfile.notificationPreferences?.collab ?? true,
  });

  // Security State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(currentUserProfile.twoFactorEnabled ?? false);

  // Blocked Users State
  const [blockedUids, setBlockedUids] = useState<string[]>(currentUserProfile.blockedUsers || []);
  const [blockInput, setBlockInput] = useState('');
  const [blockingUser, setBlockingUser] = useState(false);

  // General Loading & Logout Modal State
  const [saving, setSaving] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync profile when currentUserProfile changes
  useEffect(() => {
    setDisplayName(currentUserProfile.displayName || '');
    setUsername(currentUserProfile.username || '');
    setBio(currentUserProfile.bio || '');
    setLocation(currentUserProfile.location || '');
    setPhotoURL(currentUserProfile.photoURL || '');
    setIsPrivate(currentUserProfile.isPrivate ?? false);
    setDmPermission(currentUserProfile.dmPermission || 'everyone');
    setStoryViewsPermission(currentUserProfile.storyViewsPermission || 'everyone');
    setNotifPrefs({
      likes: currentUserProfile.notificationPreferences?.likes ?? true,
      comments: currentUserProfile.notificationPreferences?.comments ?? true,
      followers: currentUserProfile.notificationPreferences?.followers ?? true,
      messages: currentUserProfile.notificationPreferences?.messages ?? true,
      collab: currentUserProfile.notificationPreferences?.collab ?? true,
    });
    setTwoFactorEnabled(currentUserProfile.twoFactorEnabled ?? false);
    setBlockedUids(currentUserProfile.blockedUsers || []);
  }, [currentUserProfile]);

  // Debounced real-time username validation
  useEffect(() => {
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');

    // If username hasn't changed from original profile username, mark valid
    if (cleanUsername === currentUserProfile.username.toLowerCase()) {
      setUsernameStatus('idle');
      setUsernameError(null);
      return;
    }

    if (!cleanUsername) {
      setUsernameStatus('invalid');
      setUsernameError('Nome de usuário não pode ficar em branco.');
      return;
    }

    // Rules: only letters, numbers, dot, underscore, no spaces
    const validPattern = /^[a-z0-9._]+$/;
    if (!validPattern.test(cleanUsername)) {
      setUsernameStatus('invalid');
      setUsernameError('Apenas letras minúsculas, números, ponto (.) e underline (_).');
      return;
    }

    if (cleanUsername.length < 3) {
      setUsernameStatus('invalid');
      setUsernameError('O nome de usuário deve ter pelo menos 3 caracteres.');
      return;
    }

    setUsernameStatus('checking');
    setUsernameError(null);

    const timer = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(cleanUsername);
        if (available) {
          setUsernameStatus('available');
          setUsernameError(null);
        } else {
          setUsernameStatus('taken');
          setUsernameError('Este nome de usuário já está em uso.');
        }
      } catch (err) {
        console.error('Error checking username availability:', err);
        setUsernameStatus('idle');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, currentUserProfile.username]);

  // Check if profile tab has changes
  const hasProfileChanges =
    displayName.trim() !== (currentUserProfile.displayName || '') ||
    username.trim().toLowerCase().replace(/^@/, '') !== currentUserProfile.username.toLowerCase() ||
    bio.trim() !== (currentUserProfile.bio || '') ||
    location.trim() !== (currentUserProfile.location || '') ||
    photoURL !== (currentUserProfile.photoURL || '');

  // Check if privacy tab has changes
  const hasPrivacyChanges =
    isPrivate !== (currentUserProfile.isPrivate ?? false) ||
    dmPermission !== (currentUserProfile.dmPermission || 'everyone') ||
    storyViewsPermission !== (currentUserProfile.storyViewsPermission || 'everyone');

  // Check if notifications tab has changes
  const hasNotifChanges =
    notifPrefs.likes !== (currentUserProfile.notificationPreferences?.likes ?? true) ||
    notifPrefs.comments !== (currentUserProfile.notificationPreferences?.comments ?? true) ||
    notifPrefs.followers !== (currentUserProfile.notificationPreferences?.followers ?? true) ||
    notifPrefs.messages !== (currentUserProfile.notificationPreferences?.messages ?? true) ||
    notifPrefs.collab !== (currentUserProfile.notificationPreferences?.collab ?? true);

  // Check if security tab has changes (e.g. 2FA)
  const hasSecurityChanges =
    twoFactorEnabled !== (currentUserProfile.twoFactorEnabled ?? false);

  // Overall changes state for currently active tab
  const canSave = (() => {
    if (saving) return false;
    if (activeTab === 'profile') {
      return (
        hasProfileChanges &&
        usernameStatus !== 'checking' &&
        usernameStatus !== 'taken' &&
        usernameStatus !== 'invalid'
      );
    }
    if (activeTab === 'privacy') return hasPrivacyChanges;
    if (activeTab === 'notifications') return hasNotifChanges;
    if (activeTab === 'security') return hasSecurityChanges;
    return false;
  })();

  // Handle Image Upload with Compression
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onShowToast?.('Por favor escolha uma imagem válida (JPG, PNG ou WEBP).', 'error');
      return;
    }

    try {
      const compressed = await optimizeImage(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.85,
        mimeType: 'image/jpeg',
      });
      setPhotoURL(compressed);
      onShowToast?.('Imagem selecionada!', 'info');
    } catch (err) {
      console.error('Failed to process image:', err);
      onShowToast?.('Erro ao processar imagem.', 'error');
    }
  };

  // Submit Save Changes for current tab
  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      if (activeTab === 'profile') {
        const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
        const updated = await updateUserProfile(
          currentUserProfile.uid,
          {
            displayName: displayName.trim(),
            username: cleanUsername,
            bio: bio.trim(),
            location: location.trim(),
            photoURL,
          },
          currentUserProfile.username
        );
        onProfileUpdated(updated);
        onShowToast?.('Perfil atualizado com sucesso!', 'success');
      } else if (activeTab === 'privacy') {
        const updated = await updateUserProfile(currentUserProfile.uid, {
          isPrivate,
          conta_privada: isPrivate,
          dmPermission,
          storyViewsPermission,
        });
        onProfileUpdated(updated);
        onShowToast?.('Configurações de privacidade salvas!', 'success');
      } else if (activeTab === 'notifications') {
        const updated = await updateUserProfile(currentUserProfile.uid, {
          notificationPreferences: notifPrefs,
        });
        onProfileUpdated(updated);
        onShowToast?.('Preferências de notificação salvas!', 'success');
      } else if (activeTab === 'security') {
        const updated = await updateUserProfile(currentUserProfile.uid, {
          twoFactorEnabled,
        });
        onProfileUpdated(updated);
        onShowToast?.('Configurações de segurança salvas!', 'success');
      }
    } catch (err: any) {
      console.error('Error saving settings:', err);
      onShowToast?.(err.message || 'Erro ao salvar alterações.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Handle Change Password
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError('Digite a sua senha atual.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('A confirmação de senha não confere.');
      return;
    }

    setChangingPassword(true);
    try {
      await changeUserPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onShowToast?.('Sua senha foi alterada com sucesso!', 'success');
    } catch (err: any) {
      console.error('Password change error:', err);
      setPasswordError(err.message || 'Falha ao alterar a senha.');
    } finally {
      setChangingPassword(false);
    }
  };

  // Handle Unblock User
  const handleUnblock = async (uidToUnblock: string) => {
    try {
      await unblockUserSocial(currentUserProfile.uid, uidToUnblock);
      const updatedList = blockedUids.filter((id) => id !== uidToUnblock);
      setBlockedUids(updatedList);
      onProfileUpdated({
        ...currentUserProfile,
        blockedUsers: updatedList,
      });
      onShowToast?.('Usuário desbloqueado com sucesso.', 'success');
    } catch (err: any) {
      console.error('Error unblocking user:', err);
      onShowToast?.('Erro ao desbloquear usuário.', 'error');
    }
  };

  // Handle Block User by input handle
  const handleAddBlockUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const handleToBlock = blockInput.trim().toLowerCase().replace(/^@/, '');
    if (!handleToBlock) return;

    const targetUser = allUsers.find(
      (u) => u.username.toLowerCase() === handleToBlock
    );

    if (!targetUser) {
      onShowToast?.(`Usuário @${handleToBlock} não foi encontrado.`, 'error');
      return;
    }

    if (targetUser.uid === currentUserProfile.uid) {
      onShowToast?.('Você não pode bloquear a si mesmo.', 'error');
      return;
    }

    if (blockedUids.includes(targetUser.uid)) {
      onShowToast?.(`@${handleToBlock} já está na sua lista de bloqueados.`, 'info');
      return;
    }

    setBlockingUser(true);
    try {
      await blockUserSocial(currentUserProfile.uid, targetUser.uid);
      const updatedList = [...blockedUids, targetUser.uid];
      setBlockedUids(updatedList);
      onProfileUpdated({
        ...currentUserProfile,
        blockedUsers: updatedList,
      });
      setBlockInput('');
      onShowToast?.(`@${targetUser.username} foi bloqueado com sucesso.`, 'success');
    } catch (err: any) {
      console.error('Error blocking user:', err);
      onShowToast?.('Erro ao bloquear usuário.', 'error');
    } finally {
      setBlockingUser(false);
    }
  };

  // Blocked users list
  const blockedUsersList = allUsers.filter((u) => blockedUids.includes(u.uid));

  const avatarInitial =
    displayName[0]?.toUpperCase() || username[0]?.toUpperCase() || 'V';

  return (
    <div id="settings-view-container" className="flex-1 max-w-5xl mx-auto py-8 px-4 sm:px-8">
      {/* 2-Column Layout matching image.png (Sidebar + Content Card) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* LEFT MENU (CONFIGURAÇÕES) */}
        <div className="md:col-span-4 lg:col-span-3 space-y-4">
          <div className="px-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              CONFIGURAÇÕES
            </h2>
          </div>

          <nav className="space-y-1">
            {/* 1. Editar perfil */}
            <button
              id="settings-tab-profile"
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer text-left ${
                activeTab === 'profile'
                  ? 'bg-[#F1F5F5] text-gray-900 font-semibold shadow-2xs'
                  : 'text-gray-700 hover:bg-[#F8FAFA] hover:text-gray-900 font-medium'
              }`}
            >
              <User
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'profile' ? 'text-[#548687] stroke-[2.2]' : 'text-gray-500'
                }`}
              />
              <span>Editar perfil</span>
            </button>

            {/* 2. Privacidade */}
            <button
              id="settings-tab-privacy"
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer text-left ${
                activeTab === 'privacy'
                  ? 'bg-[#F1F5F5] text-gray-900 font-semibold shadow-2xs'
                  : 'text-gray-700 hover:bg-[#F8FAFA] hover:text-gray-900 font-medium'
              }`}
            >
              <Lock
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'privacy' ? 'text-[#548687] stroke-[2.2]' : 'text-gray-500'
                }`}
              />
              <span>Privacidade</span>
            </button>

            {/* 3. Notificações */}
            <button
              id="settings-tab-notifications"
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer text-left ${
                activeTab === 'notifications'
                  ? 'bg-[#F1F5F5] text-gray-900 font-semibold shadow-2xs'
                  : 'text-gray-700 hover:bg-[#F8FAFA] hover:text-gray-900 font-medium'
              }`}
            >
              <Bell
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'notifications' ? 'text-[#548687] stroke-[2.2]' : 'text-gray-500'
                }`}
              />
              <span>Notificações</span>
            </button>

            {/* 4. Segurança */}
            <button
              id="settings-tab-security"
              type="button"
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer text-left ${
                activeTab === 'security'
                  ? 'bg-[#F1F5F5] text-gray-900 font-semibold shadow-2xs'
                  : 'text-gray-700 hover:bg-[#F8FAFA] hover:text-gray-900 font-medium'
              }`}
            >
              <Shield
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'security' ? 'text-[#548687] stroke-[2.2]' : 'text-gray-500'
                }`}
              />
              <span>Segurança</span>
            </button>

            {/* 5. Contas bloqueadas */}
            <button
              id="settings-tab-blocked"
              type="button"
              onClick={() => setActiveTab('blocked')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer text-left ${
                activeTab === 'blocked'
                  ? 'bg-[#F1F5F5] text-gray-900 font-semibold shadow-2xs'
                  : 'text-gray-700 hover:bg-[#F8FAFA] hover:text-gray-900 font-medium'
              }`}
            >
              <Ban
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'blocked' ? 'text-[#548687] stroke-[2.2]' : 'text-gray-500'
                }`}
              />
              <span>Contas bloqueadas</span>
            </button>

            {/* 6. Sair (Red Highlight Logout) */}
            <div className="pt-2">
              <button
                id="btn-settings-logout"
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-[#DC2626] hover:bg-rose-50 transition-colors cursor-pointer text-left"
              >
                <LogOut className="w-4 h-4 shrink-0 text-[#DC2626]" />
                <span>Sair</span>
              </button>
            </div>
          </nav>
        </div>

        {/* RIGHT CONTENT PANEL (Forms & Settings) */}
        <div className="md:col-span-8 lg:col-span-9 bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xs space-y-6">

          {/* TAB 1: EDITAR PERFIL */}
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                Editar perfil
              </h2>

              {/* Avatar section matching image.png */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#E1EEEE] text-[#426F70] flex items-center justify-center font-bold text-2xl overflow-hidden border-2 border-[#548687]/20 shadow-2xs">
                    {photoURL ? (
                      <img
                        src={photoURL}
                        alt="Foto de perfil"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{avatarInitial}</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-800 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4 text-gray-600" />
                    <span>Alterar foto</span>
                  </button>

                  {photoURL && (
                    <button
                      type="button"
                      onClick={() => setPhotoURL('')}
                      className="text-xs text-rose-600 font-semibold hover:underline block"
                    >
                      Remover foto
                    </button>
                  )}
                </div>
              </div>

              {/* Form Fields matching image.png */}
              <div className="space-y-5">
                {/* Nome de exibição */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700">
                    Nome de exibição
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Luana Ketlyn"
                    maxLength={50}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#548687] focus:ring-1 focus:ring-[#548687]/30 transition-all"
                  />
                </div>

                {/* Nome de usuário */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700">
                    Nome de usuário
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">
                      @
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) =>
                        setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))
                      }
                      placeholder="lu.k"
                      maxLength={30}
                      className={`w-full pl-9 pr-10 py-3 bg-white border rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none transition-all ${
                        usernameStatus === 'taken' || usernameStatus === 'invalid'
                          ? 'border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20'
                          : usernameStatus === 'available'
                          ? 'border-emerald-300 focus:border-emerald-500'
                          : 'border-gray-200 focus:border-[#548687] focus:ring-1 focus:ring-[#548687]/30'
                      }`}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
                      {usernameStatus === 'checking' && (
                        <Loader2 className="w-4 h-4 animate-spin text-[#548687]" />
                      )}
                      {usernameStatus === 'available' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      )}
                      {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                  </div>

                  {/* Real-time username feedback message */}
                  {usernameStatus === 'available' && (
                    <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <span>✓</span> Nome de usuário disponível!
                    </p>
                  )}
                  {usernameError && (
                    <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
                      <span>!</span> {usernameError}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    Apenas letras minúsculas, números, ponto (.) e underline (_).
                  </p>
                </div>

                {/* Bio */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-gray-700">
                      Bio
                    </label>
                    <span className="text-xs text-gray-400">{bio.length}/150</span>
                  </div>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="design & fotografia ✨"
                    maxLength={150}
                    rows={3}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#548687] focus:ring-1 focus:ring-[#548687]/30 transition-all resize-none"
                  />
                </div>

                {/* Localização (opcional) */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700">
                    Localização (opcional)
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="São Paulo, SP"
                    maxLength={60}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#548687] focus:ring-1 focus:ring-[#548687]/30 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRIVACIDADE */}
          {activeTab === 'privacy' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                  Privacidade da conta
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Gerencie quem pode visualizar suas publicações e interagir com você.
                </p>
              </div>

              <div className="space-y-6 divide-y divide-gray-100">
                {/* 1. Account Privacy Toggle (Public vs Private) */}
                <div className="pt-2 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-900 block">
                      Conta privada
                    </label>
                    <p className="text-xs text-gray-500 leading-relaxed max-w-md">
                      Quando sua conta é privada, apenas as pessoas que você aprovar
                      poderão ver suas fotos, vídeos e lista de seguidores na VYBE.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsPrivate(!isPrivate)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isPrivate ? 'bg-[#548687]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isPrivate ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* 2. Direct Messages Permission */}
                <div className="pt-6 space-y-3">
                  <label className="text-sm font-semibold text-gray-900 block">
                    Quem pode te enviar mensagens diretas?
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="dmPermission"
                        checked={dmPermission === 'everyone'}
                        onChange={() => setDmPermission('everyone')}
                        className="w-4 h-4 text-[#548687] focus:ring-[#548687]"
                      />
                      <div>
                        <span className="text-xs font-semibold text-gray-900 block">
                          Todo mundo
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Qualquer usuário da comunidade VYBE pode iniciar um chat com você.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="dmPermission"
                        checked={dmPermission === 'following'}
                        onChange={() => setDmPermission('following')}
                        className="w-4 h-4 text-[#548687] focus:ring-[#548687]"
                      />
                      <div>
                        <span className="text-xs font-semibold text-gray-900 block">
                          Apenas quem você segue
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Somente pessoas que você segue de volta podem te enviar DMs.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 3. Story Views Permission */}
                <div className="pt-6 space-y-3">
                  <label className="text-sm font-semibold text-gray-900 block">
                    Quem pode ver suas visualizações de Story?
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="storyViews"
                        checked={storyViewsPermission === 'everyone'}
                        onChange={() => setStoryViewsPermission('everyone')}
                        className="w-4 h-4 text-[#548687] focus:ring-[#548687]"
                      />
                      <div>
                        <span className="text-xs font-semibold text-gray-900 block">
                          Todo mundo
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Seu nome aparecerá na lista de quem visualizou os stories de terceiros.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="storyViews"
                        checked={storyViewsPermission === 'following'}
                        onChange={() => setStoryViewsPermission('following')}
                        className="w-4 h-4 text-[#548687] focus:ring-[#548687]"
                      />
                      <div>
                        <span className="text-xs font-semibold text-gray-900 block">
                          Apenas quem você segue
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Visível apenas para usuários que você já acompanha.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="storyViews"
                        checked={storyViewsPermission === 'nobody'}
                        onChange={() => setStoryViewsPermission('nobody')}
                        className="w-4 h-4 text-[#548687] focus:ring-[#548687]"
                      />
                      <div>
                        <span className="text-xs font-semibold text-gray-900 block">
                          Modo anônimo (Ninguém)
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Assista stories sem registrar sua presença na lista de espectadores.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NOTIFICAÇÕES */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                  Preferências de notificação
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Escolha os alertas e avisos que você quer receber na plataforma.
                </p>
              </div>

              <div className="space-y-4">
                {/* 1. Curtidas */}
                <div className="flex items-center justify-between p-4 bg-[#FAFBFB] rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <Heart className="w-5 h-5 fill-rose-600" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-semibold text-gray-900 block">
                        Curtidas
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Avisar quando alguém curtir suas publicações.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setNotifPrefs({ ...notifPrefs, likes: !notifPrefs.likes })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      notifPrefs.likes ? 'bg-[#548687]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        notifPrefs.likes ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* 2. Comentários */}
                <div className="flex items-center justify-between p-4 bg-[#FAFBFB] rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-semibold text-gray-900 block">
                        Comentários
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Avisar quando comentarem ou responderem suas fotos.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setNotifPrefs({ ...notifPrefs, comments: !notifPrefs.comments })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      notifPrefs.comments ? 'bg-[#548687]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        notifPrefs.comments ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* 3. Novos seguidores */}
                <div className="flex items-center justify-between p-4 bg-[#FAFBFB] rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#E1EEEE] text-[#548687] flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-semibold text-gray-900 block">
                        Novos seguidores
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Avisar quando alguém começar a te seguir.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setNotifPrefs({ ...notifPrefs, followers: !notifPrefs.followers })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      notifPrefs.followers ? 'bg-[#548687]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        notifPrefs.followers ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* 4. Mensagens diretas */}
                <div className="flex items-center justify-between p-4 bg-[#FAFBFB] rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-semibold text-gray-900 block">
                        Mensagens diretas
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Alertar sobre novos chats e mensagens privadas.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setNotifPrefs({ ...notifPrefs, messages: !notifPrefs.messages })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      notifPrefs.messages ? 'bg-[#548687]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        notifPrefs.messages ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* 5. Convites de colaboração */}
                <div className="flex items-center justify-between p-4 bg-[#FAFBFB] rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-semibold text-gray-900 block">
                        Convites de colaboração
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Alertar quando convidarem você para ser co-autor de um post.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setNotifPrefs({ ...notifPrefs, collab: !notifPrefs.collab })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      notifPrefs.collab ? 'bg-[#548687]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        notifPrefs.collab ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SEGURANÇA */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                  Segurança da conta
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Altere sua senha, ative autenticação de dois fatores e consulte conexões ativas.
                </p>
              </div>

              {/* Password change form */}
              <form onSubmit={handleChangePasswordSubmit} className="p-5 bg-[#FAFBFB] rounded-2xl border border-gray-100 space-y-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#548687]" />
                  <h3 className="text-sm font-bold text-gray-900">Trocar senha</h3>
                </div>

                {passwordError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Senha atual
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#548687]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Nova senha
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#548687]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Confirmar nova senha
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#548687]"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={changingPassword || !currentPassword || !newPassword}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 disabled:opacity-50 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-2"
                  >
                    {changingPassword ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#548687]" />
                        <span>Atualizando senha...</span>
                      </>
                    ) : (
                      <span>Atualizar senha</span>
                    )}
                  </button>
                </div>
              </form>

              {/* 2-Factor Auth */}
              <div className="flex items-center justify-between p-5 bg-[#FAFBFB] rounded-2xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-gray-900">
                        Autenticação de Dois Fatores (2FA)
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        twoFactorEnabled
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {twoFactorEnabled ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-500 block mt-0.5">
                      Exigir um código de verificação adicional por e-mail no login.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    twoFactorEnabled ? 'bg-[#548687]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Connected Sessions */}
              <div className="p-5 bg-[#FAFBFB] rounded-2xl border border-gray-100 space-y-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#548687]" />
                  <h3 className="text-sm font-bold text-gray-900">Sessões ativas</h3>
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      <span>Navegador Web (Sessão atual)</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <div className="text-gray-500 text-[11px]">
                      Dispositivo seguro · Ativo agora
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-semibold rounded-lg text-[10px]">
                    Conectado
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CONTAS BLOQUEADAS */}
          {activeTab === 'blocked' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                  Contas bloqueadas
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Pessoas bloqueadas não podem ver o seu perfil, publicações nem enviar mensagens.
                </p>
              </div>

              {/* Add Block Form */}
              <form onSubmit={handleAddBlockUser} className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-xs">
                    @
                  </span>
                  <input
                    type="text"
                    value={blockInput}
                    onChange={(e) => setBlockInput(e.target.value)}
                    placeholder="Bloquear por @username..."
                    className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-rose-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={blockingUser || !blockInput.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {blockingUser ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserX className="w-3.5 h-3.5" />
                  )}
                  <span>Bloquear</span>
                </button>
              </form>

              {/* Blocked List */}
              {blockedUsersList.length > 0 ? (
                <div className="space-y-2">
                  {blockedUsersList.map((blockedUser) => {
                    const initial =
                      blockedUser.displayName?.[0]?.toUpperCase() ||
                      blockedUser.username[0]?.toUpperCase() ||
                      'V';

                    return (
                      <div
                        key={blockedUser.uid}
                        className="flex items-center justify-between p-3.5 bg-[#FAFBFB] rounded-2xl border border-gray-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold text-xs overflow-hidden">
                            {blockedUser.photoURL ? (
                              <img
                                src={blockedUser.photoURL}
                                alt={blockedUser.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{initial}</span>
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-gray-900 text-xs block">
                              @{blockedUser.username}
                            </span>
                            <span className="text-[11px] text-gray-500">
                              {blockedUser.displayName || 'Usuário VYBE'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUnblock(blockedUser.uid)}
                          className="px-3.5 py-1.5 border border-gray-300 hover:bg-white text-gray-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        >
                          Desbloquear
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center space-y-2 bg-[#FAFBFB] rounded-3xl border border-dashed border-gray-200">
                  <UserX className="w-8 h-8 text-gray-300 mx-auto" />
                  <h3 className="font-bold text-gray-800 text-sm">
                    Nenhuma conta bloqueada
                  </h3>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto">
                    Os usuários que você bloquear aparecerão aqui nesta lista.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* GLOBAL BOTTOM ACTION ROW: "Salvar alterações" (Matching image.png) */}
          {activeTab !== 'blocked' && (
            <div className="pt-6 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                id="btn-settings-save"
                type="button"
                onClick={handleSaveChanges}
                disabled={!canSave}
                className="px-6 py-2.5 bg-[#548687] hover:bg-[#436e6f] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar alterações</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CONFIRM LOGOUT MODAL (Spec item 7) */}
      {showLogoutConfirm && (
        <div
          id="logout-confirm-modal"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-gray-100 text-center space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">
                Tem certeza que deseja sair?
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Você precisará fazer login novamente para acessar seus feeds, chats e notificações na VYBE.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-logout"
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogoutRequested();
                }}
                className="flex-1 py-2.5 bg-[#DC2626] hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Sair da conta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
