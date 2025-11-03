import { initializeApp } from 'firebase/app';
import { getAuth, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Configuração do Firebase
// IMPORTANTE: Substitua essas variáveis pelas suas credenciais do Firebase
// Obtenha no Firebase Console: https://console.firebase.google.com/
// Vá em Project Settings > General > Your apps > Web app

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAhMFwzQIwzvzkQPRfEIsniirMnZhZR9Qk",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "app--drive.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "app--drive",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "app--drive.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "563533896455",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:563533896455:web:c50d9697a4874f0c7403a2",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-F48T44V4NH",
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Authentication
export const auth: Auth = getAuth(app);

// Configura a persistência do Firebase Auth para manter o login salvo
// browserLocalPersistence = mantém o login mesmo após fechar o navegador
// Isso faz com que o usuário não precise fazer login toda vez que abrir o site
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('[Firebase Auth] Persistência configurada: login será mantido');
  })
  .catch((error) => {
    console.error('[Firebase Auth] Erro ao configurar persistência:', error);
  });

// Inicializa o Firestore
export const db: Firestore = getFirestore(app);

export default app;

