import { db } from './firebase';
import { doc, setDoc, getDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { auth } from './firebase';

// Interface para os dados salvos no Firestore
interface GoogleDriveTokens {
  accessToken: string;
  refreshToken?: string; // Refresh token que não expira (ou expira muito raramente)
  expiresAt?: number; // Timestamp de quando o access token expira
  userInfo: {
    name: string;
    email: string;
    picture?: string;
  };
  savedAt: string;
  isActive?: boolean;
}

// Salva múltiplas contas do Google Drive na subcoleção
export async function saveMultipleAccounts(
  token: string,
  user: { name: string; email: string; picture?: string },
  userId: string,
  refreshToken?: string,
  expiresIn?: number,
  setAsActive: boolean = false
): Promise<string> {
  const expiresAt = expiresIn 
    ? Date.now() + (expiresIn * 1000) 
    : Date.now() + (3600 * 1000);

  try {
    // Se deve ser ativa, desativa todas as outras
    if (setAsActive) {
      const accountsRef = collection(db, 'users', userId, 'googleDriveAccounts');
      const snapshot = await getDocs(accountsRef);
      const updatePromises = snapshot.docs.map(docSnap => {
        return setDoc(docSnap.ref, { isActive: false }, { merge: true });
      });
      await Promise.all(updatePromises);
    }

    // Cria um ID baseado no email para evitar duplicatas
    const accountId = user.email.replace(/[^a-zA-Z0-9]/g, '_');
    
    const accountRef = doc(db, 'users', userId, 'googleDriveAccounts', accountId);
    const dataToSave = {
      accessToken: token,
      refreshToken: refreshToken || undefined,
      expiresAt: expiresAt,
      userInfo: user,
      savedAt: new Date().toISOString(),
      isActive: setAsActive,
    };

    await setDoc(accountRef, dataToSave);
    console.log('[saveMultipleAccounts] ✅ Conta salva na subcoleção:', user.email);
    
    return accountId;
  } catch (error: any) {
    console.error('[saveMultipleAccounts] Erro ao salvar conta:', error);
    throw error;
  }
}

// Armazena o token de acesso no localStorage e no Firestore
export async function saveAccessToken(token: string): Promise<void> {
  localStorage.setItem('google_drive_token', token);
  
  // Salva também no Firestore se o usuário estiver autenticado
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      await setDoc(doc(db, 'googleDriveTokens', currentUser.uid), {
        accessToken: token,
        savedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      console.error('Erro ao salvar token no Firestore:', error);
      // Não falha completamente, apenas registra o erro
    }
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem('google_drive_token');
}

// Busca token do Firestore para o usuário atual
export async function getAccessTokenFromFirestore(): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }

  try {
    const docRef = doc(db, 'googleDriveTokens', currentUser.uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as GoogleDriveTokens;
      return data.accessToken || null;
    }
  } catch (error) {
    console.error('Erro ao buscar token do Firestore:', error);
  }
  
  return null;
}

export function removeAccessToken(): void {
  localStorage.removeItem('google_drive_token');
}

// Remove token do Firestore
export async function removeAccessTokenFromFirestore(): Promise<void> {
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      await deleteDoc(doc(db, 'googleDriveTokens', currentUser.uid));
      console.log('[removeAccessTokenFromFirestore] ✅ Token removido do Firestore com sucesso!');
    } catch (error) {
      console.error('Erro ao remover token do Firestore:', error);
      throw error;
    }
  } else {
    console.warn('[removeAccessTokenFromFirestore] ⚠️ Nenhum usuário autenticado');
  }
}

// Armazena informações do usuário no localStorage e no Firestore
export async function saveUserInfo(user: { name: string; email: string; picture?: string }): Promise<void> {
  localStorage.setItem('google_user', JSON.stringify(user));
  
  // Salva também no Firestore se o usuário estiver autenticado
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      await setDoc(doc(db, 'googleDriveTokens', currentUser.uid), {
        userInfo: user,
        savedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      console.error('Erro ao salvar informações do usuário no Firestore:', error);
    }
  }
}

