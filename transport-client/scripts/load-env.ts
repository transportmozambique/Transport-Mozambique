// O Next.js carrega o .env para a aplicação; um script simples tem de o fazer sozinho, antes de
// lib/prisma ler DATABASE_URL. Importar isto primeiro.
try {
  process.loadEnvFile();
} catch {
  // Sem .env aqui: DATABASE_URL tem de vir do ambiente
}
