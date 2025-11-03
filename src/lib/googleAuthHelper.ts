// Helper para gerenciar tokens e renovações automáticas
import { refreshAccessToken } from './googleAuthBackend';
import { getAuthFromFirestore } from './googleAuth';
import { saveAuth } from './googleAuth';
import { auth } from './firebase';

/**
 * Obtém um token válido, renovando automaticamente se necessário
 * @param currentToken Token atual que pode estar expirado
 * @returns Token válido ou null se não conseguir renovar
 */
export async function ensureValidToken(currentToken?: string | null): Promise<string | null> {
  if (!currentToken) {
    // Se não temos token, tenta buscar do Firestore
    const currentUser = auth.currentUser;
    if (!currentUser) return null;

    const firestoreAuth = await getAuthFromFirestore(currentUser.uid);
    if (firestoreAuth.token && firestoreAuth.user) {
      currentToken = firestoreAuth.token;
      
      // Se o token está expirado e temos refresh token, renova
      if (firestoreAuth.refreshToken && firestoreAuth.expiresAt) {
        const now = Date.now();
        const expiresAt = firestoreAuth.expiresAt;
        const buffer = 60 * 1000; // 1 minuto de buffer
        
        if (now >= (expiresAt - buffer)) {
          console.log('[ensureValidToken] Token expirado, renovando automaticamente...');
          
          try {
            const refreshed = await refreshAccessToken(firestoreAuth.refreshToken);
            
            if (refreshed && refreshed.accessToken) {
              console.log('[ensureValidToken] ✅ Token renovado automaticamente!');
              
              // Salva o novo token
              await saveAuth(
                refreshed.accessToken,
                firestoreAuth.user!,
                currentUser.uid,
                firestoreAuth.refreshToken,
                refreshed.expiresIn
              );
              
              // Atualiza localStorage
              localStorage.setItem('google_drive_token', refreshed.accessToken);
              
              return refreshed.accessToken;
            }
          } catch (error) {
            console.error('[ensureValidToken] Erro ao renovar token:', error);
            return null;
          }
        }
      }
      
      return currentToken;
    }
    
    return null;
  }

  // Se temos token, verifica se está válido ou se precisa renovar
  try {
    // Testa o token com uma requisição simples
    const testResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${currentToken}` },
    });

    if (testResponse.ok) {
      // Token válido
      return currentToken;
    }

    // Se recebeu 401 (Unauthorized), tenta renovar
    if (testResponse.status === 401) {
      console.log('[ensureValidToken] Token inválido (401), tentando renovar...');
      
      const currentUser = auth.currentUser;
      if (!currentUser) return null;

      const firestoreAuth = await getAuthFromFirestore(currentUser.uid);
      
      if (firestoreAuth.refreshToken && firestoreAuth.user) {
        try {
          const refreshed = await refreshAccessToken(firestoreAuth.refreshToken);
          
          if (refreshed && refreshed.accessToken) {
            console.log('[ensureValidToken] ✅ Token renovado automaticamente após 401!');
            
            // Salva o novo token
            await saveAuth(
              refreshed.accessToken,
              firestoreAuth.user,
              currentUser.uid,
              firestoreAuth.refreshToken,
              refreshed.expiresIn
            );
            
            // Atualiza localStorage
            localStorage.setItem('google_drive_token', refreshed.accessToken);
            
            return refreshed.accessToken;
          }
        } catch (error) {
          console.error('[ensureValidToken] Erro ao renovar token após 401:', error);
          return null;
        }
      }
    }

    // Se não conseguiu renovar, retorna null
    return null;
  } catch (error) {
    console.error('[ensureValidToken] Erro ao validar token:', error);
    // Em caso de erro de rede, assume que o token pode estar válido
    return currentToken;
  }
}

/**
 * Wrapper para fetch que renova automaticamente o token se necessário
 * @param url URL da requisição
 * @param options Opções do fetch (deve incluir Authorization header)
 * @param getToken Função para obter o token atual
 * @returns Response da requisição
 */
export async function fetchWithAutoRefresh(
  url: string,
  options: RequestInit = {},
  getToken: () => string | null
): Promise<Response> {
  let token = getToken();
  
  // Adiciona Authorization header se não existir
  if (!options.headers) {
    options.headers = {};
  }
  
  const headers = options.headers as Record<string, string>;
  if (!headers.Authorization && token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  // Faz a requisição
  let response = await fetch(url, options);
  
  // Se recebeu 401 (Unauthorized), tenta renovar e tentar novamente
  if (response.status === 401) {
    console.log('[fetchWithAutoRefresh] Recebeu 401, tentando renovar token...');
    
    const refreshedToken = await ensureValidToken(token);
    
    if (refreshedToken && refreshedToken !== token) {
      // Token foi renovado, tenta novamente com novo token
      headers.Authorization = `Bearer ${refreshedToken}`;
      
      // Recria as opções para garantir que os headers estão atualizados
      const newOptions = {
        ...options,
        headers: {
          ...headers,
        },
      };
      
      response = await fetch(url, newOptions);
      
      // Se ainda der erro, mostra mensagem mais clara
      if (!response.ok && response.status === 401) {
        console.error('[fetchWithAutoRefresh] ❌ Token renovado mas ainda recebeu 401. Pode ser necessário fazer login novamente.');
      }
    } else {
      console.error('[fetchWithAutoRefresh] ❌ Não foi possível renovar o token. Pode ser necessário fazer login novamente.');
    }
  }
  
  return response;
}