export function getUserInfo(): { name: string; email: string; picture?: string } | null {
  const user = localStorage.getItem('google_user');
  return user ? JSON.parse(user) : null;
}

// Busca informações do usuário do Firestore
export async function getUserInfoFromFirestore(): Promise<{ name: string; email: string; picture?: string } | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }

  try {
    const docRef = doc(db, 'googleDriveTokens', currentUser.uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as GoogleDriveTokens;
      return data.userInfo || null;
    }
  } catch (error) {
    console.error('Erro ao buscar informações do usuário do Firestore:', error);
  }
  
  return null;
}

export function removeUserInfo(): void {
  localStorage.removeItem('google_user');
}

// Limpa todos os dados de autenticação
export async function clearAuth(): Promise<void> {
  removeAccessToken();
  removeUserInfo();
  await removeAccessTokenFromFirestore();
}

// Salva token e usuário juntos no localStorage e no Firestore
export async function saveAuth(
  token: string, 
  user: { name: string; email: string; picture?: string }, 
  userId?: string,
  refreshToken?: string,
  expiresIn?: number
): Promise<void> {
  localStorage.setItem('google_drive_token', token);
  localStorage.setItem('google_user', JSON.stringify(user));
  if (refreshToken) {
    localStorage.setItem('google_refresh_token', refreshToken);
  }
  
  // Determina qual uid usar: userId fornecido, ou auth.currentUser, ou nada
  let uid: string | null = userId || null;
  
  if (!uid) {
    const currentUser = auth.currentUser;
    if (currentUser) {
      uid = currentUser.uid;
    }
  }
  
  // Calcula quando o token expira (padrão: 1 hora se não especificado)
  const expiresAt = expiresIn 
    ? Date.now() + (expiresIn * 1000) 
    : Date.now() + (3600 * 1000); // 1 hora padrão
  
  // Salva também no Firestore se tiver uid
  if (uid) {
    try {
      console.log('[saveAuth] Salvando token no Firestore para userId:', uid);
      console.log('[saveAuth] Token (primeiros 10 chars):', token.substring(0, 10) + '...');
      console.log('[saveAuth] User info:', { name: user.name, email: user.email });
      console.log('[saveAuth] Refresh token disponível:', !!refreshToken);
      console.log('[saveAuth] Token expira em:', new Date(expiresAt).toLocaleString());
      
      const docRef = doc(db, 'googleDriveTokens', uid);
      const dataToSave = {
        accessToken: token,
        refreshToken: refreshToken || undefined,
        expiresAt: expiresAt,
        userInfo: user,
        savedAt: new Date().toISOString(),
      };
      
      console.log('[saveAuth] Dados a serem salvos:', {
        collection: 'googleDriveTokens',
        documentId: uid,
        hasToken: !!dataToSave.accessToken,
        hasUserInfo: !!dataToSave.userInfo,
      });
      
      await setDoc(docRef, dataToSave);
      console.log('[saveAuth] ✅ Token salvo com sucesso no Firestore!');
      
      // Verifica se foi salvo corretamente
      const verificationDoc = await getDoc(docRef);
      if (verificationDoc.exists()) {
        console.log('[saveAuth] ✅ Verificação: Documento existe no Firestore');
        const savedData = verificationDoc.data();
        console.log('[saveAuth] Dados salvos:', {
          hasToken: !!savedData.accessToken,
          hasUserInfo: !!savedData.userInfo,
        });
      } else {
        console.error('[saveAuth] ❌ ERRO: Documento não foi encontrado após salvar!');
      }
    } catch (error: any) {
      console.error('[saveAuth] ❌ ERRO ao salvar autenticação no Firestore:', error);
      console.error('[saveAuth] Tipo do erro:', error?.constructor?.name);
      console.error('[saveAuth] Código do erro:', error?.code);
      console.error('[saveAuth] Mensagem do erro:', error?.message);
      
      // Se for erro de permissão, mostra instruções
      if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
        console.error('[saveAuth] ⚠️ ERRO DE PERMISSÃO!');
        console.error('[saveAuth] Verifique se as regras do Firestore estão configuradas corretamente.');
        console.error('[saveAuth] Veja o arquivo FIREBASE_SETUP.md para instruções.');
      }
      
      // Não falha completamente, apenas registra o erro
    }
  } else {
    console.warn('[saveAuth] Nenhum userId disponível, token salvo apenas no localStorage');
    console.warn('[saveAuth] userId fornecido:', userId);
    console.warn('[saveAuth] auth.currentUser:', auth.currentUser?.uid || 'null');
  }
}

