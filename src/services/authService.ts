import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
  User
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { UserProfile } from '../types/user';

export async function isEmailAvailable(email: string): Promise<boolean> {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail) return false;
  const q = query(collection(db, 'users'), where('email', '==', cleanEmail), limit(1));
  const snap = await getDocs(q);
  return snap.empty;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const cleanUsername = username.toLowerCase().trim();
  if (!cleanUsername || cleanUsername.length < 3) return false;
  const usernameDoc = await getDoc(doc(db, 'usernames', cleanUsername));
  return !usernameDoc.exists();
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (userDoc.exists()) {
    return userDoc.data() as UserProfile;
  }
  return null;
}

export interface RegisterData {
  username: string;
  displayName: string;
  email: string;
  password: string;
  birthDate: string;
  country: string;
}

export async function registerWithEmail(data: RegisterData): Promise<UserProfile> {
  const cleanUsername = data.username.toLowerCase().trim();

  // Verify username
  const available = await isUsernameAvailable(cleanUsername);
  if (!available) {
    throw new Error('Este nome de usuário já está em uso. Escolha outro.');
  }

  // Create Firebase Auth user
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    data.email.trim(),
    data.password
  );
  const user = userCredential.user;

  // Update Auth Profile
  await updateProfile(user, {
    displayName: data.displayName.trim() || cleanUsername,
  });

  const profile: UserProfile = {
    uid: user.uid,
    email: data.email.trim().toLowerCase(),
    username: cleanUsername,
    displayName: data.displayName.trim() || cleanUsername,
    birthDate: data.birthDate,
    country: data.country,
    photoURL: user.photoURL || '',
    createdAt: new Date().toISOString(),
  };

  // Save to Firestore
  await setDoc(doc(db, 'users', user.uid), profile);
  await setDoc(doc(db, 'usernames', cleanUsername), {
    uid: user.uid,
    createdAt: new Date().toISOString(),
  });

  return profile;
}

export async function loginWithEmailOrUsername(
  identifier: string,
  password: string
): Promise<{ user: User; profile: UserProfile | null }> {
  const cleanIdent = identifier.trim();
  let emailToUse = cleanIdent;

  // If identifier is not an email, look up username
  if (!cleanIdent.includes('@')) {
    const cleanUsername = cleanIdent.toLowerCase().replace(/^@/, '');
    const usernameDoc = await getDoc(doc(db, 'usernames', cleanUsername));
    if (!usernameDoc.exists()) {
      throw new Error('Nome de usuário não encontrado.');
    }
    const uid = usernameDoc.data().uid;
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      throw new Error('Perfil de usuário não encontrado.');
    }
    emailToUse = userDoc.data().email;
  }

  const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);
  const profile = await getUserProfile(userCredential.user.uid);
  return { user: userCredential.user, profile };
}

export async function loginWithGoogle(): Promise<{
  user: User;
  profile: UserProfile | null;
  needsProfileCompletion: boolean;
}> {
  const result = await signInWithPopup(auth, googleProvider);
  const profile = await getUserProfile(result.user.uid);

  return {
    user: result.user,
    profile,
    needsProfileCompletion: !profile || !profile.username,
  };
}

export async function completeGoogleProfile(
  user: User,
  data: { username: string; birthDate: string; country: string }
): Promise<UserProfile> {
  const cleanUsername = data.username.toLowerCase().trim();
  const available = await isUsernameAvailable(cleanUsername);
  if (!available) {
    throw new Error('Este nome de usuário já está em uso. Escolha outro.');
  }

  const profile: UserProfile = {
    uid: user.uid,
    email: user.email || '',
    username: cleanUsername,
    displayName: user.displayName || cleanUsername,
    birthDate: data.birthDate,
    country: data.country,
    photoURL: user.photoURL || '',
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'users', user.uid), profile);
  await setDoc(doc(db, 'usernames', cleanUsername), {
    uid: user.uid,
    createdAt: new Date().toISOString(),
  });

  return profile;
}

export async function logout(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfile>,
  previousUsername?: string
): Promise<UserProfile> {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    throw new Error('Perfil de usuário não encontrado.');
  }

  const currentData = userSnap.data() as UserProfile;
  let newUsername = currentData.username;

  if (
    updates.username &&
    updates.username.toLowerCase().trim() !== currentData.username.toLowerCase()
  ) {
    const cleanUsername = updates.username.toLowerCase().trim();
    const available = await isUsernameAvailable(cleanUsername);
    if (!available) {
      throw new Error('Este nome de usuário já está em uso. Escolha outro.');
    }
    newUsername = cleanUsername;

    // Register new username
    await setDoc(doc(db, 'usernames', newUsername), {
      uid,
      createdAt: new Date().toISOString(),
    });

    // Remove old username doc if it existed
    const old = (previousUsername || currentData.username).toLowerCase().trim();
    if (old && old !== newUsername) {
      try {
        await deleteDoc(doc(db, 'usernames', old));
      } catch (err) {
        console.warn('Could not delete old username doc:', err);
      }
    }
  }

  const updatedProfile: UserProfile = {
    ...currentData,
    ...updates,
    username: newUsername,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(userRef, updatedProfile, { merge: true });

  if (auth.currentUser && auth.currentUser.uid === uid) {
    try {
      await updateProfile(auth.currentUser, {
        displayName: updatedProfile.displayName,
        photoURL: updatedProfile.photoURL,
      });
    } catch (e) {
      console.warn('Could not update Auth profile:', e);
    }
  }

  return updatedProfile;
}

export async function changeUserPassword(currentPassword: string, newPassword: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) {
    throw new Error('Usuário não autenticado.');
  }

  try {
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, newPassword);
  } catch (err: any) {
    console.error('Error changing password:', err);
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      throw new Error('A senha atual informada está incorreta.');
    }
    if (err.code === 'auth/weak-password') {
      throw new Error('A nova senha deve ter pelo menos 6 caracteres.');
    }
    throw new Error(err.message || 'Erro ao alterar a senha.');
  }
}

export async function blockUser(currentUid: string, targetUid: string): Promise<void> {
  const userRef = doc(db, 'users', currentUid);
  await updateDoc(userRef, {
    blockedUsers: arrayUnion(targetUid),
  });
}

export async function unblockUser(currentUid: string, targetUid: string): Promise<void> {
  const userRef = doc(db, 'users', currentUid);
  await updateDoc(userRef, {
    blockedUsers: arrayRemove(targetUid),
  });
}

export async function deleteAccountPermanently(uid: string, username: string, password?: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Usuário não autenticado.');
  }

  // If password is provided, reauthenticate first
  if (password && currentUser.email) {
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
    } catch (err: any) {
      console.error('Reauth failed before deletion:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        throw new Error('A senha informada está incorreta.');
      }
      throw new Error(err.message || 'Falha na reautenticação.');
    }
  }

  // 1. Delete user doc from Firestore
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (err) {
    console.warn('Could not delete user doc from Firestore:', err);
  }

  // 2. Delete username registry
  if (username) {
    try {
      await deleteDoc(doc(db, 'usernames', username.toLowerCase().trim()));
    } catch (err) {
      console.warn('Could not delete username doc from Firestore:', err);
    }
  }

  // 3. Delete user from Firebase Auth
  try {
    await deleteUser(currentUser);
  } catch (err: any) {
    console.error('Error deleting Auth user:', err);
    if (err.code === 'auth/requires-recent-login') {
      throw new Error('reauthenticate-required');
    }
    throw new Error(err.message || 'Erro ao deletar conta de autenticação.');
  }
}

