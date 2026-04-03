// monitor/services/FeedbackService.ts
// ─────────────────────────────────────────────────────
// Serviço de Formatação e Gerenciamento de Feedback
//
// Responsabilidade:
// 1. Formatam mensagens de feedback de forma consistente
// 2. Construir contexto incluindo histórico relevante
// 3. Gerenciar limites de tokens/contexto
// 4. Adaptar feedback para diferentes tipos de falhas
//
// Design:
// - Templates específicos por tipo de falha
// - Inclusão inteligente de histórico
// - Truncamento seguro para limites de contexto
// ─────────────────────────────────────────────────────

import type { Logger } from '../interfaces/logger';
import type { AnaliseProgramadorOutput } from '../passos/macro/FaseAnaliseProgramador';
import type { SessionInfo } from './SessionManagerService';

export interface FeedbackServiceDependencies {
  logger: Logger;
}

export interface FeedbackService {
  /**
   * Formata feedback baseado na análise do programador
   * @param analysis Resultado da análise do workspace
   * @param taskId ID da tarefa para referência
   * @param sessionInfo Informações da sessão (opcional, para incluir histórico)
   * @returns Mensagem de feedback formatada
   */
  formatFeedback(
    analysis: AnaliseProgramadorOutput,
    taskId: string,
    sessionInfo?: SessionInfo | null
  ): Promise<string>;

  /**
   * Constrói o contexto completo para o próximo turno
   * @param taskDescription Descrição original da tarefa
   * @param feedback Mensagem de feedback atual
   * @param sessionInfo Informações da sessão (para histórico)
   * @param maxLength Comprimento máximo em caracteres (opcional)
   * @returns Contexto formatado para o prompt
   */
  buildContext(
    taskDescription: string,
    feedback: string,
    sessionInfo?: SessionInfo | null,
    maxLength?: number
  ): Promise<string>;

  /**
   * Determina se o feedback indica necessidade de nova tentativa
   * @param analysis Resultado da análise
   */
  requiresNewAttempt(analysis: AnaliseProgramadorOutput): boolean;

  /**
   * Extrai instruções específicas para o tipo de falha
   * @param analysis Resultado da análise
   */
  getSpecificInstructions(analysis: AnaliseProgramadorOutput): string;
}

export class FeedbackServiceImpl implements FeedbackService {
  private readonly logger: Logger;

  constructor(deps: FeedbackServiceDependencies) {
    this.logger = deps.logger;
  }

  public async formatFeedback(
    analysis: AnaliseProgramadorOutput,
    taskId: string,
    sessionInfo?: SessionInfo | null
  ): Promise<string> {
    
    // Template base
    let feedback = `# FEEDBACK DA ANÁLISE - Tarefa ${taskId}\n\n`;
    
    // Status geral
    if (analysis.workspaceValidado) {
      feedback += `✅ **VALIDAÇÃO BEM-SUCEDIDA**\n`;
      feedback += `O workspace foi validado com sucesso. `;
      
      if (analysis.fileChanges?.total) {
        feedback += `Foram detectadas ${analysis.fileChanges.total} alterações.`;
      }
      
      if (analysis.hasDoneFile) {
        feedback += ` Arquivo .done encontrado.`;
      }
      
      feedback += `\n\n**A tarefa pode prosseguir para a fase de testes.**`;
      
    } else {
      feedback += `⚠️ **AJUSTES NECESSÁRIOS**\n`;
      
      // Adicionar diagnóstico específico
      const diagnosis = this.getDiagnosis(analysis);
      feedback += diagnosis + '\n\n';
      
      // Adicionar instruções específicas
      const instructions = this.getSpecificInstructions(analysis);
      feedback += `## INSTRUÇÕES PARA CORREÇÃO\n${instructions}\n\n`;
      
      // Adicionar contexto de histórico se disponível
      if (sessionInfo?.feedbackHistory && sessionInfo.feedbackHistory.length > 0) {
        const attemptCount = sessionInfo.feedbackHistory.length;
        feedback += `📝 **Esta é a tentativa ${attemptCount + 1} de correção.**\n`;
        feedback += `Considere o feedback anterior ao realizar as correções.\n\n`;
      }
    }
    
    // Adicionar detalhes técnicos se disponíveis
    if (analysis.fileChanges && analysis.fileChanges.total > 0) {
      feedback += `\n## DETALHES TÉCNICOS\n`;
      feedback += `- Arquivos modificados: ${analysis.fileChanges.modified.length}\n`;
      feedback += `- Arquivos criados: ${analysis.fileChanges.created.length}\n`;
      feedback += `- Arquivos deletados: ${analysis.fileChanges.deleted.length}\n`;
      
      if (analysis.fileChanges.modified.length > 0) {
        feedback += `\n**Arquivos modificados:**\n`;
        analysis.fileChanges.modified.slice(0, 3).forEach(file => {
          feedback += `  • ${file}\n`;
        });
        if (analysis.fileChanges.modified.length > 3) {
          feedback += `  • ... e mais ${analysis.fileChanges.modified.length - 3} arquivos\n`;
        }
      }
    }
    
    // Adicionar definição de pronto se disponível
    if (analysis.mensagem) {
      feedback += `\n## CONTEXTO ADICIONAL\n${analysis.mensagem}\n`;
    }
    
    // Assinatura do sistema
    feedback += `\n---\n*Feedback gerado automaticamente pelo sistema de análise*`;
    
    await this.logger.info(`📝 Feedback formatado para tarefa ${taskId} (${feedback.length} chars)`);
    
    return feedback;
  }

