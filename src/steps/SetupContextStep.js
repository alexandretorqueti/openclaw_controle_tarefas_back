// src/steps/SetupContextStep.js
/**
 * Step responsável por preparar o contexto para execução de tarefas.
 * Inclui análise de escopo, preparação de arquivos, geração de prompts e snapshot inicial.
 */

const container = require('../container');

class SetupContextStep {
  /**
   * Construtor que obtém dependências do container.
   * Aceita instâncias opcionais para facilitar testes.
   */
  constructor(options = {}) {
    this.log = options.log || container.resolve('log');
    this.config = options.config || container.resolve('config');
    this.fileSystem = options.fileSystem || container.resolve('fileSystem');
    this.path = options.path || container.resolve('path');
    
    this.prisma = options.prisma || container.resolve('prisma');
    this.taskAnalysisService = options.taskAnalysisService || container.resolve('taskAnalysisService');
    this.workspaceSnapshotService = options.workspaceSnapshotService || container.resolve('workspaceSnapshotService');
    this.promptFactory = options.promptFactory || container.resolve('promptFactory');
    this.fileUtils = options.fileUtils || container.resolve('fileUtils');
    this.sessionChainUtils = options.sessionChainUtils || container.resolve('sessionChainUtils'); // Injetado para o Roadmap
  }

  /**
   * Executa o step de preparação de contexto
   * @param {Object} context - Contexto do pipeline
   * @param {Object} context.task - Tarefa a ser executada
   * @param {string} context.userId - ID do usuário
   * @returns {Promise<Object>} Contexto atualizado com setup completo
   */
  async execute(context) {
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
        task.comments.forEach((comment, index) => {
          const userInfo = comment.user ? `${comment.user.name} (${comment.user.nickname})` : 'Usuário';
          const timestamp = new Date(comment.createdAt).toLocaleString('pt-BR');
          commentsSection += `\n${index + 1}. [${timestamp}] ${userInfo}: ${comment.content}`;
        });
        await this.log(`💬 [Setup] ${task.comments.length} comentários incluídos no contexto`);
      }

      // =====================================================================
      // 🚀 NOVIDADE 1: CONSTRUÇÃO DO ROADMAP VISUAL (ANTI-AMNÉSIA E ANTI-AFOBAÇÃO)
      // =====================================================================
      let roadmapSection = '';
      try {
        const taskChain = await this.sessionChainUtils.getTaskChain(task.id);
        
        if (taskChain && taskChain.length > 1) {
          roadmapSection = '\n=== ROADMAP DA FUNCIONALIDADE (EPIC) ===\n';
          roadmapSection += 'Esta tarefa faz parte de uma sequência estruturada. Respeite ESTREITAMENTE os limites do seu escopo e NÃO tente implementar funcionalidades de passos futuros.\n\n';
          
          taskChain.forEach((t, index) => {
            if (t.id === task.id) {
              roadmapSection += `[📍 VOCÊ ESTÁ AQUI] Passo ${index + 1}: ${t.title} (FOQUE APENAS NISTO)\n`;
            } else if (t.status && t.status.isFinalState) {
              roadmapSection += `[✅ CONCLUÍDO] Passo ${index + 1}: ${t.title} (Já implementado no projeto, apenas integre)\n`;
            } else {
              roadmapSection += `[⏳ PENDENTE] Passo ${index + 1}: ${t.title} (NÃO implemente isso agora)\n`;
            }
          });
          roadmapSection += '========================================\n';
          await this.log(`🗺️ [Escopo] Roadmap de ${taskChain.length} passos gerado com sucesso.`);
        }
      } catch (err) {
        await this.log(`⚠️ [Escopo] Erro ao montar roadmap visual: ${err.message}`);
      }

      const originalDescription = task.description || 'Sem descrição detalhada.';
      task.description = roadmapSection ? `${roadmapSection}\n=== DESCRIÇÃO DA TAREFA ATUAL ===\n${originalDescription}` : originalDescription;
      // =====================================================================
      
      // 5. Tirar snapshot inicial (para obter lista de arquivos para o prompt)
      await this.log(`📸 [Setup] Tirando snapshot inicial do workspace...`);
      const initialSnapshot = await this.workspaceSnapshotService.takeSnapshot(
        project?.pastaBase || TASKS_DIR
      );
      let fileList = Array.from(initialSnapshot.keys());
      await this.log(`📁 [Setup] ${fileList.length} arquivos detectados no workspace (pré-filtro)`);

      // =====================================================================
      // 🎯 FILTRO CIRÚRGICO DE DOMÍNIO (CORRIGIDO PARA CAMINHOS ABSOLUTOS)
      // =====================================================================
      const domain = task.domain?.toUpperCase();
      
      if (domain === 'FRONTEND' && project?.frontendPath) {
        const originalCount = fileList.length;
        fileList = fileList.filter(file => 
          file.includes(project.frontendPath) || // Correção: de startsWith para includes
          file.includes('shared') || 
          !file.includes('/') 
        );
        await this.log(`🎯 [Escopo] Tarefa FRONTEND: Lista reduzida de ${originalCount} para ${fileList.length} arquivos.`);
      } else if (domain === 'BACKEND' && project?.backendPath) {
        const originalCount = fileList.length;
        fileList = fileList.filter(file => 
          file.includes(project.backendPath) || // Correção: de startsWith para includes
          file.includes('prisma') || 
          file.includes('shared') ||
          !file.includes('/')
        );
        await this.log(`🎯 [Escopo] Tarefa BACKEND: Lista reduzida de ${originalCount} para ${fileList.length} arquivos.`);
      } else {
        await this.log(`🌍 [Escopo] Tarefa FULLSTACK ou domínio não especificado: Enviando todos os ${fileList.length} arquivos.`);
      }
      
      // 6. Gerar Prompt Inteligente do Arquiteto usando PromptFactory
      await this.log(`🧠 [Setup] Gerando prompt do arquiteto...`);
      const architectPrompt = this.promptFactory.buildArchitectPrompt(
        task, 
        project, 
        fileList, // Agora passa a lista otimizada pelo Filtro de Domínio!
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
      // O roadmap visual já foi injetado na task.description, então o developerPrompt ganha isso de graça.
      const engineRules = this.promptFactory.buildEngineRulesPrompt(files);
      const developerPrompt = `DESENVOLVEDOR: Analise o plano de ação e crie o código.\n\nTAREFA: ${task.title}. DESC: ${task.description}. BASE: ${dirBase}.${commentsSection}\n\n${engineRules}`;
      
      // 9. Retornar os dados necessários
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
        executionLogData: {
          taskId: task.id,
          userId,
          model: 'deepseek/deepseek-chat',
          startedAt: new Date()
        }
      };
      
    } catch (stepError) {
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
   * @param {Object} task - Tarefa a ser preparada
   * @param {string} userId - ID do usuário
   * @param {Object} config - Configuração (opcional, usa container por padrão)
   * @returns {Promise<Object>} Resultado do setup
   */
  static async setupContext(task, userId, config = null) {
    const step = new SetupContextStep();
    const result = await step.execute({ 
      task, 
      userId, 
      config: config || container.resolve('config') 
    });
    return result.setupResult;
  }
}

module.exports = SetupContextStep;