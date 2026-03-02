// aux/network.js

const net = require('net');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { servicesConfig } = require('./config');
const { log } = require('./logger');

function isPortOpen(port) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.on('error', () => { socket.destroy(); reject(); });
    socket.on('timeout', () => { socket.destroy(); reject(); });
    // O VERDADEIRO TIMEOUT: Se em 2 segundos a porta não falar nada, matamos.
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 2000);

    socket.on('connect', () => { 
      clearTimeout(timer); 
      socket.destroy(); 
      resolve(true); 
    });
    
    socket.on('error', () => { 
      clearTimeout(timer); 
      socket.destroy(); 
      resolve(false); 
    });
    
    // Conecta estritamente no localhost IPv4 para evitar conflitos de IPv6
    socket.connect(port, '127.0.0.1');
  });
}

async function startService(service) {
  await log(`🚀 Iniciando ${service.name} na porta ${service.port}...`);
  
  try {
    // Cria log na pasta do projeto para sabermos POR QUE ele não sobe
    const logFilePath = path.join(service.path, `startup-${service.name.toLowerCase()}.log`);
    const outLog = fs.openSync(logFilePath, 'a');
    
    const child = spawn(service.cmd, [], {
      cwd: service.path,
      detached: true,
      shell: true, // Crucial para rodar comandos como 'npm' nativamente no Linux
      stdio: ['ignore', outLog, outLog]
    });

    child.unref(); 
    await log(`✅ Comando enviado. Se a porta não abrir, leia o log: ${logFilePath}`);
    
  } catch (err) {
    await log(`❌ Falha ao tentar rodar o comando do ${service.name}: ${err.message}`);
  }
}

async function verifyEnvironmentHealth() {
  await log('--- VERIFICANDO SAÚDE DO AMBIENTE ---');
  let environmentHealthy = true;

  // Proteção: Se a variável de ambiente estiver mal formatada, avisa.
  if (!Array.isArray(servicesConfig)) {
    await log("A configuração PROJECT_SERVICES no .env é inválida ou não é um Array.");
    return false;
  }

  for (const service of servicesConfig) {
    if (!service.port || !service.path) {
      await log(`⚠️ Serviço mal configurado no .env: ${JSON.stringify(service)}`);
      continue;
    }

    const isOpen = await isPortOpen(service.port);
    if (isOpen) {
      await log(`✅ ${service.name} (Porta ${service.port}) OK.`);
    } else {
      await log(`🔴 ${service.name} (Porta ${service.port}) OFFLINE. Iniciando...`);
      await startService(service);
      environmentHealthy = false;
    }
  }

  if (!environmentHealthy) {
    await log('⏳ Aguardando 5 segundos para os serviços subirem...');
    await new Promise(resolve => setTimeout(resolve, 30000)); // Espera 30 segundos para dar tempo dos serviços iniciarem
  }
  return true;
}

module.exports = { verifyEnvironmentHealth };

