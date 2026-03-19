#!/usr/bin/env node

/**
 * Script para testar atualização em tempo real dos terminais
 * Simula o analista/programador escrevendo no terminal
 */

const http = require('http');

const API_BASE = 'http://localhost:4001';
const TASK_ID = 'ce3f8d21-c992-4d3e-be6a-6a4a8ca91898'; // ID da tarefa de teste

// Conteúdo para simular digitação
const analistaContent = [
  "🧠 Iniciando análise da tarefa...\n",
  "📋 Verificando requisitos...\n",
  "🔍 Analisando complexidade: MÉDIA\n",
  "📊 Identificando dependências: 3 tarefas\n",
  "⏱️ Estimativa de tempo: 6 horas\n",
  "✅ Análise concluída com sucesso!\n"
];

const programadorContent = [
  "💻 Iniciando implementação...\n",
  "$ npm install\n",
  "✅ Dependências instaladas\n",
  "$ npm run test\n",
  "✅ Todos os testes passaram (15/15)\n",
  "$ npm run build\n",
  "✅ Build concluído (1.4MB)\n",
  "🚀 Deploy realizado com sucesso!\n"
];

function sendTerminalUpdate(type, content) {
  const data = JSON.stringify({
    type,
    content,
    taskId: TASK_ID,
    timestamp: new Date().toISOString()
  });

  const options = {
    hostname: 'localhost',
    port: 4001,
    path: '/api/test/terminal-update',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  const req = http.request(options, (res) => {
    console.log(`📤 Enviado: ${type} - "${content.substring(0, 30)}..."`);
    console.log(`   Status: ${res.statusCode}`);
  });

  req.on('error', (error) => {
    console.error(`❌ Erro ao enviar: ${error.message}`);
  });

  req.write(data);
  req.end();
}

// Função para simular digitação letra por letra
function simulateTyping(type, fullContent, callback) {
  let index = 0;
  const interval = setInterval(() => {
    if (index < fullContent.length) {
      const char = fullContent[index];
      sendTerminalUpdate(type, char);
      index++;
    } else {
      clearInterval(interval);
      if (callback) callback();
    }
  }, 50); // 50ms por caractere
}

// Função principal
async function main() {
  console.log('🚀 Iniciando simulação de terminais em tempo real...\n');
  
  // Simular analista
  console.log('🧠 Simulando Analista AI...');
  for (const chunk of analistaContent) {
    simulateTyping('analista', chunk);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Aguarda 2 segundos entre chunks
  }
  
  console.log('\n⏳ Aguardando 3 segundos...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Simular programador
  console.log('💻 Simulando Programador AI...');
  for (const chunk of programadorContent) {
    simulateTyping('programador', chunk);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Aguarda 1.5 segundos entre chunks
  }
  
  console.log('\n✅ Simulação concluída!');
}

// Executar
main().catch(console.error);