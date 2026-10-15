require('dotenv').config();

async function restartSimulation() {
  console.log('🔄 Restarting bus simulation...\n');

  try {
    const response = await fetch('http://localhost:3000/api/startup');
    const data = await response.json();
    
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('\n✅ Simulation restarted successfully!');
      console.log(`   - ${data.status.busCount} buses in circulation`);
      console.log(`   - Running: ${data.status.running}`);
    } else {
      console.log('\n❌ Failed to restart simulation');
      console.log('   Error:', data.error);
    }
  } catch (error) {
    console.error('\n❌ Error calling startup API:', error.message);
    console.log('\n💡 Make sure the Next.js server is running on port 3000');
  }
}

restartSimulation();
