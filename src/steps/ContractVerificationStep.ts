// src/steps/ContractVerificationStep.ts
/**
 * Step responsável por verificar se o contrato da tarefa foi cumprido.
 * Verifica arquivos .done, relatório, evidências e snapshot changes.
 */

import container from '../container';

class ContractVerificationStep {
  // 1. Declaração limpa de todas as dependências
  private log: any;
  private contractVerificationService: any;
  private evidenceService: any;
  private fileUtils: any;
  private workspaceSnapshotService: any;

  /**
   * Construtor que obtém dependências do container.
   * Aceita instâncias opcionais para facilitar testes.
   */
  constructor(options: any = {}) {
    this.log = options.log || container.get('log');
    this.contractVerificationService = options.contractVerificationService || container.get('contractVerificationService');
    this.evidenceService = options.evidenceService || container.get('evidenceService');
    this.fileUtils = options.fileUtils || container.get('fileUtils');
    this.workspaceSnapshotService = options.workspaceSnapshotService || container.get('workspaceSnapshotService');
  }

  /**
   * Executa a verificação de contrato
   */
  async execute(context: any): Promise<any> {
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
        contractResult // Mantém compatibilidade com o Orquestrador
      };
      
    } catch (stepError: any) {
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
   */
  static async verifyContract(context: any): Promise<any> {
    const step = new ContractVerificationStep();
    const result = await step.execute(context);
    return result.contractVerificationResult;
  }
}

export default ContractVerificationStep;