import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { Header } from './components/Header';
import { Sidebar, AppView } from './components/Sidebar';
import { HomeFeed } from './components/HomeFeed';
import { SuggestionsSidebar } from './components/SuggestionsSidebar';
import { FriendsView } from './components/FriendsView';
import { ProfileView } from './components/ProfileView';
import { StoryViewer } from './components/StoryViewer';
import { StoryCreatorModal } from './components/StoryCreatorModal';
import { PostCreatorModal } from './components/PostCreatorModal';
import { PostCommentsPanel } from './components/PostCommentsPanel';
import { MessagesView } from './components/MessagesView';
import { NotificationsView } from './components/NotificationsView';
import { ExploreView } from './components/ExploreView';
import { SharePostModal } from './components/SharePostModal';
import { PostEngagementsModal } from './components/PostEngagementsModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { UserStoriesGroup, PostItem, ConversationItem, NotificationItem } from './types/social';
import { UserProfile } from './types/user';
import {
  subscribeFollowing,
  subscribeFollowers,
  subscribeAllFollows,
  subscribeAllUsers,
  subscribeConversations,
  subscribeNotifications,
  cleanupSeedData,
} from './services/socialService';
import { Loader2, Home, Users, MessageCircle, Bell, Compass, User } from 'lucide-react';

