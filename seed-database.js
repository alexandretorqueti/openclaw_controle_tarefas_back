#!/usr/bin/env node
/**
 * Script para popular o banco de dados com dados iniciais
 * 
 * Executar: node seed-database.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');
  
  try {
    // 1. Criar usuários
    console.log('👥 Criando usuários...');
    
    const users = [
      {
        name: 'Alexandre',
        nickname: 'alexandre',
        email: 'alexandre@example.com',
        avatarUrl: null,
        role: 'Admin'
      },
      {
        name: 'Jarbas',
        nickname: 'jarbas',
        email: 'jarbas@example.com',
        avatarUrl: null,
        role: 'Admin'
      }
    ];
    
    for (const userData of users) {
      const existingUser = await prisma.user.findUnique({
        where: { nickname: userData.nickname }
      });
      
      if (!existingUser) {
        await prisma.user.create({
          data: userData
        });
        console.log(`✅ Usuário criado: ${userData.name} (${userData.nickname})`);
      } else {
        console.log(`⚠️ Usuário já existe: ${userData.name}`);
      }
    }
    
    // 2. Criar prioridades
    console.log('📊 Criando prioridades...');
    
    const priorities = [
      { name: 'Baixa', weight: 1 },
      { name: 'Média', weight: 2 },
      { name: 'Alta', weight: 3 }
    ];
    
    for (const priorityData of priorities) {
      const existingPriority = await prisma.priority.findFirst({
        where: { name: priorityData.name }
      });
      
      if (!existingPriority) {
        await prisma.priority.create({
          data: priorityData
        });
        console.log(`✅ Prioridade criada: ${priorityData.name}`);
      } else {
        console.log(`⚠️ Prioridade já existe: ${priorityData.name}`);
      }
    }
    
    // 3. Criar status
    console.log('📋 Criando status...');
    
    const statuses = [
      { 
        name: 'Pendente', 
        order: 1, 
        colorCode: '#9E9E9E',
        isFinalState: false,
        visibleToAi: true
      },
      { 
        name: 'Em Andamento', 
        order: 2, 
        colorCode: '#2196F3',
        isFinalState: false,
        visibleToAi: false  // Não visível para IA
      },
      { 
        name: 'Programação Finalizada', 
        order: 3, 
        colorCode: '#4CAF50',
        isFinalState: true,
        visibleToAi: false  // Não visível para IA
      }
    ];
    
    for (const statusData of statuses) {
      const existingStatus = await prisma.status.findFirst({
        where: { name: statusData.name }
      });
      
      if (!existingStatus) {
        await prisma.status.create({
          data: statusData
        });
        console.log(`✅ Status criado: ${statusData.name}`);
      } else {
        console.log(`⚠️ Status já existe: ${statusData.name}`);
      }
    }
    
    // 4. Criar projeto "Sistema de Gestão de Tarefas"
    console.log('🏗️ Criando projeto principal...');
    
    const alexandreUser = await prisma.user.findUnique({
      where: { nickname: 'alexandre' }
    });
    
    if (alexandreUser) {
      const existingProject = await prisma.project.findFirst({
        where: { name: 'Sistema de Gestão de Tarefas' }
      });
      
      if (!existingProject) {
        const project = await prisma.project.create({
          data: {
            name: 'Sistema de Gestão de Tarefas',
            description: 'Sistema completo para gestão de tarefas com arquitetura de agentes IA',
            regras: `# Regras do Sistema de Gestão de Tarefas

## Fluxo de Trabalho
1. Tarefas são criadas com prioridade e status inicial
2. Agentes IA analisam e executam tarefas automaticamente
3. Monitoramento em tempo real do progresso

## Agentes Disponíveis
- **Arquiteto**: Planeja soluções técnicas
- **Desenvolvedor**: Implementa código
- **Analista**: Analisa requisitos
- **QA**: Testa implementações

## Regras Técnicas
- Backend: Node.js + Express + Prisma
- Frontend: React + TypeScript
- Banco: SQLite (dev) / PostgreSQL (prod)
- IA: OpenClaw + múltiplos modelos`,
            status: true,
            ativo: true,
            pastaBase: '/home/alexandrebragatorqueti/projetos/monitor-tarefas',
            frontendPath: 'tarefas-web',
            backendPath: 'tarefas-server',
            frontendPort: 3000,
            backendPort: 3001,
            repositoryUrl: 'https://github.com/seu-usuario/monitor-tarefas',
            frontendBuildCmd: 'npm run build',
            backendBuildCmd: 'npm run build',
            createdById: alexandreUser.id
          }
        });
        
        console.log(`✅ Projeto criado: ${project.name} (ID: ${project.id})`);
        
        // 5. Criar algumas tarefas de exemplo
        console.log('📝 Criando tarefas de exemplo...');
        
        const mediumPriority = await prisma.priority.findFirst({
          where: { name: 'Média' }
        });
        
        const pendingStatus = await prisma.status.findFirst({
          where: { name: 'Pendente' }
        });
        
        // Buscar usuário jarbas para atribuição
        const jarbasUser = await prisma.user.findUnique({
          where: { nickname: 'jarbas' }
        });
        
        if (!jarbasUser) {
          throw new Error('Usuário jarbas não encontrado para atribuição de tarefas');
        }
        
        const exampleTasks = [
          {
            title: 'Configurar ambiente de desenvolvimento',
            description: 'Instalar dependências e configurar variáveis de ambiente',
            priority: { connect: { id: mediumPriority ? mediumPriority.id : undefined } },
            status: { connect: { id: pendingStatus ? pendingStatus.id : undefined } },
            project: { connect: { id: project.id } },
            createdBy: { connect: { id: alexandreUser.id } },
            assignedTo: { connect: { id: jarbasUser.id } },
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias
          },
          {
            title: 'Implementar autenticação de usuários',
            description: 'Criar sistema de login e controle de acesso',
            priority: { connect: { id: mediumPriority ? mediumPriority.id : undefined } },
            status: { connect: { id: pendingStatus ? pendingStatus.id : undefined } },
            project: { connect: { id: project.id } },
            createdBy: { connect: { id: alexandreUser.id } },
            assignedTo: { connect: { id: jarbasUser.id } },
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 dias
          },
          {
            title: 'Criar dashboard de monitoramento',
            description: 'Interface para visualizar progresso das tarefas',
            priority: { connect: { id: mediumPriority ? mediumPriority.id : undefined } },
            status: { connect: { id: pendingStatus ? pendingStatus.id : undefined } },
            project: { connect: { id: project.id } },
            createdBy: { connect: { id: alexandreUser.id } },
            assignedTo: { connect: { id: jarbasUser.id } },
            deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // 10 dias
          }
        ];
        
        for (const taskData of exampleTasks) {
          await prisma.task.create({
            data: taskData
          });
          console.log(`✅ Tarefa criada: ${taskData.title}`);
        }
        
      } else {
        console.log(`⚠️ Projeto já existe: ${existingProject.name}`);
      }
    } else {
      console.log('❌ Usuário "alexandre" não encontrado para criar projeto');
    }
    
    // 6. Criar tipo de projeto padrão
    console.log('🏷️ Criando tipo de projeto padrão...');
    
    const existingProjectType = await prisma.projectType.findFirst({
      where: { name: 'Sistema Web' }
    });
    
    if (!existingProjectType) {
      await prisma.projectType.create({
        data: {
          name: 'Sistema Web',
          personaPrompt: `Você é um arquiteto de software especializado em sistemas web.
Analise os requisitos e crie um plano técnico detalhado.
Foque em:
1. Arquitetura frontend (React/Vue)
2. Backend API (Node.js/Express)
3. Banco de dados (SQL/NoSQL)
4. Autenticação e segurança
5. Deploy e monitoramento`,
          baseRules: `# Regras para Sistemas Web

## Stack Recomendada
- Frontend: React com TypeScript
- Backend: Node.js + Express
- Banco: PostgreSQL ou MongoDB
- Autenticação: JWT + refresh tokens

## Boas Práticas
- Componentes reutilizáveis
- API RESTful com versionamento
- Testes unitários e de integração
- Documentação Swagger/OpenAPI

## Segurança
- Validação de entrada
- Proteção contra XSS e SQL injection
- Rate limiting
- Logs de auditoria`
        }
      });
      console.log('✅ Tipo de projeto criado: Sistema Web');
    } else {
      console.log('⚠️ Tipo de projeto já existe: Sistema Web');
    }
    
    console.log('\n🎉 Seed concluído com sucesso!');
    console.log('\n📊 Resumo:');
    console.log('- 👥 2 usuários (alexandre, jarbas)');
    console.log('- 📊 3 prioridades (Baixa, Média, Alta)');
    console.log('- 📋 3 status (Pendente, Em Andamento, Programação Finalizada)');
    console.log('- 🏗️ 1 projeto (Sistema de Gestão de Tarefas)');
    console.log('- 📝 3 tarefas de exemplo');
    console.log('- 🏷️ 1 tipo de projeto (Sistema Web)');
    
  } catch (error) {
    console.error('❌ Erro durante o seed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = { main };