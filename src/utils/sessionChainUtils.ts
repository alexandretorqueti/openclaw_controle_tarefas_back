// Migrado para TypeScript - Fase: Utils
// Arquivo: sessionChainUtils.js

/**
 * Utilitários para gerenciamento de sessões em cadeias de dependências
 * 
 * Regras:
 * 1. Se uma tarefa não tem dependência, cria a sessão com o id daquela tarefa
 * 2. Se uma tarefa é dependente de outra, ela precisa entrar na sessão da anterior
 * 3. Se uma tarefa é dependente de uma que é dependente de outra, deve pegar a sessão da primeira
 * 4. Sempre que uma tarefa for dependente de qualquer uma, deve-se procurar a PRIMEIRA tarefa da fila
 */

import prisma from '../services/prismaService';

class SessionChainUtils {
  
  /**
   * Encontra a PRIMEIRA tarefa da cadeia de dependências
   * @param {string} taskId - ID da tarefa atual
   * @returns {Promise<string>} ID da primeira tarefa da cadeia
   */
  static async findFirstTaskInChain(taskId): Promise<any> {
    console.log(`🔍 Buscando primeira tarefa da cadeia para: ${taskId}`);
    
    let currentTaskId = taskId;
    let visitedTasks = new Set([taskId]);
    let iteration = 0;
    const MAX_ITERATIONS = 50; // Prevenção contra loops infinitos
    
    while (iteration < MAX_ITERATIONS) {
      iteration++;
      
      // Buscar dependências BLOCKING desta tarefa
      const dependencies = await prisma.dependency.findMany({
  where: {
  dependentTaskId: currentTaskId,
  type: 'BLOCKING'
        },
  include: {
  task: {
  select: { id: true, title: true }
          }
        }
      });
      
      console.log(`  Iteração ${iteration}: Tarefa ${currentTaskId} tem ${dependencies.length} dependências BLOCKING`);
      
      // Se não tem dependências BLOCKING, esta é a primeira da cadeia
      if (dependencies.length === 0) {
        console.log(`✅ Primeira tarefa da cadeia encontrada: ${currentTaskId}`);
        return currentTaskId;
      }
      
      // Pegar a primeira dependência BLOCKING (assumindo que só há uma por enquanto)
      const firstDependency = dependencies[0];
      
      // Verificar se já visitamos esta tarefa (prevenção de loop)
      if (visitedTasks.has(firstDependency.taskId)) {
        console.warn(`⚠️ Loop detectado na cadeia de dependências! Retornando tarefa atual: ${currentTaskId}`);
        return currentTaskId;
      }
      
      // Adicionar ao conjunto de visitados e continuar subindo na cadeia
      visitedTasks.add(firstDependency.taskId);
      currentTaskId = firstDependency.taskId;
      
      console.log(`  Subindo na cadeia: ${firstDependency.task.id} -> ${firstDependency.task.title}`);
    }
    
    console.warn(`⚠️ Máximo de iterações atingido. Retornando: ${currentTaskId}`);
    return currentTaskId;
  }
  
  /**
   * Gera um ID de sessão baseado na primeira tarefa da cadeia
   * @param {string} taskId - ID da tarefa atual
   * @param {string} sessionType - Tipo de sessão ('arquiteto' ou 'turno')
   * @param {number} turnNumber - Número do turno (apenas para sessões de turno)
   * @returns {Promise<string>} ID da sessão unificada
   */
  static async generateUnifiedSessionId(taskId, sessionType, turnNumber = null): Promise<any> {
    const firstTaskId = await this.findFirstTaskInChain(taskId);
    
    // REGRA PRINCIPAL: Todas as tarefas da mesma cadeia devem ter EXATAMENTE A MESMA SESSÃO
    // Isso permite compartilhamento total de contexto entre tarefas dependentes
    
    if (sessionType === 'arquiteto') {
      // Sessão do arquiteto: ID da primeira tarefa + "-arquiteto"
      // Todas as tarefas da cadeia compartilham a MESMA sessão de arquiteto
      const timestamp = new Date().getTime();
      return `${firstTaskId}-arquiteto-${timestamp}`;
    } else if (sessionType === 'turno') {
      // Sessão do turno: ID da primeira tarefa + "-turno-" + número do turno
      // Todas as tarefas da cadeia compartilham a MESMA sessão por turno
      if (turnNumber === null) {
        throw new Error('Número do turno é obrigatório para sessões de turno');
      }
      return `${firstTaskId}-turno-${turnNumber}`;
    }
    
    throw new Error(`Tipo de sessão inválido: ${sessionType}`);
  }
  
  /**
   * Verifica se uma tarefa tem dependências BLOCKING não finalizadas
   * @param {string} taskId - ID da tarefa
   * @returns {Promise<boolean>} true se tem dependências pendentes
   */
  static async hasPendingDependencies(taskId): Promise<any> {
    const dependencies = await prisma.dependency.findMany({
  where: {
  dependentTaskId: taskId,
  type: 'BLOCKING'
      },
  include: {
  task: {
  include: {
  status: true
          }
        }
      }
    });
    
    // Verifica se alguma dependência NÃO está finalizada
    return dependencies.some(dep => 
      dep.task && dep.task.status && !dep.task.status.isFinalState
    );
  }
  
  /**
   * Obtém todas as tarefas na mesma cadeia de dependências
   * @param {string} taskId - ID da tarefa atual
   * @returns {Promise<Array>} Lista de tarefas na cadeia (da primeira até a atual)
   */
  static async getTaskChain(taskId): Promise<any> {
    const chain = [];
    let currentTaskId = taskId;
    let visitedTasks = new Set();
    const MAX_ITERATIONS = 50;
    let iteration = 0;
    
    // Primeiro, subir até a primeira tarefa
    while (iteration < MAX_ITERATIONS && !visitedTasks.has(currentTaskId)) {
      iteration++;
      visitedTasks.add(currentTaskId);
      
      // Buscar tarefa atual
      const currentTask = await prisma.task.findUnique({
  where: { id: currentTaskId },
  select: { id: true, title: true, status: true }
      });
      
      if (currentTask) {
        chain.unshift(currentTask); // Adiciona no início (para manter ordem: primeira -> última)
      }
      
      // Buscar dependências BLOCKING
      const dependencies = await prisma.dependency.findMany({
  where: {
  dependentTaskId: currentTaskId,
  type: 'BLOCKING'
        }
      });
      
      if (dependencies.length === 0) {
        break; // Esta é a primeira tarefa
      }
      
      // Pegar a primeira dependência e continuar subindo
      currentTaskId = dependencies[0].taskId;
    }
    
    console.log(`🔗 Cadeia encontrada: ${chain.map(t => t.title).join(' -> ')}`);
    return chain;
  }
}

export default SessionChainUtils;