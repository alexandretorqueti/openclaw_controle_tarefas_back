var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const prisma = require('./prismaService');
const logger = require('../utils/logger');
const ProcessKiller = require('../utils/processKiller');
class AutoTaskService {
    // Buscar projeto pelo ID da variável de ambiente
    getMonitorProject() {
        return __awaiter(this, void 0, void 0, function* () {
            const projectId = process.env.PROJETO_MONITOR;
            if (!projectId) {
                console.error('Variável PROJETO_MONITOR não configurada no .env');
                return null;
            }
            try {
                const project = yield prisma.project.findUnique({
                    where: { id: projectId }
                });
                if (!project) {
                    console.error(`Projeto com ID ${projectId} não encontrado`);
                    return null;
                }
                return project;
            }
            catch (error) {
                console.error(`Erro ao buscar projeto: ${error.message}`);
                return null;
            }
        });
    }
    // Buscar tarefa existente com mesmo erro
    findExistingErrorTask(projectId, errorSignature) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const tasks = yield prisma.task.findMany({
                    where: {
                        projectId: projectId,
                        isCompleted: false,
                        title: { contains: 'Bug automático detectado' },
                        status: {
                            isFinalState: false
                        }
                    }
                });
                // Filtrar por assinatura do erro na descrição
                const matchingTasks = tasks.filter(task => {
                    if (!task.description)
                        return false;
                    // Tentar buscar pela assinatura completa
                    if (task.description.includes(errorSignature)) {
                        return true;
                    }
                    // Para tarefas antigas (sem linha **Error Signature:**), 
                    // tentar reconstruir a assinatura a partir do endpoint e primeira linha do erro
                    const endpointMatch = task.description.match(/\*\*Endpoint:\*\*\s*(.+)/);
                    const errorMatch = task.description.match(/\*\*Error:\*\*\s*([^\n]+)/);
                    if (endpointMatch && errorMatch) {
                        const endpoint = endpointMatch[1].trim();
                        const firstErrorLine = errorMatch[1].trim();
                        const reconstructedSignature = `${endpoint}:${firstErrorLine}`.substring(0, 100);
                        return reconstructedSignature === errorSignature;
                    }
                    return false;
                });
                return matchingTasks.length > 0 ? matchingTasks[0] : null;
            }
            catch (error) {
                console.error(`Erro ao buscar tarefa existente: ${error.message}`);
                return null;
            }
        });
    }
    // Gerar assinatura do erro para comparação
    generateErrorSignature(error, req) {
        const endpoint = req ? `${req.method} ${req.originalUrl}` : 'Unknown endpoint';
        const errorMessage = error.message || 'Unknown error';
        // Pegar apenas a primeira linha da mensagem de erro para a assinatura
        const firstLine = errorMessage.split('\n')[0];
        return `${endpoint}:${firstLine}`.substring(0, 100);
    }
    // Gerar descrição detalhada do erro
    generateErrorDescription(error, req, res) {
        const parts = [];
        if (req) {
            parts.push(`**Endpoint:** ${req.method} ${req.originalUrl}`);
            // Adicionar assinatura do erro para detecção de duplicatas
            const errorSignature = this.generateErrorSignature(error, req);
            parts.push(`**Error Signature:** ${errorSignature}`);
            parts.push(`**IP:** ${req.ip || 'N/A'}`);
            parts.push(`**User Agent:** ${req.get('User-Agent') || 'N/A'}`);
            if (req.body && Object.keys(req.body).length > 0) {
                try {
                    parts.push(`**Body:** \`\`\`json\n${JSON.stringify(req.body, null, 2)}\n\`\`\``);
                }
                catch (e) {
                    parts.push(`**Body:** (Não serializável)`);
                }
            }
            if (req.query && Object.keys(req.query).length > 0) {
                parts.push(`**Query:** \`\`\`json\n${JSON.stringify(req.query, null, 2)}\n\`\`\``);
            }
            if (req.params && Object.keys(req.params).length > 0) {
                parts.push(`**Params:** \`\`\`json\n${JSON.stringify(req.params, null, 2)}\n\`\`\``);
            }
        }
        if (error) {
            parts.push(`**Error:** ${error.message || 'N/A'}`);
            if (error.stack) {
                parts.push(`**Stack:** \`\`\`\n${error.stack}\n\`\`\``);
            }
            parts.push(`**Name:** ${error.name || 'N/A'}`);
            parts.push(`**Status Code:** ${error.statusCode || 'N/A'}`);
        }
        if (res && res.statusCode) {
            parts.push(`**Response Status:** ${res.statusCode}`);
        }
        parts.push(`**Timestamp:** ${new Date().toISOString()}`);
        parts.push(`**Process ID:** ${process.pid}`);
        return parts.join('\n\n');
    }
    // Buscar primeiro status "visível para IA"
    getFirstVisibleStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Primeiro tentar encontrar status com "visível para IA" no nome
                const statuses = yield prisma.status.findMany({
                    orderBy: { order: 'asc' }
                });
                const visibleStatus = statuses.find(s => s.name && s.name.toLowerCase().includes('visível para ia'));
                if (visibleStatus) {
                    return visibleStatus;
                }
                // Fallback: buscar primeiro status disponível
                if (statuses.length > 0) {
                    return statuses[0];
                }
                console.error('Nenhum status encontrado no banco de dados');
                return null;
            }
            catch (error) {
                console.error(`Erro ao buscar status: ${error.message}`);
                return null;
            }
        });
    }
    // Buscar ID de prioridade padrão
    getDefaultPriorityId() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const priorities = yield prisma.priority.findMany();
                if (priorities.length > 0) {
                    return priorities[0].id;
                }
                console.error('Nenhuma prioridade encontrada no banco de dados');
                return null;
            }
            catch (error) {
                console.error(`Erro ao buscar prioridade: ${error.message}`);
                return null;
            }
        });
    }
    // Buscar ID de usuário sistema
    getSystemUserId() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const users = yield prisma.user.findMany();
                // Primeiro tentar encontrar usuário 'system'
                let user = users.find(u => u.name && u.name.toLowerCase().includes('system'));
                if (!user && users.length > 0) {
                    // Fallback: primeiro usuário disponível
                    user = users[0];
                }
                if (user) {
                    return user.id;
                }
                console.error('Nenhum usuário encontrado no banco de dados');
                return null;
            }
            catch (error) {
                console.error(`Erro ao buscar usuário: ${error.message}`);
                return null;
            }
        });
    }
    // Criar tarefa automática
    createAutoTask(error, req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 1. Buscar projeto monitor
                const project = yield this.getMonitorProject();
                if (!project) {
                    console.error('Não foi possível encontrar o projeto monitor');
                    return null;
                }
                // 2. Gerar assinatura do erro
                const errorSignature = this.generateErrorSignature(error, req);
                // 3. Verificar se já existe tarefa para este erro
                const existingTask = yield this.findExistingErrorTask(project.id, errorSignature);
                if (existingTask) {
                    console.log(`Tarefa já existe para este erro: ${existingTask.id}`);
                    return existingTask;
                }
                // 4. Buscar status "visível para IA"
                const status = yield this.getFirstVisibleStatus();
                if (!status) {
                    console.error('Não foi possível encontrar status para a tarefa');
                    return null;
                }
                // 5. Buscar prioridade padrão
                const priorityId = yield this.getDefaultPriorityId();
                if (!priorityId) {
                    console.error('Não foi possível encontrar prioridade para a tarefa');
                    return null;
                }
                // 6. Buscar usuário sistema
                const createdById = yield this.getSystemUserId();
                if (!createdById) {
                    console.error('Não foi possível encontrar usuário para a tarefa');
                    return null;
                }
                // 7. Gerar descrição detalhada
                const description = this.generateErrorDescription(error, req, res);
                // 8. Criar nova tarefa
                const newTask = yield prisma.task.create({
                    data: {
                        title: 'Bug automático detectado',
                        description: description,
                        projectId: project.id,
                        statusId: status.id,
                        isCompleted: false,
                        priorityId: priorityId,
                        createdById: createdById,
                        assignedToId: createdById,
                        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias a partir de agora
                    }
                });
                console.log(`Tarefa automática criada: ${newTask.id}`);
                // Matar o processo após criar a tarefa
                ProcessKiller.killAfterTaskCreation(newTask, 3000);
                return newTask;
            }
            catch (error) {
                console.error(`Erro ao criar tarefa automática: ${error.message}`);
                // Matar o processo mesmo se falhar
                ProcessKiller.killAfterDelay(3000);
                return null;
            }
        });
    }
}
module.exports = new AutoTaskService();
