const net = require('net');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { servicesConfig } = require('./config');
const { log } = require('./logger');

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
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

function startService(service) {
  log(`🚀 Iniciando ${service.name} na porta ${service.port}...`);
  
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
    log(`✅ Comando enviado. Se a porta não abrir, leia o log: ${logFilePath}`);
    
  } catch (err) {
    log(`❌ Falha ao tentar rodar o comando do ${service.name}: ${err.message}`);
  }
}

async function verifyEnvironmentHealth() {
  log('--- VERIFICANDO SAÚDE DO AMBIENTE ---');
  let environmentHealthy = true;

  // Proteção: Se a variável de ambiente estiver mal formatada, avisa.
  if (!Array.isArray(servicesConfig)) {
    throw new Error("A configuração PROJECT_SERVICES no .env é inválida ou não é um Array.");
  }

  for (const service of servicesConfig) {
    if (!service.port || !service.path) {
      log(`⚠️ Serviço mal configurado no .env: ${JSON.stringify(service)}`);
      continue;
    }

    const isOpen = await isPortOpen(service.port);
    if (isOpen) {
      log(`✅ ${service.name} (Porta ${service.port}) OK.`);
    } else {
      log(`🔴 ${service.name} (Porta ${service.port}) OFFLINE. Iniciando...`);
      startService(service);
      environmentHealthy = false;
    }
  }

  if (!environmentHealthy) {
    log('⏳ Aguardando 5 segundos para os serviços subirem...');
    await new Promise(resolve => setTimeout(resolve, 30000)); // Espera 30 segundos para dar tempo dos serviços iniciarem
  }
  return true;
}

module.exports = { verifyEnvironmentHealth };