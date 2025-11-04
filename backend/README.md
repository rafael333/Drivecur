# Backend para OAuth do Google com Refresh Tokens

Este backend permite obter refresh tokens e renovar tokens automaticamente, evitando que o usuário precise fazer login toda hora.

## 📋 Pré-requisitos

1. **Obter Client Secret do Google**:
   - Acesse [Google Cloud Console](https://console.cloud.google.com/)
   - Vá em **APIs e Serviços** > **Credenciais**
   - Clique no seu OAuth Client ID
   - Copie o **Client Secret**

2. **Configurar variáveis de ambiente**:
   - Crie um arquivo `.env` na raiz do projeto (ou no diretório `backend`)
   - Adicione:
     ```
     GOOGLE_CLIENT_ID=seu_client_id_aqui
     GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
     PORT=3001
     ```

## 🚀 Instalação e Execução

1. **Instalar dependências**:
   ```bash
   npm install express cors axios dotenv
   ```

2. **Executar o servidor**:
   ```bash
   node backend/server.js
   ```

   Ou adicione ao `package.json`:
   ```json
   "scripts": {
     "server": "node backend/server.js",
     "dev:server": "nodemon backend/server.js"
   }
   ```

3. **O servidor estará rodando em**: `http://localhost:3001`

## 🔧 Endpoints

### POST `/api/google/oauth/token`
Troca o código OAuth por tokens (access + refresh)

**Request Body**:
```json
{
  "code": "código_oauth",
  "redirectUri": "http://localhost:5173"
}
```

**Response**:
```json
{
  "accessToken": "ya29...",
  "refreshToken": "1//...",
  "expiresIn": 3600
}
```

### POST `/api/google/oauth/refresh`
Renova o access token usando o refresh token

**Request Body**:
```json
{
  "refreshToken": "1//..."
}
```

**Response**:
```json
{
  "accessToken": "ya29...",
  "expiresIn": 3600
}
```

## 🔐 Segurança

⚠️ **IMPORTANTE**: Nunca exponha o `CLIENT_SECRET` no frontend! 
- O `CLIENT_SECRET` só deve estar no backend
- O frontend só usa o `CLIENT_ID`

## 📝 Próximos Passos

Depois de configurar este backend, atualize o frontend para:
1. Usar `response_type=code` ao invés de `response_type=token`
2. Trocar o código pelo token via API deste backend
3. Renovar tokens automaticamente quando expirar

