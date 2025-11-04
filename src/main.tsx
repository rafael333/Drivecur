import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

console.log('[main.tsx] Iniciando aplicação...');

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('[main.tsx] ❌ Elemento root não encontrado!');
  throw new Error('Elemento root não encontrado!');
}

console.log('[main.tsx] ✅ Elemento root encontrado, renderizando...');

try {
  const root = createRoot(rootElement);
  console.log('[main.tsx] ✅ createRoot criado com sucesso');
  
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
  
  console.log('[main.tsx] ✅ Aplicação renderizada com sucesso');
} catch (error) {
  console.error('[main.tsx] ❌ Erro ao renderizar aplicação:', error);
  rootElement.innerHTML = `
    <div style="min-height: 100vh; background: #0f0f0f; color: white; display: flex; align-items: center; justify-content: center; padding: 2rem;">
      <div style="max-width: 600px;">
        <h1 style="color: #ef4444; margin-bottom: 1rem;">Erro ao carregar aplicação</h1>
        <p style="color: #9ca3af; margin-bottom: 1rem;">Ocorreu um erro ao inicializar a aplicação.</p>
        <pre style="background: #1a1a1a; padding: 1rem; border-radius: 8px; overflow: auto; color: #fca5a5;">
          ${error instanceof Error ? error.message : String(error)}
          ${error instanceof Error && error.stack ? '\n\n' + error.stack : ''}
        </pre>
        <button 
          onclick="window.location.reload()" 
          style="margin-top: 1rem; background: #3b82f6; color: white; padding: 0.5rem 1rem; border: none; border-radius: 8px; cursor: pointer;"
        >
          Recarregar página
        </button>
      </div>
    </div>
  `;
  throw error;
}
