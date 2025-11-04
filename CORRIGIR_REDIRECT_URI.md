# 🔧 Como Corrigir o Erro redirect_uri_mismatch

## ❌ Erro
```
Erro 400: redirect_uri_mismatch
Não é possível fazer login porque APP enviou uma solicitação inválida.
```

## 🔍 O que significa?

O `redirect_uri` usado na requisição OAuth não está cadastrado nas **URIs de redirecionamento autorizados** no Google Cloud Console.

## ✅ Solução Passo a Passo

### 1. Verificar qual redirect_uri está sendo usado

1. Abra o **Console do Navegador** (F12)
2. Tente adicionar uma conta novamente
3. Procure por mensagens que começam com `[AccountManager]`
4. Copie o `redirect_uri` que aparece nos logs

**Exemplo:**
```
[AccountManager] Adicionando conta com redirect_uri: http://localhost:5173
```

### 2. Adicionar URI no Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Vá em **APIs e Serviços** > **Credenciais**
3. Clique no seu **OAuth 2.0 Client ID**
4. Em **URIs de redirecionamento autorizados**, adicione:
   - `http://localhost:5173` (se estiver usando Vite padrão)
   - `http://localhost:3000` (se estiver usando outra porta)
   - `http://127.0.0.1:5173` (IP local)
   - Ou qualquer outra URL que aparecer nos logs

### 3. URIs comuns para desenvolvimento

```
http://localhost:5173
http://localhost:3000
http://127.0.0.1:5173
http://127.0.0.1:3000
```

### 4. Para produção

Se estiver em produção, adicione:
```
https://seu-dominio.com
https://www.seu-dominio.com
```

### 5. Salvar e testar

1. Clique em **Salvar** no Google Cloud Console
2. Aguarde alguns segundos para as mudanças serem aplicadas
3. Tente adicionar a conta novamente

## ⚠️ Importante

- **Não adicione barra final** na URI (ex: `http://localhost:5173/` ❌)
- **Use exatamente a mesma URL** que aparece nos logs
- **Protocolo correto**: `http://` para localhost, `https://` para produção
- **Porta correta**: Verifique qual porta o Vite está usando

## 🔍 Como verificar qual porta está usando

Abra o terminal onde rodou `npm run dev` e veja a mensagem:
```
➜  Local:   http://localhost:5173/
```

Essa é a URL que precisa estar cadastrada!









