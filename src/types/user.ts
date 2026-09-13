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
  createdAt: string;
  updatedAt?: string;
}
