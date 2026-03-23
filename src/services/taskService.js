var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
// src/services/taskService.js
const prisma = require('./prismaService');
const NotificationService = require('./notificationService');
const sseService = require('./sseService'); // <-- 1. Importa o serviço SSE
const taskHierarchyService = require('./taskHierarchyService'); // <-- Serviço de hierarquia
class TaskService {
    // Função auxiliar para executar git
    exec(command, args, cwd) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, { cwd, stdio: 'pipe' });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (data) => stdout += data.toString());
            child.stderr.on('data', (data) => stderr += data.toString());
            child.on('close', (code) => {
                if (code === 0)
                    resolve(stdout);
                else
                    reject(new Error(`${command} ${args[0]} failed: ${stderr}`));
            });
        });
    }
    // Função principal de commit
    checkAndCommit(projectPath, taskId, taskTitle) {
        return __awaiter(this, void 0, void 0, function* () {
            return false;
            try {
                // Verificar se path existe e tem .git
                if (!fs.existsSync(projectPath) || !fs.existsSync(path.join(projectPath, '.git'))) {
                    return false;
                }
                // Verificar alterações
                const status = yield this.exec('git', ['status', '--porcelain'], projectPath);
                if (!status.trim())
                    return false; // Sem alterações
                // Criar branch com o Id da tarefa e primeiras letras da tarefa, trocando espaços por hífens
                const branchName = `${taskId}-${taskTitle.toLowerCase().replace(/\s+/g, '-').substring(0, 50)}`;
                yield this.exec('git', ['checkout', '-b', branchName], projectPath);
                // Fazer commit
                /*
                await this.exec('git', ['add', '.'], projectPath);
                const commitMessage = `${taskId}: ${taskTitle}`;
                await this.exec('git', ['commit', '-m', commitMessage], projectPath);
                */
                return true;
            }
            catch (error) {
                console.error(`Git commit failed for ${projectPath}:`, error.message);
                return false;
            }
        });
    }
    // Faz build das aplicações e confere se há erros
    buildProject(projectPath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Build da branch atual
                const buildResult = yield this.exec('npm', (['run', 'build'], projectPath));
                return { success: true, output: buildResult };
            }
            catch (error) {
                return { success: false, output: error.message };
            }
        });
    }
    // Validate referenced IDs exist before creating a task
    validateReferences(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const errors = [];
            // Check project exists
            const project = yield prisma.project.findUnique({
                where: { id: data.projectId }
            });
            if (!project) {
                errors.push(`Project with ID ${data.projectId} not found`);
            }
            // Check status exists
            const status = yield prisma.status.findUnique({
                where: { id: data.statusId }
            });
            if (!status) {
                errors.push(`Status with ID ${data.statusId} not found`);
            }
            // Check priority exists
            const priority = yield prisma.priority.findUnique({
                where: { id: data.priorityId }
            });
            if (!priority) {
                errors.push(`Priority with ID ${data.priorityId} not found`);
            }
            // Check creator exists
            const creator = yield prisma.user.findUnique({
                where: { id: data.createdById }
            });
            if (!creator) {
                errors.push(`Creator with ID ${data.createdById} not found`);
            }
            // Check assignee exists
            const assignee = yield prisma.user.findUnique({
                where: { id: data.assignedToId }
            });
            if (!assignee) {
                errors.push(`Assignee with ID ${data.assignedToId} not found`);
            }
            // Check parent task exists if provided
            if (data.parentTaskId) {
                const parentTask = yield prisma.task.findUnique({
                    where: { id: data.parentTaskId }
                });
                if (!parentTask) {
                    errors.push(`Parent task with ID ${data.parentTaskId} not found`);
                }
                else if (parentTask.projectId !== data.projectId) {
                    errors.push(`Parent task belongs to a different project`);
                }
            }
            if (errors.length > 0) {
                const error = new Error(`Validation failed: ${errors.join(', ')}`);
                error.validationErrors = errors;
                error.statusCode = 400;
                throw error;
            }
            return { project, status, priority, creator, assignee };
        });
    }
    // Create a new task
    createTask(data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate all referenced IDs exist
            yield this.validateReferences(data);
            // Process recurrence fields
            // Handle both arrays and already stringified JSON
            const recurrenceTimes = data.recurrenceTimes ?
                (typeof data.recurrenceTimes === 'string' ? data.recurrenceTimes : JSON.stringify(data.recurrenceTimes)) :
                null;
            const recurrenceDays = data.recurrenceDays ?
                (typeof data.recurrenceDays === 'string' ? data.recurrenceDays : JSON.stringify(data.recurrenceDays)) :
                null;
            // Calculate next execution time if task is recurring
            let nextExecutionAt = null;
            if (data.isRecurring && data.recurrenceType) {
                nextExecutionAt = this.calculateNextExecution(data);
            }
            const newTask = yield prisma.task.create({
                data: {
                    title: data.title,
                    description: data.description,
                    deadline: new Date(data.deadline),
                    position: data.position || 0,
                    isCompleted: data.isCompleted || false,
                    // Recurrence fields
                    isRecurring: data.isRecurring || false,
                    recurrenceType: data.recurrenceType || null,
                    recurrenceTimes: recurrenceTimes,
                    recurrenceDays: recurrenceDays,
                    lastExecutedAt: null,
                    nextExecutionAt: nextExecutionAt,
                    projectId: data.projectId,
                    statusId: data.statusId,
                    priorityId: data.priorityId,
                    createdById: data.createdById,
                    assignedToId: data.assignedToId,
                    agent: data.agent || null,
                    parentTaskId: data.parentTaskId || null
                },
                include: {
                    project: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    status: true,
                    priority: true,
                    createdBy: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatarUrl: true
                        }
                    },
                    assignedTo: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatarUrl: true
                        }
                    },
                    parentTask: {
                        select: {
                            id: true,
                            title: true
                        }
                    }
                }
            });
            // Emitir evento SSE para criação em tempo real
            try {
                console.log(`📢 TaskService (PRE-BROADCAST): Preparando para emitir task_created para ${newTask.id}. Clientes conectados: ${sseService.clients.length}`);
                sseService.broadcast('task_created', newTask);
                console.log(`✅ TaskService: Evento task_created emitido com sucesso`);
            }
            catch (error) {
                console.error(`❌ TaskService: Erro ao emitir evento task_created:`, error);
            }
            return newTask;
        });
    }
    // Get all tasks with filters
    getAllTasks(filters = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const where = {};
            if (filters.projectId) {
                where.projectId = filters.projectId;
            }
            if (filters.statusId) {
                where.statusId = filters.statusId;
            }
            if (filters.priorityId) {
                where.priorityId = filters.priorityId;
            }
            if (filters.assignedToId) {
                where.assignedToId = filters.assignedToId;
            }
            // Filtro para parentTaskId (subtarefas)
            if (filters.parentTaskId !== undefined) {
                if (filters.parentTaskId === null || filters.parentTaskId === '' || filters.parentTaskId === 'null') {
                    where.parentTaskId = null;
                }
                else {
                    where.parentTaskId = filters.parentTaskId;
                }
            }
            else {
                // Se parentTaskId não for passado, assumimos que queremos as tarefas raiz do projeto
                where.parentTaskId = null;
            }
            // Default to excluding completed tasks unless explicitly requested
            if (filters.isCompleted !== undefined) {
                where.isCompleted = filters.isCompleted === true; // Espera booleano true/false
            }
            else {
                where.isCompleted = false; // Valor padrão: não trazer tarefas completas
            }
            console.log('DEBUG getAllTasks final where:', JSON.stringify(where));
            if (filters.search) {
                where.OR = [
                    { title: { contains: filters.search, mode: 'insensitive' } },
                    { description: { contains: filters.search, mode: 'insensitive' } }
                ];
            }
            return yield prisma.task.findMany({
                where,
                include: {
                    project: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            regras: true
                        }
                    },
                    status: true,
                    priority: true,
                    createdBy: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatarUrl: true
                        }
                    },
                    assignedTo: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatarUrl: true
                        }
                    },
                    parentTask: {
                        select: {
                            id: true,
                            title: true
                        }
                    },
                    subtasks: {
                        select: {
                            id: true,
                            title: true,
                            isCompleted: true
                        }
                    },
                    parentTask: {
                        select: {
                            id: true,
                            title: true
                        }
                    },
                },
                orderBy: {
                    [filters.sortBy || 'deadline']: filters.sortOrder || 'asc'
                }
            });
        });
    }
    // Get task by ID with all details
    getTaskById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield prisma.task.findUnique({
                where: { id },
                include: {
                    project: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            regras: true
                        }
                    },
                    status: true,
                    priority: true,
                    createdBy: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatarUrl: true
                        }
                    },
                    assignedTo: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatarUrl: true
                        }
                    },
                    parentTask: {
                        select: {
                            id: true,
                            title: true
                        }
                    },
                    subtasks: {
                        include: {
                            status: true,
                            priority: true,
                            assignedTo: {
                                select: {
                                    id: true,
                                    name: true,
                                    avatarUrl: true
                                }
                            }
                        }
                    },
                    dependencies: {
                        include: {
                            dependentTask: {
                                select: {
                                    id: true,
                                    title: true,
                                    status: true
                                }
                            }
                        }
                    },
                    dependents: {
                        include: {
                            task: {
                                select: {
                                    id: true,
                                    title: true,
                                    status: true
                                }
                            }
                        }
                    },
                    comments: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    avatarUrl: true
                                }
                            },
                            replies: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            name: true,
                                            avatarUrl: true
                                        }
                                    }
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
                    },
                    attachments: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
                    },
                    history: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        },
                        orderBy: {
                            timestamp: 'desc'
                        }
                    }
                }
            });
        });
    }
    // Validate update references
    validateUpdateReferences(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const errors = [];
            // Get current task to check project context
            const currentTask = yield prisma.task.findUnique({
                where: { id },
                select: { projectId: true }
            });
            if (!currentTask) {
                throw new Error(`Task with ID ${id} not found`);
            }
            // Check project exists if being updated
            if (data.projectId) {
                const project = yield prisma.project.findUnique({
                    where: { id: data.projectId }
                });
                if (!project) {
                    errors.push(`Project with ID ${data.projectId} not found`);
                }
            }
            // Check status exists if being updated
            if (data.statusId) {
                const status = yield prisma.status.findUnique({
                    where: { id: data.statusId }
                });
                if (!status) {
                    errors.push(`Status with ID ${data.statusId} not found`);
                }
            }
            // Check priority exists if being updated
            if (data.priorityId) {
                const priority = yield prisma.priority.findUnique({
                    where: { id: data.priorityId }
                });
                if (!priority) {
                    errors.push(`Priority with ID ${data.priorityId} not found`);
                }
            }
            // Check assignee exists if being updated
            if (data.assignedToId) {
                const assignee = yield prisma.user.findUnique({
                    where: { id: data.assignedToId }
                });
                if (!assignee) {
                    errors.push(`Assignee with ID ${data.assignedToId} not found`);
                }
            }
            // Check parent task exists if provided
            if (data.parentTaskId !== undefined) {
                if (data.parentTaskId === null) {
                    // Allow null (removing parent)
                }
                else {
                    const parentTask = yield prisma.task.findUnique({
                        where: { id: data.parentTaskId }
                    });
                    if (!parentTask) {
                        errors.push(`Parent task with ID ${data.parentTaskId} not found`);
                    }
                    else {
                        // Check parent task belongs to same project (or new project if project is being updated)
                        const targetProjectId = data.projectId || currentTask.projectId;
                        if (parentTask.projectId !== targetProjectId) {
                            errors.push(`Parent task belongs to a different project`);
                        }
                        // Check for circular reference
                        if (parentTask.id === id) {
                            errors.push(`Task cannot be its own parent`);
                        }
                    }
                }
            }
            if (errors.length > 0) {
                const error = new Error(`Validation failed: ${errors.join(', ')}`);
                error.validationErrors = errors;
                error.statusCode = 400;
                throw error;
            }
        });
    }
    // Update task
    updateTask(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate update references
            yield this.validateUpdateReferences(id, data);
            // Check if status is changing to record history
            const oldTask = yield prisma.task.findUnique({
                where: { id },
                select: { statusId: true, createdById: true, isExecuting: true }
            });
            if (!oldTask) {
                throw new Error(`Task with ID ${id} not found`);
            }
            // Se isExecuting foi alterado, atualizar hierarquia ANTES da transação
            if (data.isExecuting !== undefined && data.isExecuting !== null) {
                console.log(`🔍 TaskService: Verificando mudança de isExecuting para task ${id}, novo valor: ${data.isExecuting}, antigo: ${oldTask.isExecuting}`);
                if (oldTask.isExecuting !== data.isExecuting) {
                    console.log(`🔄 TaskService: isExecuting MUDOU de ${oldTask.isExecuting} para ${data.isExecuting} na tarefa ${id}`);
                    try {
                        yield taskHierarchyService.updateHierarchyOnExecutionChange(id, data.isExecuting);
                        console.log(`✅ TaskService: Hierarquia atualizada para task ${id}`);
                    }
                    catch (hierarchyError) {
                        console.error(`❌ TaskService: Erro ao atualizar hierarquia: ${hierarchyError.message}`);
                        // Não lançar erro para não quebrar a atualização principal
                    }
                }
                else {
                    console.log(`ℹ️ TaskService: isExecuting NÃO mudou para task ${id} (antigo: ${oldTask.isExecuting}, novo: ${data.isExecuting})`);
                }
            }
            // Process recurrence fields
            const updateData = {
                title: data.title,
                description: data.description,
                deadline: data.deadline !== undefined ? (data.deadline ? new Date(data.deadline) : null) : undefined,
                position: data.position,
                isCompleted: data.isCompleted,
                projectId: data.projectId,
                statusId: data.statusId,
                priorityId: data.priorityId,
                assignedToId: data.assignedToId,
                parentTaskId: data.parentTaskId,
                agent: data.agent,
                isExecuting: data.isExecuting,
                hasChildExecuting: data.hasChildExecuting,
                updatedAt: new Date(),
                arquitetosPromptContent: data.arquitetosPromptContent,
                arquitetosAnalysisContent: data.arquitetosAnalysisContent,
                arquitetosTerminalContent: data.arquitetosTerminalContent,
                programadorTerminalContent: data.programadorTerminalContent,
                programadorReportContent: data.programadorReportContent,
                isAtomic: data.isAtomic
            };
            // Add recurrence fields if provided
            if (data.isRecurring !== undefined) {
                updateData.isRecurring = data.isRecurring;
            }
            if (data.recurrenceType !== undefined) {
                updateData.recurrenceType = data.recurrenceType;
            }
            if (data.recurrenceTimes !== undefined) {
                updateData.recurrenceTimes = data.recurrenceTimes ?
                    (typeof data.recurrenceTimes === 'string' ? data.recurrenceTimes : JSON.stringify(data.recurrenceTimes)) :
                    null;
            }
            if (data.recurrenceDays !== undefined) {
                updateData.recurrenceDays = data.recurrenceDays ?
                    (typeof data.recurrenceDays === 'string' ? data.recurrenceDays : JSON.stringify(data.recurrenceDays)) :
                    null;
            }
            // Recalculate next execution if recurrence fields changed
            if (data.isRecurring || data.recurrenceType || data.recurrenceTimes || data.recurrenceDays) {
                const taskData = yield prisma.task.findUnique({
                    where: { id },
                    select: {
                        isRecurring: true,
                        recurrenceType: true,
                        recurrenceTimes: true,
                        recurrenceDays: true,
                        lastExecutedAt: true
                    }
                });
                const combinedData = {
                    isRecurring: data.isRecurring !== undefined ? data.isRecurring : taskData.isRecurring,
                    recurrenceType: data.recurrenceType !== undefined ? data.recurrenceType : taskData.recurrenceType,
                    recurrenceTimes: data.recurrenceTimes !== undefined ? data.recurrenceTimes : (taskData.recurrenceTimes ? JSON.parse(taskData.recurrenceTimes) : null),
                    recurrenceDays: data.recurrenceDays !== undefined ? data.recurrenceDays : (taskData.recurrenceDays ? JSON.parse(taskData.recurrenceDays) : null),
                    lastExecutedAt: taskData.lastExecutedAt
                };
                if (combinedData.isRecurring && combinedData.recurrenceType) {
                    updateData.nextExecutionAt = this.calculateNextExecution(combinedData);
                }
                else {
                    updateData.nextExecutionAt = null;
                }
            }
            // Remove undefined values
            Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
            const transaction = [];
            // Add task update
            transaction.push(prisma.task.update({
                where: { id },
                data: updateData,
                include: {
                    project: true,
                    status: true,
                    priority: true,
                    createdBy: true,
                    assignedTo: true
                }
            }));
            // Add history record if status changed
            if (data.statusId && oldTask && data.statusId !== oldTask.statusId) {
                // Determine userId for history: use provided userId, or oldTask.createdById, or fallback to task creator
                const userId = data.userId || oldTask.createdById;
                if (userId) {
                    transaction.push(prisma.taskHistory.create({
                        data: {
                            taskId: id,
                            userId: userId,
                            oldStatusId: oldTask.statusId,
                            newStatusId: data.statusId,
                            notes: data.statusChangeNotes
                        }
                    }));
                }
                // If userId is not available, skip history creation (log warning)
                else {
                    console.warn(`Cannot create task history for task ${id}: userId not available`);
                }
            }
            const results = yield prisma.$transaction(transaction);
            // IMPORTANTE: Atualizar o estado isChildExecuting dos ancestrais, já que as tarefas terminaram a execução
            // No método updateTask, não temos ancestorsFinalized definido, apenas atualizamos a hierarquia da tarefa atual
            try {
                yield taskHierarchyService.updateHierarchyOnExecutionChange(id, false);
            }
            catch (err) {
                console.error('Erro ao atualizar hierarquia no updateTask:', err.message);
            }
            // Broadcast SSE event AFTER transaction is complete
            sseService.broadcast('task_updated', results[0]);
            return results[0]; // Return the updated task
        });
    }
    // No seu TaskService.js
    /**
     * INICIA a execução exclusiva de uma tarefa.
     */
    startTaskExecution(taskId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`🚀 Iniciando execução exclusiva da tarefa ${taskId}...`);
            // 1. O GATILHO GLOBAL: Desliga todas as outras tarefas ativas no banco.
            // Buscamos as tarefas ativas e chamamos stopTaskExecution para garantir
            // que a hierarquia seja atualizada e os eventos SSE sejam disparados.
            const activeTasks = yield prisma.task.findMany({
                where: {
                    isExecuting: true,
                    id: { not: taskId } // Garante que não vamos desligar a própria tarefa à toa
                },
                select: { id: true }
            });
            for (const activeTask of activeTasks) {
                yield this.stopTaskExecution(activeTask.id);
            }
            // 2. REUSO INTELIGENTE: Delega para o seu método principal.
            // A updateTask vai alterar para true, atualizar a hierarquia e disparar o SSE!
            return yield this.updateTask(taskId, { isExecuting: true });
        });
    }
    /**
     * PARA a execução de uma tarefa.
     */
    stopTaskExecution(taskId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`🛑 Parando a execução da tarefa ${taskId}...`);
            // Novamente, reuso total. A updateTask faz toda a mágica do teardown.
            return yield this.updateTask(taskId, { isExecuting: false });
        });
    }
    // Delete task
    deleteTask(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const taskToDelete = yield prisma.task.findUnique({ where: { id } });
            if (taskToDelete && taskToDelete.isExecuting) {
                try {
                    yield taskHierarchyService.updateHierarchyOnExecutionChange(id, false);
                }
                catch (err) {
                    console.error('Erro ao atualizar hierarquia antes de deletar:', err.message);
                }
            }
            // First delete dependencies, comments, attachments, history
            yield prisma.$transaction([
                prisma.dependency.deleteMany({
                    where: {
                        OR: [
                            { taskId: id },
                            { dependentTaskId: id }
                        ]
                    }
                }),
                prisma.comment.deleteMany({
                    where: { taskId: id }
                }),
                prisma.attachment.deleteMany({
                    where: { taskId: id }
                }),
                prisma.taskHistory.deleteMany({
                    where: { taskId: id }
                })
            ]);
            // Then delete the task
            const deletedTask = yield prisma.task.delete({
                where: { id }
            });
            // Emitir evento SSE para deleção em tempo real
            sseService.broadcast('task_deleted', { id: deletedTask.id });
            return deletedTask;
        });
    }
    // Update task position (for drag and drop)
    updateTaskPosition(id, position) {
        return __awaiter(this, void 0, void 0, function* () {
            const updatedTask = yield prisma.task.update({
                where: { id },
                data: { position },
                include: {
                    project: true,
                    status: true,
                    priority: true
                }
            });
            // Emitir evento SSE para atualização em tempo real
            sseService.broadcast('task_updated', updatedTask);
            return updatedTask;
        });
    }
    // Toggle task completion
    toggleTaskCompletion(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const task = yield prisma.task.findUnique({
                where: { id },
                select: { isCompleted: true }
            });
            if (!task) {
                throw new Error('Task not found');
            }
            const updatedTask = yield prisma.task.update({
                where: { id },
                data: {
                    isCompleted: !task.isCompleted,
                    updatedAt: new Date()
                },
                include: {
                    project: true,
                    status: true,
                    priority: true
                }
            });
            // Emitir evento SSE para atualização em tempo real
            sseService.broadcast('task_updated', updatedTask);
            return updatedTask;
        });
    }
    // Get tasks by project
    getTasksByProject(projectId, filters = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const where = { projectId };
            if (filters.statusId) {
                where.statusId = filters.statusId;
            }
            // Filtro para parentTaskId (subtarefas)
            if (filters.parentTaskId !== undefined) {
                if (filters.parentTaskId === null || filters.parentTaskId === '' || filters.parentTaskId === 'null') {
                    where.parentTaskId = null;
                }
                else {
                    where.parentTaskId = filters.parentTaskId;
                }
            }
            else {
                // Se parentTaskId não for passado, assumimos que queremos as tarefas raiz do projeto
                where.parentTaskId = null;
            }
            // Ajuste para isCompleted: Por padrão, não trazer tarefas completas, a menos que isCompleted seja explicitamente 'true'
            if (filters.isCompleted !== undefined) {
                where.isCompleted = filters.isCompleted === true; // Espera booleano true/false
            }
            else {
                where.isCompleted = false; // Valor padrão: não trazer tarefas completas
            }
            if (filters.search) {
                where.OR = [
                    { title: { contains: filters.search, mode: 'insensitive' } },
                    { description: { contains: filters.search, mode: 'insensitive' } }
                ];
            }
            console.log('DEBUG getTasksByProject final where:', JSON.stringify(where));
            return yield prisma.task.findMany({
                where,
                include: {
                    project: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            regras: true
                        }
                    },
                    status: true,
                    priority: true,
                    assignedTo: {
                        select: {
                            id: true,
                            name: true,
                            avatarUrl: true
                        }
                    },
                    subtasks: {
                        select: {
                            id: true,
                            title: true,
                            isCompleted: true
                        }
                    }
                },
                orderBy: {
                    position: 'asc'
                }
            });
        });
    }
    // Get recurring tasks that need execution
    getRecurringTasksDue() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            return yield prisma.task.findMany({
                where: {
                    isRecurring: true,
                    isCompleted: false,
                    OR: [
                        {
                            nextExecutionAt: {
                                lte: now
                            }
                        },
                        {
                            nextExecutionAt: null,
                            lastExecutedAt: null
                        }
                    ]
                },
                include: {
                    project: true,
                    status: true,
                    priority: true,
                    assignedTo: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            });
        });
    }
    // Mark task as executed and calculate next execution
    markTaskAsExecuted(taskId) {
        return __awaiter(this, void 0, void 0, function* () {
            const task = yield prisma.task.findUnique({
                where: { id: taskId },
                select: {
                    isRecurring: true,
                    recurrenceType: true,
                    recurrenceTimes: true,
                    recurrenceDays: true,
                    lastExecutedAt: true
                }
            });
            if (!task) {
                throw new Error('Task not found');
            }
            const updateData = {
                lastExecutedAt: new Date(),
                updatedAt: new Date()
            };
            // Calculate next execution if task is recurring
            if (task.isRecurring && task.recurrenceType) {
                const taskData = {
                    isRecurring: task.isRecurring,
                    recurrenceType: task.recurrenceType,
                    recurrenceTimes: task.recurrenceTimes ? JSON.parse(task.recurrenceTimes) : null,
                    recurrenceDays: task.recurrenceDays ? JSON.parse(task.recurrenceDays) : null,
                    lastExecutedAt: new Date() // Use current time as last executed
                };
                updateData.nextExecutionAt = this.calculateNextExecution(taskData);
            }
            else {
                updateData.nextExecutionAt = null;
            }
            // Emitir evento SSE para atualização em tempo real
            sseService.broadcast('task_updated', updateData);
            return yield prisma.task.update({
                where: { id: taskId },
                data: updateData,
                include: {
                    project: true,
                    status: true,
                    priority: true
                }
            });
        });
    }
    // Calculate next execution time based on recurrence rules
    calculateNextExecution(taskData) {
        const now = new Date();
        const lastExecuted = taskData.lastExecutedAt || now;
        if (!taskData.recurrenceType) {
            return null;
        }
        switch (taskData.recurrenceType) {
            case 'daily':
                return this.calculateNextDailyExecution(lastExecuted, taskData.recurrenceTimes);
            case 'weekly':
                return this.calculateNextWeeklyExecution(lastExecuted, taskData.recurrenceDays, taskData.recurrenceTimes);
            case 'monthly':
                return this.calculateNextMonthlyExecution(lastExecuted, taskData.recurrenceTimes);
            default:
                return null;
        }
    }
    // Calculate next daily execution
    calculateNextDailyExecution(lastExecuted, recurrenceTimes) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (!recurrenceTimes || !Array.isArray(recurrenceTimes) || recurrenceTimes.length === 0) {
            // Default to same time tomorrow
            const next = new Date(lastExecuted);
            next.setDate(next.getDate() + 1);
            return next;
        }
        // Parse times and find next one
        const times = recurrenceTimes.map(time => {
            const [hours, minutes] = time.split(':').map(Number);
            const date = new Date(today);
            date.setHours(hours, minutes, 0, 0);
            return date;
        }).sort((a, b) => a - b);
        // Find next time today
        for (const time of times) {
            if (time > now) {
                return time;
            }
        }
        // If no more times today, use first time tomorrow
        const firstTimeTomorrow = new Date(times[0]);
        firstTimeTomorrow.setDate(firstTimeTomorrow.getDate() + 1);
        return firstTimeTomorrow;
    }
    // Calculate next weekly execution
    calculateNextWeeklyExecution(lastExecuted, recurrenceDays, recurrenceTimes) {
        const now = new Date();
        const today = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        if (!recurrenceDays || !Array.isArray(recurrenceDays) || recurrenceDays.length === 0) {
            // Default to same day next week
            const next = new Date(lastExecuted);
            next.setDate(next.getDate() + 7);
            return next;
        }
        // Parse days (0-6)
        const days = recurrenceDays.map(Number).sort((a, b) => a - b);
        // Find next day this week
        for (const day of days) {
            if (day > today) {
                return this.calculateDateTimeForDay(day, recurrenceTimes, now);
            }
        }
        // If no more days this week, use first day next week
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7 - today + days[0]);
        return this.calculateDateTimeForDay(days[0], recurrenceTimes, nextWeek);
    }
    // Calculate next monthly execution
    calculateNextMonthlyExecution(lastExecuted, recurrenceTimes) {
        const next = new Date(lastExecuted);
        next.setMonth(next.getMonth() + 1);
        if (recurrenceTimes && Array.isArray(recurrenceTimes) && recurrenceTimes.length > 0) {
            // Use first time for monthly recurrence
            const [hours, minutes] = recurrenceTimes[0].split(':').map(Number);
            next.setHours(hours, minutes, 0, 0);
        }
        return next;
    }
    // Helper: Calculate date/time for a specific day
    calculateDateTimeForDay(dayOfWeek, recurrenceTimes, baseDate) {
        const date = new Date(baseDate);
        const currentDay = date.getDay();
        const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
        date.setDate(date.getDate() + daysToAdd);
        if (recurrenceTimes && Array.isArray(recurrenceTimes) && recurrenceTimes.length > 0) {
            // Use first time for the day
            const [hours, minutes] = recurrenceTimes[0].split(':').map(Number);
            date.setHours(hours, minutes, 0, 0);
        }
        else {
            // Default to same time
            date.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0);
        }
        return date;
    }
    // === NOVO MÉTODO: Obter a próxima tarefa para um usuário (usado pelo Jarbas) ===
    getNextTaskForUser(nickname) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            console.log(`DEBUG: Buscando próxima tarefa para usuário ${nickname} às ${now.toISOString()}`);
            const [user, aiStatuses] = yield Promise.all([
                prisma.user.findUnique({ where: { nickname } }),
                prisma.status.findMany({ where: { visibleToAi: true }, select: { id: true } })
            ]);
            if (!user || aiStatuses.length === 0)
                return null;
            const statusIds = aiStatuses.map(s => s.id);
            // MÁGICA AQUI: A query já filtra recursivas que estão no futuro!
            const tasks = yield prisma.task.findMany({
                where: {
                    assignedToId: user.id,
                    isCompleted: false,
                    statusId: { in: statusIds },
                    // Filtrar apenas tarefas de projetos ativos
                    project: {
                        ativo: true,
                        status: true
                    },
                    // A tarefa tem que ser: Normal OU (Recursiva E já passou do horário previsto)
                    OR: [
                        { isRecurring: false },
                        {
                            isRecurring: true,
                            nextExecutionAt: { lte: now }
                        },
                        {
                            isRecurring: true,
                            nextExecutionAt: null
                        }
                    ]
                },
                include: {
                    priority: true,
                    status: true,
                    project: {
                        select: {
                            id: true,
                            name: true,
                            ativo: true,
                            status: true,
                            // === NOVOS CAMPOS PARA O MONITOR ORQUESTRAR ===
                            modeloAuxiliar: true,
                            programadorBack: true,
                            programadorFront: true,
                            projectType: true,
                            agent: true
                        }
                    },
                    dependents: {
                        include: {
                            task: {
                                include: {
                                    priority: true,
                                    status: true
                                }
                            }
                        }
                    }
                }
            });
            // Filtra tarefas onde TODAS as dependências (bloqueadores) já estão em um status que seja 'estado final';
            let playableTasks = [];
            try {
                playableTasks = tasks.filter(t => t.dependents.every(dep => dep.task && dep.task.status && dep.task.status.isFinalState));
            }
            catch (error) {
                return null;
            }
            console.log(`\nDEBUG: Tarefas atribuídas a ${nickname} que passaram na dependência: ${playableTasks.map(t => t.title).join('; ')}`);
            console.log(`Quantidade total de tarefas atribuídas a ${nickname} (sem filtrar dependências): ${tasks.length}\n`);
            if (playableTasks.length === 0)
                return null;
            playableTasks.sort((a, b) => {
                // Como a query só trouxe recursivas vencidas, se ela é recursiva, ela DEVE ir pro topo.
                if (a.isRecurring && !b.isRecurring)
                    return -1;
                if (!a.isRecurring && b.isRecurring)
                    return 1;
                // Se ambas são recursivas, a mais atrasada ganha
                if (a.isRecurring && b.isRecurring) {
                    const dateA = a.nextExecutionAt || a.createdAt;
                    const dateB = b.nextExecutionAt || b.createdAt;
                    console.log(`DEBUG: Comparando recursivas ${a.title} (next: ${dateA.toISOString()}) e ${b.title} (next: ${dateB.toISOString()})`);
                    return dateA.getTime() - dateB.getTime();
                }
                // Se nenhuma é recursiva, vai por peso e depois criação
                if (a.priority.weight !== b.priority.weight) {
                    console.log(`DEBUG: Comparando prioridades ${a.priority.name} (peso: ${a.priority.weight}) e ${b.priority.name} (peso: ${b.priority.weight})`);
                    return b.priority.weight - a.priority.weight;
                }
                console.log(`DEBUG: Comparando por deadline ${a.title} (deadline: ${a.deadline.toISOString()}) e ${b.title} (deadline: ${b.deadline.toISOString()})`);
                return (a.deadline || a.createdAt).getTime() - (b.deadline || b.createdAt).getTime();
            });
            console.log(`\nDEBUG: Tarefas encontradas para ${nickname}: ${playableTasks.map(t => `${t.title} (recursiva: ${t.isRecurring}, próxima execução: ${t.nextExecutionAt})`).join('; ')}\n`);
            const nextTask = playableTasks[0];
            if (!nextTask)
                return null;
            // Retornar a tarefa sem marcar como em execução
            // O monitor.js será responsável por marcar isExecuting: true após criar o arquivo LOCK
            console.log(`📋 Tarefa "${nextTask.title}" selecionada para execução (ainda não marcada como isExecuting: true)`);
            return nextTask;
        });
    }
    // Finalize task - find first final status and update task
    // Finalize task - Lida com finalização de normais e reinício de recursivas
    finalizeTask(taskId, userId, executionNotes = null) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Busca a tarefa atual
            const existingTask = yield prisma.task.findUnique({
                where: { id: taskId }
            });
            if (!existingTask) {
                throw new Error(`Task with ID ${taskId} not found`);
            }
            // Fallback para o userId caso não venha na requisição (ideal pegar do token de auth)
            let actionUserId = userId || existingTask.assignedToId || existingTask.createdById;
            // VALIDAÇÃO CRÍTICA: Verificar se o userId existe na tabela users
            if (actionUserId) {
                try {
                    const userExists = yield prisma.user.findUnique({
                        where: { id: actionUserId },
                        select: { id: true }
                    });
                    if (!userExists) {
                        console.warn(`⚠️ User ID ${actionUserId} não encontrado na tabela users. Buscando usuário fallback...`);
                        // Buscar qualquer usuário válido como fallback
                        const fallbackUser = yield prisma.user.findFirst({
                            select: { id: true }
                        });
                        if (fallbackUser) {
                            actionUserId = fallbackUser.id;
                            console.log(`🔄 Usando usuário fallback: ${actionUserId}`);
                        }
                        else {
                            console.error('❌ Nenhum usuário encontrado no sistema! Não será possível criar histórico.');
                            actionUserId = null;
                        }
                    }
                }
                catch (userCheckError) {
                    console.error(`❌ Erro ao verificar usuário ${actionUserId}:`, userCheckError.message);
                    actionUserId = null;
                }
            }
            // ==========================================
            // FLUXO A: TAREFA RECURSIVA (O RESET)
            // ==========================================
            if (existingTask.isRecurring) {
                // Pega o status inicial (o de menor 'order' - ex: "To Do" / "Backlog")
                const firstStatus = yield prisma.status.findFirst({
                    orderBy: { order: 'asc' }
                });
                if (!firstStatus)
                    throw new Error('Nenhum status configurado no sistema.');
                // Calcula a próxima data de execução com base no horário de AGORA
                const taskDataForCalc = Object.assign(Object.assign({}, existingTask), { lastExecutedAt: new Date() });
                const nextExecutionAt = this.calculateNextExecution(taskDataForCalc);
                // Preparar transação - sempre atualiza a tarefa
                const transaction = [
                    prisma.task.update({
                        where: { id: taskId },
                        data: {
                            statusId: firstStatus.id,
                            isExecuting: false,
                            lastExecutedAt: new Date(),
                            nextExecutionAt: nextExecutionAt,
                            isCompleted: false // Garante que a tarefa continua viva
                        },
                        include: { project: true, status: true, priority: true }
                    })
                ];
                // Adicionar histórico APENAS se temos um userId válido
                let historyRecord = null;
                if (actionUserId) {
                    transaction.push(prisma.taskHistory.create({
                        data: {
                            taskId: taskId,
                            userId: actionUserId,
                            oldStatusId: existingTask.statusId,
                            newStatusId: firstStatus.id,
                            notes: executionNotes || 'Execução de rotina concluída. Tarefa reiniciada.'
                        }
                    }));
                }
                else {
                    console.warn(`⚠️ Não criando histórico para tarefa recursiva ${taskId} pois não há userId válido.`);
                }
                // Executar transação
                const transactionResults = yield prisma.$transaction(transaction);
                const updatedTask = transactionResults[0];
                historyRecord = actionUserId ? transactionResults[1] : null;
                // Controle de versão automático após finalização
                try {
                    const project = yield prisma.project.findUnique({
                        where: { id: existingTask.projectId },
                        select: { frontendPath: true, backendPath: true }
                    });
                    if (project === null || project === void 0 ? void 0 : project.frontendPath) {
                        yield this.checkAndCommit(project.frontendPath, taskId, existingTask.title);
                    }
                    if (project === null || project === void 0 ? void 0 : project.backendPath) {
                        yield this.checkAndCommit(project.backendPath, taskId, existingTask.title);
                    }
                }
                catch (gitError) {
                    console.error('Git automation failed:', gitError.message);
                }
                // ==========================================
                // NOTIFICAÇÃO NO TELEGRAM PARA TAREFAS RECURSIVAS
                // ==========================================
                try {
                    // Buscar informações completas do usuário
                    const user = yield prisma.user.findUnique({
                        where: { id: actionUserId }
                    });
                    if (user) {
                        // Construir mensagem específica para tarefas recursivas
                        const projectName = ((_a = updatedTask.project) === null || _a === void 0 ? void 0 : _a.name) || 'Projeto desconhecido';
                        const userName = user.name || 'Usuário desconhecido';
                        const taskTitle = updatedTask.title || 'Tarefa sem título';
                        const nextExecution = nextExecutionAt ? new Date(nextExecutionAt).toLocaleString('pt-BR') : 'Não agendada';
                        let message = `🔄 *TAREFA RECURSIVA REINICIADA!*\n\n`;
                        message += `*Tarefa:* ${taskTitle}\n`;
                        message += `*Projeto:* ${projectName}\n`;
                        message += `*Executada por:* ${userName}\n`;
                        message += `*Próxima execução:* ${nextExecution}\n`;
                        if (executionNotes && executionNotes.trim() !== '') {
                            message += `\n*Notas:* ${executionNotes.substring(0, 200)}${executionNotes.length > 200 ? '...' : ''}\n`;
                        }
                        message += `\n📅 *Data:* ${new Date().toLocaleString('pt-BR')}`;
                        message += `\n🔗 *ID:* ${taskId.substring(0, 8)}...`;
                        // Enviar notificação
                        yield NotificationService.sendTelegramNotification(message);
                        console.log(`📱 Notificação de tarefa recursiva enviada para ${user.name}`);
                    }
                    else {
                        console.warn(`⚠️ Usuário ${actionUserId} não encontrado para notificação de tarefa recursiva`);
                    }
                }
                catch (notificationError) {
                    console.error(`❌ Erro ao enviar notificação de tarefa recursiva: ${notificationError.message}`);
                    // Não falhar a operação principal por causa da notificação
                }
                // IMPORTANTE: Atualizar o estado isChildExecuting dos ancestrais, já que as tarefas terminaram a execução
                try {
                    yield taskHierarchyService.updateHierarchyOnExecutionChange(taskId, false);
                    // No fluxo de tarefa recursiva, não há ancestorsFinalized definido
                    // Apenas atualiza a hierarquia da tarefa atual
                }
                catch (err) {
                    console.error('Erro ao atualizar hierarquia no finalizeTask:', err.message);
                }
                // Broadcast SSE event AFTER transaction is complete
                sseService.broadcast('task_updated', updatedTask);
                // No fluxo de tarefa recursiva, não há ancestorsFinalized para emitir SSE
                return {
                    task: updatedTask,
                    status: firstStatus,
                    history: historyRecord,
                    isRecurringReset: true
                };
            }
            // ==========================================
            // FLUXO B: TAREFA NORMAL (FINALIZAÇÃO REAL)
            // ==========================================
            const finalStatus = yield prisma.status.findFirst({
                where: { isFinalState: true },
                orderBy: { order: 'asc' }
            });
            if (!finalStatus)
                throw new Error('Nenhum status final configurado no sistema.');
            // Iniciar transação para atualizar a tarefa atual
            const transaction = [
                prisma.task.update({
                    where: { id: taskId },
                    data: {
                        statusId: finalStatus.id,
                        isCompleted: false,
                        isExecuting: false,
                        lastExecutedAt: new Date(),
                        nextExecutionAt: null
                    },
                    include: { project: true, status: true, priority: true }
                })
            ];
            // Adicionar histórico APENAS se temos um userId válido
            if (actionUserId) {
                transaction.push(prisma.taskHistory.create({
                    data: {
                        taskId: taskId,
                        userId: actionUserId,
                        oldStatusId: existingTask.statusId,
                        newStatusId: finalStatus.id,
                        notes: executionNotes || 'Tarefa finalizada.'
                    }
                }));
            }
            else {
                console.warn(`⚠️ Não criando histórico para tarefa ${taskId} pois não há userId válido.`);
            }
            // Variáveis para armazenar tarefas ancestrais finalizadas
            let finalizedAncestors = []; // Array de objetos {task, historyRecord}
            let parentHistoryRecord = null;
            // ==========================================
            // FUNÇÃO RECURSIVA PARA VERIFICAR ANCESTRAIS
            // ==========================================
            const checkAndFinalizeAncestors = (currentTaskId, userId, finalStatusId, transactionArray) => __awaiter(this, void 0, void 0, function* () {
                const ancestorsToFinalize = [];
                // Função recursiva interna
                const checkAncestor = (taskId) => __awaiter(this, void 0, void 0, function* () {
                    // Buscar a tarefa atual para obter o parentTaskId
                    const task = yield prisma.task.findUnique({
                        where: { id: taskId },
                        select: { parentTaskId: true }
                    });
                    if (!task || !task.parentTaskId) {
                        return; // Não tem pai, fim da recursão
                    }
                    const parentTaskId = task.parentTaskId;
                    // Buscar todas as subtasks (irmãs) da tarefa pai
                    const allSubtasks = yield prisma.task.findMany({
                        where: {
                            parentTaskId: parentTaskId
                        },
                        include: {
                            status: true
                        }
                    });
                    // Verificar se TODAS as subtasks estão no status final
                    const allSubtasksFinalized = allSubtasks.every(subtask => subtask.id === taskId || (subtask.status && subtask.status.isFinalState));
                    console.log(`📊 Verificando pai ${parentTaskId}: ${allSubtasks.length} subtasks, todas finalizadas? ${allSubtasksFinalized}`);
                    // Se todas as subtasks estão finalizadas
                    if (allSubtasksFinalized && allSubtasks.length > 0) {
                        // Buscar a tarefa pai
                        const parentTask = yield prisma.task.findUnique({
                            where: { id: parentTaskId },
                            include: { status: true }
                        });
                        if (parentTask && (!parentTask.status || !parentTask.status.isFinalState)) {
                            console.log(`✅ Todas as subtasks da tarefa pai ${parentTaskId} estão finalizadas. Finalizando pai também...`);
                            // Adicionar à lista de ancestrais para finalizar
                            ancestorsToFinalize.push({
                                task: parentTask,
                                parentTaskId: parentTaskId
                            });
                            // Continuar recursivamente para o avô, bisavô, etc.
                            yield checkAncestor(parentTaskId);
                        }
                        else if (parentTask && parentTask.status && parentTask.status.isFinalState) {
                            console.log(`ℹ️ Tarefa pai ${parentTaskId} já está finalizada.`);
                            // Mesmo já finalizada, continuar verificando ancestrais
                            yield checkAncestor(parentTaskId);
                        }
                    }
                    else {
                        console.log(`⏳ Tarefa pai ${parentTaskId} não será finalizada ainda: ${allSubtasks.length} subtasks, ${allSubtasks.filter(s => s.status && s.status.isFinalState).length} finalizadas.`);
                    }
                });
                // Iniciar verificação recursiva
                yield checkAncestor(currentTaskId);
                // Processar todos os ancestrais encontrados (do mais próximo ao mais distante)
                for (const ancestor of ancestorsToFinalize) {
                    const { task: parentTask, parentTaskId } = ancestor;
                    // Adicionar atualização da tarefa ancestral à transação
                    transactionArray.push(prisma.task.update({
                        where: { id: parentTaskId },
                        data: {
                            statusId: finalStatusId,
                            isCompleted: false,
                            isExecuting: false,
                            lastExecutedAt: new Date(),
                            nextExecutionAt: null
                        },
                        include: { project: true, status: true, priority: true }
                    }));
                    // Adicionar histórico para a tarefa ancestral APENAS se temos userId
                    if (userId) {
                        transactionArray.push(prisma.taskHistory.create({
                            data: {
                                taskId: parentTaskId,
                                userId: userId,
                                oldStatusId: parentTask.statusId,
                                newStatusId: finalStatusId,
                                notes: `Tarefa ancestral finalizada automaticamente porque todas as subtasks foram concluídas.`
                            }
                        }));
                    }
                    else {
                        console.warn(`⚠️ Não criando histórico para tarefa ancestral ${parentTaskId} pois userId é nulo.`);
                    }
                    console.log(`🎯 Tarefa ancestral ${parentTaskId} será finalizada automaticamente.`);
                }
                return ancestorsToFinalize.length;
            });
            // ==========================================
            // EXECUTAR VERIFICAÇÃO RECURSIVA DE ANCESTRAIS
            // ==========================================
            if (existingTask.parentTaskId) {
                console.log(`🔍 Tarefa ${taskId} tem pai ${existingTask.parentTaskId}. Verificando ancestrais recursivamente...`);
                const ancestorsFinalized = yield checkAndFinalizeAncestors(taskId, actionUserId, finalStatus.id, transaction);
                console.log(`📈 ${ancestorsFinalized.length} tarefas ancestrais serão finalizadas.`);
            }
            // Executar todas as operações em uma única transação
            const transactionResults = yield prisma.$transaction(transaction);
            const updatedTask = transactionResults[0];
            // O histórico está na posição 1 apenas se foi criado (actionUserId não nulo)
            // Se não há histórico, transactionResults tem apenas 1 elemento
            const historyRecord = transactionResults.length > 1 ? transactionResults[1] : null;
            // Extrair dados dos ancestrais finalizados (se houver)
            // Cada ancestral ocupa 2 posições na transação: update + history
            const ancestorsFinalized = [];
            const ancestorsHistory = [];
            // Determinar posição inicial: 
            // - Se temos histórico para a tarefa atual: começa na posição 2 (tarefa[0], histórico[1])
            // - Se NÃO temos histórico: começa na posição 1 (apenas tarefa[0])
            const startIndex = historyRecord ? 2 : 1;
            for (let i = startIndex; i < transactionResults.length; i += 2) {
                if (i < transactionResults.length) {
                    ancestorsFinalized.push(transactionResults[i]); // Tarefa ancestral atualizada
                }
                if (i + 1 < transactionResults.length) {
                    ancestorsHistory.push(transactionResults[i + 1]); // Histórico da tarefa ancestral
                }
            }
            console.log(`📊 ${ancestorsFinalized.length} tarefas ancestrais foram finalizadas.`);
            // Controle de versão automático após finalização
            try {
                const project = yield prisma.project.findUnique({
                    where: { id: existingTask.projectId },
                    select: { frontendPath: true, backendPath: true }
                });
                if (project === null || project === void 0 ? void 0 : project.frontendPath) {
                    yield this.checkAndCommit(project.frontendPath, taskId, existingTask.title);
                }
                if (project === null || project === void 0 ? void 0 : project.backendPath) {
                    yield this.checkAndCommit(project.backendPath, taskId, existingTask.title);
                }
            }
            catch (gitError) {
                console.error('Git automation failed:', gitError.message);
            }
            // ==========================================
            // NOTIFICAÇÃO NO TELEGRAM
            // ==========================================
            try {
                // Buscar informações completas do usuário
                const user = yield prisma.user.findUnique({
                    where: { id: actionUserId }
                });
                if (user) {
                    // Enviar notificação da tarefa concluída
                    yield NotificationService.sendTaskCompletedNotification(updatedTask, user, executionNotes);
                    console.log(`📱 Notificação no Telegram enviada para ${user.name} (${user.nickname})`);
                }
                else {
                    console.warn(`⚠️ Usuário ${actionUserId} não encontrado para notificação`);
                }
                // Se houver ancestrais finalizados automaticamente, enviar notificações adicionais
                if (ancestorsFinalized.length > 0) {
                    console.log(`📱 Enviando notificações para ${ancestorsFinalized.length} tarefas ancestrais finalizadas...`);
                    for (const ancestorTask of ancestorsFinalized) {
                        // Buscar todas as subtasks para listar na notificação
                        const allSubtasks = yield prisma.task.findMany({
                            where: {
                                parentTaskId: ancestorTask.id
                            },
                            select: {
                                id: true,
                                title: true,
                                status: true
                            }
                        });
                        yield NotificationService.sendParentTaskAutoCompletedNotification(ancestorTask, allSubtasks);
                        console.log(`📱 Notificação para tarefa ancestral ${ancestorTask.id} (${ancestorTask.title}) enviada`);
                    }
                }
            }
            catch (notificationError) {
                console.error(`❌ Erro ao enviar notificação no Telegram: ${notificationError.message}`);
                // Não falhar a operação principal por causa da notificação
            }
            // IMPORTANTE: Atualizar o estado isChildExecuting dos ancestrais, já que as tarefas terminaram a execução
            try {
                yield taskHierarchyService.updateHierarchyOnExecutionChange(taskId, false);
                for (const ancestor of ancestorsFinalized) {
                    yield taskHierarchyService.updateHierarchyOnExecutionChange(ancestor.id, false);
                }
            }
            catch (err) {
                console.error('Erro ao atualizar hierarquia no finalizeTask:', err.message);
            }
            // Broadcast SSE event AFTER transaction is complete
            sseService.broadcast('task_updated', updatedTask);
            // IMPORTANTE: Emitir SSE para todos os ancestrais que também foram atualizados/finalizados!
            if (typeof ancestorsFinalized !== 'undefined' && Array.isArray(ancestorsFinalized)) {
                for (const ancestor of ancestorsFinalized) {
                    sseService.broadcast('task_updated', ancestor);
                }
            }
            return {
                task: updatedTask,
                status: finalStatus,
                history: historyRecord,
                ancestorsFinalized: ancestorsFinalized,
                ancestorsHistory: ancestorsHistory,
                // Mantendo compatibilidade total com código existente
                parentTaskFinalized: ancestorsFinalized.length > 0 ? ancestorsFinalized[0] : null,
                parentHistory: ancestorsHistory.length > 0 ? ancestorsHistory[0] : null,
                isRecurringReset: false
            };
        });
    }
}
module.exports = new TaskService();
