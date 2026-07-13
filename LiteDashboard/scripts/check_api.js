const http = require('http');

async function check() {
  const login = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'test1234' })
  });
  const cookie = login.headers.get('set-cookie');
  console.log('Cookie:', cookie);
  
  const req = await fetch('http://localhost:3000/api/widget-data/crypto-desk', {
    headers: { 'Cookie': cookie }
  });
  
  const data = await req.text();
  console.log('Status:', req.status);
  console.log('Data:', data.substring(0, 500)); // Print first 500 chars to avoid huge log
}

check();
