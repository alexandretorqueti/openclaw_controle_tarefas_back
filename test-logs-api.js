// Test script for logs API
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/logs/monitor',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Testing logs API endpoint...');

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Response:', JSON.stringify(parsed, null, 2));
      
      if (parsed.logs && Array.isArray(parsed.logs)) {
        console.log(`\n✅ Success! Found ${parsed.logs.length} log entries.`);
        if (parsed.logs.length > 0) {
          console.log('\nFirst 3 log entries:');
          parsed.logs.slice(0, 3).forEach((log, i) => {
            console.log(`${i + 1}: ${log.substring(0, 100)}...`);
          });
        }
      } else {
        console.log('\n⚠️ No logs array in response');
      }
    } catch (err) {
      console.error('Error parsing response:', err);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (err) => {
  console.error('Request error:', err.message);
  
  // Check if server is running
  console.log('\n⚠️ Make sure the backend server is running:');
  console.log('   cd /home/alexandrebragatorqueti/projetos/tarefas-server');
  console.log('   npm run dev');
});

req.end();