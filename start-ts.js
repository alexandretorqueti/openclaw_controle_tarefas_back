#!/usr/bin/env node
/**
 * Script de inicialização para TypeScript
 * Usa ts-node para executar código TypeScript diretamente
 */

// Carregar variáveis de ambiente se houver
require('dotenv').config();

// Executar monitor.ts
require('ts-node/register');
require('./src/monitor.ts');
