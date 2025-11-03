# Configuração do Google Drive API

## Passo 1: Obter o Client ID do Google OAuth

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Selecione seu projeto ou crie um novo
3. Vá em **APIs e Serviços** > **Credenciais**
4. Clique em **Criar Credenciais** > **ID do Cliente OAuth**
5. Configure:
   - Tipo de aplicativo: **Aplicativo da Web**
   - Nome: qualquer nome (ex: "Google Drive Manager")
   - **URIs de redirecionamento autorizados**: Adicione `http://localhost:5173`
6. Clique em **Criar**
7. Copie o **ID do Cliente** (formato: `xxxxxx.apps.googleusercontent.com`)

## Passo 2: Configurar a Tela de Consentimento OAuth

1. No Google Cloud Console, vá em **APIs e Serviços** > **Tela de consentimento OAuth**
2. Escolha o tipo de usuário: **Externo** (ou **Interno** se for uma conta Google Workspace)
3. Preencha as informações obrigatórias:
   - Nome do aplicativo
   - E-mail de suporte do usuário
   - E-mail do desenvolvedor
4. Adicione escopos:
   - `https://www.googleapis.com/auth/drive.readonly` (Leitura do Google Drive)
5. Adicione usuários de teste:
   - Na seção "Usuários de teste", clique em **+ ADICIONAR USUÁRIOS**
   - Adicione o e-mail da conta Google que você vai usar para testar
   - **IMPORTANTE**: Adicione todos os e-mails que precisarão acessar o app
6. Clique em **Salvar e Continuar**

## Passo 3: Ativar a API do Google Drive

1. No Google Cloud Console, vá em **APIs e Serviços** > **Biblioteca**
2. Procure por "Google Drive API"
3. Clique em **Ativar**

## Passo 4: Configurar o arquivo .env

1. Crie um arquivo `.env` na raiz do projeto
2. Adicione:
   ```
   VITE_GOOGLE_CLIENT_ID=seu_client_id_aqui
   ```
3. Substitua `seu_client_id_aqui` pelo Client ID que você copiou

## Resolver erro 403: access_denied

Se você está recebendo o erro "APP não concluiu o processo de verificação", siga estes passos:

1. **Adicionar conta como testador:**
   - Vá em **APIs e Serviços** > **Tela de consentimento OAuth**
   - Role até a seção **Usuários de teste**
   - Clique em **+ ADICIONAR USUÁRIOS**
   - Adicione o e-mail da conta Google que você está usando
   - Clique em **Adicionar**
   - **Aguarde alguns minutos** para as mudanças serem propagadas

2. **Verificar configurações:**
   - Certifique-se de que o escopo `https://www.googleapis.com/auth/drive.readonly` está configurado
   - Certifique-se de que `http://localhost:5173` está nas URIs de redirecionamento

3. **Tentar novamente:**
   - Limpe o cache do navegador
   - Tente fazer login novamente

## Tornar o App Público (Opcional)

Se quiser que qualquer pessoa possa usar o app (sem precisar adicionar como testador):

1. Vá em **APIs e Serviços** > **Tela de consentimento OAuth**
2. Clique em **PUBLICAR APP**
3. **ATENÇÃO**: Para apps públicos, o Google pode exigir verificação de segurança se você usar escopos sensíveis

## Importante

- **NÃO** use o Client Secret no frontend - ele é apenas para aplicações backend
- O Client ID é seguro para usar no frontend
- O arquivo `.env` já está no `.gitignore` e não será commitado
- Apps em modo de teste só funcionam para usuários adicionados como testadores

## Exemplo

Seu arquivo `.env` deve ficar assim:
```
VITE_GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
```

