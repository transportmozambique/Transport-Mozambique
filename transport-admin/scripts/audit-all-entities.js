const fs = require('fs');
const path = require('path');

const entities = [
  'vias',
  'transportes', 
  'paragens',
  'proprietarios',
  'motoristas',
  'provincias',
  'municipios'
];

const pages = ['page.tsx', 'novo/page.tsx', '[id]/page.tsx', 'editar/page.tsx'];
const apiRoutes = ['route.ts', '[id]/route.ts'];

console.log('🔍 CRUD Audit Report\n');
console.log('='.repeat(80));

entities.forEach(entity => {
  console.log(`\n📦 ${entity.toUpperCase()}`);
  console.log('-'.repeat(80));
  
  // Check pages
  console.log('\n  Pages:');
  pages.forEach(page => {
    const pagePath = path.join(__dirname, '..', 'app', entity, page);
    const exists = fs.existsSync(pagePath);
    console.log(`    ${exists ? '✅' : '❌'} ${page}`);
  });
  
  // Check API routes
  console.log('\n  API Routes:');
  apiRoutes.forEach(route => {
    const routePath = path.join(__dirname, '..', 'app', 'api', entity, route);
    const exists = fs.existsSync(routePath);
    console.log(`    ${exists ? '✅' : '❌'} /api/${entity}/${route}`);
  });
  
  // Check for alerts in list page
  const listPagePath = path.join(__dirname, '..', 'app', entity, 'page.tsx');
  if (fs.existsSync(listPagePath)) {
    const content = fs.readFileSync(listPagePath, 'utf8');
    const hasAlerts = content.includes('alert(');
    const hasNotifications = content.includes('notification') || content.includes('toast');
    const hasDebounce = content.includes('useDebounce');
    const hasDeleteModal = content.includes('DeleteModal') || content.includes('showDeleteModal');
    
    console.log('\n  Code Quality:');
    console.log(`    ${hasAlerts ? '❌' : '✅'} No browser alerts`);
    console.log(`    ${hasNotifications ? '✅' : '❌'} Toast notifications`);
    console.log(`    ${hasDebounce ? '✅' : '❌'} Debounced search`);
    console.log(`    ${hasDeleteModal ? '✅' : '❌'} Delete confirmation modal`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('\n✨ Audit Complete!\n');
