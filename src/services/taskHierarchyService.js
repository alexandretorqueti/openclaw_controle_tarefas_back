// src/services/taskHierarchyService.js
// Serviço para gerenciar marcação hierárquica de tarefas em execução
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
// Removida a importação do sseService, pois o TaskService já cuida dos broadcasts.
class TaskHierarchyService {
    /**
     * Marca todos os ancestrais de uma tarefa como tendo filho em execução
     * @param {string} taskId - ID da tarefa que está sendo executada
     * @returns {Promise<void>}
     */
    markAncestorsAsChildExecuting(taskId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔍 TaskHierarchyService: Marcando ancestrais da tarefa ${taskId} como hasChildExecuting: true`);
                // Obter todos os ancestrais da tarefa
                const ancestors = yield this.getTaskAncestors(taskId);
                if (ancestors.length === 0) {
                    console.log(`ℹ️ TaskHierarchyService: Tarefa ${taskId} não tem ancestrais para marcar`);
                    return;
                }
                const ancestorIds = ancestors.map(ancestor => ancestor.id);
                console.log(`✅ TaskHierarchyService: ${ancestors.length} ancestrais encontrados para marcar: ${ancestorIds.join(', ')}`);
                // Usando require tardio para evitar dependência circular com taskService
                const taskService = require('./taskService');
                // Atualizar todos os ancestrais usando o TaskService
                // IMPORTANTE: Não desmarcamos todas as tarefas do sistema!
                // Apenas marcamos os ancestrais desta tarefa específica
                for (const ancestorId of ancestorIds) {
                    // Verificar se o ancestral já está marcado (para evitar atualização desnecessária)
                    const ancestor = yield prisma.task.findUnique({
                        where: { id: ancestorId },
                        select: { hasChildExecuting: true }
                    });
                    if (!ancestor || !ancestor.hasChildExecuting) {
                        // Só atualiza se não estiver já marcado
                        yield taskService.updateTask(ancestorId, { hasChildExecuting: true });
                        console.log(`   ✅ Ancestral ${ancestorId}: marcado como hasChildExecuting: true`);
                    }
                    else {
                        console.log(`   ℹ️ Ancestral ${ancestorId}: já estava marcado como hasChildExecuting: true`);
                    }
                }
            }
            catch (error) {
                console.error(`❌ TaskHierarchyService: Erro ao marcar ancestrais: ${error.message}`);
                throw error;
            }
        });
    }
    /**
     * Desmarca todos os ancestrais de uma tarefa (remove hasChildExecuting)
     * Verifica se ainda há outros descendentes em execução antes de desmarcar
     * @param {string} taskId - ID da tarefa que parou de executar
     * @returns {Promise<void>}
     */
    unmarkAncestorsAsChildExecuting(taskId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔍 TaskHierarchyService: Verificando ancestrais da tarefa ${taskId} para desmarcar hasChildExecuting`);
                // Obter todos os ancestrais da tarefa
                const ancestors = yield this.getTaskAncestors(taskId);
                if (ancestors.length === 0) {
                    console.log(`ℹ️ TaskHierarchyService: Tarefa ${taskId} não tem ancestrais para verificar`);
                    return;
                }
                const ancestorIds = ancestors.map(ancestor => ancestor.id);
                // Para cada ancestral, verificar se ainda tem outros descendentes em execução
                for (const ancestorId of ancestorIds) {
                    yield this.updateAncestorIfNoExecutingChildren(ancestorId);
                }
                console.log(`✅ TaskHierarchyService: Ancestrais verificados: ${ancestorIds.join(', ')}`);
            }
            catch (error) {
                console.error(`❌ TaskHierarchyService: Erro ao desmarcar ancestrais: ${error.message}`);
                throw error;
            }
        });
    }
    /**
     * Atualiza um ancestral apenas se não tiver mais descendentes em execução
     * @param {string} ancestorId - ID do ancestral a verificar
     * @returns {Promise<void>}
     */
    updateAncestorIfNoExecutingChildren(ancestorId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Contar quantos descendentes diretos e indiretos estão em execução
                const executingDescendantsCount = yield this.countExecutingDescendants(ancestorId);
                if (executingDescendantsCount === 0) {
                    // Nenhum descendente em execução, pode desmarcar
                    const taskService = require('./taskService'); // Require tardio
                    yield taskService.updateTask(ancestorId, { hasChildExecuting: false });
                    console.log(`   ✅ Ancestral ${ancestorId}: hasChildExecuting: false (0 descendentes em execução)`);
                }
                else {
                    console.log(`   ℹ️ Ancestral ${ancestorId}: mantém hasChildExecuting: true (${executingDescendantsCount} descendentes em execução)`);
                }
            }
            catch (error) {
                console.error(`❌ TaskHierarchyService: Erro ao verificar ancestral ${ancestorId}: ${error.message}`);
                throw error;
            }
        });
    }
    /**
     * Conta quantos descendentes de uma tarefa estão em execução
     * @param {string} taskId - ID da tarefa ancestral
     * @returns {Promise<number>}
     */
    countExecutingDescendants(taskId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`   🔍 TaskHierarchyService: Contando descendentes em execução para tarefa ${taskId}`);
                // Obter todos os descendentes da tarefa
                const descendants = yield this.getTaskDescendants(taskId);
                console.log(`   🔍 TaskHierarchyService: Encontrados ${descendants.length} descendentes totais`);
                // Filtrar apenas os que estão em execução
                const executingDescendants = descendants.filter(descendant => descendant.isExecuting);
                console.log(`   🔍 TaskHierarchyService: ${executingDescendants.length} descendentes em execução`);
                // Log detalhado dos descendentes
                if (descendants.length > 0) {
                    console.log(`   🔍 TaskHierarchyService: Descendentes encontrados:`);
                    descendants.forEach(descendant => {
                        console.log(`     - ${descendant.id}: ${descendant.title} (isExecuting: ${descendant.isExecuting})`);
                    });
                }
                return executingDescendants.length;
            }
            catch (error) {
                console.error(`❌ TaskHierarchyService: Erro ao contar descendentes em execução: ${error.message}`);
                throw error;
            }
        });
    }
    /**
     * Obtém todos os ancestrais de uma tarefa (pai, avô, bisavô, etc.)
     * @param {string} taskId - ID da tarefa
     * @returns {Promise<Array>} Array de tarefas ancestrais
     */
    getTaskAncestors(taskId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const ancestors = [];
                let currentTaskId = taskId;
                // Subir na hierarquia até chegar à raiz
                // Leitura é segura no Prisma aqui, não precisa delegar pro TaskService
                while (true) {
                    const task = yield prisma.task.findUnique({
                        where: { id: currentTaskId },
                        select: {
                            id: true,
                            parentTaskId: true
                        }
                    });
                    if (!task || !task.parentTaskId) {
                        break; // Chegou à raiz ou tarefa não encontrada
                    }
                    // Obter o pai
                    const parent = yield prisma.task.findUnique({
                        where: { id: task.parentTaskId },
                        select: {
                            id: true,
                            title: true,
                            parentTaskId: true
                        }
                    });
                    if (parent) {
                        ancestors.push(parent);
                        currentTaskId = parent.id;
                    }
                    else {
                        break;
                    }
                }
                return ancestors;
            }
            catch (error) {
                console.error(`❌ TaskHierarchyService: Erro ao obter ancestrais: ${error.message}`);
                throw error;
            }
        });
    }
    /**
     * Obtém todos os descendentes de uma tarefa (filhos, netos, etc.)
     * @param {string} taskId - ID da tarefa ancestral
     * @returns {Promise<Array>} Array de tarefas descendentes
     */
    getTaskDescendants(taskId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`   🔍 TaskHierarchyService: Buscando descendentes para tarefa ${taskId}`);
                const descendants = [];
                // Função recursiva para obter todos os descendentes
                const getDescendantsRecursive = (parentId) => __awaiter(this, void 0, void 0, function* () {
                    const children = yield prisma.task.findMany({
                        where: { parentTaskId: parentId },
                        select: {
                            id: true,
                            title: true,
                            isExecuting: true
                        }
                    });
                    console.log(`   🔍 TaskHierarchyService: Para parentId ${parentId}, encontrados ${children.length} filhos`);
                    for (const child of children) {
                        console.log(`   🔍 TaskHierarchyService: Filho ${child.id}: ${child.title} (isExecuting: ${child.isExecuting})`);
                        descendants.push(child);
                        yield getDescendantsRecursive(child.id);
                    }
                });
                yield getDescendantsRecursive(taskId);
                console.log(`   🔍 TaskHierarchyService: Total de descendentes para ${taskId}: ${descendants.length}`);
                return descendants;
            }
            catch (error) {
                console.error(`❌ TaskHierarchyService: Erro ao obter descendentes: ${error.message}`);
                throw error;
            }
        });
    }
    /**
     * Atualiza a marcação hierárquica quando uma tarefa muda seu estado de execução
     * @param {string} taskId - ID da tarefa
     * @param {boolean} isNowExecuting - Novo estado de execução
     * @returns {Promise<void>}
     */
    updateHierarchyOnExecutionChange(taskId, isNowExecuting) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔄 TaskHierarchyService: Atualizando hierarquia para tarefa ${taskId} (isExecuting: ${isNowExecuting})`);
                if (isNowExecuting) {
                    // Tarefa começou a executar → marcar ancestrais
                    yield this.markAncestorsAsChildExecuting(taskId);
                }
                else {
                    // Tarefa parou de executar → verificar ancestrais
                    yield this.unmarkAncestorsAsChildExecuting(taskId);
                }
                console.log(`✅ TaskHierarchyService: Hierarquia atualizada para tarefa ${taskId}`);
            }
            catch (error) {
                console.error(`❌ TaskHierarchyService: Erro ao atualizar hierarquia: ${error.message}`);
                throw error;
            }
        });
    }
}
module.exports = new TaskHierarchyService();
