# 🔄 Configuração de Refresh Tokens - Token Nunca Expira!

## 📋 Passo a Passo Completo

### 1. Obter Client Secret do Google

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Vá em **APIs e Serviços** > **Credenciais**
3. Clique no seu **OAuth Client ID**
4. Copie o **Client Secret** (formato: `GOCSPX-...`)

### 2. Configurar Variáveis de Ambiente

Crie ou atualize o arquivo `.env` na raiz do projeto:

```env
# Client ID do Google (já existe)
VITE_GOOGLE_CLIENT_ID=seu_client_id_aqui

# Client Secret (NOVO - obrigatório)
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui

# URL do Backend (padrão: localhost:3001)
VITE_BACKEND_URL=http://localhost:3001
PORT=3001
```

⚠️ **IMPORTANTE**: O `GOOGLE_CLIENT_SECRET` **NUNCA** deve ser exposto no frontend! Ele só fica no backend.

### 3. Instalar Dependências do Backend

```bash
npm install
```

Isso instalará: `express`, `cors`, `axios`, `dotenv`

### 4. Iniciar o Backend

**Terminal 1 - Backend:**
```bash
npm run server
```

Ou para desenvolvimento com auto-reload:
```bash
npm run dev:server
```

O servidor rodará em: `http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### 5. Atualizar URIs de Redirecionamento

No Google Cloud Console:
1. Vá em **APIs e Serviços** > **Credenciais**
2. Clique no seu OAuth Client ID
3. Em **URIs de redirecionamento autorizados**, adicione:
   - `http://localhost:5173` (frontend)
   - `http://localhost:3001` (backend - se necessário)

### 6. Testar

1. **Inicie o backend** (`npm run server`)
2. **Inicie o frontend** (`npm run dev`)
3. **Faça login no Google Drive**
4. **Aguarde 1 hora** - o token será renovado automaticamente! ✅

## ✅ Como Funciona

### Antes (Sem Refresh Tokens):
- Token expira em 1 hora
- Usuário precisa fazer login novamente
- ❌ Experiência ruim

### Agora (Com Refresh Tokens):
- Token expira em 1 hora
- **Renovação automática** usando refresh token
- Usuário **não precisa fazer login novamente**
- ✅ Experiência perfeita!

## 🔧 Fluxo Completo

1. **Login**: Usuário faz login → recebe `access_token` + `refresh_token`
2. **Uso**: Token é usado normalmente por 1 hora
3. **Expiração**: Token expira após 1 hora
4. **Renovação Automática**: App detecta expiração → usa `refresh_token` → obtém novo `access_token` → continua funcionando
5. **Resultado**: Usuário **nunca** precisa fazer login novamente! 🎉

## 📝 Notas Importantes

- **Refresh tokens não expiram** (ou expiram muito raramente)
- Renovação acontece **automaticamente** quando necessário
- **Sem interação do usuário** necessária
- Funciona mesmo após fechar e reabrir o navegador

## 🚀 Deploy em Produção

Para produção, você precisa:
1. Deploy do backend (ex: Railway, Render, Heroku, etc.)
2. Atualizar `VITE_BACKEND_URL` no `.env` para a URL do backend em produção
3. Configurar CORS no backend para aceitar requisições do domínio de produção

## ❓ Troubleshooting

### Erro: "Client Secret não configurado"
- Verifique se adicionou `GOOGLE_CLIENT_SECRET` no `.env`
- Reinicie o servidor backend

### Erro: "Erro ao trocar código por tokens"
- Verifique se o backend está rodando
- Verifique se `VITE_BACKEND_URL` está correto no frontend
- Verifique se o Client Secret está correto

### Token não renova automaticamente
- Verifique se o refresh token foi salvo no Firestore
- Verifique os logs do console do navegador
- Certifique-se de que o backend está acessível

