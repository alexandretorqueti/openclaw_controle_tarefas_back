// Migrado para TypeScript - Fase: Steps
// Arquivo: GetNextTaskStep.js

// src/steps/GetNextTaskStep.js
/**
 * Step responsável por obter a próxima tarefa elegível para execução.
 * Faz requisição à API e trata casos de fila vazia ou erros.
 */

import container from '../container';

class GetNextTaskStep {
  /**
   * Construtor que obtém dependências do container.
   * Aceita instâncias opcionais para facilitar testes.
   */
  constructor(options = {}) {
    (this as any).log = container.resolve('log');
    (this as any).config = container.resolve('config');
    (this as any).axios = options.axios || container.resolve('axios');
  }

  /**
   * Executa o step para obter próxima tarefa
   * @param {Object} context - Contexto do pipeline
   * @param {string} context.nickname - Nickname do usuário
   * @param {string} context.apiUrl - URL da API (opcional, usa config.API_URL por padrão)
   * @returns {Promise<Object>} Contexto atualizado com tarefa encontrada
   */
  async execute(context): Promise<any> {
    const { nickname } = context;
    const apiUrl = context.apiUrl || this.config.API_URL;
    
    if (!nickname) {
      await this.log(`⚠️ GetNextTaskStep: nickname não fornecido`);
      return {
        ...context,
        nextTaskResult: {
          success: false,
          error: 'nickname não fornecido',
          task: null
        }
      };
    }

    try {
      await this.log(`🔍 Buscando próxima tarefa elegível para usuário "${nickname}"`);
      
      const response = await this.axios.get(`${apiUrl}/api/users/nickname/${nickname}/next-task`);

      // Se a API retornar uma tarefa válida, nós a devolvemos
      if (response.data && response.data?.task?.id) {
        const task = response.data.task;
        await this.log(`✅ Tarefa ${task.id} encontrada: "${task.title}"`);
        
        return {
          ...context,
          nextTaskResult: {
            success: true,
            task,
            found: true,
            taskId: task.id
          },
          task // Adiciona a tarefa ao contexto para próximos steps
        };
      }

      // Tarefa não encontrada (mas API retornou 200 com dados vazios)
      await this.log(`ℹ️ Nenhuma tarefa encontrada para "${nickname}" (API retornou 200 sem tarefa)`);
      
      return {
        ...context,
        nextTaskResult: {
          success: true,
          task: null,
          found: false,
          message: 'Nenhuma tarefa encontrada'
        }
      };
      
    } catch (error) {
      // Se a API retornar 404 (Not Found) ou 204 (No Content), significa que a fila está vazia.
      // Isso é um comportamento esperado, então não precisamos logar como um erro crítico.
      if (error.response && (error.response.status === 404 || error.response.status === 204)) {
        await this.log(`ℹ️ Nenhuma tarefa disponível para "${nickname}" (API: ${error.response.status})`);
        
        return {
          ...context,
          nextTaskResult: {
            success: true,
            task: null,
            found: false,
            apiStatus: error.response.status,
            message: 'Fila vazia - comportamento esperado'
          }
        };
      }

      // Outros erros (network, server error, etc.)
      await this.log(`❌ Erro ao buscar tarefa elegível na API: ${error.message}`);
      
      return {
        ...context,
        nextTaskResult: {
          success: false,
          error: error.message,
          task: null,
          found: false
        },
        shouldAbort: true,
        abortReason: `Falha ao buscar próxima tarefa: ${error.message}`
      };
    }
  }

  /**
   * Método estático de conveniência para uso direto
   * @param {string} nickname - Nickname do usuário
   * @param {string} apiUrl - URL da API (opcional)
   * @returns {Promise<Object|null>} Tarefa encontrada ou null
   */
  static async getNextTask(nickname, apiUrl = null): Promise<any> {
    const step = new GetNextTaskStep();
    const result = await step.execute({ nickname, apiUrl });
    return result.nextTaskResult;
  }
}

export default GetNextTaskStep;