function AppContent() {
  const { user, profile, loading, needsProfileCompletion } = useAuth();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [profileTargetUid, setProfileTargetUid] = useState<string | null>(null);

  // Follow graph and user data state
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [myFollowing, setMyFollowing] = useState<Set<string>>(new Set());
  const [myFollowers, setMyFollowers] = useState<Set<string>>(new Set());
  const [allFollows, setAllFollows] = useState<{ followerUid: string; followingUid: string }[]>(
    []
  );
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Modals & Viewer State
  const [storyViewerData, setStoryViewerData] = useState<{
    groups: UserStoriesGroup[];
    startIndex: number;
  } | null>(null);
  const [isStoryCreatorOpen, setIsStoryCreatorOpen] = useState(false);
  const [isPostCreatorOpen, setIsPostCreatorOpen] = useState(false);
  const [activeCommentPost, setActiveCommentPost] = useState<PostItem | null>(null);
  const [activeCommentModalPost, setActiveCommentModalPost] = useState<PostItem | null>(null);
  const [sharingPost, setSharingPost] = useState<PostItem | null>(null);
  const [engagementsModalState, setEngagementsModalState] = useState<{
    post: PostItem;
    initialTab: 'curtidas' | 'visualizacoes';
  } | null>(null);

  const handleOpenComments = (post: PostItem) => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setActiveCommentModalPost(post);
    } else {
      setActiveCommentPost(post);
    }
  };

  const addToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now().toString() + Math.random().toString().slice(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleInteractionNotice = (featureName: string) => {
    addToast(
      `"${featureName}" será implementado nas próximas etapas da VYBE.`,
      'info'
    );
  };

  const handleSelectUser = (uid: string) => {
    setProfileTargetUid(uid);
    setCurrentView('profile');
  };

  const handleNavigateProfile = () => {
    if (user?.uid) {
      setProfileTargetUid(user.uid);
      setCurrentView('profile');
    }
  };

  // Cleanup old seed accounts and subscribe to real-time follow graph
  useEffect(() => {
    if (!user?.uid) return;

    // Remove legacy fake seeds
    cleanupSeedData();

    // Subscribe to all registered users
    const unsubUsers = subscribeAllUsers((users) => {
      setAllUsers(users);
    });

    // Subscribe to who I follow
    const unsubFollowing = subscribeFollowing(user.uid, (set) => {
      setMyFollowing(set);
    });

    // Subscribe to who follows me
    const unsubFollowers = subscribeFollowers(user.uid, (set) => {
      setMyFollowers(set);
    });

    // Subscribe to all follows connections (for mutual friends calculation)
    const unsubAllFollows = subscribeAllFollows((follows) => {
      setAllFollows(follows);
    });

    // Subscribe to conversations for real-time unread messages badge
    const unsubConversations = subscribeConversations(user.uid, (convList) => {
      setConversations(convList);
    });

    // Subscribe to real-time notifications for unread badge count
    const unsubNotifications = subscribeNotifications(user.uid, (notifList) => {
      setNotifications(notifList);
    });

    return () => {
      unsubUsers();
      unsubFollowing();
      unsubFollowers();
      unsubAllFollows();
      unsubConversations();
      unsubNotifications();
    };
  }, [user?.uid]);

  // Calculate unread notifications count
  const unreadNotificationsCount = notifications.filter((n) => !n.lida).length;

  // Calculate unread messages (pulsing teal dot indicator)
  const hasUnreadMessages = conversations.some((conv) => {
    // 1. Pending incoming solicitation waiting for my response
    if (conv.status === 'pendente' && conv.destinatario_id === user?.uid) {
      return true;
    }
    // 2. Active or pending chat with unread message where I am not the author
    if (
      conv.ultima_mensagem &&
      conv.ultima_mensagem.lida === false &&
      conv.ultima_mensagem.autor_id !== user?.uid
    ) {
      return true;
    }
    return false;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFDFD] flex flex-col items-center justify-center p-4">
        <img
          src="/logo.png"
          alt="VYBE"
          className="h-10 w-auto object-contain mb-4 animate-pulse"
        />
        <div className="flex items-center gap-2 text-sm text-[#548687] font-medium">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Carregando VYBE...</span>
        </div>
      </div>
    );
  }

  // Not authenticated or pending profile completion -> Show Auth Page
  if (!user || needsProfileCompletion) {
    return (
      <>
        <AuthModal showToast={addToast} />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col text-[#1E293B]">
      {/* Top Header with Real-Time Search Bar */}
      <Header
        currentUid={user.uid}
        allUsers={allUsers}
        myFollowing={myFollowing}
        myFollowers={myFollowers}
        allFollows={allFollows}
        hasUnreadMessages={hasUnreadMessages}
        hasUnreadNotifications={unreadNotificationsCount > 0}
        unreadNotificationsCount={unreadNotificationsCount}
        onNavigateHome={() => setCurrentView('home')}
        onNavigateFriends={() => setCurrentView('friends')}
        onNavigateProfile={handleNavigateProfile}
        onNavigateMessages={() => setCurrentView('messages')}
        onNavigateNotifications={() => setCurrentView('notifications')}
        onSelectUser={handleSelectUser}
        onShowToast={addToast}
        onInteractionAttempt={handleInteractionNotice}
      />

      {/* Main 3-Column Layout */}
      <main className="flex-1 w-full max-w-6xl mx-auto flex flex-col md:flex-row pb-16 md:pb-0">
        {/* Left Column: Navigation Sidebar */}
        <div className="hidden md:block border-r border-gray-100 sticky top-[68px] h-[calc(100vh-68px)] overflow-y-auto">
          <Sidebar
            currentView={currentView}
            hasUnreadMessages={hasUnreadMessages}
            hasUnreadNotifications={unreadNotificationsCount > 0}
            unreadNotificationsCount={unreadNotificationsCount}
            onViewChange={(view) => {
              if (view === 'profile') {
                handleNavigateProfile();
              } else {
                setCurrentView(view);
              }
            }}
            onInteractionAttempt={handleInteractionNotice}
            onCreateClick={() => setIsPostCreatorOpen(true)}
          />
        </div>

        {/* Center Column: Dynamic View based on Navigation */}
        {currentView === 'home' ? (
          <>
            <div className="flex-1 min-w-0">
              <HomeFeed
                myFollowing={myFollowing}
                onOpenStoryViewer={(groups, startIndex) => {
                  setStoryViewerData({ groups, startIndex });
                }}
                onOpenStoryCreator={() => setIsStoryCreatorOpen(true)}
                onOpenPostCreator={() => setIsPostCreatorOpen(true)}
                onSelectUser={handleSelectUser}
                onNavigateFriends={() => setCurrentView('friends')}
                onShowToast={addToast}
                onOpenComments={handleOpenComments}
                onSharePost={(p) => setSharingPost(p)}
                onOpenEngagements={(post, tab) => setEngagementsModalState({ post, initialTab: tab })}
              />
            </div>

            {/* Right Column: Suggestions Sidebar OR Post Comments Panel (replaces suggestions column as requested) */}
            <div className="hidden lg:block border-l border-gray-100 sticky top-[68px] h-[calc(100vh-68px)] overflow-hidden">
              {activeCommentPost ? (
                <PostCommentsPanel
                  post={activeCommentPost}
                  onClose={() => setActiveCommentPost(null)}
                  onSelectUser={handleSelectUser}
                  onShowToast={addToast}
                  isSidebar={true}
                  onOpenEngagements={(post, tab) => setEngagementsModalState({ post, initialTab: tab })}
                />
              ) : (
                <div className="h-full overflow-y-auto">
                  <SuggestionsSidebar onShowToast={addToast} onSelectUser={handleSelectUser} />
                </div>
              )}
            </div>
          </>
        ) : currentView === 'friends' ? (
          <div className="flex-1 min-w-0">
            <FriendsView
              currentUid={user.uid}
              allUsers={allUsers}
              myFollowing={myFollowing}
              myFollowers={myFollowers}
              allFollows={allFollows}
              onShowToast={addToast}
              onSelectUser={handleSelectUser}
              onOpenSearch={() => {
                const searchInput = document.getElementById('input-global-search');
                searchInput?.focus();
              }}
            />
          </div>
        ) : currentView === 'profile' ? (
          <div className="flex-1 min-w-0">
            <ProfileView
              targetUid={profileTargetUid || user.uid}
              currentUid={user.uid}
              currentUserProfile={profile}
              myFollowing={myFollowing}
              myFollowers={myFollowers}
              onShowToast={addToast}
              onOpenPostCreator={() => setIsPostCreatorOpen(true)}
              onSelectUser={handleSelectUser}
              onOpenEngagements={(post, tab) => setEngagementsModalState({ post, initialTab: tab })}
            />
          </div>
        ) : currentView === 'messages' ? (
          <div className="flex-1 min-w-0 h-[calc(100vh-68px)] flex flex-col bg-white">
            <MessagesView
              allUsers={allUsers}
              myFollowing={myFollowing}
              onSelectUser={handleSelectUser}
              onOpenPostDetail={handleOpenComments}
              onShowToast={addToast}
            />
          </div>
        ) : currentView === 'notifications' ? (
          <div className="flex-1 min-w-0 bg-white min-h-[calc(100vh-68px)]">
            <NotificationsView
              myFollowing={myFollowing}
              onSelectUser={handleSelectUser}
              onOpenPostDetail={handleOpenComments}
              onNavigateMessages={() => setCurrentView('messages')}
              onShowToast={addToast}
            />
          </div>
        ) : currentView === 'explore' ? (
          <div className="flex-1 min-w-0 bg-white min-h-[calc(100vh-68px)]">
            <ExploreView
              allUsers={allUsers}
              myFollowing={myFollowing}
              myFollowers={myFollowers}
              allFollows={allFollows}
              onOpenPostDetail={handleOpenComments}
              onSelectUser={handleSelectUser}
              onShowToast={addToast}
              onOpenEngagements={(post, tab) => setEngagementsModalState({ post, initialTab: tab })}
            />
          </div>
        ) : (
          <div className="flex-1 min-w-0 py-12 px-6 text-center">
            <p className="text-gray-500 text-sm">
              Esta seção está em desenvolvimento.
            </p>
            <button
              onClick={() => setCurrentView('home')}
              className="mt-3 px-4 py-2 bg-[#548687] text-white text-xs font-semibold rounded-xl"
            >
              Voltar para o Início
            </button>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (for small screens) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-1.5 flex items-center justify-around z-30">
        <button
          onClick={() => setCurrentView('home')}
          className={`p-1.5 flex flex-col items-center gap-0.5 cursor-pointer ${
            currentView === 'home' ? 'text-[#548687]' : 'text-gray-500'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Início</span>
        </button>

        <button
          onClick={() => setCurrentView('explore')}
          className={`p-1.5 flex flex-col items-center gap-0.5 cursor-pointer ${
            currentView === 'explore' ? 'text-[#548687]' : 'text-gray-500'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-medium">Explorar</span>
        </button>

        <button
          onClick={() => setIsPostCreatorOpen(true)}
          className="px-3 py-1 bg-[#548687] text-white rounded-xl text-xs font-medium cursor-pointer shadow-xs active:scale-95"
        >
          +
        </button>

        <button
          onClick={() => setCurrentView('messages')}
          className={`p-1.5 flex flex-col items-center gap-0.5 cursor-pointer relative ${
            currentView === 'messages' ? 'text-[#548687]' : 'text-gray-500'
          }`}
        >
          <div className="relative">
            <MessageCircle className="w-5 h-5" />
            {hasUnreadMessages && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#548687] opacity-80" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#45B6B0] ring-1.5 ring-white" />
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">Chat</span>
        </button>

        <button
          onClick={() => setCurrentView('notifications')}
          className={`p-1.5 flex flex-col items-center gap-0.5 cursor-pointer relative ${
            currentView === 'notifications' ? 'text-[#548687]' : 'text-gray-500'
          }`}
        >
          <div className="relative">
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#548687] opacity-80" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0F4C5C] ring-1.5 ring-white" />
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">Avisos</span>
        </button>

        <button
          onClick={handleNavigateProfile}
          className={`p-1.5 flex flex-col items-center gap-0.5 cursor-pointer ${
            currentView === 'profile' ? 'text-[#548687]' : 'text-gray-500'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium">Perfil</span>
        </button>
      </div>

      {/* Story Fullscreen Viewer */}
      {storyViewerData && (
        <StoryViewer
          groups={storyViewerData.groups}
          initialGroupIndex={storyViewerData.startIndex}
          currentUid={user.uid}
          onClose={() => setStoryViewerData(null)}
          onShowToast={addToast}
        />
      )}

      {/* Story Creator Modal */}
      {profile && (
        <StoryCreatorModal
          author={profile}
          isOpen={isStoryCreatorOpen}
          onClose={() => setIsStoryCreatorOpen(false)}
          onStoryCreated={() => {
            setIsStoryCreatorOpen(false);
          }}
          onShowToast={addToast}
        />
      )}

      {/* Post Creator Modal */}
      {profile && (
        <PostCreatorModal
          author={profile}
          isOpen={isPostCreatorOpen}
          onClose={() => setIsPostCreatorOpen(false)}
          onPostCreated={() => {
            setIsPostCreatorOpen(false);
          }}
          onOpenStoryCreator={() => {
            setIsPostCreatorOpen(false);
            setIsStoryCreatorOpen(true);
          }}
          allUsers={allUsers}
          myFollowers={myFollowers}
          onShowToast={addToast}
        />
      )}

      {/* 2-Column Comments Modal (for mobile devices or direct modal inspection) */}
      {activeCommentModalPost && (
        <PostCommentsPanel
          post={activeCommentModalPost}
          onClose={() => setActiveCommentModalPost(null)}
          onSelectUser={handleSelectUser}
          onShowToast={addToast}
          isModal={true}
          onOpenEngagements={(post, tab) => setEngagementsModalState({ post, initialTab: tab })}
        />
      )}

      {/* Share Post to DM Modal */}
      {sharingPost && (
        <SharePostModal
          post={sharingPost}
          isOpen={Boolean(sharingPost)}
          onClose={() => setSharingPost(null)}
          allUsers={allUsers}
          myFollowing={myFollowing}
          onShowToast={addToast}
        />
      )}

      {/* Post Engagements Modal (Likes & Views) */}
      <PostEngagementsModal
        isOpen={Boolean(engagementsModalState)}
        post={engagementsModalState?.post || null}
        initialTab={engagementsModalState?.initialTab || 'curtidas'}
        onClose={() => setEngagementsModalState(null)}
        currentUid={user?.uid || ''}
        allUsers={allUsers}
        myFollowing={myFollowing}
        myFollowers={myFollowers}
        onSelectUser={handleSelectUser}
        onShowToast={addToast}
      />

      {/* Toast Notification Stack */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
