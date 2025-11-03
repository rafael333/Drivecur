// Backend simples para OAuth do Google com refresh tokens
// Execute: node backend/server.js
// Ou use: npm install express cors axios
// Depois: npm run server

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Configura dotenv para carregar do diretório raiz do projeto
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Sobe dois níveis: backend -> raiz do projeto
const envPath = join(__dirname, '..', '.env');
console.log('[Backend] Carregando .env de:', envPath);
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.error('[Backend] ❌ Erro ao carregar .env:', envResult.error);
} else {
  console.log('[Backend] ✅ .env carregado com sucesso!');
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Troca o código OAuth por tokens (access + refresh)
app.post('/api/google/oauth/token', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({ error: 'Código e redirectUri são obrigatórios' });
    }

    // Tenta pegar do .env (pode estar como VITE_GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_ID)
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    console.log('[Backend] Verificando credenciais na requisição:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdLength: clientId?.length || 0,
      clientSecretLength: clientSecret?.length || 0,
    });

    if (!clientId || !clientSecret) {
      console.error('[Backend] ❌ Credenciais não encontradas!');
      return res.status(500).json({ 
        error: 'Credenciais do Google não configuradas',
        details: 'Verifique se GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET estão no .env na raiz do projeto'
      });
    }

    console.log('[Backend] ✅ Credenciais encontradas, trocando código por tokens...');
    // Troca o código por tokens
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    res.json({
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
    });
  } catch (error) {
    console.error('Erro ao trocar código por tokens:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Erro ao obter tokens',
      details: error.response?.data || error.message,
    });
  }
});

// Renova o access token usando o refresh token
app.post('/api/google/oauth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token é obrigatório' });
    }

    // Tenta pegar do .env (pode estar como VITE_GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_ID)
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'Credenciais do Google não configuradas' });
    }

    // Renova o access token
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    });

    const { access_token, expires_in } = tokenResponse.data;

    res.json({
      accessToken: access_token,
      expiresIn: expires_in,
    });
  } catch (error) {
    console.error('Erro ao renovar token:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Erro ao renovar token',
      details: error.response?.data || error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📡 Endpoints disponíveis:`);
  console.log(`   POST http://localhost:${PORT}/api/google/oauth/token`);
  console.log(`   POST http://localhost:${PORT}/api/google/oauth/refresh`);
  console.log(`\n✅ Verificando credenciais:`);
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  console.log(`   Client ID: ${clientId ? '✅ Configurado' : '❌ Não encontrado'}`);
  console.log(`   Client Secret: ${clientSecret ? '✅ Configurado' : '❌ Não encontrado'}`);
  if (!clientId || !clientSecret) {
    console.log(`\n⚠️  ATENÇÃO: Credenciais não configuradas!`);
    console.log(`   Verifique o arquivo .env na raiz do projeto.`);
  }
});

