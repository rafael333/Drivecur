// Netlify Function para renovar access token usando refresh token
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
    const { refreshToken } = JSON.parse(event.body || '{}');

    if (!refreshToken) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Refresh token é obrigatório' }),
      };
    }

    // Pega do ambiente (Netlify vai fornecer via Environment Variables)
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Credenciais do Google não configuradas' }),
      };
    }

    // Renova o access token
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    });

    const { access_token, expires_in } = tokenResponse.data;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        accessToken: access_token,
        expiresIn: expires_in,
      }),
    };
  } catch (error) {
    console.error('Erro ao renovar token:', error.response?.data || error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Erro ao renovar token',
        details: error.response?.data || error.message,
      }),
    };
  }
};

