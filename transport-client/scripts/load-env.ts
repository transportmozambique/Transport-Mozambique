// Next.js loads .env for the app; a plain script has to do it itself, before lib/prisma reads
// DATABASE_URL. Import this first.
try {
  process.loadEnvFile();
} catch {
  // No .env here: DATABASE_URL must come from the environment
}
