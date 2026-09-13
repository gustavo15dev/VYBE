import { useState, useMemo } from 'react';
import { UserProfile } from '../types/user';
import { FollowButton } from './FollowButton';
import { Users, UserCheck, Sparkles, UserPlus, Search } from 'lucide-react';

interface FriendsViewProps {
  currentUid: string;
  allUsers: UserProfile[];
  myFollowing: Set<string>;
  myFollowers: Set<string>;
  allFollows: { followerUid: string; followingUid: string }[];
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onOpenSearch?: () => void;
  onSelectUser?: (uid: string) => void;
}

type TabType = 'following' | 'followers' | 'suggestions';

export function FriendsView({
  currentUid,
  allUsers,
  myFollowing,
  myFollowers,
  allFollows,
  onShowToast,
  onOpenSearch,
  onSelectUser,
}: FriendsViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('following');
  const [filterQuery, setFilterQuery] = useState('');

  // Map of who follows who: followerUid -> Set<followingUid>
  const followsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const f of allFollows) {
      if (!map.has(f.followerUid)) map.set(f.followerUid, new Set());
      map.get(f.followerUid)!.add(f.followingUid);
    }
    return map;
  }, [allFollows]);

  // Helper to compute mutual friends count between current user and target user
  const getMutualFriendsCount = (targetUid: string): number => {
    let count = 0;
    const targetFollowed = followsMap.get(targetUid) || new Set();

    // Check how many people I follow that target user also follows
    myFollowing.forEach((uid) => {
      if (uid !== targetUid && targetFollowed.has(uid)) {
        count++;
      }
    });

    // Also check if users I follow follow the target user
    allFollows.forEach((f) => {
      if (myFollowing.has(f.followerUid) && f.followingUid === targetUid && f.followerUid !== targetUid) {
        count++;
      }
    });

    return Math.min(count, 12);
  };

  // 1. FOLLOWING LIST (Pessoas que eu sigo)
  const followingList = useMemo(() => {
    return allUsers
      .filter((u) => u.uid !== currentUid && myFollowing.has(u.uid))
      .filter((u) => {
        if (!filterQuery.trim()) return true;
        const q = filterQuery.toLowerCase();
        return (
          u.username.toLowerCase().includes(q) ||
          (u.displayName && u.displayName.toLowerCase().includes(q))
        );
      });
  }, [allUsers, myFollowing, currentUid, filterQuery]);

  // 2. FOLLOWERS LIST (Pessoas que me seguem)
  const followersList = useMemo(() => {
    return allUsers
      .filter((u) => u.uid !== currentUid && myFollowers.has(u.uid))
      .filter((u) => {
        if (!filterQuery.trim()) return true;
        const q = filterQuery.toLowerCase();
        return (
          u.username.toLowerCase().includes(q) ||
          (u.displayName && u.displayName.toLowerCase().includes(q))
        );
      });
  }, [allUsers, myFollowers, currentUid, filterQuery]);

  // 3. SUGGESTIONS LIST (Pessoas que eu AINDA NÃO SIGO)
  const suggestionsList = useMemo(() => {
    return allUsers
      .filter((u) => u.uid !== currentUid && !myFollowing.has(u.uid))
      .map((u) => ({
        user: u,
        followsMe: myFollowers.has(u.uid),
        mutualCount: getMutualFriendsCount(u.uid),
      }))
      .sort((a, b) => {
        // Prioritize people who follow me, then people with more mutual friends
        if (a.followsMe && !b.followsMe) return -1;
        if (!a.followsMe && b.followsMe) return 1;
        return b.mutualCount - a.mutualCount;
      })
      .map((item) => item.user)
      .filter((u) => {
        if (!filterQuery.trim()) return true;
        const q = filterQuery.toLowerCase();
        return (
          u.username.toLowerCase().includes(q) ||
          (u.displayName && u.displayName.toLowerCase().includes(q))
        );
      });
  }, [allUsers, myFollowing, myFollowers, currentUid, filterQuery]);

  const activeCount =
    activeTab === 'following'
      ? followingList.length
      : activeTab === 'followers'
      ? followersList.length
      : suggestionsList.length;

  return (
    <div id="friends-screen-view" className="flex-1 max-w-2xl mx-auto py-7 px-4 sm:px-6">
      {/* Page Title & Subtitle */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-[26px] font-bold text-gray-900 tracking-tight">
          Amigos
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Pessoas que você segue e que seguem você
        </p>
      </div>

      {/* Navigation Tabs (Seguindo · N, Seguidores · N, Sugestões) */}
      <div className="flex items-center gap-6 sm:gap-8 border-b border-gray-100 text-sm font-semibold mb-6 overflow-x-auto scrollbar-none">
        {/* Tab 1: Seguindo */}
        <button
          id="tab-friends-following"
          type="button"
          onClick={() => setActiveTab('following')}
          className={`pb-3.5 relative transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'following'
              ? 'text-gray-900 font-bold'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span>Seguindo</span>
            <span className="text-xs text-gray-400 font-medium">
              · {myFollowing.size}
            </span>
          </div>
          {activeTab === 'following' && (
            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#548687] rounded-full" />
          )}
        </button>

        {/* Tab 2: Seguidores */}
        <button
          id="tab-friends-followers"
          type="button"
          onClick={() => setActiveTab('followers')}
          className={`pb-3.5 relative transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'followers'
              ? 'text-gray-900 font-bold'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span>Seguidores</span>
            <span className="text-xs text-gray-400 font-medium">
              · {myFollowers.size}
            </span>
          </div>
          {activeTab === 'followers' && (
            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#548687] rounded-full" />
          )}
        </button>

        {/* Tab 3: Sugestões */}
        <button
          id="tab-friends-suggestions"
          type="button"
          onClick={() => setActiveTab('suggestions')}
          className={`pb-3.5 relative transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'suggestions'
              ? 'text-gray-900 font-bold'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span>Sugestões</span>
            {suggestionsList.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#548687]" />
            )}
          </div>
          {activeTab === 'suggestions' && (
            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#548687] rounded-full" />
          )}
        </button>
      </div>

      {/* Filter inside current list */}
      {(myFollowing.size > 5 || myFollowers.size > 5) && (
        <div className="relative mb-5">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder={`Filtrar em ${
              activeTab === 'following'
                ? 'seguindo'
                : activeTab === 'followers'
                ? 'seguidores'
                : 'sugestões'
            }...`}
            className="w-full pl-10 pr-4 py-2 bg-[#F8FAFA] border border-gray-200/80 rounded-xl text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#548687] focus:bg-white transition-colors"
          />
        </div>
      )}

      {/* Users List Container */}
      <div className="space-y-2 sm:space-y-3">
        {/* LIST RENDERING: FOLLOWING */}
        {activeTab === 'following' && (
          <>
            {followingList.length > 0 ? (
              followingList.map((targetUser) => {
                const followsMeBack = myFollowers.has(targetUser.uid);
                const initial =
                  targetUser.displayName?.[0]?.toUpperCase() ||
                  targetUser.username[0]?.toUpperCase() ||
                  'V';

                return (
                  <div
                    key={targetUser.uid}
                    className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl hover:bg-[#F8FAFA] transition-colors border border-transparent hover:border-gray-100"
                  >
                    {/* User Info Left */}
                    <div
                      onClick={() => onSelectUser?.(targetUser.uid)}
                      className="flex items-center gap-3.5 min-w-0 cursor-pointer group/user flex-1"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#E1EEEE] text-[#426F70] flex items-center justify-center font-bold text-base overflow-hidden shrink-0 border border-gray-100 group-hover/user:scale-105 transition-transform">
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
                        <div className="font-semibold text-gray-900 text-sm sm:text-base leading-snug truncate group-hover/user:text-[#548687] transition-colors">
                          {targetUser.username}
                        </div>
                        <div className="text-xs text-gray-500 leading-none mt-1">
                          {followsMeBack ? (
                            <span className="text-[#548687] font-medium">
                              Segue você de volta
                            </span>
                          ) : targetUser.displayName ? (
                            <span>{targetUser.displayName}</span>
                          ) : (
                            <span className="text-gray-400">Não segue você</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Button Right */}
                    <div className="shrink-0 ml-3">
                      <FollowButton
                        currentUid={currentUid}
                        targetUid={targetUser.uid}
                        targetUsername={targetUser.username}
                        iFollow={true}
                        followsMe={followsMeBack}
                        onShowToast={onShowToast}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 px-4 bg-[#F9FBFC] rounded-3xl border border-dashed border-gray-200">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <h3 className="font-bold text-gray-800 text-sm">
                  {filterQuery ? 'Nenhum usuário encontrado' : 'Você ainda não segue ninguém'}
                </h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Descubra novas pessoas navegando na aba de Sugestões ou usando a barra de busca acima!
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('suggestions')}
                  className="mt-4 px-4 py-2 bg-[#548687] text-white text-xs font-semibold rounded-xl hover:bg-[#436e6f] transition-colors cursor-pointer"
                >
                  Ver sugestões
                </button>
              </div>
            )}
          </>
        )}

        {/* LIST RENDERING: FOLLOWERS */}
        {activeTab === 'followers' && (
          <>
            {followersList.length > 0 ? (
              followersList.map((targetUser) => {
                const iFollow = myFollowing.has(targetUser.uid);
                const initial =
                  targetUser.displayName?.[0]?.toUpperCase() ||
                  targetUser.username[0]?.toUpperCase() ||
                  'V';

                return (
                  <div
                    key={targetUser.uid}
                    className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl hover:bg-[#F8FAFA] transition-colors border border-transparent hover:border-gray-100"
                  >
                    {/* User Info Left */}
                    <div
                      onClick={() => onSelectUser?.(targetUser.uid)}
                      className="flex items-center gap-3.5 min-w-0 cursor-pointer group/user flex-1"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#E1EEEE] text-[#426F70] flex items-center justify-center font-bold text-base overflow-hidden shrink-0 border border-gray-100 group-hover/user:scale-105 transition-transform">
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
                        <div className="font-semibold text-gray-900 text-sm sm:text-base leading-snug truncate group-hover/user:text-[#548687] transition-colors">
                          {targetUser.username}
                        </div>
                        <div className="text-xs text-gray-500 leading-none mt-1">
                          {iFollow ? (
                            <span className="text-[#548687] font-medium">
                              Amigos mútuos
                            </span>
                          ) : targetUser.displayName ? (
                            <span>{targetUser.displayName} · Segue você</span>
                          ) : (
                            <span>Segue você</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Button Right */}
                    <div className="shrink-0 ml-3">
                      <FollowButton
                        currentUid={currentUid}
                        targetUid={targetUser.uid}
                        targetUsername={targetUser.username}
                        iFollow={iFollow}
                        followsMe={true}
                        onShowToast={onShowToast}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 px-4 bg-[#F9FBFC] rounded-3xl border border-dashed border-gray-200">
                <UserCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <h3 className="font-bold text-gray-800 text-sm">
                  {filterQuery ? 'Nenhum seguidor encontrado' : 'Você ainda não tem seguidores'}
                </h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Publique fotos e stories no seu feed para que outras pessoas descubram seu perfil!
                </p>
              </div>
            )}
          </>
        )}

        {/* LIST RENDERING: SUGGESTIONS */}
        {activeTab === 'suggestions' && (
          <>
            {suggestionsList.length > 0 ? (
              suggestionsList.map((targetUser) => {
                const followsMe = myFollowers.has(targetUser.uid);
                const mutualCount = getMutualFriendsCount(targetUser.uid);
                const initial =
                  targetUser.displayName?.[0]?.toUpperCase() ||
                  targetUser.username[0]?.toUpperCase() ||
                  'V';

                return (
                  <div
                    key={targetUser.uid}
                    className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl hover:bg-[#F8FAFA] transition-colors border border-transparent hover:border-gray-100"
                  >
                    {/* User Info Left */}
                    <div
                      onClick={() => onSelectUser?.(targetUser.uid)}
                      className="flex items-center gap-3.5 min-w-0 cursor-pointer group/user flex-1"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#E1EEEE] text-[#426F70] flex items-center justify-center font-bold text-base overflow-hidden shrink-0 border border-gray-100 group-hover/user:scale-105 transition-transform">
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
                        <div className="font-semibold text-gray-900 text-sm sm:text-base leading-snug truncate group-hover/user:text-[#548687] transition-colors">
                          {targetUser.username}
                        </div>
                        <div className="text-xs text-gray-500 leading-none mt-1">
                          {followsMe ? (
                            <span className="text-[#548687] font-medium">
                              Segue você
                            </span>
                          ) : mutualCount > 0 ? (
                            <span>
                              {targetUser.displayName || targetUser.username} · {mutualCount}{' '}
                              {mutualCount === 1 ? 'amigo em comum' : 'amigos em comum'}
                            </span>
                          ) : targetUser.displayName ? (
                            <span>{targetUser.displayName}</span>
                          ) : (
                            <span>Sugerido pra você</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Button Right */}
                    <div className="shrink-0 ml-3">
                      <FollowButton
                        currentUid={currentUid}
                        targetUid={targetUser.uid}
                        targetUsername={targetUser.username}
                        iFollow={false}
                        followsMe={followsMe}
                        onShowToast={onShowToast}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 px-4 bg-[#F9FBFC] rounded-3xl border border-dashed border-gray-200">
                <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <h3 className="font-bold text-gray-800 text-sm">
                  {allUsers.filter((u) => u.uid !== currentUid && !u.uid.startsWith('seed_')).length === 0
                    ? 'Nenhuma outra conta criada ainda'
                    : 'Sem sugestões no momento'}
                </h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  {allUsers.filter((u) => u.uid !== currentUid && !u.uid.startsWith('seed_')).length === 0
                    ? 'Ainda não há outros usuários cadastrados na VYBE. Assim que novas pessoas criarem conta, elas aparecerão aqui!'
                    : 'Você já segue todos os perfis cadastrados na VYBE!'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
