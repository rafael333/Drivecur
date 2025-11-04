# 🚀 Drivecur - Gerenciador de Google Drive

Aplicação web para gerenciar e visualizar arquivos do Google Drive com recursos avançados de vídeo.

## 📋 Funcionalidades

### ✅ Funcionalidades Implementadas

- **🔐 Autenticação Persistente**: Login do site salvo automaticamente, não precisa fazer login toda vez
- **🔑 Tokens do Google Drive**: Salvos no Firebase, recuperação automática ao fazer login
- **📹 Progresso de Vídeo**: Vídeos continuam de onde você parou, salvo automaticamente
- **📝 Sistema de Anotações**: Criar, editar e excluir anotações em vídeos com marcadores visuais
- **📁 Gerenciamento de Pastas**: Salvar, fixar e favoritar pastas para acesso rápido
- **🎬 Player de Vídeo Avançado**: Controles de velocidade, anotações, progresso salvo

## 🛠️ Tecnologias

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express
- **Database**: Firebase Firestore
- **Autenticação**: Firebase Auth + Google OAuth
- **Styling**: Tailwind CSS
- **Ícones**: Lucide React

## 📦 Instalação

### Pré-requisitos

- Node.js 18.x ou superior
- npm (vem com Node.js)

### Passos

1. **Clone o repositório**:
   ```bash
   cd Drivecur-main
   ```

2. **Instale as dependências**:
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente**:
   Crie um arquivo `.env` na raiz do projeto:
   ```env
   # Google OAuth
   VITE_GOOGLE_CLIENT_ID=seu_client_id_aqui
   GOOGLE_CLIENT_ID=seu_client_id_aqui
   GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
   
   # Backend (opcional)
   VITE_BACKEND_URL=http://localhost:3001
   PORT=3001
   
   # Firebase (configure no Firebase Console)
   VITE_FIREBASE_API_KEY=sua_api_key
   VITE_FIREBASE_AUTH_DOMAIN=seu_auth_domain
   VITE_FIREBASE_PROJECT_ID=seu_project_id
   VITE_FIREBASE_STORAGE_BUCKET=seu_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=seu_messaging_sender_id
   VITE_FIREBASE_APP_ID=seu_app_id
   ```

4. **Inicie o servidor backend** (em um terminal):
   ```bash
   npm run server
   ```

5. **Inicie o frontend** (em outro terminal):
   ```bash
   npm run dev
   ```

## ⚙️ Configuração

### 1. Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto ou selecione um existente
3. Ative a **Google Drive API**
4. Configure OAuth:
   - Vá em **APIs e Serviços** > **Credenciais**
   - Crie **ID do Cliente OAuth** (tipo: Aplicativo da Web)
   - Adicione URI de redirecionamento: `http://localhost:5173`
   - Configure a **Tela de consentimento OAuth**
   - Adicione escopo: `https://www.googleapis.com/auth/drive.readonly`
   - Adicione usuários de teste

### 2. Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Crie um projeto ou selecione um existente
3. Ative **Authentication** e configure **Email/Password**
4. Ative **Firestore Database**
5. Configure as regras de segurança (veja `firestore.rules`)
6. Adicione as configurações do Firebase no `.env`

### 3. Firestore Security Rules

Aplique as regras do arquivo `firestore.rules` no Firebase Console:

1. Vá em **Firestore Database** > **Regras**
2. Cole o conteúdo de `firestore.rules`
3. Clique em **Publicar**

## 📁 Estrutura do Projeto

```
Drivecur-main/
├── backend/              # Servidor Express.js
│   └── server.js         # Endpoints OAuth
├── src/
│   ├── components/       # Componentes React
│   ├── lib/             # Bibliotecas e utilitários
│   ├── hooks/           # React Hooks customizados
│   └── types/           # TypeScript types
├── firestore.rules      # Regras de segurança do Firestore
├── package.json         # Dependências
└── vite.config.ts       # Configuração do Vite
```

## 🎯 Como Usar

### Login
- Faça login no site uma vez
- Na próxima vez, estará logado automaticamente

### Google Drive
- Primeira vez: faça login no Google Drive
- Próximas vezes: token é recuperado automaticamente

### Vídeos
- Assista normalmente
- Use os controles de velocidade (0.25x até 2x)
- Crie anotações clicando no ícone de comentário
- O progresso é salvo automaticamente

### Pastas
- Salve, fixe ou favorite pastas para acesso rápido
- Personalize cores das pastas favoritas
- As pastas são salvas no Firebase

## 🔒 Segurança

- Cada usuário só acessa seus próprios dados no Firestore
- Tokens são armazenados de forma segura
- Regras de segurança do Firestore protegem os dados
- Client Secret nunca é exposto no frontend

## 📝 Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Build para produção
- `npm run server` - Inicia o servidor backend
- `npm run lint` - Executa o linter
- `npm run typecheck` - Verifica tipos TypeScript

## 🚀 Deploy

### Produção
1. Configure as variáveis de ambiente no servidor
2. Faça deploy do backend (Railway, Render, Heroku, etc.)
3. Atualize `VITE_BACKEND_URL` para a URL do backend em produção
4. Configure CORS no backend
5. Faça build: `npm run build`
6. Deploy do frontend (Netlify, Vercel, etc.)

## 📚 Estrutura de Dados no Firestore

```
googleDriveTokens/
  {userId}/
    accessToken, refreshToken, expiresAt, userInfo

users/
  {userId}/
    videoProgress/
      {fileId}/
        currentTime, duration, watchedAt
    
    videoAnnotations/
      {annotationId}/
        timestamp, comment, createdAt
    
    savedFolders/{folderId}/
      id, name, color, savedAt
    
    pinnedFolders/{folderId}/
      id, name, color, pinnedAt
    
    favoritedFolders/{folderId}/
      id, name, color, favoritedAt
```

## 🐛 Troubleshooting

### Erro: "Missing or insufficient permissions"
- Verifique se as regras do Firestore foram aplicadas corretamente

### Erro: "APP não concluiu o processo de verificação"
- Adicione seu email como usuário de teste no Google Cloud Console

### Token não renova automaticamente
- Verifique se o backend está rodando
- Verifique se o `GOOGLE_CLIENT_SECRET` está configurado

### Vídeo não carrega
- Verifique se o token do Google Drive está válido
- Verifique o console do navegador para erros

## 📄 Licença

Este projeto é privado.
