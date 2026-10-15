/**
 * Seed Vercel Database
 * 
 * This script calls the seed API endpoint to populate the Vercel database
 */

const VERCEL_URL = 'https://transport-tracking-system-xltm.vercel.app';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'your-admin-secret-here';

async function checkDatabase() {
  console.log('🔍 Checking current database state...\n');
  
  try {
    const response = await fetch(`${VERCEL_URL}/api/admin/seed`);
    const data = await response.json();
    
    console.log('📊 Current counts:');
    console.log(`   Transportes: ${data.database?.transportes || 0}`);
    console.log(`   Vias: ${data.database?.vias || 0}`);
    console.log(`   Paragens: ${data.database?.paragens || 0}`);
    console.log();
    
    return data.database;
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    return null;
  }
}

async function seedDatabase() {
  console.log('🌱 Seeding Vercel database...\n');
  
  try {
    const response = await fetch(`${VERCEL_URL}/api/admin/seed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authorization: ADMIN_SECRET,
      }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success!');
      console.log(`   ${data.message}`);
    } else {
      console.log('❌ Failed to seed database');
      console.log(`   Error: ${data.error}`);
      console.log(`   Message: ${data.message}`);
      
      if (data.error === 'Unauthorized - Invalid admin secret') {
        console.log('\n⚠️  ADMIN_SECRET is incorrect or not set!');
        console.log('   1. Check .env file for ADMIN_SECRET');
        console.log('   2. Make sure it matches the one in Vercel environment variables');
        console.log('   3. Run: ADMIN_SECRET="your-secret" node seed-vercel.js');
      }
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    return null;
  }
}

async function main() {
  console.log('=' .repeat(60));
  console.log('  VERCEL DATABASE SEEDER');
  console.log('=' .repeat(60));
  console.log();
  
  // Check current state
  const before = await checkDatabase();
  
  if (before && (before.vias > 0 || before.transportes > 0)) {
    console.log('⚠️  Database already has data!');
    console.log('   Proceeding with seed will re-populate the database.');
    console.log();
  }
  
  // Seed
  await seedDatabase();
  
  console.log();
  
  // Check after seeding
  console.log('🔍 Checking database after seed...\n');
  await checkDatabase();
  
  console.log();
  console.log('=' .repeat(60));
  console.log('✅ Done! Check your Vercel admin panel:');
  console.log(`   ${VERCEL_URL}/admin/routes`);
  console.log('=' .repeat(60));
}

main();
