# 🔧 Corrigir Erro de Permissão para Anotações

## ❌ Erro Atual
```
Missing or insufficient permissions.
```

## ✅ Solução Rápida

### Passo 1: Acesse o Firebase Console
1. Abra: https://console.firebase.google.com/project/app--drive/firestore/rules
2. Você verá a página de **Regras do Firestore**

### Passo 2: Cole as Regras Completas
Substitua **TODO** o conteúdo atual por estas regras:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Regras para a coleção de tokens do Google Drive
    match /googleDriveTokens/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Regras para o progresso dos vídeos
    match /users/{userId}/videoProgress/{fileId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Regras para as anotações dos vídeos ⭐ IMPORTANTE
    match /users/{userId}/videoAnnotations/{annotationId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Regra padrão: nega acesso a qualquer outra coleção
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Passo 3: Publique
1. Clique no botão **Publicar** (Publish) no canto superior direito
2. Aguarde a mensagem de confirmação
3. Pronto! ✅

## 🔍 Como Verificar se Funcionou

Após publicar as regras:
1. Volte para o aplicativo
2. Recarregue a página (F5)
3. Tente criar uma anotação novamente
4. Deve funcionar! ✨

## 📝 Estrutura no Firestore

As anotações são salvas em:
```
users/
  {seu_userId}/
    videoAnnotations/
      {annotationId}/
        id: string
        fileId: string
        fileName: string
        timestamp: number
        comment: string
        createdAt: timestamp
        updatedAt: timestamp
```

## ⚠️ Importante

- Certifique-se de que a regra `users/{userId}/videoAnnotations/{annotationId}` está presente
- A regra deve permitir `read, write` apenas se `request.auth.uid == userId`
- Após publicar, pode levar alguns segundos para as novas regras entrarem em vigor










