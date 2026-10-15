/**
 * Fix Invalid Via Colors
 * 
 * This script fixes vias that have invalid hex color codes
 * (e.g., 5 characters instead of 6)
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function getValidColor(color) {
  const defaultColor = '#3B82F6';
  
  if (!color || typeof color !== 'string' || !color.startsWith('#')) {
    return defaultColor;
  }
  
  const hexPart = color.substring(1);
  
  // Check if it contains only valid hex characters
  if (!/^[0-9A-Fa-f]+$/.test(hexPart)) {
    return defaultColor;
  }
  
  if (hexPart.length === 6) {
    return color;
  } else if (hexPart.length < 6) {
    // Pad with zeros
    return '#' + hexPart.padEnd(6, '0');
  } else {
    // Truncate to 6 characters
    return '#' + hexPart.substring(0, 6);
  }
}

async function fixViaColors() {
  console.log('🎨 Fixing Via Colors...\n');
  console.log('='.repeat(70));
  
  try {
    // Get all vias
    const vias = await prisma.via.findMany({
      select: {
        id: true,
        codigo: true,
        nome: true,
        cor: true,
      }
    });
    
    console.log(`Found ${vias.length} vias\n`);
    
    let fixedCount = 0;
    const fixes = [];
    
    for (const via of vias) {
      const originalColor = via.cor;
      const validColor = getValidColor(originalColor);
      
      if (originalColor !== validColor) {
        fixes.push({
          codigo: via.codigo,
          nome: via.nome,
          original: originalColor,
          fixed: validColor
        });
        
        await prisma.via.update({
          where: { id: via.id },
          data: { cor: validColor }
        });
        
        fixedCount++;
      }
    }
    
    console.log(`✅ Fixed ${fixedCount} vias with invalid colors\n`);
    
    if (fixes.length > 0) {
      console.log('Examples of fixes:');
      fixes.slice(0, 10).forEach(fix => {
        console.log(`  ${fix.codigo} - ${fix.nome}`);
        console.log(`    ${fix.original} → ${fix.fixed}`);
      });
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ All via colors are now valid!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixViaColors();
