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
import { PostEditModal } from './components/PostEditModal';
import { DeletePostConfirmModal } from './components/DeletePostConfirmModal';
import { PostCommentsPanel } from './components/PostCommentsPanel';
import { MessagesView } from './components/MessagesView';
import { NotificationsView } from './components/NotificationsView';
import { SettingsView } from './components/SettingsView';
import { InsightsView } from './components/InsightsView';
import { AdminPanel } from './components/AdminPanel';
import { SharePostModal } from './components/SharePostModal';
import { PostEngagementsModal } from './components/PostEngagementsModal';
import { PublicPostView } from './components/PublicPostView';
import { HashtagView } from './components/HashtagView';
import { ToastContainer, ToastMessage } from './components/Toast';
import { UserStoriesGroup, PostItem, ConversationItem, NotificationItem, FollowRequestItem } from './types/social';
import { UserProfile } from './types/user';
import { ReportModal } from './components/ReportModal';
import { BlockModal } from './components/BlockModal';
import { ReportTargetType } from './types/social';
import {
  subscribeFollowing,
  subscribeFollowers,
  subscribeAllFollows,
  subscribeAllUsers,
  subscribeConversations,
  subscribeNotifications,
  subscribeMyBlockedUsers,
  subscribeUsersWhoBlockedMe,
  subscribeIncomingFollowRequests,
  subscribeOutgoingFollowRequests,
  cleanupSeedData,
} from './services/socialService';
import { Loader2, Home, Users, MessageCircle, Bell, User, BarChart3 } from 'lucide-react';

