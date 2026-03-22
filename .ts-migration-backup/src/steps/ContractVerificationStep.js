// src/steps/ContractVerificationStep.js
/**
 * Step responsável por verificar se o contrato da tarefa foi cumprido.
 * Verifica arquivos .done, relatório, evidências e snapshot changes.
 */

const container = require('../container');

class ContractVerificationStep {
  /**
   * Construtor que obtém dependências do container.
   * Aceita instâncias opcionais para facilitar testes.
   */
  constructor(options = {}) {
    this.log = options.log || container.get('log');
    
    // Usar instâncias fornecidas ou criar do container
    this.contractVerificationService = options.contractVerificationService || container.get('contractVerificationService');
    this.evidenceService = options.evidenceService || container.get('evidenceService');
    this.fileUtils = options.fileUtils || container.get('fileUtils');
    this.workspaceSnapshotService = options.workspaceSnapshotService || container.get('workspaceSnapshotService');
  }

  /**
   * Executa a verificação de contrato
   * @param {Object} context - Contexto do pipeline
   * @param {Object} context.task - Tarefa
   * @param {Object} context.project - Projeto (pode ser null)
   * @param {Object} context.files - Arquivos preparados
   * @param {Object} context.config - Configuração
   * @param {Object} context.evidence - Evidências coletadas (do DeveloperTurnStep)
   * @param {Object} context.analysisPlan - Plano de análise
   * @param {Map} context.initialSnapshot - Snapshot inicial
   * @param {string} context.actualDoneFilePath - Caminho real do arquivo .done (pode ser diferente do esperado)
   * @returns {Promise<Object>} Contexto atualizado com resultado da verificação
   */
  async execute(context) {
    const { 
      task, 
      project, 
      files, 
      config, 
      evidence,
      analysisPlan,
      initialSnapshot,
      actualDoneFilePath
    } = context;
    
    if (!task || !files || !config) {
      await this.log(`⚠️ ContractVerificationStep: contexto incompleto`);
      return {
        ...context,
        contractVerificationResult: {
          success: false,
          error: 'contexto incompleto (task, files ou config faltando)'
        }
      };
    }

    try {
      await this.log(`📋 [Contrato] Verificando cumprimento do contrato para tarefa ${task.id}...`);
      
      // Usa o caminho real do .done se fornecido, senão o padrão
      const doneFilePath = actualDoneFilePath || files.doneFile;
      const relatorioFilePath = files.relatorioFile;
      const terminalLogFilePath = files.terminalLogFile;
      
      // 1. VERIFICA SE ARQUIVOS EXISTEM
      const doneExists = await this.fileUtils.fileExists(doneFilePath);
      const reportExists = await this.fileUtils.fileExists(relatorioFilePath);
      
      await this.log(`📁 [Contrato] doneFile existe: ${doneExists} (${doneFilePath})`);
      await this.log(`📁 [Contrato] relatorioFile existe: ${reportExists}`);
      
      // 2. CHAMA O SERVIÇO DE VERIFICAÇÃO DE CONTRATO
      const contractResult = await this.contractVerificationService.verifyContract(
        doneFilePath,
        relatorioFilePath,
        terminalLogFilePath,
        {
          taskType: analysisPlan.taskType,
          evidence: evidence || this.evidenceService.createEmptyEvidence(),
          task,
          project,
          analysisPlan,
          initialSnapshot
        }
      );
      
      await this.log(`📊 [Contrato] Resultado: contractFulfilled=${contractResult.contractFulfilled}`);
      
      if (contractResult.contractFulfilled) {
        await this.log(`✅ [Contrato] Contrato cumprido com sucesso!`);
        if (contractResult.executionNotes) {
          await this.log(`📝 [Contrato] Notas: ${contractResult.executionNotes}`);
        }
      } else {
        await this.log(`⚠️ [Contrato] Contrato NÃO cumprido`);
        if (contractResult.feedbackToAgent) {
          await this.log(`💬 [Contrato] Feedback para agente: ${contractResult.feedbackToAgent.substring(0, 200)}...`);
        }
        if (contractResult.missingRequirements && contractResult.missingRequirements.length > 0) {
          await this.log(`📋 [Contrato] Requisitos faltando: ${contractResult.missingRequirements.join(', ')}`);
        }
      }
      
      return {
        ...context,
        contractVerificationResult: {
          success: true,
          contractFulfilled: contractResult.contractFulfilled,
          executionNotes: contractResult.executionNotes,
          feedbackToAgent: contractResult.feedbackToAgent,
          missingRequirements: contractResult.missingRequirements || [],
          evidence: contractResult.evidence || {}
        },
        contractResult // Mantém compatibilidade com código existente
      };
      
    } catch (stepError) {
      await this.log(`💥 Erro no ContractVerificationStep para tarefa ${task.id}: ${stepError.message}`);
      
      return {
        ...context,
        contractVerificationResult: {
          success: false,
          error: stepError.message,
          contractFulfilled: false
        },
        shouldAbort: true,
        abortReason: `Falha na verificação de contrato: ${stepError.message}`
      };
    }
  }

  /**
   * Método estático de conveniência para uso direto
   * @param {Object} context - Contexto completo
   * @returns {Promise<Object>} Resultado da verificação
   */
  static async verifyContract(context) {
    const step = new ContractVerificationStep();
    const result = await step.execute(context);
    return result.contractVerificationResult;
  }
}

module.exports = ContractVerificationStep;