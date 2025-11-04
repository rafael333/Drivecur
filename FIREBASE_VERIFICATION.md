# Verificação do Firestore - Passo a Passo

## 🔍 Verificar se o Documento Existe

1. Acesse: https://console.firebase.google.com/project/app--drive/firestore
2. Clique em **Firestore Database** > **Dados**
3. Procure pela coleção `googleDriveTokens`
4. Verifique se existe um documento com o ID: `mFQpsTbZq6dNe8tGP2hMJEnm5cU2`

### Se o documento EXISTE:
- ✅ O problema é nas **regras de leitura** do Firestore
- Veja a seção "Corrigir Regras de Leitura" abaixo

### Se o documento NÃO EXISTE:
- ❌ O documento não foi salvo (mesmo com sucesso aparente)
- Veja a seção "Verificar Regras de Escrita" abaixo

## 🔧 Corrigir Regras de Leitura

Se o documento existe mas não consegue ler, as regras estão impedindo a leitura:

1. Vá em **Firestore Database** > **Regras**
2. Certifique-se de que as regras estão assim:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /googleDriveTokens/{userId} {
      // Permite leitura e escrita se o usuário está autenticado
      // E o userId do documento corresponde ao uid do usuário autenticado
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

3. Clique em **Publicar**
4. Aguarde alguns segundos e teste novamente

## ⚠️ Se as Regras Estão Corretas mas Ainda Não Funciona

Pode ser um problema de cache ou timing. Tente:

### Opção 1: Regras Temporárias para Teste

Use estas regras temporárias (apenas para testar):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /googleDriveTokens/{userId} {
      allow read, write: if request.auth != null;
    }
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**⚠️ IMPORTANTE:** Depois de testar, volte para as regras seguras!

### Opção 2: Verificar no Console do Firebase

1. Abra o console do Firebase
2. Vá em **Firestore Database** > **Dados**
3. Tente ler manualmente o documento
4. Se não conseguir, é problema de regras mesmo

## 🔍 Debug Adicional

No console do navegador, procure por:
- `[getAuthFromFirestore] exists: true` → Documento encontrado ✅
- `[getAuthFromFirestore] exists: false` → Documento não existe ❌
- `[getAuthFromFirestore] ❌ Erro` → Problema de permissão ❌

Se aparecer erro de permissão, as regras estão bloqueando!