// Renova o access token usando o refresh token
export async function refreshAccessToken(refreshToken: string, clientId: string): Promise<{
  accessToken: string;
  expiresIn: number;
} | null> {
  try {
    console.log('[refreshAccessToken] Renovando access token...');
    
    // Nota: Para renovar tokens, normalmente precisaríamos do client_secret
    // Mas no fluxo implícito do OAuth, não recebemos refresh tokens
    // Esta função está preparada para quando implementarmos o fluxo de código completo
    
    // Por enquanto, retornamos null pois precisamos do client_secret no backend
    console.warn('[refreshAccessToken] Refresh token não pode ser usado sem client_secret (requer backend)');
    return null;
  } catch (error: any) {
    console.error('[refreshAccessToken] Erro ao renovar token:', error);
    return null;
  }
}

// Tenta fazer login silencioso - simplificado
// Nota: Sem backend, não podemos renovar tokens automaticamente de forma confiável
// Esta função sempre retorna null - a renovação deve ser feita manualmente pelo usuário
export async function attemptSilentLogin(): Promise<{
  token: string;
  user: { name: string; email: string; picture?: string };
} | null> {
  // Por enquanto, retorna null pois renovação silenciosa requer backend
  // O usuário precisará fazer login manualmente quando o token expirar
  return null;
}

// Verifica se o token está expirado ou próximo de expirar
export function isTokenExpired(expiresAt?: number, bufferMinutes: number = 1): boolean {
  if (!expiresAt) {
    // Se não temos data de expiração, não assumimos que está expirado
    // Vamos validar pela API ao invés de assumir
    return false;
  }
  
  // Considera expirado apenas se realmente passou da data (com buffer de 1 minuto para segurança)
  // Isso evita invalidar tokens válidos prematuramente
  const buffer = bufferMinutes * 60 * 1000;
  return Date.now() >= (expiresAt - buffer);
}

