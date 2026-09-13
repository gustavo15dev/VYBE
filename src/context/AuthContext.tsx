import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getUserProfile, logout as authLogout } from '../services/authService';
import { UserProfile } from '../types/user';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  needsProfileCompletion: boolean;
  pendingGoogleUser: User | null;
  setPendingGoogleUser: (user: User | null) => void;
  setNeedsProfileCompletion: (needs: boolean) => void;
  setProfile: (profile: UserProfile | null) => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<User | null>(null);

  const refreshProfile = async () => {
    if (auth.currentUser) {
      const p = await getUserProfile(auth.currentUser.uid);
      setProfile(p);
      if (!p || !p.username) {
        setNeedsProfileCompletion(true);
      } else {
        setNeedsProfileCompletion(false);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userProfile = await getUserProfile(currentUser.uid);
          setProfile(userProfile);
          if (!userProfile || !userProfile.username) {
            setNeedsProfileCompletion(true);
            setPendingGoogleUser(currentUser);
          } else {
            setNeedsProfileCompletion(false);
            setPendingGoogleUser(null);
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
        }
      } else {
        setProfile(null);
        setNeedsProfileCompletion(false);
        setPendingGoogleUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await authLogout();
    setUser(null);
    setProfile(null);
    setNeedsProfileCompletion(false);
    setPendingGoogleUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        needsProfileCompletion,
        pendingGoogleUser,
        setPendingGoogleUser,
        setNeedsProfileCompletion,
        setProfile,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