  public async buildContext(
    taskDescription: string,
    feedback: string,
    sessionInfo?: SessionInfo | null,
    maxLength: number = 8000
  ): Promise<string> {
    let context = `# TAREFA: ${taskDescription.substring(0, 200)}${taskDescription.length > 200 ? '...' : ''}\n\n`;
    
    // Adicionar histórico se disponível
    if (sessionInfo?.feedbackHistory && sessionInfo.feedbackHistory.length > 0) {
      context += `## HISTÓRICO DE INTERAÇÕES\n`;
      context += `Esta é a tentativa ${sessionInfo.feedbackHistory.length + 1}.\n\n`;
      
      // Incluir apenas os últimos 2 feedbacks para não explodir o contexto
      const recentHistory = sessionInfo.feedbackHistory.slice(-2);
      recentHistory.forEach((hist, index) => {
        context += `### Feedback ${index + 1}\n${hist}\n\n`;
      });
    }
    
    // Adicionar feedback atual
    context += `## FEEDBACK ATUAL (ANÁLISE DO SISTEMA)\n${feedback}\n\n`;
    
    // Adicionar instruções para resposta
    context += `## INSTRUÇÕES PARA SUA RESPOSTA\n`;
    context += `1. Analise o feedback acima cuidadosamente\n`;
    context += `2. Corrija os problemas identificados\n`;
    context += `3. Use as ferramentas apropriadas (write, edit, exec)\n`;
    context += `4. Ao concluir, crie o arquivo .done na pasta da tarefa\n`;
    context += `5. Se não conseguir corrigir tudo, explique o que fez e o que falta\n\n`;
    
    // Truncar se necessário
    if (context.length > maxLength) {
      const originalLength = context.length;
      context = context.substring(0, maxLength - 100) + '\n\n...[contexto truncado devido ao limite de tamanho]';
      this.logger.info(`📏 Contexto truncado de ${originalLength} para ${maxLength} caracteres`);
    }
    
    return context;
  }

  public requiresNewAttempt(analysis: AnaliseProgramadorOutput): boolean {
    // Precisa de nova tentativa se:
    // 1. Workspace não validado E
    // 2. Não é um erro crítico que deve abortar a tarefa
    if (analysis.workspaceValidado) {
      return false;
    }
    
    // Tipos de falha que merecem nova tentativa
    const retryableFailures = [
      'SEM_DONE',
      'SEM_ALTERACOES', 
      'ALTERACOES_INSUFICIENTES',
      'NADA_FEITO',
      'BUILD_FALHOU',
      'TESTES_FALHARAM'
    ];
    
    return retryableFailures.includes(analysis.tipoFalha || '');
  }

