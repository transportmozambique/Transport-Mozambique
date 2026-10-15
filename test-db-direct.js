const { Client } = require('pg');
require('dotenv').config();

async function testConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Tentando conectar ao banco de dados...');
    await client.connect();
    console.log('Conexão bem-sucedida!');
    
    const res = await client.query('SELECT current_database(), now()');
    console.log('Resposta do BD:', res.rows[0]);
    
    const admins = await client.query('SELECT id, nome, email FROM "Administrador"');
    console.log('Administradores no BD:', admins.rows);
    
    await client.end();
  } catch (err) {
    console.error('Erro na conexão:', err);
  }
}

testConnection();
