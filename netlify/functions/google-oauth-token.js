// Netlify Function para trocar código OAuth por tokens
const axios = require('axios');

exports.handler = async (event, context) => {
  // Permite CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Apenas permite POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { code, redirectUri } = JSON.parse(event.body || '{}');

    if (!code || !redirectUri) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Código e redirectUri são obrigatórios' }),
      };
    }

    // Pega do ambiente (Netlify vai fornecer via Environment Variables)
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[Backend] ❌ Credenciais não encontradas!');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Credenciais do Google não configuradas',
          details: 'Verifique se GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET estão nas variáveis de ambiente da Netlify',
        }),
      };
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in,
      }),
    };
  } catch (error) {
    console.error('Erro ao trocar código por tokens:', error.response?.data || error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Erro ao obter tokens',
        details: error.response?.data || error.message,
      }),
    };
  }
};

