// src/steps/SetupContextStep.ts
/**
 * Step responsável por preparar o contexto para execução de tarefas.
 * Inclui análise de escopo, preparação de arquivos, geração de prompts e snapshot inicial.
 */

import container from '../container';

class SetupContextStep {
  // 1. Declaração explícita de dependências
  private log: any;
  private config: any;
  private fileSystem: any;
  private path: any;
  private prisma: any;
  private taskAnalysisService: any;
  private workspaceSnapshotService: any;
  private promptFactory: any;
  private fileUtils: any;

  /**
   * Construtor que obtém dependências do container.
   * Aceita instâncias opcionais para facilitar testes.
   */
  constructor(options: any = {}) {
    this.log = container.get('log');
    this.config = container.get('config');
    this.fileSystem = container.get('fileSystem');
    this.path = container.get('path');
    
    // Usar instâncias fornecidas ou criar do container
    this.prisma = options.prisma || container.get('prisma');
    this.taskAnalysisService = options.taskAnalysisService || container.get('taskAnalysisService');
    this.workspaceSnapshotService = options.workspaceSnapshotService || container.get('workspaceSnapshotService');
    this.promptFactory = options.promptFactory || container.get('promptFactory');
    this.fileUtils = options.fileUtils || container.get('fileUtils');
  }

  /**
   * Executa o step de preparação de contexto
   */
  async execute(context: any): Promise<any> {
    const { task, userId } = context;
    const { TASKS_DIR } = this.config;
    
    if (!task || !task.id) {
      await this.log(`⚠️ SetupContextStep: task inválida ou sem ID`);
      return {
        ...context,
        setupResult: {
          success: false,
          error: 'task inválida ou sem ID'
        },
        shouldAbort: true,
        abortReason: 'task inválida ou sem ID'
      };
    }

    try {
      await this.log(`🔧 [Setup] Preparando contexto para tarefa ${task.id}: "${task.title}"`);
      
      // 1. Buscar projeto associado (se houver)
      const project = task.projectId ? 
        await this.prisma.project.findUnique({ where: { id: task.projectId } }) : 
        null;
      
      const taskId = task.id;
      
      // 2. Analisar escopo da tarefa para definir taskType (development, analysis, automation)
      await this.log(`🔍 [Setup] Analisando escopo da tarefa...`);
      const analysisPlan = await this.taskAnalysisService.analyzeTaskScope(
        task, 
        project, 
        this.path.join(TASKS_DIR, `terminal-pre-analise-${taskId}.log`)
      );
      
      await this.log(`📋 [Setup] Tipo de tarefa definido: ${analysisPlan.taskType}`);
      
      // 3. Preparar caminhos dos arquivos
      const files = {
        promptFile: this.path.join(TASKS_DIR, `prompt-${taskId}.txt`),
        relatorioFile: this.path.join(TASKS_DIR, `relatorio-${taskId}.txt`),
        doneFile: this.path.join(TASKS_DIR, `done-${taskId}.done`),
        terminalLogFile: this.path.join(TASKS_DIR, `terminal-${taskId}.log`),
        architectPlanFile: this.path.join(TASKS_DIR, `plano-arquiteto-${taskId}.txt`),
        architectLogFile: this.path.join(TASKS_DIR, `terminal-arquiteto-${taskId}.log`)
      };

      const dirBase = project?.pastaBase || 'Diretório atual';
      
      // 4. Montar seção de comentários (se houver)
      let commentsSection = '';
      if (task.comments && task.comments.length > 0) {
        commentsSection = '\n\n=== COMENTÁRIOS DA TAREFA ===\n';
        task.comments.forEach((comment: any, index: number) => {
          const userInfo = comment.user ? `${comment.user.name} (${comment.user.nickname})` : 'Usuário';
          const timestamp = new Date(comment.createdAt).toLocaleString('pt-BR');
          commentsSection += `\n${index + 1}. [${timestamp}] ${userInfo}: ${comment.content}`;
        });
        await this.log(`💬 [Setup] ${task.comments.length} comentários incluídos no contexto`);
      }
      
      // 5. Tirar snapshot inicial (para obter lista de arquivos para o prompt)
      await this.log(`📸 [Setup] Tirando snapshot inicial do workspace...`);
      const initialSnapshot = await this.workspaceSnapshotService.takeSnapshot(
        project?.pastaBase || TASKS_DIR
      );
      const fileList = Array.from(initialSnapshot.keys());
      await this.log(`📁 [Setup] ${fileList.length} arquivos detectados no workspace`);
      
      // 6. Gerar Prompt Inteligente do Arquiteto usando PromptFactory
      await this.log(`🧠 [Setup] Gerando prompt do arquiteto...`);
      const architectPrompt = this.promptFactory.buildArchitectPrompt(
        task, 
        project, 
        fileList, 
        files.architectPlanFile, 
        commentsSection, 
        analysisPlan.taskType
      );
      
      // 7. Salvar arquivos físicos
      const architectPromptBackupFile = this.path.join(TASKS_DIR, `architect-prompt-${taskId}.txt`);
      await this.fileSystem.writeFile(architectPromptBackupFile, architectPrompt);
      await this.fileSystem.writeFile(files.promptFile, architectPrompt);
      await this.fileSystem.writeFile(files.terminalLogFile, '');
      
      await this.log(`💾 [Setup] Arquivos de prompt salvos: ${files.promptFile}`);
      
      // 8. Gerar Prompt do Desenvolvedor
      const engineRules = this.promptFactory.buildEngineRulesPrompt(files);
      const developerPrompt = `DESENVOLVEDOR: Analise o plano de ação e crie o código.\n\nTAREFA: ${task.title}. DESC: ${task.description}. BASE: ${dirBase}.${commentsSection}\n\n${engineRules}`;
      
      // 9. Criar log de execução no banco (se necessário)
      // Nota: A criação do log de execução pode ser movida para um step separado
      // Por enquanto, retornamos os dados necessários
      
      await this.log(`✅ [Setup] Contexto preparado com sucesso para tarefa ${taskId}`);
      
      return {
        ...context,
        setupResult: {
          success: true,
          taskId,
          filesPrepared: Object.keys(files).length,
          fileListCount: fileList.length,
          taskType: analysisPlan.taskType
        },
        project,
        analysisPlan,
        files,
        initialSnapshot,
        currentInput: architectPrompt,
        developerPrompt,
        commentsSection,
        // Dados para criação de log (pode ser usado por outro step)
        executionLogData: {
          taskId: task.id,
          userId,
          model: 'deepseek/deepseek-chat', // Default, pode ser sobrescrito
          startedAt: new Date()
        }
      };
      
    } catch (stepError: any) {
      await this.log(`💥 Erro no SetupContextStep para tarefa ${task.id}: ${stepError.message}`);
      
      return {
        ...context,
        setupResult: {
          success: false,
          error: stepError.message,
          taskId: task.id
        },
        shouldAbort: true,
        abortReason: `Falha na preparação do contexto: ${stepError.message}`
      };
    }
  }

  /**
   * Método estático de conveniência para uso direto
   */
  static async setupContext(task: any, userId: string, config: any = null): Promise<any> {
    const step = new SetupContextStep();
    const result = await step.execute({ 
      task, 
      userId, 
      config: config || container.get('config') 
    });
    return result.setupResult;
  }
}

export default SetupContextStep;