function AppContent() {
  const { user, profile, loading, needsProfileCompletion, setProfile, logout } = useAuth();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  useEffect(() => {
    let count = 0;
    let timer: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '5') {
        e.preventDefault();
        count++;

        clearTimeout(timer);
        timer = setTimeout(() => {
          count = 0;
        }, 3000); // Reset count after 3 seconds of inactivity

        if (count >= 5) {
          count = 0;
          setIsAdminPanelOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, []);

  const [currentView, setCurrentView] = useState<AppView>('home');
  const [profileTargetUid, setProfileTargetUid] = useState<string | null>(null);

  // Single Public Post URL Route state (/p/:postId or ?p=postId)
  const [singlePostId, setSinglePostId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname;
    if (path.startsWith('/p/')) {
      const parts = path.split('/p/');
      const id = parts[1]?.split('/')[0]?.split('?')[0];
      if (id && id.trim()) return id.trim();
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('p') || params.get('post') || null;
  });

  // Hashtag Route State (/tag/:nome or ?tag=nome)
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname;
    if (path.startsWith('/tag/')) {
      const parts = path.split('/tag/');
      const tag = parts[1]?.split('/')[0]?.split('?')[0];
      if (tag && tag.trim()) return tag.trim();
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('tag') || null;
  });

  // Guest Popup Auth Modal State
  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    tab: 'login' | 'register';
    paywallMessage?: string;
  } | null>(null);

  useEffect(() => {
    if (selectedHashtag) {
      setCurrentView('hashtag');
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/p/')) {
        const parts = path.split('/p/');
        const id = parts[1]?.split('/')[0]?.split('?')[0];
        if (id && id.trim()) {
          setSinglePostId(id.trim());
          return;
        }
      }
      if (path.startsWith('/tag/')) {
        const parts = path.split('/tag/');
        const tag = parts[1]?.split('/')[0]?.split('?')[0];
        if (tag && tag.trim()) {
          setSelectedHashtag(tag.trim());
          setCurrentView('hashtag');
          return;
        }
      }
      const params = new URLSearchParams(window.location.search);
      const qp = params.get('p') || params.get('post');
      const qt = params.get('tag');
      setSinglePostId(qp || null);
      if (qt) {
        setSelectedHashtag(qt);
        setCurrentView('hashtag');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Follow graph and user data state
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [myFollowing, setMyFollowing] = useState<Set<string>>(new Set());
  const [myFollowers, setMyFollowers] = useState<Set<string>>(new Set());
  const [myBlockedUsers, setMyBlockedUsers] = useState<Set<string>>(new Set());
  const [usersWhoBlockedMe, setUsersWhoBlockedMe] = useState<Set<string>>(new Set());
  
  const [myOutgoingRequests, setMyOutgoingRequests] = useState<Set<string>>(new Set());
  const [myIncomingRequests, setMyIncomingRequests] = useState<FollowRequestItem[]>([]);

  // Union set of all blocked uids
  const allBlockedUids = new Set<string>([
    ...Array.from<string>(myBlockedUsers),
    ...Array.from<string>(usersWhoBlockedMe),
  ]);

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

  // Report & Block Modal state
  const [reportModalState, setReportModalState] = useState<{
    isOpen: boolean;
    targetType: ReportTargetType;
    targetId: string;
  } | null>(null);

  const [blockModalState, setBlockModalState] = useState<{
    isOpen: boolean;
    targetUid: string;
    targetUsername: string;
  } | null>(null);

  const [editingPost, setEditingPost] = useState<PostItem | null>(null);
  const [deletingPost, setDeletingPost] = useState<PostItem | null>(null);
  const [chatTargetUid, setChatTargetUid] = useState<string | null>(null);

  const handleOpenChatWithUser = (targetUid: string) => {
    if (!user?.uid) {
      setAuthModalState({
        isOpen: true,
        tab: 'login',
        paywallMessage: 'Faça login para enviar mensagens.',
      });
      return;
    }
    setChatTargetUid(targetUid);
    setCurrentView('messages');
  };

  const handleOpenEditPost = (post: PostItem) => {
    if (!user?.uid) {
      setAuthModalState({
        isOpen: true,
        tab: 'login',
        paywallMessage: 'Faça login para editar uma publicação.',
      });
      return;
    }
    setEditingPost(post);
  };

  const handleConfirmDeletePost = (post: PostItem) => {
    if (!user?.uid) {
      setAuthModalState({
        isOpen: true,
        tab: 'login',
        paywallMessage: 'Faça login para excluir uma publicação.',
      });
      return;
    }
    setDeletingPost(post);
  };

  const handleOpenReport = (type: ReportTargetType, id: string) => {
    if (!user?.uid) {
      setAuthModalState({
        isOpen: true,
        tab: 'login',
        paywallMessage: 'Faça login para denunciar um conteúdo.',
      });
      return;
    }
    setReportModalState({ isOpen: true, targetType: type, targetId: id });
  };

  const handleOpenBlock = (targetUid: string, targetUsername: string) => {
    if (!user?.uid) {
      setAuthModalState({
        isOpen: true,
        tab: 'login',
        paywallMessage: 'Faça login para bloquear um usuário.',
      });
      return;
    }
    setBlockModalState({ isOpen: true, targetUid, targetUsername });
  };

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

  const handleSelectHashtag = (tag: string) => {
    const cleanTag = tag.toLowerCase().replace(/^#/, '').trim();
    setSelectedHashtag(cleanTag);
    setCurrentView('hashtag');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/tag/${cleanTag}`);
    }
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

    // Subscribe to users I have blocked
    const unsubBlockedByMe = subscribeMyBlockedUsers(user.uid, (set) => {
      setMyBlockedUsers(set);
    });

    // Subscribe to users who blocked me
    const unsubBlockedMe = subscribeUsersWhoBlockedMe(user.uid, (set) => {
      setUsersWhoBlockedMe(set);
    });

    // Subscribe to incoming follow requests
    const unsubIncomingReqs = subscribeIncomingFollowRequests(user.uid, (reqs) => {
      setMyIncomingRequests(reqs);
    });

    // Subscribe to outgoing follow requests
    const unsubOutgoingReqs = subscribeOutgoingFollowRequests(user.uid, (set) => {
      setMyOutgoingRequests(set);
    });

    return () => {
      unsubUsers();
      unsubFollowing();
      unsubFollowers();
      unsubAllFollows();
      unsubConversations();
      unsubNotifications();
      unsubBlockedByMe();
      unsubBlockedMe();
      unsubIncomingReqs();
      unsubOutgoingReqs();
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

  // If accessing a single public post page (/p/:postId)
  if (singlePostId) {
    return (
      <div className="min-h-screen bg-[#F7FAFA] flex flex-col text-[#1E293B]">
        {/* Header with guest mode or logged-in mode */}
        <Header
          currentUid={user?.uid || ''}
          allUsers={allUsers}
          myFollowing={myFollowing}
          myFollowers={myFollowers}
          allFollows={allFollows}
          hasUnreadMessages={hasUnreadMessages}
          hasUnreadNotifications={unreadNotificationsCount > 0}
          unreadNotificationsCount={unreadNotificationsCount}
          onNavigateHome={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/');
            }
            setSinglePostId(null);
            setCurrentView('home');
          }}
          onNavigateFriends={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/');
            }
            setSinglePostId(null);
            setCurrentView('friends');
          }}
          onNavigateProfile={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/');
            }
            setSinglePostId(null);
            handleNavigateProfile();
          }}
          onNavigateMessages={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/');
            }
            setSinglePostId(null);
            setCurrentView('messages');
          }}
          onNavigateNotifications={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/');
            }
            setSinglePostId(null);
            setCurrentView('notifications');
          }}
          onSelectUser={(uid) => {
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/');
            }
            setSinglePostId(null);
            handleSelectUser(uid);
          }}
          onOpenAuthModal={(tab) => {
            setAuthModalState({
              isOpen: true,
              tab: tab || 'login',
            });
          }}
          onShowToast={addToast}
          onInteractionAttempt={handleInteractionNotice}
        />

        {/* Public Post Main Container */}
        <main className="flex-1 w-full pb-12">
          <PublicPostView
            postId={singlePostId}
            currentUid={user?.uid}
            myFollowing={myFollowing}
            allUsers={allUsers}
            onSelectUser={(uid) => {
              if (user) {
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', '/');
                }
                setSinglePostId(null);
                handleSelectUser(uid);
              } else {
                setAuthModalState({
                  isOpen: true,
                  tab: 'login',
                  paywallMessage: 'ver este perfil',
                });
              }
            }}
            onSelectHashtag={(tag) => {
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', '/');
              }
              setSinglePostId(null);
              handleSelectHashtag(tag);
            }}
            onOpenAuthModal={(tab, paywallMsg) => {
              setAuthModalState({
                isOpen: true,
                tab: tab || 'login',
                paywallMessage: paywallMsg,
              });
            }}
            onShowToast={addToast}
            onOpenEngagements={(post, tab) => {
              if (user) {
                setEngagementsModalState({ post, initialTab: tab });
              } else {
                setAuthModalState({
                  isOpen: true,
                  tab: 'login',
                  paywallMessage: 'ver estatísticas e curtidas',
                });
              }
            }}
            onBackHome={() => {
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', '/');
              }
              setSinglePostId(null);
            }}
          />
        </main>

        {/* Soft Paywall Auth Modal Popup for Guests */}
        {authModalState?.isOpen && (
          <AuthModal
            isModal={true}
            initialTab={authModalState.tab}
            paywallMessage={authModalState.paywallMessage}
            onClose={() => setAuthModalState(null)}
            showToast={addToast}
          />
        )}

        {/* Engagements Modal if logged in */}
        {engagementsModalState && (
          <PostEngagementsModal
            post={engagementsModalState.post}
            initialTab={engagementsModalState.initialTab}
            isOpen={true}
            onClose={() => setEngagementsModalState(null)}
            allUsers={allUsers}
            myFollowing={myFollowing}
            myFollowers={myFollowers}
            currentUid={user?.uid}
            onSelectUser={(uid) => {
              setEngagementsModalState(null);
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', '/');
              }
              setSinglePostId(null);
              handleSelectUser(uid);
            }}
            onShowToast={addToast}
          />
        )}

        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </div>
    );
  }

  // Not authenticated or pending profile completion -> Show Full Page Auth
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
        hasUnreadRequests={myIncomingRequests.length > 0}
        onNavigateHome={() => setCurrentView('home')}
        onNavigateFriends={() => setCurrentView('friends')}
        onNavigateProfile={handleNavigateProfile}
        onNavigateMessages={() => setCurrentView('messages')}
        onNavigateNotifications={() => setCurrentView('notifications')}
        onNavigateSettings={() => setCurrentView('settings')}
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
            isCreator={profile?.conta_criador}
            hasUnreadMessages={hasUnreadMessages}
            hasUnreadNotifications={unreadNotificationsCount > 0}
            unreadNotificationsCount={unreadNotificationsCount}
            hasUnreadRequests={myIncomingRequests.length > 0}
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
                allBlockedUids={allBlockedUids}
                onOpenStoryViewer={(groups, startIndex) => {
                  setStoryViewerData({ groups, startIndex });
                }}
                onOpenStoryCreator={() => setIsStoryCreatorOpen(true)}
                onOpenPostCreator={() => setIsPostCreatorOpen(true)}
                onSelectUser={handleSelectUser}
                onSelectHashtag={handleSelectHashtag}
                onNavigateFriends={() => setCurrentView('friends')}
                onShowToast={addToast}
                onOpenComments={handleOpenComments}
                onSharePost={(p) => setSharingPost(p)}
                onOpenEngagements={(post, tab) => setEngagementsModalState({ post, initialTab: tab })}
                onOpenReport={handleOpenReport}
                onOpenBlock={handleOpenBlock}
                onOpenEditPost={handleOpenEditPost}
                onConfirmDeletePost={handleConfirmDeletePost}
                allUsers={allUsers}
              />
            </div>

            {/* Right Column: Suggestions Sidebar OR Post Comments Panel */}
            <div className="hidden lg:block border-l border-gray-100 sticky top-[68px] h-[calc(100vh-68px)] overflow-hidden">
              {activeCommentPost ? (
                <PostCommentsPanel
                  post={activeCommentPost}
                  onClose={() => setActiveCommentPost(null)}
                  onSelectUser={handleSelectUser}
                  onSelectHashtag={handleSelectHashtag}
                  allUsers={allUsers}
                  myFollowing={myFollowing}
                  onShowToast={addToast}
                  isSidebar={true}
                  onOpenEngagements={(post, tab) => setEngagementsModalState({ post, initialTab: tab })}
                  onOpenReport={handleOpenReport}
                  onOpenBlock={handleOpenBlock}
                  onOpenEditPost={handleOpenEditPost}
                  onConfirmDeletePost={handleConfirmDeletePost}
                />
              ) : (
                <div className="h-full overflow-y-auto">
                  <SuggestionsSidebar onShowToast={addToast} onSelectUser={handleSelectUser} />
                </div>
              )}
            </div>
          </>
        ) : currentView === 'hashtag' && selectedHashtag ? (
          <div className="flex-1 min-w-0 bg-[#F8FAFC] min-h-[calc(100vh-68px)]">
            <HashtagView
              tagName={selectedHashtag}
              onBack={() => {
                setCurrentView('home');
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', '/');
                }
              }}
              onOpenPost={handleOpenComments}
              onSelectUser={handleSelectUser}
            />
          </div>
        ) : currentView === 'friends' ? (
          <div className="flex-1 min-w-0">
            <FriendsView
              currentUid={user.uid}
              allUsers={allUsers}
              myFollowing={myFollowing}
              myFollowers={myFollowers}
              allFollows={allFollows}
              myIncomingRequests={myIncomingRequests}
              myOutgoingRequests={myOutgoingRequests}
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
              myBlockedUsers={myBlockedUsers}
              usersWhoBlockedMe={usersWhoBlockedMe}
              myOutgoingRequests={myOutgoingRequests}
              onShowToast={addToast}
              onOpenPostCreator={() => setIsPostCreatorOpen(true)}
              onSelectUser={handleSelectUser}
              onOpenChat={handleOpenChatWithUser}
              onOpenEngagements={(post, tab) => setEngagementsModalState({ post, initialTab: tab })}
              onNavigateSettings={() => setCurrentView('settings')}
              onOpenReport={handleOpenReport}
              onOpenBlock={handleOpenBlock}
              onOpenEditPost={handleOpenEditPost}
              onConfirmDeletePost={handleConfirmDeletePost}
            />
          </div>
        ) : currentView === 'settings' ? (
          <div className="flex-1 min-w-0 bg-[#F9FBFC] min-h-[calc(100vh-68px)]">
            <SettingsView
              currentUserProfile={profile}
              allUsers={allUsers}
              onProfileUpdated={(updated) => setProfile(updated)}
              onLogoutRequested={logout}
              onShowToast={addToast}
            />
          </div>
        ) : currentView === 'messages' ? (
          <div className="flex-1 min-w-0 h-[calc(100vh-68px)] flex flex-col bg-white">
            <MessagesView
              allUsers={allUsers}
              myFollowing={myFollowing}
              initialTargetUid={chatTargetUid}
              onSelectUser={handleSelectUser}
              onOpenPostDetail={handleOpenComments}
              onShowToast={addToast}
            />
          </div>
        ) : currentView === 'notifications' ? (
          <div className="flex-1 min-w-0 bg-white min-h-[calc(100vh-68px)]">
            <NotificationsView
              allUsers={allUsers}
              myFollowing={myFollowing}
              onSelectUser={handleSelectUser}
              onOpenPostDetail={handleOpenComments}
              onNavigateMessages={() => setCurrentView('messages')}
              onShowToast={addToast}
            />
          </div>
        ) : currentView === 'insights' ? (
          <div className="flex-1 min-w-0 bg-[#F9FBFC] min-h-[calc(100vh-68px)]">
            <InsightsView
              currentUserProfile={profile}
              onShowToast={addToast}
              onOpenPostDetail={handleOpenComments}
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

        {profile?.conta_criador && (
          <button
            onClick={() => setCurrentView('insights')}
            className={`p-1.5 flex flex-col items-center gap-0.5 cursor-pointer ${
              currentView === 'insights' ? 'text-[#548687]' : 'text-gray-500'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px] font-medium">Insights</span>
          </button>
        )}

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
          onOpenReport={handleOpenReport}
          onOpenBlock={handleOpenBlock}
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
          onSelectHashtag={handleSelectHashtag}
          allUsers={allUsers}
          myFollowing={myFollowing}
          onShowToast={addToast}
          isModal={true}
          onOpenEngagements={(post, tab) => setEngagementsModalState({ post, initialTab: tab })}
          onOpenReport={handleOpenReport}
          onOpenBlock={handleOpenBlock}
          onOpenEditPost={handleOpenEditPost}
          onConfirmDeletePost={handleConfirmDeletePost}
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

      {/* Report Content Modal */}
      {reportModalState?.isOpen && (
        <ReportModal
          isOpen={true}
          targetType={reportModalState.targetType}
          targetId={reportModalState.targetId}
          currentUid={user?.uid}
          onClose={() => setReportModalState(null)}
          onShowToast={addToast}
          onOpenAuthModal={() =>
            setAuthModalState({
              isOpen: true,
              tab: 'login',
              paywallMessage: 'Faça login para denunciar um conteúdo.',
            })
          }
        />
      )}

      {/* Block User Modal */}
      {blockModalState?.isOpen && (
        <BlockModal
          isOpen={true}
          targetUid={blockModalState.targetUid}
          targetUsername={blockModalState.targetUsername}
          currentUid={user?.uid}
          onClose={() => setBlockModalState(null)}
          onShowToast={addToast}
          onOpenAuthModal={() =>
            setAuthModalState({
              isOpen: true,
              tab: 'login',
              paywallMessage: 'Faça login para bloquear um usuário.',
            })
          }
        />
      )}

      {/* Edit Post Modal */}
      {editingPost && (
        <PostEditModal
          post={editingPost}
          isOpen={true}
          onClose={() => setEditingPost(null)}
          onPostEdited={() => {
            setEditingPost(null);
            // Stale active comments check
            if (activeCommentPost?.id === editingPost.id) {
              setActiveCommentPost(null);
            }
            if (activeCommentModalPost?.id === editingPost.id) {
              setActiveCommentModalPost(null);
            }
          }}
          onShowToast={addToast}
          allUsers={allUsers}
        />
      )}

      {/* Delete Post Confirm Modal */}
      {deletingPost && (
        <DeletePostConfirmModal
          post={deletingPost}
          isOpen={true}
          onClose={() => setDeletingPost(null)}
          onPostDeleted={() => {
            const deletedId = deletingPost.id;
            setDeletingPost(null);
            if (activeCommentPost?.id === deletedId) {
              setActiveCommentPost(null);
            }
            if (activeCommentModalPost?.id === deletedId) {
              setActiveCommentModalPost(null);
            }
          }}
          onShowToast={addToast}
        />
      )}

      {/* Admin Panel Modal */}
      <AdminPanel
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
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
