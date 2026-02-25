#!/usr/bin/env node
/**
 * SCRIPT SEGURO PARA RESTAURAÇÃO DE DADOS ESSENCIAIS
 * 
 * Este script apenas ADICIONA dados faltantes, NUNCA remove dados existentes.
 * É seguro executar múltiplas vezes (usando upsert para evitar duplicação).
 * 
 * CONFIGURAÇÕES NO .env:
 * - FRONTEND_PATH, FRONTEND_PORT, BACKEND_PATH, BACKEND_PORT, REPOSITORY_URL
 * - MAIN_PROJECT_NAME, MAIN_PROJECT_DESCRIPTION, MAIN_PROJECT_RULES
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configurações do ambiente
const CONFIG = {
  FRONTEND_PATH: process.env.FRONTEND_PATH,
  FRONTEND_PORT: parseInt(process.env.FRONTEND_PORT) || 3000,
  BACKEND_PATH: process.env.BACKEND_PATH,
  BACKEND_PORT: parseInt(process.env.BACKEND_PORT) || 3001,
  REPOSITORY_URL: process.env.REPOSITORY_URL,
  MAIN_PROJECT_NAME: process.env.MAIN_PROJECT_NAME,
  MAIN_PROJECT_DESCRIPTION: process.env.MAIN_PROJECT_DESCRIPTION,
  MAIN_PROJECT_RULES: process.env.MAIN_PROJECT_RULES
};

// Validar configurações obrigatórias
function validateConfig() {
  const required = ['FRONTEND_PATH', 'BACKEND_PATH', 'MAIN_PROJECT_NAME', 'MAIN_PROJECT_DESCRIPTION'];
  const missing = required.filter(key => !CONFIG[key]);
  
  if (missing.length > 0) {
    throw new Error(`Configurações obrigatórias faltando no .env: ${missing.join(', ')}`);
  }
  
  console.log('✅ Configurações carregadas do .env');
}

// Buscar IDs dos usuários dinamicamente
async function getUserIds() {
  console.log('🔍 Buscando IDs dos usuários...');
  
  // Buscar Alexandre pelo nickname
  const alexandre = await prisma.user.findFirst({
    where: { nickname: 'alexandre' },
    select: { id: true, name: true, nickname: true }
  });
  
  if (!alexandre) {
    throw new Error('❌ Usuário Alexandre (nickname: "alexandre") não encontrado no banco!');
  }
  
  // Buscar Jarbas pelo nickname 'test'
  const jarbas = await prisma.user.findFirst({
    where: { nickname: 'test' },
    select: { id: true, name: true, nickname: true }
  });
  
  if (!jarbas) {
    throw new Error('❌ Usuário Jarbas (nickname: "test") não encontrado no banco!');
  }
  
  console.log(`✅ Alexandre: ${alexandre.id} (${alexandre.name})`);
  console.log(`✅ Jarbas: ${jarbas.id} (${jarbas.name})`);
  
  return {
    ALEXANDRE_ID: alexandre.id,
    JARBAS_ID: jarbas.id
  };
}

// Restaurar statuses
async function restoreStatuses() {
  console.log('\n📊 Restaurando statuses...');
  
  const statuses = [
    {
      name: 'Pendente',
      colorCode: '#FFA726', // Laranja
      isFinalState: false,
      visible_to_ai: true,
      order: 1
    },
    {
      name: 'Em Andamento',
      colorCode: '#29B6F6', // Azul
      isFinalState: false,
      visible_to_ai: true,
      order: 2
    },
    {
      name: 'Concluído',
      colorCode: '#66BB6A', // Verde
      isFinalState: true,
      visible_to_ai: false,
      order: 3
    }
  ];
  
  for (const status of statuses) {
    const existing = await prisma.status.findFirst({
      where: { name: status.name }
    });
    
    if (!existing) {
      await prisma.status.create({ data: status });
      console.log(`✅ Status criado: ${status.name}`);
    } else {
      console.log(`⚠️  Status já existe: ${status.name}`);
    }
  }
}

// Restaurar prioridades
async function restorePriorities() {
  console.log('\n🎯 Restaurando prioridades...');
  
  const priorities = [
    { name: 'Baixa', weight: 1 },
    { name: 'Média', weight: 2 },
    { name: 'Alta', weight: 3 },
    { name: 'Crítica', weight: 4 }
  ];
  
  for (const priority of priorities) {
    const existing = await prisma.priority.findFirst({
      where: { name: priority.name }
    });
    
    if (!existing) {
      await prisma.priority.create({ data: priority });
      console.log(`✅ Prioridade criada: ${priority.name} (peso: ${priority.weight})`);
    } else {
      console.log(`⚠️  Prioridade já existe: ${priority.name}`);
    }
  }
}

// Restaurar projeto principal
async function restoreMainProject(userIds) {
  console.log('\n🏗️  Restaurando projeto principal...');
  
  const existingProject = await prisma.project.findFirst({
    where: { name: CONFIG.MAIN_PROJECT_NAME }
  });
  
  if (!existingProject) {
    await prisma.project.create({
      data: {
        name: CONFIG.MAIN_PROJECT_NAME,
        description: CONFIG.MAIN_PROJECT_DESCRIPTION,
        regras: CONFIG.MAIN_PROJECT_RULES,
        status: true,
        ativo: true,
        createdById: userIds.ALEXANDRE_ID,
        
        // Campos de repositório
        frontendPath: CONFIG.FRONTEND_PATH,
        frontendPort: CONFIG.FRONTEND_PORT,
        backendPath: CONFIG.BACKEND_PATH,
        backendPort: CONFIG.BACKEND_PORT,
        repositoryUrl: CONFIG.REPOSITORY_URL
      }
    });
    console.log(`✅ Projeto principal criado: "${CONFIG.MAIN_PROJECT_NAME}"`);
  } else {
    console.log(`⚠️  Projeto principal já existe: "${CONFIG.MAIN_PROJECT_NAME}"`);
    
    // Atualizar campos de repositório se necessário
    const needsUpdate = !existingProject.frontendPath || 
                       !existingProject.backendPath;
    
    if (needsUpdate) {
      await prisma.project.update({
        where: { id: existingProject.id },
        data: {
          frontendPath: CONFIG.FRONTEND_PATH,
          frontendPort: CONFIG.FRONTEND_PORT,
          backendPath: CONFIG.BACKEND_PATH,
          backendPort: CONFIG.BACKEND_PORT,
          repositoryUrl: CONFIG.REPOSITORY_URL
        }
      });
      console.log('✅ Campos de repositório atualizados no projeto existente');
    }
  }
}

// Verificação final
async function finalVerification() {
  console.log('\n📋 Verificação final dos dados...');
  
  const counts = {
    statuses: await prisma.status.count(),
    priorities: await prisma.priority.count(),
    projects: await prisma.project.count(),
    users: await prisma.user.count()
  };
  
  console.log('Dados no banco:');
  console.log(`  • Statuses: ${counts.statuses}`);
  console.log(`  • Prioridades: ${counts.priorities}`);
  console.log(`  • Projetos: ${counts.projects}`);
  console.log(`  • Usuários: ${counts.users}`);
  
  // Status visíveis para IA (CRÍTICO para task-processor)
  const aiStatuses = await prisma.status.findMany({
    where: { visible_to_ai: true },
    select: { name: true, id: true }
  });
  
  console.log('\n🎯 Status visíveis para IA (task-processor):');
  if (aiStatuses.length === 0) {
    throw new Error('❌ ERRO CRÍTICO: Nenhum status visível para IA encontrado! O task-processor não funcionará.');
  }
  
  aiStatuses.forEach(status => {
    console.log(`  • ${status.name} (ID: ${status.id})`);
  });
  
  console.log(`\n✅ Task-processor: Pronto com ${aiStatuses.length} status visíveis para IA`);
}

// Função principal
async function restoreEssentialData() {
  console.log('🔧 Iniciando restauração de dados essenciais...');
  console.log('⚠️  ATENÇÃO: Este script apenas ADICIONA dados, NUNCA remove!');
  
  try {
    // 1. Validar configurações
    validateConfig();
    
    // 2. Buscar IDs dos usuários
    const userIds = await getUserIds();
    
    // 3. Restaurar dados
    await restoreStatuses();
    await restorePriorities();
    await restoreMainProject(userIds);
    
    // 4. Verificação final
    await finalVerification();
    
    console.log('\n✅ RESTAURAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('🚀 Sistema pronto para uso com dados essenciais.');
    
  } catch (error) {
    console.error('\n❌ ERRO durante a restauração:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  restoreEssentialData();
}

module.exports = { restoreEssentialData };