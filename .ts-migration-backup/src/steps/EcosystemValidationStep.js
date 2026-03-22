// src/steps/EcosystemValidationStep.js
/**
 * Step responsável por validar o ecossistema do projeto (build, testes, etc.)
 * Executa após contrato cumprido para garantir que as alterações não quebraram o sistema.
 */

const container = require('../container');

class EcosystemValidationStep {
  /**
   * Construtor que obtém dependências do container.
   * Aceita instâncias opcionais para facilitar testes.
   */
  constructor(options = {}) {
    this.log = options.log || container.resolve('log');
    
    // Usar instâncias fornecidas ou criar do container
    this.taskExecutionService = options.taskExecutionService || container.resolve('taskExecutionService');
    this.fileUtils = options.fileUtils || container.resolve('fileUtils');
    this.fileSystem = options.fileSystem || container.resolve('fileSystem');
  }

  /**
   * Executa a validação do ecossistema
   * @param {Object} context - Contexto do pipeline
   * @param {Object} context.task - Tarefa
   * @param {Object} context.project - Projeto (pode ser null)
   * @param {Object} context.config - Configuração
   * @param {Object} context.analysisPlan - Plano de análise (para determinar tipo de tarefa)
   * @param {Object} context.contractResult - Resultado da verificação de contrato
   * @param {string} context.actualDoneFilePath - Caminho do arquivo .done
   * @returns {Promise<Object>} Contexto atualizado com resultado da validação
   */
  async execute(context) {
    const { 
      task, 
      project, 
      config, 
      analysisPlan,
      contractResult,
      actualDoneFilePath
    } = context;
    
    // Se contrato não foi cumprido, não precisa validar ecossistema
    if (contractResult && !contractResult.contractFulfilled) {
      await this.log(`ℹ️ [Ecosistema] Contrato não cumprido, pulando validação de ecossistema`);
      return {
        ...context,
        ecosystemValidationResult: {
          success: true,
          skipped: true,
          reason: 'Contract not fulfilled'
        }
      };
    }
    
    // Se não há projeto ou pasta base, não há o que validar
    if (!project || !project.pastaBase) {
      await this.log(`ℹ️ [Ecosistema] Sem projeto ou pasta base, pulando validação`);
      return {
        ...context,
        ecosystemValidationResult: {
          success: true,
          skipped: true,
          reason: 'No project or base directory'
        }
      };
    }
    
    // Para tarefas de análise/automação, não verificar ecossistema
    if (analysisPlan.taskType === 'analysis' || analysisPlan.taskType === 'automation') {
      await this.log(`ℹ️ [Ecosistema] Tarefa de ${analysisPlan.taskType}, pulando validação de ecossistema`);
      return {
        ...context,
        ecosystemValidationResult: {
          success: true,
          skipped: true,
          reason: `Task type ${analysisPlan.taskType} does not require ecosystem validation`
        }
      };
    }

    try {
      await this.log(`🏗️ [Ecosistema] Validando ecossistema do projeto ${project.name}...`);
      
      // Chama a função de validação do TaskExecutionService
      const validationResult = await this.taskExecutionService.ensureAndValidateEcosystem(
        task,
        project,
        config
      );
      
      if (validationResult.passed) {
        await this.log(`✅ [Ecosistema] Validação passou: ${validationResult.message || 'Ecossistema operacional'}`);
        
        return {
          ...context,
          ecosystemValidationResult: {
            success: true,
            passed: true,
            message: validationResult.message,
            details: validationResult
          }
        };
      } else {
        await this.log(`❌ [Ecosistema] Validação falhou: ${validationResult.message || 'Ecossistema com problemas'}`);
        
        // Se houver arquivo .done, remove porque a validação falhou
        if (actualDoneFilePath) {
          try {
            await this.fileSystem.unlink(actualDoneFilePath);
            await this.log(`🗑️ [Ecosistema] Arquivo .done removido devido a falha na validação`);
          } catch (unlinkError) {
            await this.log(`⚠️ [Ecosistema] Não foi possível remover .done: ${unlinkError.message}`);
          }
        }
        
        return {
          ...context,
          ecosystemValidationResult: {
            success: true, // O step executou com sucesso, mesmo que validação tenha falhado
            passed: false,
            message: validationResult.message,
            details: validationResult
          },
          // Prepara feedback para próximo turno
          lastFeedback: `Validação de Ecossistema falhou:\n\n${validationResult.message}\n\nCorrija o código no módulo indicado e finalize novamente.`,
          contractResult: {
            contractFulfilled: false,
            executionNotes: `Validação de ecossistema falhou: ${validationResult.message}`
          }
        };
      }
      
    } catch (stepError) {
      await this.log(`💥 Erro no EcosystemValidationStep para tarefa ${task.id}: ${stepError.message}`);
      
      return {
        ...context,
        ecosystemValidationResult: {
          success: false,
          error: stepError.message,
          passed: false
        },
        shouldAbort: true,
        abortReason: `Falha na validação do ecossistema: ${stepError.message}`
      };
    }
  }

  /**
   * Método estático de conveniência para uso direto
   * @param {Object} context - Contexto completo
   * @returns {Promise<Object>} Resultado da validação
   */
  static async validateEcosystem(context) {
    const step = new EcosystemValidationStep();
    const result = await step.execute(context);
    return result.ecosystemValidationResult;
  }
}

module.exports = EcosystemValidationStep;