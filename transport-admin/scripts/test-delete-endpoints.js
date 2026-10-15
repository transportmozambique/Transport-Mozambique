/**
 * Test script to verify DELETE endpoint error handling
 * Run with: node transport-admin/scripts/test-delete-endpoints.js
 */

const BASE_URL = 'http://localhost:3000';

async function testDeleteEndpoint(entityName, endpoint, testId) {
  console.log(`\n🧪 Testing ${entityName} DELETE endpoint...`);
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
    });
    
    const data = await response.json();
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
    
    if (response.status === 400) {
      console.log(`   ✅ PASS - Properly blocked deletion with helpful message`);
    } else if (response.status === 404) {
      console.log(`   ✅ PASS - Properly returned 404 for non-existent entity`);
    } else if (response.status === 200) {
      console.log(`   ✅ PASS - Successfully deleted entity`);
    } else {
      console.log(`   ⚠️  Unexpected status code`);
    }
    
    return { success: true, status: response.status, data };
  } catch (error) {
    console.log(`   ❌ FAIL - Error:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting DELETE Endpoint Tests\n');
  console.log('=' .repeat(80));
  
  // Test 1: Try to delete a via (will likely have transportes)
  await testDeleteEndpoint(
    'Vias',
    '/api/vias/test-id-123',
    'test-id-123'
  );
  
  // Test 2: Try to delete a transporte
  await testDeleteEndpoint(
    'Transportes',
    '/api/transportes/test-id-456',
    'test-id-456'
  );
  
  // Test 3: Try to delete a proprietário
  await testDeleteEndpoint(
    'Proprietários',
    '/api/proprietarios/test-id-789',
    'test-id-789'
  );
  
  // Test 4: Try to delete a motorista
  await testDeleteEndpoint(
    'Motoristas',
    '/api/motoristas/test-id-abc',
    'test-id-abc'
  );
  
  // Test 5: Try to delete a paragem
  await testDeleteEndpoint(
    'Paragens',
    '/api/paragens/test-id-def',
    'test-id-def'
  );
  
  // Test 6: Try to delete a município
  await testDeleteEndpoint(
    'Municípios',
    '/api/municipios/test-id-ghi',
    'test-id-ghi'
  );
  
  // Test 7: Try to delete a província
  await testDeleteEndpoint(
    'Províncias',
    '/api/provincias/test-id-jkl',
    'test-id-jkl'
  );
  
  console.log('\n' + '='.repeat(80));
  console.log('✨ Tests Complete!\n');
  console.log('Expected Results:');
  console.log('  - 404 errors for non-existent IDs (test IDs)');
  console.log('  - 400 errors with helpful messages for entities with relations');
  console.log('  - 200 success for entities without blocking relations');
  console.log('\nNote: Use real IDs from your database to test actual scenarios');
}

// Run tests
runTests().catch(console.error);
