# Configuração das Regras de Segurança do Firestore

## Problema
Se você está vendo o erro "Missing or insufficient permissions" ao tentar salvar ou buscar tokens do Google Drive, significa que as regras de segurança do Firestore não estão configuradas.

## Solução

### Passo 1: Acesse o Firebase Console
1. Vá para https://console.firebase.google.com/
2. Selecione seu projeto (app--drive)

### Passo 2: Configure as Regras do Firestore
1. No menu lateral, clique em **Firestore Database**
2. Clique na aba **Regras** (Rules)
3. Cole o seguinte código nas regras:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Regras para a coleção de tokens do Google Drive
    // Permite que usuários autenticados leiam e escrevam apenas seus próprios tokens
    match /googleDriveTokens/{userId} {
      // Permite leitura e escrita apenas se o userId do documento corresponde ao usuário autenticado
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Regras para múltiplas contas do Google Drive ⭐ IMPORTANTE PARA MÚLTIPLAS CONTAS
    // Permite que usuários autenticados leiam e escrevam apenas suas próprias contas
    match /users/{userId}/googleDriveAccounts/{accountId} {
      // Permite leitura e escrita apenas se o userId corresponde ao usuário autenticado
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Regras para o progresso dos vídeos
    // Permite que usuários autenticados leiam e escrevam apenas seus próprios progressos
    match /users/{userId}/videoProgress/{fileId} {
      // Permite leitura e escrita apenas se o userId corresponde ao usuário autenticado
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Regras para as anotações dos vídeos ⭐ IMPORTANTE PARA ANOTAÇÕES
    // Permite que usuários autenticados leiam e escrevam apenas suas próprias anotações
    match /users/{userId}/videoAnnotations/{annotationId} {
      // Permite leitura e escrita apenas se o userId corresponde ao usuário autenticado
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Regra padrão: nega acesso a qualquer outra coleção não especificada
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Passo 3: Publique as Regras
1. Clique no botão **Publicar** (Publish)
2. Aguarde a confirmação de que as regras foram atualizadas

## Explicação das Regras

- **`googleDriveTokens/{userId}`**: Define regras para a coleção onde os tokens são salvos
- **`request.auth != null`**: Garante que apenas usuários autenticados podem acessar
- **`request.auth.uid == userId`**: Garante que cada usuário só pode ler/escrever seu próprio documento (usando seu uid como ID do documento)
- **Última regra**: Nega acesso a qualquer outra coleção não especificada acima (por segurança)

## Segurança

✅ **Cada usuário só acessa seus próprios tokens**
✅ **Apenas usuários autenticados têm acesso**
✅ **Outras coleções estão protegidas por padrão**

## Após Configurar

1. Recarregue a página do seu aplicativo
2. Faça login no site
3. Faça login no Google Drive (se ainda não tiver feito)
4. O token será salvo automaticamente no Firestore
5. Na próxima vez que você fizer login no site, não precisará fazer login no Google Drive novamente!

## 🔍 Como Verificar se Está Funcionando

### Passo 1: Verifique o Console do Navegador
Após fazer login no Google Drive, abra o console (F12) e procure por:
- `[saveAuth] ✅ Token salvo com sucesso no Firestore!`
- Se aparecer erro de permissão, as regras não estão corretas

### Passo 2: Verifique no Firebase Console
1. Vá para **Firestore Database** no Firebase Console
2. Deve aparecer uma coleção chamada `googleDriveTokens`
3. Dentro dela, deve ter um documento com o ID igual ao seu `uid` do Firebase Auth
4. O documento deve conter:
   - `accessToken`: string com o token
   - `userInfo`: objeto com name, email, picture
   - `savedAt`: timestamp

### Passo 3: Se Não Funcionar - Teste com Regras Temporárias
1. No Firebase Console, vá em **Firestore Database** > **Regras**
2. Use temporariamente as regras do arquivo `firestore.rules.test` (mais permissivas para teste)
3. Publique e teste novamente
4. Se funcionar, o problema são as regras. Ajuste-as conforme necessário
5. **⚠️ IMPORTANTE:** Depois dos testes, volte para as regras seguras!

## ⚠️ Problemas Comuns

### Erro: "Missing or insufficient permissions"
- **Causa:** Regras do Firestore não configuradas ou incorretas
- **Solução:** Verifique se aplicou as regras corretamente e publicou

### Erro: "Firestore is not enabled"
- **Causa:** Firestore não está habilitado no projeto
- **Solução:** 
  1. Vá em **Firestore Database** no Firebase Console
  2. Clique em **Criar banco de dados**
  3. Escolha modo **Produção** ou **Teste** (teste é mais fácil)
  4. Escolha uma localização

### Token não aparece no Firestore
- Verifique o console do navegador para ver erros
- Verifique se o `userId` está sendo passado corretamente
- Verifique se o Firestore está habilitado e funcionando

