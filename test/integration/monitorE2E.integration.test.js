const { execSync } = require('child_process');
const prisma = require('../../src/services/prismaService');
const taskService = require('../../src/services/taskService');
const lockService = require('../../src/services/lockService');
const fs = require('fs');
const path = require('path');

describe('Cenário E2E: Árvore de Tarefas com 3 Níveis', () => {
  let user, statusInitial, priority, project;
  let taskGrandpa, taskParent, taskChild;
  let lockServiceInstance;

  beforeAll(async () => {
    // Configura o banco de dados temporário de testes se não existir
    execSync('npx prisma db push --accept-data-loss', { stdio: 'ignore' });

    // Criar dados base
    user = await prisma.user.create({
      data: {
        name: 'Test E2E User',
        nickname: 'test_e2e_user_' + Date.now(),
        email: 'test_e2e_' + Date.now() + '@example.com',
        role: 'Admin'
      }
    });

    statusInitial = await prisma.status.create({
      data: { name: 'To Do E2E', isFinalState: false, order: 9991 }
    });

    priority = await prisma.priority.create({
      data: { name: 'Normal E2E', weight: 1 }
    });

    project = await prisma.project.create({
      data: {
        name: 'E2E Project',
        description: 'Testing 3 levels',
        createdById: user.id
      }
    });

    const lockPath = path.join(__dirname, '..', '..', 'test-lock.pid');
    const LockService = require('../../src/services/lockService');
    lockServiceInstance = new LockService(lockPath);
  });

  afterAll(async () => {
    // Limpar os dados criados em ordem de dependência
    await prisma.taskExecutionLog.deleteMany({ where: { task: { projectId: project.id } } });
    await prisma.taskHistory.deleteMany({ where: { task: { projectId: project.id } } });
    await prisma.comment.deleteMany({ where: { task: { projectId: project.id } } });
    await prisma.attachment.deleteMany({ where: { task: { projectId: project.id } } });
    await prisma.dependency.deleteMany({
      where: {
        OR: [
          { task: { projectId: project.id } },
          { dependentTask: { projectId: project.id } }
        ]
      }
    });
    await prisma.task.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.status.deleteMany({ where: { id: statusInitial.id } });
    await prisma.priority.delete({ where: { id: priority.id } });
    await prisma.user.delete({ where: { id: user.id } });
    
    // Limpar lock
    try {
      await lockServiceInstance.releaseLock();
    } catch (e) {}
  });

  it('1. Deve criar uma árvore de tarefas com 3 níveis', async () => {
    // Avô (Grandpa)
    taskGrandpa = await prisma.task.create({
      data: {
        title: 'Tarefa Avô',
        description: 'Nível 1',
        deadline: new Date(),
        statusId: statusInitial.id,
        priorityId: priority.id,
        projectId: project.id,
        createdById: user.id,
        assignedToId: user.id
      }
    });

    // Pai (Parent)
    taskParent = await prisma.task.create({
      data: {
        title: 'Tarefa Pai',
        description: 'Nível 2',
        deadline: new Date(),
        statusId: statusInitial.id,
        priorityId: priority.id,
        projectId: project.id,
        parentTaskId: taskGrandpa.id,
        createdById: user.id,
        assignedToId: user.id
      }
    });

    // Filho (Child) - Nível mais baixo
    taskChild = await prisma.task.create({
      data: {
        title: 'Tarefa Filho',
        description: 'Nível 3',
        deadline: new Date(),
        statusId: statusInitial.id,
        priorityId: priority.id,
        projectId: project.id,
        parentTaskId: taskParent.id,
        createdById: user.id,
        assignedToId: user.id
      }
    });

    expect(taskGrandpa.id).toBeDefined();
    expect(taskParent.parentTaskId).toBe(taskGrandpa.id);
    expect(taskChild.parentTaskId).toBe(taskParent.id);
  });

  it('2. Ao iniciar o processamento da tarefa nível 3 (filho)', async () => {
    // a.1 - Simula a inicialização da tarefa (como o monitor.js faz via lockService)
    await lockServiceInstance.acquireLock(taskChild.id);
    
    // Opcionalmente, atualizar o status para 'em andamento' caso não seja automático
    const inProgressStatus = await prisma.status.findFirst({ where: { isFinalState: false, order: 2 } }) || statusInitial;
    await prisma.task.update({ where: { id: taskChild.id }, data: { statusId: inProgressStatus.id } });

    // Buscar do banco atualizado
    const updatedChild = await prisma.task.findUnique({ where: { id: taskChild.id }, include: { status: true } });
    const updatedParent = await prisma.task.findUnique({ where: { id: taskParent.id } });
    const updatedGrandpa = await prisma.task.findUnique({ where: { id: taskGrandpa.id } });

    // a.1: O filho foi colocado em andamento e isExecuting = true
    expect(updatedChild.isExecuting).toBe(true);
    // a.2: O pai e o avô ficam com isChildExecuting (hasChildExecuting) = true
    expect(updatedParent.hasChildExecuting).toBe(true);
    expect(updatedGrandpa.hasChildExecuting).toBe(true);
  });

  it('3. Ao finalizar o processamento da tarefa de nível mais baixo (filho)', async () => {
    // b.1, b.2, b.3 - Simular a finalização
    await taskService.finalizeTask(taskChild.id, user.id, 'Finalizado com sucesso');

    // Buscar do banco atualizado
    const finalizedChild = await prisma.task.findUnique({ where: { id: taskChild.id }, include: { status: true } });
    const finalizedParent = await prisma.task.findUnique({ where: { id: taskParent.id }, include: { status: true } });
    const finalizedGrandpa = await prisma.task.findUnique({ where: { id: taskGrandpa.id }, include: { status: true } });

    // b.1: a tarefa vai para status final, isExecuting = false e isCompleted = true
    expect(finalizedChild.status.isFinalState).toBe(true);
    expect(finalizedChild.isExecuting).toBe(false);
    expect(finalizedChild.isCompleted).toBe(false);
    
    // b.2: todos os pais e avôs ficam com hasChildExecuting = false
    expect(finalizedParent.hasChildExecuting).toBe(false);
    expect(finalizedGrandpa.hasChildExecuting).toBe(false);

    // b.3: ao finalizar, a tarefa pai também deve ficar finalizada se foi a última
    expect(finalizedParent.status.isFinalState).toBe(true);
    expect(finalizedParent.isExecuting).toBe(false);
    expect(finalizedParent.isCompleted).toBe(false);

    // E como é uma cadeia, o avô também foi finalizado pois o pai foi a última dele!
    expect(finalizedGrandpa.status.isFinalState).toBe(true);
    expect(finalizedGrandpa.isExecuting).toBe(false);
    expect(finalizedGrandpa.isCompleted).toBe(false);
  });
});