// Busca token e informações do usuário do Firestore
export async function getAuthFromFirestore(userId?: string): Promise<{
  token: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  user: { name: string; email: string; picture?: string } | null;
}> {
  // Tenta usar o userId fornecido, caso contrário usa auth.currentUser
  let uid: string | null = userId || null;
  
  if (!uid) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('[getAuthFromFirestore] Nenhum usuário autenticado encontrado');
      return { token: null, refreshToken: null, expiresAt: null, user: null };
    }
    uid = currentUser.uid;
  }

  try {
    console.log('[getAuthFromFirestore] Buscando token para userId:', uid);
    console.log('[getAuthFromFirestore] auth.currentUser:', auth.currentUser?.uid || 'null');
    
    const docRef = doc(db, 'googleDriveTokens', uid);
    console.log('[getAuthFromFirestore] Referência do documento criada:', {
      collection: 'googleDriveTokens',
      documentId: uid,
    });
    
    const docSnap = await getDoc(docRef);
    console.log('[getAuthFromFirestore] Documento obtido:', {
      exists: docSnap.exists(),
      id: docSnap.id,
    });
    
    if (docSnap.exists()) {
      const data = docSnap.data() as GoogleDriveTokens;
      const expiresAt = data.expiresAt || null;
      const isExpired = expiresAt ? isTokenExpired(expiresAt) : false;
      
      console.log('[getAuthFromFirestore] ✅ Documento encontrado!', {
        hasToken: !!data.accessToken,
        hasRefreshToken: !!data.refreshToken,
        hasUser: !!data.userInfo,
        tokenLength: data.accessToken?.length || 0,
        expiresAt: expiresAt ? new Date(expiresAt).toLocaleString() : 'não definido',
        isExpired,
        savedAt: data.savedAt,
      });
      
      return {
        token: data.accessToken || null,
        refreshToken: data.refreshToken || null,
        expiresAt: expiresAt || null,
        user: data.userInfo || null,
      };
    } else {
      console.warn('[getAuthFromFirestore] ⚠️ Nenhum documento encontrado para userId:', uid);
      console.warn('[getAuthFromFirestore] Isso pode indicar:');
      console.warn('[getAuthFromFirestore] - Documento não foi salvo corretamente');
      console.warn('[getAuthFromFirestore] - Regras do Firestore impedem leitura');
      console.warn('[getAuthFromFirestore] - userId não corresponde ao documento salvo');
    }
  } catch (error: any) {
    console.error('[getAuthFromFirestore] ❌ Erro ao buscar autenticação do Firestore:', error);
    console.error('[getAuthFromFirestore] Tipo do erro:', error?.constructor?.name);
    console.error('[getAuthFromFirestore] Código do erro:', error?.code);
    console.error('[getAuthFromFirestore] Mensagem:', error?.message);
    
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      console.error('[getAuthFromFirestore] ⚠️ ERRO DE PERMISSÃO!');
      console.error('[getAuthFromFirestore] As regras do Firestore não permitem leitura.');
      console.error('[getAuthFromFirestore] Verifique o arquivo FIREBASE_SETUP.md');
    }
  }
  
  return { token: null, refreshToken: null, expiresAt: null, user: null };
}

// Cache de validação para evitar verificar o mesmo token múltiplas vezes
const VALIDATION_CACHE_KEY = 'google_token_validation_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

interface ValidationCache {
  tokenHash: string;
  isValid: boolean;
  validatedAt: number;
}

function getTokenHash(token: string): string {
  // Cria um hash simples do token (primeiros e últimos caracteres)
  return token.substring(0, 10) + token.substring(token.length - 10);
}

function getCachedValidation(token: string): boolean | null {
  try {
    const cached = localStorage.getItem(VALIDATION_CACHE_KEY);
    if (!cached) return null;
    
    const cache: ValidationCache = JSON.parse(cached);
    const tokenHash = getTokenHash(token);
    
    // Verifica se é o mesmo token e se ainda está no período de cache
    if (cache.tokenHash === tokenHash && (Date.now() - cache.validatedAt) < CACHE_DURATION) {
      return cache.isValid;
    }
    
    return null;
  } catch {
    return null;
  }
}

function setCachedValidation(token: string, isValid: boolean): void {
  try {
    const cache: ValidationCache = {
      tokenHash: getTokenHash(token),
      isValid,
      validatedAt: Date.now(),
    };
    localStorage.setItem(VALIDATION_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignora erros de localStorage
  }
}

// Verifica se o token ainda é válido fazendo uma requisição à API do Google Drive
// Usa cache para evitar verificar o mesmo token múltiplas vezes
export async function validateToken(token: string, useCache: boolean = true): Promise<boolean> {
  // Verifica cache primeiro
  if (useCache) {
    const cached = getCachedValidation(token);
    if (cached !== null) {
      return cached;
    }
  }
  
  try {
    // Testa o token fazendo uma requisição simples ao Drive API
    const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    const isValid = response.ok;
    
    // Salva no cache
    if (useCache) {
      setCachedValidation(token, isValid);
    }
    
    return isValid;
  } catch (error: any) {
    // Em caso de erro de rede, retorna false mas não salva no cache
    return false;
  }
}

