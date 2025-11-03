// Funções para interagir com o backend de OAuth
// Isso permite obter refresh tokens e renovar tokens automaticamente

// Usa a URL do backend da variável de ambiente ou detecta automaticamente
const getBackendUrl = (): string => {
  // Prioriza variável de ambiente
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  
  // Se estiver no browser, tenta detectar automaticamente
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Em produção ou ambiente não-localhost, assume que o backend está no mesmo domínio
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${window.location.protocol}//${hostname}:3001`;
    }
  }
  
  // Em desenvolvimento, usa localhost como padrão
  return 'http://localhost:3001';
};

const BACKEND_URL = getBackendUrl();

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

// Troca o código OAuth por tokens (access + refresh)
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<TokenResponse | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/google/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, redirectUri }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Google Auth Backend] ❌ Erro ao trocar código por tokens:', error);
      console.error('[Google Auth Backend] Status:', response.status);
      console.error('[Google Auth Backend] URL:', `${BACKEND_URL}/api/google/oauth/token`);
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
    };
  } catch (error) {
    console.error('Erro ao trocar código por tokens:', error);
    return null;
  }
}

// Renova o access token usando o refresh token
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResponse | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/google/oauth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Erro ao renovar token:', error);
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.accessToken,
      expiresIn: data.expiresIn,
    };
  } catch (error) {
    console.error('Erro ao renovar token:', error);
    return null;
  }
}

