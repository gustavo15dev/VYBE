import { Home, Compass, Users, MessageCircle, Bell, Plus, User } from 'lucide-react';

export type AppView = 'home' | 'friends' | 'explore' | 'messages' | 'notifications' | 'profile';

interface SidebarProps {
  currentView?: AppView;
  hasUnreadMessages?: boolean;
  hasUnreadNotifications?: boolean;
  unreadNotificationsCount?: number;
  onViewChange?: (view: AppView) => void;
  onInteractionAttempt?: (featureName: string) => void;
  onCreateClick?: () => void;
}

export function Sidebar({
  currentView = 'home',
  hasUnreadMessages = false,
  hasUnreadNotifications = false,
  unreadNotificationsCount = 0,
  onViewChange,
  onInteractionAttempt,
  onCreateClick,
}: SidebarProps) {
  const handleClick = (name: string, view?: AppView) => {
    if (name === '+ Criar publicação' && onCreateClick) {
      onCreateClick();
      return;
    }

    if (view && onViewChange) {
      if (
        view === 'home' ||
        view === 'explore' ||
        view === 'friends' ||
        view === 'messages' ||
        view === 'notifications' ||
        view === 'profile'
      ) {
        onViewChange(view);
        return;
      }
    }

    if (onInteractionAttempt) onInteractionAttempt(name);
  };

  const navItems: { name: string; icon: any; view: AppView }[] = [
    { name: 'Início', icon: Home, view: 'home' },
    { name: 'Explorar', icon: Compass, view: 'explore' },
    { name: 'Amigos', icon: Users, view: 'friends' },
    { name: 'Mensagens', icon: MessageCircle, view: 'messages' },
    { name: 'Notificações', icon: Bell, view: 'notifications' },
    { name: 'Perfil', icon: User, view: 'profile' },
  ];

  return (
    <aside className="w-56 shrink-0 py-6 pr-4 flex flex-col justify-between">
      <div className="space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.view;

          return (
            <button
              key={item.name}
              id={`nav-item-${item.view}`}
              type="button"
              onClick={() => handleClick(item.name, item.view)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-medium transition-colors cursor-pointer text-left relative ${
                isActive
                  ? 'bg-[#F1F5F5] text-gray-900 font-semibold'
                  : 'text-gray-700 hover:bg-[#F8FAFA] hover:text-gray-900'
              }`}
            >
              <div className="relative shrink-0 flex items-center justify-center">
                <Icon
                  className={`w-5 h-5 ${
                    isActive ? 'text-[#548687] stroke-[2.2]' : 'text-gray-600'
                  }`}
                />
                {item.view === 'messages' && hasUnreadMessages && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#548687] opacity-80" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#45B6B0] ring-1.5 ring-white" />
                  </span>
                )}
                {item.view === 'notifications' && hasUnreadNotifications && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#548687] opacity-80" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0F4C5C] ring-1.5 ring-white" />
                  </span>
                )}
              </div>
              <span className="flex-1">{item.name}</span>
              {item.view === 'messages' && hasUnreadMessages && (
                <span className="relative flex h-2 w-2 ml-auto">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#548687] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#45B6B0]" />
                </span>
              )}
              {item.view === 'notifications' && hasUnreadNotifications && unreadNotificationsCount > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#548687] text-white">
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              )}
            </button>
          );
        })}

        {/* Primary Action Button "+ Criar" */}
        <div className="pt-4">
          <button
            id="btn-sidebar-create"
            type="button"
            onClick={() => handleClick('+ Criar publicação')}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#548687] hover:bg-[#467374] text-white font-medium text-sm rounded-xl transition-all shadow-xs cursor-pointer active:scale-[0.99]"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>Criar</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
