#!/usr/bin/env node
/**
 * SCRIPT RÁPIDO PARA VER DADOS DO BANCO
 * Execute: node ver-dados-rapido.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verDados() {
  console.log('🔍 VERIFICANDO DADOS DO BANCO\n');
  
  // 1. USUÁRIOS
  console.log('👥 USUÁRIOS:');
  const users = await prisma.user.findMany({
    select: { id: true, name: true, nickname: true, email: true }
  });
  users.forEach(u => {
    console.log(`  • ${u.name} (${u.nickname}) - ID: ${u.id.substring(0, 8)}...`);
  });
  
  // 2. STATUS
  console.log('\n📊 STATUS:');
  const statuses = await prisma.status.findMany({
    select: { id: true, name: true, colorCode: true, visible_to_ai: true, order: true }
  });
  statuses.forEach(s => {
    const ai = s.visible_to_ai ? '✅ IA' : '❌ IA';
    console.log(`  • ${s.name} ${ai} - Cor: ${s.colorCode} - Ordem: ${s.order}`);
  });
  
  // 3. PRIORIDADES
  console.log('\n🎯 PRIORIDADES:');
  const priorities = await prisma.priority.findMany({
    select: { id: true, name: true, weight: true }
  });
  priorities.forEach(p => {
    console.log(`  • ${p.name} - Peso: ${p.weight}`);
  });
  
  // 4. PROJETOS
  console.log('\n🏗️ PROJETOS:');
  const projects = await prisma.project.findMany({
    select: { 
      id: true, 
      name: true, 
      description: true,
      frontendPath: true,
      backendPath: true,
      status: true
    }
  });
  projects.forEach(p => {
    const hasFrontend = p.frontendPath ? '✅' : '❌';
    const hasBackend = p.backendPath ? '✅' : '❌';
    console.log(`  • ${p.name}`);
    console.log(`    Descrição: ${p.description?.substring(0, 50)}...`);
    console.log(`    Frontend: ${hasFrontend} Backend: ${hasBackend}`);
  });
  
  // 5. TAREFAS (se houver)
  console.log('\n📝 TAREFAS:');
  const tasks = await prisma.task.findMany({
    select: { 
      id: true, 
      title: true, 
      statusId: true,
      assignedToId: true,
      isCompleted: true
    },
    take: 10 // Limitar a 10 tarefas
  });
  
  if (tasks.length === 0) {
    console.log('  • Nenhuma tarefa no banco');
  } else {
    tasks.forEach(t => {
      const completed = t.isCompleted ? '✅' : '❌';
      console.log(`  • ${t.title} ${completed} - ID: ${t.id.substring(0, 8)}...`);
    });
  }
  
  // 6. RESUMO
  console.log('\n📋 RESUMO:');
  const counts = {
    users: await prisma.user.count(),
    statuses: await prisma.status.count(),
    priorities: await prisma.priority.count(),
    projects: await prisma.project.count(),
    tasks: await prisma.task.count()
  };
  
  console.log(`  • Usuários: ${counts.users}`);
  console.log(`  • Status: ${counts.statuses}`);
  console.log(`  • Prioridades: ${counts.priorities}`);
  console.log(`  • Projetos: ${counts.projects}`);
  console.log(`  • Tarefas: ${counts.tasks}`);
  
  // 7. STATUS VISÍVEIS PARA IA (CRÍTICO)
  console.log('\n🎯 STATUS VISÍVEIS PARA IA (task-processor):');
  const aiStatuses = statuses.filter(s => s.visible_to_ai);
  if (aiStatuses.length === 0) {
    console.log('  ❌ NENHUM STATUS VISÍVEL PARA IA! TASK-PROCESSOR NÃO FUNCIONARÁ!');
  } else {
    aiStatuses.forEach(s => {
      console.log(`  • ${s.name} (ID: ${s.id.substring(0, 8)}...)`);
    });
  }
  
  await prisma.$disconnect();
  console.log('\n✅ Verificação concluída!');
}

verDados().catch(error => {
  console.error('❌ Erro:', error.message);
  process.exit(1);
});