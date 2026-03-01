const { spawn } = require('child_process');
const fs = require('fs');

const child = spawn('node', ['monitor.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';

child.stdout.on('data', (data) => {
  output += data.toString();
});

child.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

child.on('close', (code) => {
  if (errorOutput) {
    console.error(errorOutput);
  }
  console.log(output);
  process.exit(code);
});
