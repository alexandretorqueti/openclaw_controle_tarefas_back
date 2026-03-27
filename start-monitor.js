#!/usr/bin/env node

// Script de inicialização do monitor
console.log('🚀 Inicializando Monitor de Tarefas...');

// Definir variáveis de ambiente
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Inicializar container de dependências
require('./bootstrap');

// Importar e executar o monitor
const monitor = require('./src/monitor');

monitor.main()
  .then(() => {
    console.log('✅ Monitor inicializado com sucesso');
  })
  .catch((err) => {
    console.error('💥 Erro ao inicializar o monitor:', err.message);
    console.error(err.stack);
    process.exit(1);
  });