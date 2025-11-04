import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

export interface SiteUser {
  email: string;
  name?: string;
  uid?: string;
  displayName?: string;
}

// Converte Firebase User para SiteUser
export function firebaseUserToSiteUser(firebaseUser: FirebaseUser): SiteUser {
  return {
    email: firebaseUser.email || '',
    name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName || undefined,
  };
}

// Obtém o usuário atual do Firebase
export function getCurrentSiteUser(): SiteUser | null {
  const firebaseUser = auth.currentUser;
  return firebaseUser ? firebaseUserToSiteUser(firebaseUser) : null;
}

// Verifica se o usuário está logado no site
export function isSiteAuthenticated(): boolean {
  return auth.currentUser !== null;
}

// Observa mudanças no estado de autenticação
export function onAuthStateChange(callback: (user: SiteUser | null) => void): () => void {
  return onAuthStateChanged(auth, (firebaseUser) => {
    callback(firebaseUser ? firebaseUserToSiteUser(firebaseUser) : null);
  });
}