  public getSpecificInstructions(analysis: AnaliseProgramadorOutput): string {
    const tipoFalha = analysis.tipoFalha || 'NADA_FEITO';
    
    switch (tipoFalha) {
      case 'SEM_DONE':
        return `🔹 **CRIE O ARQUIVO .done**\n` +
               `O sistema detectou alterações no código, mas falta o arquivo .done que marca a conclusão.\n` +
               `Execute: \`write { path: ".done", content: "Tarefa concluída em ${new Date().toISOString()}" }\` na pasta da tarefa.\n` +
               `Isso sinaliza ao sistema que você finalizou o trabalho.`;
               
      case 'SEM_ALTERACOES':
        return `🔹 **FAÇA ALTERAÇÕES NO CÓDIGO**\n` +
               `Você criou o arquivo .done, mas não houve alterações no código fonte.\n` +
               `Por favor, use as ferramentas de edição (write, edit) para implementar as mudanças necessárias.\n` +
               `Verifique se está editando os arquivos corretos no diretório do projeto.`;
               
      case 'ALTERACOES_INSUFICIENTES':
        return `🔹 **ALTERAÇÕES MAIS SIGNIFICATIVAS**\n` +
               `Foram detectadas algumas alterações, mas são insuficientes para validar o trabalho.\n` +
               `Certifique-se de que está implementando a funcionalidade completa solicitada na tarefa.\n` +
               `Considere:\n` +
               `1. Revisar os requisitos da tarefa\n` +
               `2. Implementar testes se necessário\n` +
               `3. Verificar integração com outras partes do sistema`;
               
      case 'NADA_FEITO':
        return `🔹 **INICIE O TRABALHO**\n` +
               `Não foram detectadas alterações no código nem arquivo .done criado.\n` +
               `Por favor:\n` +
               `1. Comece a trabalhar na tarefa usando write/edit para modificar código\n` +
               `2. Ou se já concluiu, crie o arquivo .done\n` +
               `3. Use exec para rodar comandos se necessário\n` +
               `4. Documente seu progresso se encontrar obstáculos`;
               
      case 'BUILD_FALHOU':
        return `🔹 **CORRIJA ERROS DE BUILD**\n` +
               `O build do projeto falhou. Verifique:\n` +
               `1. Erros de sintaxe no código\n` +
               `2. Dependências faltando (package.json, imports)\n` +
               `3. Configurações do projeto\n` +
               `Use \`exec { command: "npm run build" }\` para testar localmente antes de marcar como concluído.`;
               
      case 'TESTES_FALHARAM':
        return `🔹 **CORRIJA TESTES QUE FALHARAM**\n` +
               `Os testes automatizados falharam. Verifique:\n` +
               `1. Se suas alterações quebraram testes existentes\n` +
               `2. Se novos testes foram adicionados e estão falhando\n` +
               `3. Dados de teste/mocks que precisam ser atualizados\n` +
               `Use \`exec { command: "npm test" }\` para rodar os testes localmente.`;
               
      default:
        return `🔹 **REVISE SEU TRABALHO**\n` +
               `O sistema identificou problemas na sua implementação.\n` +
               `Por favor, revise o código e certifique-se de que:\n` +
               `1. A funcionalidade solicitada foi implementada\n` +
               `2. Não há erros de sintaxe ou lógica\n` +
               `3. Os arquivos necessários foram criados/modificados\n` +
               `4. O arquivo .done foi criado ao concluir`;
    }
  }

  /**
   * Diagnóstico detalhado baseado no tipo de falha
   */
  private getDiagnosis(analysis: AnaliseProgramadorOutput): string {
    const tipoFalha = analysis.tipoFalha || 'NADA_FEITO';
    
    const diagnoses: Record<string, string> = {
      'SEM_DONE': `O sistema detectou que você alterou arquivos (${analysis.fileChanges?.total || 0} mudanças), mas não criou o arquivo .done que sinaliza conclusão.`,
      'SEM_ALTERACOES': `Você criou o arquivo .done, mas não foram detectadas alterações no código fonte. O .done indica conclusão, mas sem mudanças não há evidência de trabalho realizado.`,
      'ALTERACOES_INSUFICIENTES': `Foram detectadas algumas alterações (${analysis.fileChanges?.total || 0} arquivos), mas são insuficientes para validar a implementação completa da tarefa.`,
      'NADA_FEITO': `Não foram detectadas alterações no código nem arquivo .done criado. O sistema não pode validar trabalho não realizado.`,
      'BUILD_FALHOU': `O build do projeto falhou. Isso indica problemas no código que impedem a compilação/transpilação.`,
      'TESTES_FALHARAM': `Os testes automatizados falharam. Isso indica que as alterações podem ter introduzido regressões ou não atendem aos requisitos.`
    };
    
    return diagnoses[tipoFalha] || `Problema não especificado no trabalho do programador.`;
  }
}