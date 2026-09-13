import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types/user';
import {
  fetchSuggestedUsers,
  subscribeFollowing,
  subscribeFollowers,
} from '../services/socialService';
import { Users, Loader2 } from 'lucide-react';
import { FollowButton } from './FollowButton';

interface SuggestionsSidebarProps {
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onSelectUser?: (uid: string) => void;
}

export function SuggestionsSidebar({ onShowToast, onSelectUser }: SuggestionsSidebarProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [followersSet, setFollowersSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;
    setLoading(true);

    fetchSuggestedUsers(user.uid)
      .then((list) => {
        if (isMounted) {
          setUsers(list);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (isMounted) setLoading(false);
      });

    const unsubFollowing = subscribeFollowing(user.uid, (set) => {
      if (isMounted) setFollowingSet(set);
    });

    const unsubFollowers = subscribeFollowers(user.uid, (set) => {
      if (isMounted) setFollowersSet(set);
    });

    return () => {
      isMounted = false;
      unsubFollowing();
      unsubFollowers();
    };
  }, [user?.uid]);

  return (
    <aside className="w-72 shrink-0 py-6 pl-5">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 tracking-tight">
            Sugestões pra você
          </h3>
          <span className="text-[11px] text-gray-400 font-medium">Contas reais</span>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-gray-400 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-[#548687]" />
            <span>Buscando usuários...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="py-6 px-4 bg-[#F8FAFA] rounded-2xl border border-gray-100 text-center space-y-2">
            <Users className="w-7 h-7 text-gray-400 mx-auto" />
            <p className="text-xs font-semibold text-gray-700">
              Nenhuma outra conta por enquanto
            </p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Assim que outras pessoas criarem contas na VYBE, elas aparecerão aqui em tempo real.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.slice(0, 6).map((item) => {
              const isFollowing = followingSet.has(item.uid);
              const followsMe = followersSet.has(item.uid);
              const initial =
                item.displayName?.[0]?.toUpperCase() ||
                item.username[0]?.toUpperCase() ||
                'U';

              return (
                <div
                  key={item.uid}
                  id={`suggested-user-${item.username}`}
                  className="flex items-center justify-between gap-3 group"
                >
                  <div
                    onClick={() => onSelectUser?.(item.uid)}
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer group/user flex-1"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#DCEAEA] text-[#376263] font-semibold text-xs flex items-center justify-center shrink-0 overflow-hidden shadow-2xs group-hover/user:scale-105 transition-transform">
                      {item.photoURL ? (
                        <img
                          src={item.photoURL}
                          alt={item.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{initial}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-900 truncate group-hover/user:text-[#548687] transition-colors">
                        {item.displayName || item.username}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">
                        @{item.username}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <FollowButton
                      currentUid={user?.uid || ''}
                      targetUid={item.uid}
                      targetUsername={item.username}
                      iFollow={isFollowing}
                      followsMe={followsMe}
                      size="sm"
                      onShowToast={onShowToast}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
