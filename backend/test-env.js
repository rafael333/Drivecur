// Script de teste para verificar se o backend consegue ler o .env
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');

console.log('🔍 Testando leitura do .env...');
console.log('Caminho do .env:', envPath);

const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.error('❌ Erro ao carregar .env:', envResult.error);
  process.exit(1);
}

console.log('✅ .env carregado com sucesso!\n');

const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

console.log('📋 Verificando credenciais:');
console.log('   Client ID:', clientId ? `✅ ${clientId.substring(0, 30)}...` : '❌ Não encontrado');
console.log('   Client Secret:', clientSecret ? `✅ ${clientSecret.substring(0, 10)}...` : '❌ Não encontrado');

if (!clientId || !clientSecret) {
  console.log('\n❌ ERRO: Credenciais não encontradas!');
  console.log('   Verifique o arquivo .env na raiz do projeto.');
  process.exit(1);
}

console.log('\n✅ Todas as credenciais estão configuradas corretamente!');
console.log('   O backend deve funcionar agora.\n');

