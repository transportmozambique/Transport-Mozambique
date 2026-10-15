// Quick debug script to test the API directly
// Run with: node debug-markers.js

const busId = 'cmorbsk8u0000124pf9c8u123'; // Replace with actual bus ID
const paragemId = 'cmorbs9vu002a124pcm29azr0'; // Replace with actual paragem ID (Xipamanine)
const destinationId = 'cmornovn6001tl1taii3watxh'; // Replace with actual destination ID (Hulene)

const apiUrl = `http://localhost:3000/api/bus/${busId}?paragem=${paragemId}&destination=${destinationId}`;

console.log('Testing API:', apiUrl);
console.log('\nFetching...\n');

fetch(apiUrl)
  .then(res => res.json())
  .then(data => {
    console.log('✅ API Response received');
    console.log('\n📊 Stops data:');
    console.log('Total stops:', data.stops?.length || 0);
    
    if (data.stops) {
      const pickupStops = data.stops.filter(s => s.isPickup);
      const destinationStops = data.stops.filter(s => s.isDestination);
      
      console.log('Pickup stops:', pickupStops.length);
      console.log('Destination stops:', destinationStops.length);
      
      if (pickupStops.length > 0) {
        console.log('\n🟢 PICKUP STOP:');
        console.log(JSON.stringify(pickupStops[0], null, 2));
      } else {
        console.log('\n❌ NO PICKUP STOP FOUND!');
      }
      
      if (destinationStops.length > 0) {
        console.log('\n🔴 DESTINATION STOP:');
        console.log(JSON.stringify(destinationStops[0], null, 2));
      } else {
        console.log('\n❌ NO DESTINATION STOP FOUND!');
      }
      
      console.log('\n📋 All stops:');
      data.stops.forEach((stop, i) => {
        const marker = stop.isPickup ? '🟢' : stop.isDestination ? '🔴' : '⚪';
        console.log(`${marker} ${i + 1}. ${stop.nome} (isPickup: ${stop.isPickup}, isDestination: ${stop.isDestination})`);
      });
    } else {
      console.log('❌ No stops in response!');
    }
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
  });
