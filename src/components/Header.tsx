import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types/user';
import { FollowButton } from './FollowButton';
import { VerifiedBadge } from './VerifiedBadge';
import {
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from '../services/socialService';
import {
  Search,
  Home,
  MessageCircle,
  Bell,
  MoreHorizontal,
  LogOut,
  Calendar,
  Globe,
  AtSign,
  X,
  History,
  Users,
  User,
  Settings,
} from 'lucide-react';

interface HeaderProps {
  currentUid?: string;
  allUsers?: UserProfile[];
  myFollowing?: Set<string>;
  myFollowers?: Set<string>;
  allFollows?: { followerUid: string; followingUid: string }[];
  hasUnreadMessages?: boolean;
  hasUnreadNotifications?: boolean;
  unreadNotificationsCount?: number;
  hasUnreadRequests?: boolean;
  onNavigateHome?: () => void;
  onNavigateFriends?: () => void;
  onNavigateProfile?: () => void;
  onNavigateMessages?: () => void;
  onNavigateNotifications?: () => void;
  onNavigateSettings?: () => void;
  onSelectUser?: (uid: string) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onInteractionAttempt?: (featureName: string) => void;
  onOpenAuthModal?: (tab?: 'login' | 'register') => void;
}

export function Header({
  currentUid = '',
  allUsers = [],
  myFollowing = new Set(),
  myFollowers = new Set(),
  allFollows = [],
  hasUnreadMessages = false,
  hasUnreadNotifications = false,
  unreadNotificationsCount = 0,
  hasUnreadRequests = false,
  onNavigateHome,
  onNavigateFriends,
  onNavigateProfile,
  onNavigateMessages,
  onNavigateNotifications,
  onNavigateSettings,
  onSelectUser,
  onShowToast,
  onInteractionAttempt,
  onOpenAuthModal,
}: HeaderProps) {
  const { profile, user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Debounce search query ~300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
      if (searchQuery.trim()) {
        const updated = saveRecentSearch(searchQuery.trim());
        setRecentSearches(updated);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Close search & dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute graph of follows for mutual friends count
  const followsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const f of allFollows) {
      if (!map.has(f.followerUid)) map.set(f.followerUid, new Set());
      map.get(f.followerUid)!.add(f.followingUid);
    }
    return map;
  }, [allFollows]);

  // Helper to compute mutual friends count between current user and target
  const getMutualFriendsCount = (targetUid: string): number => {
    let count = 0;
    const targetFollowed = followsMap.get(targetUid) || new Set();

    myFollowing.forEach((uid) => {
      if (uid !== targetUid && targetFollowed.has(uid)) {
        count++;
      }
    });

    allFollows.forEach((f) => {
      if (myFollowing.has(f.followerUid) && f.followingUid === targetUid && f.followerUid !== targetUid) {
        count++;
      }
    });

    return Math.min(count, 12);
  };

  // Filter users based on debounced search
  const searchResults = useMemo(() => {
    if (!debouncedQuery) return [];
    const q = debouncedQuery.toLowerCase();

    return allUsers
      .filter((u) => u.uid !== currentUid)
      .filter((u) => {
        const handle = u.username.toLowerCase();
        const display = (u.displayName || '').toLowerCase();
        return handle.includes(q) || display.includes(q);
      })
      .map((targetUser) => {
        const iFollow = myFollowing.has(targetUser.uid);
        const followsMe = myFollowers.has(targetUser.uid);
        const mutualCount = getMutualFriendsCount(targetUser.uid);

        return {
          user: targetUser,
          iFollow,
          followsMe,
          mutualCount,
        };
      });
  }, [debouncedQuery, allUsers, currentUid, myFollowing, myFollowers, followsMap]);

  const handleClearSearch = () => {
    setSearchQuery('');
    setDebouncedQuery('');
  };

  const handleRecentClick = (term: string) => {
    setSearchQuery(term);
    setDebouncedQuery(term);
  };

  const handleRemoveRecent = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    const updated = removeRecentSearch(term);
    setRecentSearches(updated);
  };

  const handleClearAllRecent = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearRecentSearches();
    setRecentSearches([]);
  };

  const handleAction = (name: string) => {
    if (name === 'Início' && onNavigateHome) {
      onNavigateHome();
      return;
    }
    if (name === 'Amigos' && onNavigateFriends) {
      onNavigateFriends();
      return;
    }
    if (name === 'Mensagens' && onNavigateMessages) {
      onNavigateMessages();
      return;
    }
    if (name === 'Notificações' && onNavigateNotifications) {
      onNavigateNotifications();
      return;
    }
    if (name === 'Perfil' && onNavigateProfile) {
      onNavigateProfile();
      return;
    }
    if (onInteractionAttempt) onInteractionAttempt(name);
  };

  const userInitial =
    profile?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'V';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100/90 px-4 sm:px-8 py-3.5 flex items-center justify-between">
      {/* Left: Logo */}
      <div className="flex items-center gap-3 w-40 sm:w-48 shrink-0">
        <button
          type="button"
          onClick={() => handleAction('Início')}
          className="flex items-center gap-2 group cursor-pointer"
        >
          <img
            src="/logo.png"
            alt="VYBE"
            className="h-7 sm:h-8 w-auto object-contain transition-transform group-hover:scale-[1.02]"
          />
        </button>
      </div>

      {/* Center: Interactive Search Bar */}
      <div className="flex-1 max-w-lg mx-3 sm:mx-6 relative" ref={searchContainerRef}>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="input-global-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchOpen(true)}
            placeholder="Buscar na VYBE"
            className="w-full pl-10 pr-9 py-2 bg-[#F1F5F5] border border-transparent focus:border-[#548687]/40 rounded-full text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:bg-white transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full transition-colors cursor-pointer"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* SEARCH DROPDOWN / RESULTS POPOVER */}
        {isSearchOpen && (
          <div
            id="search-results-popover"
            className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 p-4 max-h-[80vh] overflow-y-auto animate-in fade-in slide-in-from-top-1"
          >
            {/* Header of Search Container */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-2">
              <span className="text-xs sm:text-sm font-semibold text-gray-800">
                {debouncedQuery
                  ? `Resultados para "${debouncedQuery}"`
                  : 'Buscas recentes'}
              </span>

              {debouncedQuery ? (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="text-xs text-[#548687] font-semibold hover:underline cursor-pointer"
                >
                  Limpar
                </button>
              ) : recentSearches.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearAllRecent}
                  className="text-xs text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
                >
                  Limpar histórico
                </button>
              ) : null}
            </div>

            {/* RESULTS LIST */}
            {debouncedQuery ? (
              searchResults.length > 0 ? (
                <div className="space-y-1.5">
                  {searchResults.map(({ user: targetUser, iFollow, followsMe, mutualCount }, idx) => {
                    const initial =
                      targetUser.displayName?.[0]?.toUpperCase() ||
                      targetUser.username[0]?.toUpperCase() ||
                      'V';

                    return (
                      <div
                        key={targetUser.uid}
                        className={`flex items-center justify-between p-2.5 sm:p-3 rounded-2xl transition-colors ${
                          idx === 0 ? 'bg-[#F1F5F5]/70' : 'hover:bg-[#F8FAFA]'
                        }`}
                      >
                        {/* Avatar & User Details Left */}
                        <div
                          onClick={() => {
                            setIsSearchOpen(false);
                            onSelectUser?.(targetUser.uid);
                          }}
                          className="flex items-center gap-3 min-w-0 pr-2 cursor-pointer group/user flex-1"
                        >
                          <div className="w-11 h-11 rounded-full bg-[#E1EEEE] text-[#426F70] flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 border border-gray-200 group-hover/user:scale-105 transition-transform">
                            {targetUser.photoURL ? (
                              <img
                                src={targetUser.photoURL}
                                alt={targetUser.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{initial}</span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 text-sm leading-snug truncate group-hover/user:text-[#548687] transition-colors flex items-center gap-1.5">
                              <span>{targetUser.username}</span>
                              <VerifiedBadge verified={targetUser.verificado} size={13} />
                            </div>
                            <div className="text-xs text-gray-500 leading-tight mt-0.5 truncate">
                              {mutualCount > 0 ? (
                                <span>
                                  {targetUser.displayName || targetUser.username} · {mutualCount}{' '}
                                  {mutualCount === 1 ? 'amigo em comum' : 'amigos em comum'}
                                </span>
                              ) : followsMe ? (
                                <span>
                                  {targetUser.displayName || targetUser.username} ·{' '}
                                  <span className="text-[#548687] font-medium">Segue você</span>
                                </span>
                              ) : targetUser.displayName ? (
                                <span>{targetUser.displayName}</span>
                              ) : (
                                <span className="text-gray-400">Usuário VYBE</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Follow Button Right */}
                        <div className="shrink-0">
                          <FollowButton
                            currentUid={currentUid}
                            targetUid={targetUser.uid}
                            targetUsername={targetUser.username}
                            iFollow={iFollow}
                            followsMe={followsMe}
                            size="sm"
                            onShowToast={onShowToast}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-400 text-xs sm:text-sm">
                  <p>Nenhum perfil encontrado para "{debouncedQuery}"</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Verifique se digitou o @handle ou nome corretamente.
                  </p>
                </div>
              )
            ) : (
              /* RECENT SEARCHES LIST */
              <div>
                {recentSearches.length > 0 ? (
                  <div className="space-y-1">
                    {recentSearches.map((term) => (
                      <div
                        key={term}
                        onClick={() => handleRecentClick(term)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#F8FAFA] cursor-pointer text-xs sm:text-sm text-gray-700 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <History className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{term}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveRecent(e, term)}
                          className="text-gray-300 hover:text-gray-600 p-1 transition-colors"
                          title="Remover"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-gray-400 text-xs">
                    <p>Nenhuma busca recente.</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Pesquise por amigos usando o @handle ou nome de exibição.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Icons & Profile OR Guest Auth Buttons */}
      <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
        {user ? (
          <>
            <button
              id="btn-nav-home"
              type="button"
              className="p-2 rounded-full text-[#548687] hover:bg-[#F1F5F5] transition-colors cursor-pointer"
              title="Início"
              onClick={() => handleAction('Início')}
            >
              <Home className="w-5 h-5 stroke-[2.2]" />
            </button>

            <button
              id="btn-nav-friends"
              type="button"
              className="p-2 rounded-full text-gray-700 hover:text-gray-900 hover:bg-[#F1F5F5] transition-colors cursor-pointer relative"
              title="Amigos"
              onClick={() => handleAction('Amigos')}
            >
              <Users className="w-5 h-5 stroke-[2]" />
              {hasUnreadRequests && (
                <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-80" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 ring-1.5 ring-white" />
                </span>
              )}
            </button>

            <button
              id="btn-nav-chat"
              type="button"
              className="p-2 rounded-full text-gray-700 hover:text-gray-900 hover:bg-[#F1F5F5] transition-colors cursor-pointer relative"
              title="Mensagens"
              onClick={() => handleAction('Mensagens')}
            >
              <MessageCircle className="w-5 h-5 stroke-[2]" />
              {hasUnreadMessages && (
                <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#548687] opacity-80" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#45B6B0] ring-1.5 ring-white" />
                </span>
              )}
            </button>

            <button
              id="btn-nav-notifications"
              type="button"
              className="p-2 rounded-full text-gray-700 hover:text-gray-900 hover:bg-[#F1F5F5] transition-colors cursor-pointer relative"
              title="Notificações"
              onClick={() => handleAction('Notificações')}
            >
              <Bell className="w-5 h-5 stroke-[2]" />
              {hasUnreadNotifications && (
                unreadNotificationsCount > 0 ? (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#548687] text-white text-[10px] font-bold ring-2 ring-white shadow-xs">
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </span>
                ) : (
                  <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#548687] opacity-80" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0F4C5C] ring-1.5 ring-white" />
                  </span>
                )
              )}
            </button>

            {/* User profile avatar and popup dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                id="btn-user-avatar-menu"
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1.5 p-0.5 rounded-full hover:ring-2 hover:ring-[#548687]/30 transition-all cursor-pointer"
                title="Conta"
              >
                <div className="w-8 h-8 rounded-full bg-[#548687] text-white flex items-center justify-center font-semibold text-sm shadow-xs overflow-hidden">
                  {profile?.photoURL ? (
                    <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{userInitial}</span>
                  )}
                </div>
                <MoreHorizontal className="w-4 h-4 text-gray-500 hidden sm:block" />
              </button>

              {dropdownOpen && (
                <div
                  id="user-profile-dropdown"
                  className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-3.5 z-50 animate-in fade-in slide-in-from-top-2"
                >
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-[#548687] text-white flex items-center justify-center font-semibold text-base">
                      {userInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {profile?.displayName || 'Usuário VYBE'}
                      </div>
                      <div className="text-xs text-[#548687] font-medium truncate">
                        @{profile?.username || 'vybe_user'}
                      </div>
                    </div>
                  </div>

                  {/* User details from DB */}
                  <div className="py-2.5 space-y-1.5 text-xs text-gray-600 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-gray-500">
                      <AtSign className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate">{user?.email}</span>
                    </div>
                    {profile?.country && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Globe className="w-3.5 h-3.5 text-gray-400" />
                        <span>{profile.country}</span>
                      </div>
                    )}
                    {profile?.birthDate && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>Nasc: {profile.birthDate}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 space-y-1">
                    <button
                      id="btn-profile-view-me"
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        onNavigateProfile?.();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-[#F1F5F5] rounded-xl transition-colors cursor-pointer"
                    >
                      <User className="w-4 h-4 text-[#548687]" />
                      <span>Ver meu perfil</span>
                    </button>

                    <button
                      id="btn-header-settings"
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        onNavigateSettings?.();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-[#F1F5F5] rounded-xl transition-colors cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-gray-500" />
                      <span>Configurações</span>
                    </button>

                    <button
                      id="btn-profile-logout"
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sair da conta</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Guest visitor action buttons matching image.png */
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="btn-guest-header-login"
              type="button"
              onClick={() => onOpenAuthModal?.('login')}
              className="px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer"
            >
              Entrar
            </button>
            <button
              id="btn-guest-header-register"
              type="button"
              onClick={() => onOpenAuthModal?.('register')}
              className="px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#548687] hover:bg-[#436e6f] transition-all shadow-xs cursor-pointer"
            >
              Cadastrar
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
