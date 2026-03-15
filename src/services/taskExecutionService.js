// src/services/taskExecutionService.js

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Importação dos serviços
const agentService = require('./agentService');
const WorkspaceSnapshotService = require('./workspaceSnapshotService');
const OpenClawService = require('./openclawService');
const ContractVerificationService = require('./contractVerificationService');
const EvidenceService = require('./evidenceService');
const TaskAnalysisService = require('./taskAnalysisService');
const PromptFactory = require('../utils/promptFactory');

// Utilitários
const { fileExists } = require('../utils/fileUtils');
const { runPipeline } = require('../utils/pipelineUtils'); // <-- Nosso novo motor
const { log } = require('../../aux/logger');

const prisma = new PrismaClient();

class TaskExecutionService {
  
  // ==========================================
  // MÉTODOS AUXILIARES DE LOG
  // ==========================================
  static async createExecutionLog(task, userId, agentId) {
    let model = 'deepseek/deepseek-chat';
    if (agentId) {
      try {
        const agentDetails = await agentService.getAgentDetails(agentId);
        model = agentDetails.identity?.model || model;
      } catch (error) { /* Silencioso */ }
    }
    return await prisma.taskExecutionLog.create({
      data: { taskId: task.id, userId, model, startedAt: new Date(), success: false }
    });
  }

  static async finishExecutionLog(logId, result) {
    const logEntry = await prisma.taskExecutionLog.findUnique({ where: { id: logId } });
    if (!logEntry) return;
    return await prisma.taskExecutionLog.update({
      where: { id: logId },
      data: {
        finishedAt: new Date(),
        durationMs: new Date() - logEntry.startedAt,
        success: result.success || false,
        exitCode: result.exitCode,
        errorMessage: result.errorMessage,
        executionNotes: result.executionNotes
      }
    });
  }

  // ==========================================
  // ETAPAS DO PIPELINE (STEPS)
  // ==========================================

  /**
   * Passo 1: Prepara arquivos, banco de dados e analisa o escopo.
   */
  static async stepSetupContext(ctx) {
    const { task, userId, config } = ctx;
    const { TASKS_DIR } = config;

    const project = task.projectId ? await prisma.project.findUnique({ where: { id: task.projectId } }) : null;
    const taskId = task.id;
    const analysisPlan = await TaskAnalysisService.analyzeTaskScope(task, project, path.join(TASKS_DIR, `terminal-pre-analise-${taskId}.log`));
    
    // Prepara os caminhos dos arquivos
   
    const files = {
      promptFile: path.join(TASKS_DIR, `prompt-${taskId}.txt`),
      relatorioFile: path.join(TASKS_DIR, `relatorio-${taskId}.txt`),
      doneFile: path.join(TASKS_DIR, `done-${taskId}.done`),
      terminalLogFile: path.join(TASKS_DIR, `terminal-${taskId}.log`),
      architectPlanFile: path.join(TASKS_DIR, `plano-arquiteto-${taskId}.txt`),
      architectLogFile: path.join(TASKS_DIR, `terminal-arquiteto-${taskId}.log`)
    };

    // Cria o prompt LIMPO para o arquiteto (apenas tarefa + contexto)
    const dirBase = project?.pastaBase || 'Diretório atual';
    
    // Adiciona comentários ao prompt se existirem
    let commentsSection = '';
    if (task.comments && task.comments.length > 0) {
      commentsSection = '\n\n=== COMENTÁRIOS DA TAREFA ===\n';
      task.comments.forEach((comment, index) => {
        const userInfo = comment.user ? `${comment.user.name} (${comment.user.nickname})` : 'Usuário';
        const timestamp = new Date(comment.createdAt).toLocaleString('pt-BR');
        commentsSection += `\n${index + 1}. [${timestamp}] ${userInfo}: ${comment.content}`;
      });
    }

    const architectPrompt = `ARQUITETO: Analise esta tarefa e crie um plano de ação.\n\nTAREFA: ${task.title}\nDESCRIÇÃO: ${task.description}\nBASE: ${dirBase}${commentsSection}`;
    
    // Engine rules serão adicionadas APENAS para o desenvolvedor depois
    const engineRules = PromptFactory.buildEngineRulesPrompt(files);
    const developerPrompt = `DESENVOLVEDOR: Analise o plano de ação e crie o código.\n\nTAREFA: ${task.title}. DESC: ${task.description}. BASE: ${dirBase}.${commentsSection}\n\n${engineRules}`;
    
    await fs.writeFile(files.promptFile, architectPrompt);
    await fs.writeFile(files.relatorioFile, '');
    await fs.writeFile(files.terminalLogFile, '');

    const initialSnapshot = await WorkspaceSnapshotService.takeSnapshot(project?.pastaBase || TASKS_DIR);
    const executionLog = await TaskExecutionService.createExecutionLog(task, userId, task.agent);

    return { ...ctx, project, analysisPlan, files, initialSnapshot, executionLog, currentInput: architectPrompt, developerPrompt, commentsSection };
  }

  /**
   * Passo 2: Se for desenvolvimento, o Arquiteto planeja a execução.
   */
  static async stepArchitectPlanning(ctx) {
    if (ctx.analysisPlan.taskType !== 'development') {
      await log(`⏭️ [Arquiteto] Pulado: Tarefa não é de desenvolvimento.`);
      return ctx; 
    }

    const { task, project, files, initialSnapshot, config } = ctx;
    const fileList = Array.from(initialSnapshot.keys());
    const architectInput = PromptFactory.buildArchitectPrompt(task, project, fileList, files.architectPlanFile, ctx.commentsSection || '');
    await log(`🧠 [Arquiteto] Avaliando a tarefa ${task.id} e montando o plano de ação...`);

    // Roda o Arquiteto com timeout de 10 minutos (600000ms)
    const architectResult = await OpenClawService.execute(
      `${task.id}-architect`, 
      architectInput, 
      project.agent || 'analista-pleno',            
      null,                   
      config.TASKS_DIR, 
      files.architectLogFile, 
      project?.pastaBase, 
      600000                  
    );

    // Remove .done se o arquiteto criou indevidamente
    await fs.unlink(files.doneFile).catch(() => {});
    
    let architectPlan = "";
    let architectAnalysis = null;
    
    // Primeiro tenta ler do arquivo de plano do arquiteto, depois do rawOutput
    try {
      if (await fileExists(files.architectPlanFile)) {
        architectPlan = await fs.readFile(files.architectPlanFile, 'utf8');
        await log(`📝 [Arquiteto] Plano lido do arquivo (${architectPlan.length} caracteres): ${architectPlan.substring(0, 200)}...`);
      } else if (architectResult.rawOutput && architectResult.rawOutput.trim().length > 0) {
        architectPlan = architectResult.rawOutput;
        await log(`📝 [Arquiteto] Resposta recebida (${architectPlan.length} caracteres): ${architectPlan.substring(0, 200)}...`);
      }
    } catch (error) {
      await log(`⚠️ [Arquiteto] Erro ao ler arquivo de plano: ${error.message}`);
      if (architectResult.rawOutput && architectResult.rawOutput.trim().length > 0) {
        architectPlan = architectResult.rawOutput;
        await log(`📝 [Arquiteto] Usando rawOutput como fallback (${architectPlan.length} chars)`);
      }
    }
    
    // Verificar se temos um plano do arquiteto
    if (architectPlan && architectPlan.trim().length > 0) {
      // 1. ANÁLISE INTELIGENTE DA RESPOSTA DO ARQUITETO
      // Usa LLM para compreender semanticamente se o arquiteto já executou ou só planejou
      await log(`🧠 [Arquiteto] Analisando resposta com IA...`);
      architectAnalysis = await TaskAnalysisService.analyzeArchitectResponse(architectPlan, task, project);
        
      await log(`📊 [Arquiteto] Análise inicial: hasExecuted=${architectAnalysis.hasExecuted}, hasPlan=${architectAnalysis.hasPlan}, confidence=${architectAnalysis.confidence}%`);
      
      // VALIDAÇÃO CRÍTICA: Se a IA diz que executou, verificar evidências reais
      if (architectAnalysis.hasExecuted && architectAnalysis.confidence > 70) {
        await log(`🔍 [Validação] IA diz que arquiteto executou. Verificando evidências...`);
        
        // Verificar se há evidências reais de execução
        const currentSnapshot = await WorkspaceSnapshotService.takeSnapshot(project?.pastaBase || ctx.config.TASKS_DIR);
        const changes = WorkspaceSnapshotService.compareSnapshots(ctx.initialSnapshot, currentSnapshot);
        const hasRealChanges = changes.modified.length > 0 || changes.created.length > 0;
        const architectDoneExists = await fileExists(files.doneFile);
        const architectReportExists = await fileExists(files.relatorioFile);
        const hasEvidence = hasRealChanges || architectDoneExists || architectReportExists;
        
        if (!hasEvidence) {
          await log(`⚠️ [Validação] NENHUMA evidência encontrada! IA provavelmente errou. Corrigindo análise...`);
          // Corrigir a análise: não executou, apenas planejou
          architectAnalysis = {
            hasExecuted: false,
            hasPlan: true,  // Se gerou resposta detalhada, tem plano
            confidence: 80,
            executionDetails: null,
            planDetails: "Arquiteto gerou plano detalhado, mas não executou alterações (validação de evidências falhou)",
            analysisFailed: false
          };
          await log(`📊 [Arquiteto] Análise CORRIGIDA: hasExecuted=false, hasPlan=true (falta de evidências)`);
        } else {
          await log(`✅ [Validação] Evidências confirmadas: ${changes.modified.length} arquivos modificados, ${changes.created.length} criados`);
        }
      }
      
      if (architectAnalysis.hasExecuted) {
        await log(`✅ [Arquiteto] Análise indica que já executou a tarefa (${architectAnalysis.confidence}% confiança).`);
        if (architectAnalysis.executionDetails) {
          await log(`📝 [Arquiteto] Detalhes: ${architectAnalysis.executionDetails.substring(0, 100)}...`);
        }
      } else if (architectAnalysis.hasPlan) {
        await log(`📋 [Arquiteto] Análise indica que gerou plano de ação (${architectAnalysis.confidence}% confiança).`);
        if (architectAnalysis.planDetails) {
          await log(`📝 [Arquiteto] Detalhes: ${architectAnalysis.planDetails.substring(0, 100)}...`);
        }
      } else if (architectAnalysis.analysisFailed) {
        await log(`⚠️ [Arquiteto] Análise falhou ou resposta incompreensível.`);
      } else {
        await log(`ℹ️ [Arquiteto] Análise não identificou execução nem plano claro.`);
      }
      
      // Opcional: Salvar plano em arquivo para referência (mas não dependemos mais dele)
      try {
        await fs.writeFile(files.architectPlanFile, architectPlan);
        await log(`💾 [Arquiteto] Plano salvo em arquivo para referência: ${files.architectPlanFile}`);
      } catch (error) {
        await log(`⚠️ [Arquiteto] Não foi possível salvar plano em arquivo: ${error.message}`);
      }
    } else {
      architectPlan = "O arquiteto não conseguiu gerar um plano detalhado. Siga a descrição original da tarefa.";
      architectAnalysis = {
        hasExecuted: false,
        hasPlan: false,
        confidence: 0,
        executionDetails: null,
        planDetails: null,
        analysisFailed: true
      };
      await log(`⚠️ [Arquiteto] Resposta vazia ou inválida. Usando descrição original.`);
    }

    // 2. DECIDIR FLUXO COM BASE NA ANÁLISE INTELIGENTE
    let updatedPromptContent;
    
    if (architectAnalysis.hasExecuted && architectAnalysis.confidence > 70 && architectPlan.trim()) {
      // Arquiteto já executou com alta confiança (E PASSOU NA VALIDAÇÃO) - usar APENAS a análise do arquiteto
      updatedPromptContent = `=== EXECUÇÃO CONCLUÍDA PELO ARQUITETO ===\n${architectPlan}\n\nVerifique se as alterações descritas acima foram realmente implementadas.`;
      await log(`🔄 [Arquiteto] Fluxo: Usando execução do arquiteto (alta confiança + evidências validadas).`);
    } else if (architectAnalysis.hasPlan && architectPlan.trim()) {
      // Arquiteto gerou plano - SUBSTITUIR pelo plano + adicionar instruções do desenvolvedor
      updatedPromptContent = `=== PLANO DE AÇÃO DO ARQUITETO ===\n${architectPlan}\n\n${ctx.developerPrompt}`;
      await log(`🔄 [Arquiteto] Fluxo: Substituindo prompt pelo plano + instruções do desenvolvedor.`);
    } else if (architectAnalysis.analysisFailed || !architectPlan.trim()) {
      // Arquiteto falhou - manter original
      updatedPromptContent = ctx.currentInput;
      await log(`🔄 [Arquiteto] Fluxo: Mantendo prompt original (análise falhou).`);
    } else {
      // Caso padrão (baixa confiança, resposta ambígua)
      updatedPromptContent = `${ctx.currentInput}\n\n=== ANÁLISE DO ARQUITETO ===\n${architectPlan}\n\nAnalise a resposta acima e execute conforme necessário.`;
      await log(`🔄 [Arquiteto] Fluxo: Resposta ambígua, incluindo análise como referência.`);
    }
    
    await fs.writeFile(files.promptFile, updatedPromptContent);

    return { 
      ...ctx, 
      currentInput: updatedPromptContent,
      architectAnalysis, // Análise inteligente para stepDeveloperLoop
      architectPlan
    };
  }

  /**
   * Verifica se o arquiteto já executou a tarefa e se está tudo correto
   * @returns {Object|null} Retorna finalResult se arquiteto concluiu, ou null se precisa do desenvolvedor
   */
  static async verifyArchitectWork(ctx) {
    const { task, project, analysisPlan, files, initialSnapshot, architectAnalysis, architectPlan } = ctx;
    
    if (!architectAnalysis || !architectAnalysis.hasExecuted || architectAnalysis.confidence <= 70) {
      return null; // Arquiteto não executou ou baixa confiança
    }
    
    await log(`🔍 [Verificação] Arquiteto indica execução (${architectAnalysis.confidence}% confiança).`);
    
    // Verificar evidências do arquiteto
    const architectDoneExists = await fileExists(files.doneFile);
    const architectReportExists = await fileExists(files.relatorioFile);
    const currentSnapshot = await WorkspaceSnapshotService.takeSnapshot(project?.pastaBase || ctx.config.TASKS_DIR);
    const changes = WorkspaceSnapshotService.compareSnapshots(initialSnapshot, currentSnapshot);
    const hasRealChanges = changes.modified.length > 0 || changes.created.length > 0;
    const architectLeftEvidence = architectDoneExists || architectReportExists || hasRealChanges;
    
    if (!architectLeftEvidence) {
      await log(`⚠️ [Verificação] Arquiteto não deixou evidências de execução.`);
      return { needsDeveloper: true, message: `O arquiteto analisou a tarefa, mas não encontramos evidências de execução.\n\n${architectPlan || 'Siga a descrição original da tarefa.'}` };
    }
    
    if (!hasRealChanges) {
      await log(`📝 [Verificação] Arquiteto deixou .done/relatório, mas não alterou arquivos.`);
      return { needsDeveloper: true, message: `O arquiteto analisou e disse que já fez a tarefa, mas não encontramos alterações nos arquivos.\n\n${architectPlan}\n\nPor favor, execute a tarefa conforme descrito acima.` };
    }
    
    await log(`📁 [Verificação] Arquiteto alterou ${changes.modified.length} arquivos, criou ${changes.created.length}.`);
    
    // Verificar contrato
    const contractResult = await ContractVerificationService.verifyContract(
      files.doneFile, 
      files.relatorioFile, 
      files.terminalLogFile, { 
        taskType: analysisPlan.taskType, 
        evidence: EvidenceService.createEmptyEvidence(),
        task, 
        project, 
        analysisPlan, 
        initialSnapshot
      }
    );
    
    if (!contractResult.contractFulfilled) {
      await log(`⚠️ [Verificação] Contrato não cumprido pelo arquiteto: ${contractResult.executionNotes}`);
      return { needsDeveloper: true, message: contractResult.feedbackToAgent || `O arquiteto fez alterações, mas não cumpriu o contrato: ${contractResult.executionNotes}\n\nPor favor, corrija.` };
    }
    
    await log(`✅ [Verificação] Contrato cumprido pelo arquiteto. Verificando build...`);
    
    // QA/Build validation
    let qa = { passed: true };
    if (project) {
      const BUILD_TIMEOUT = 60000;
      if (project.backendBuildCmd && project.backendPath) {
        try {
          await log(`⏳ Testando build Backend...`);
          execSync(project.backendBuildCmd, { cwd: path.join(project.pastaBase, project.backendPath), stdio: 'pipe', timeout: BUILD_TIMEOUT });
        } catch (e) { qa = { passed: false, message: `Build Backend falhou: ${e.message}` }; }
      }
      if (qa.passed && project.frontendBuildCmd && project.frontendPath) {
        try {
          await log(`⏳ Testando build Frontend...`);
          execSync(project.frontendBuildCmd, { cwd: path.join(project.pastaBase, project.frontendPath), stdio: 'pipe', timeout: BUILD_TIMEOUT });
        } catch (e) { qa = { passed: false, message: `Build Frontend falhou: ${e.message}` }; }
      }
    }
    
    if (!qa.passed) {
      await log(`❌ QA Reprovado. Build falhou: ${qa.message}`);
      await fs.unlink(files.doneFile).catch(()=>{});
      return { needsDeveloper: true, message: `Build falhou: ${qa.message}. O arquiteto fez alterações, mas o build não passa. Corrija o código e finalize novamente com .done.` };
    }
    
    await log(`✅ [Verificação] Tudo verificado! Arquiteto concluiu tarefa com sucesso.`);
    
    return {
      success: true,
      contractResult: {
        contractFulfilled: true,
        executionNotes: `Tarefa executada pelo arquiteto. Alterações: ${changes.modified.length} modificados, ${changes.created.length} criados. Build verificado.`
      },
      finalResult: { 
        success: true, 
        executionNotes: `Tarefa executada pelo arquiteto. Alterações: ${changes.modified.length} modificados, ${changes.created.length} criados. Build verificado.` 
      }
    };
  }

  /**
   * Passo 3: O loop principal de execução do Jarbas (Desenvolvedor).
   */
  static async stepDeveloperLoop(ctx) {
    let { task, project, analysisPlan, files, initialSnapshot, currentInput, config, architectAnalysis, architectPlan } = ctx;
    const { TASKS_DIR, TASK_TIMEOUT_MS } = config;
    
    const evidence = EvidenceService.createEmptyEvidence();
    
    // 1. VERIFICAR SE O ARQUITETO JÁ FEZ A TAREFA
    const architectVerification = await TaskExecutionService.verifyArchitectWork(ctx);
    
    if (architectVerification) {
      if (architectVerification.success) {
        // Arquiteto concluiu com sucesso
        return { 
          ...ctx, 
          contractResult: architectVerification.contractResult,
          finalResult: architectVerification.finalResult
        };
      } else if (architectVerification.needsDeveloper) {
        // Arquiteto falhou em algum aspecto - desenvolvedor precisa intervir
        currentInput = architectVerification.message;
        await fs.writeFile(files.promptFile, currentInput);
        await log(`🔄 [Desenvolvedor] Necessita intervenção: ${architectVerification.message.substring(0, 100)}...`);
      }
    }
    let contractResult = { contractFulfilled: false };
    let turnos = 0; 
    let turnosSemProgresso = 0;

    // Se chegou aqui, precisa do desenvolvedor
    await log(`🔄 [Desenvolvedor] Iniciando loop de execução...`);

    while (!contractResult.contractFulfilled && turnos < 10 && turnosSemProgresso < 3) {
      await log(`🤖 Turno ${turnos + 1}...`);
      turnos++;
      
      const res = await OpenClawService.execute(
        task.id, currentInput, task.agent || 'main', null, TASKS_DIR, files.terminalLogFile, project?.pastaBase, TASK_TIMEOUT_MS
      );
      
      EvidenceService.applyExecutionEvidence(
        evidence, res.toolCall, res.toolResult || {}, { executionDirectory: project?.pastaBase || TASKS_DIR }
      );
      
      contractResult = await ContractVerificationService.verifyContract(files.doneFile, files.relatorioFile, files.terminalLogFile, { 
        taskType: analysisPlan.taskType, 
        evidence, task, project, analysisPlan, initialSnapshot
      });
      
      if (contractResult.contractFulfilled) {
        // Build Validation embutida no loop para o agente poder consertar se quebrar
        let qa = { passed: true };
        if (project) {
          const BUILD_TIMEOUT = 60000;
          if (project.backendBuildCmd && project.backendPath) {
            try {
              await log(`⏳ Testando build Backend...`);
              execSync(project.backendBuildCmd, { cwd: path.join(project.pastaBase, project.backendPath), stdio: 'pipe', timeout: BUILD_TIMEOUT });
            } catch (e) { qa = { passed: false, message: `Build Backend falhou: ${e.message}` }; }
          }
          if (qa.passed && project.frontendBuildCmd && project.frontendPath) {
            try {
              await log(`⏳ Testando build Frontend...`);
              execSync(project.frontendBuildCmd, { cwd: path.join(project.pastaBase, project.frontendPath), stdio: 'pipe', timeout: BUILD_TIMEOUT });
            } catch (e) { qa = { passed: false, message: `Build Frontend falhou: ${e.message}` }; }
          }
        }

        if (!qa.passed) {
          await fs.unlink(files.doneFile).catch(()=>{});
          currentInput = `Build falhou: ${qa.message}. Corrija o erro no código e finalize novamente com .done.`;
          await log(`❌ QA Reprovado. Retornando erro para o agente: ${qa.message}`);
          contractResult.contractFulfilled = false;
          continue;
        }
        break; // Passou no contrato e no QA
      }

// Trata feedback do turno
      let doneExists = false;
      let actualDonePath = files.doneFile;

      // Função para rastrear qualquer arquivo .done na pasta
      const findDynamicDone = async (dir) => {
          if (!dir) return null;
          try {
              const dirFiles = await fs.readdir(dir);
              const found = dirFiles.find(f => f.endsWith('.done'));
              return found ? path.join(dir, found) : null;
          } catch(e) { return null; }
      };

      // Procura tanto na pasta de tarefas quanto na raiz do projeto
      const rogueDoneFile = (await findDynamicDone(config.TASKS_DIR)) || (await findDynamicDone(project?.pastaBase));

      if (rogueDoneFile) {
          doneExists = true;
          actualDonePath = rogueDoneFile; // Anota o nome real para poder apagar depois
      }

      if (res.toolFeedback) {
          // 1. Prioridade Máxima: A IA usou uma ferramenta. Devolver o resultado dela!
          currentInput = res.toolFeedback;
          await log(`🛠️ [Desenvolvedor] Retornando resultado da ferramenta (${currentInput.length} chars)`);
          
      } else if (doneExists && contractResult.feedbackToAgent) {
          // 2. A IA tentou finalizar (.done criado), mas fez besteira.
          await fs.unlink(actualDonePath).catch(()=>{}); // <-- CRÍTICO: Apaga o arquivo com o nome inventado!
          currentInput = contractResult.feedbackToAgent;
          await fs.writeFile(files.promptFile, currentInput);
          await log(`📝 [Desenvolvedor] Feedback de validação: ${currentInput.substring(0, 100)}...`);
          
      } else {
          // 3. ANÁLISE CASO A CASO (A IA não usou ferramenta e não criou .done)
          const raw = res.rawOutput || '';
          let truncatedInfo = null;
          
          // Trazemos o seu detector de anomalias para inspecionar a string
          try {
              const ToolCallService = require('./toolCallService');
              truncatedInfo = ToolCallService.detectTruncatedToolCall(raw);
          } catch (e) { /* Proteção contra erro de importação dinâmica */ }

          if (truncatedInfo && truncatedInfo.detected) {
              // CASO 3A: JSON quebrado ou payload truncado
              let reasonMsg = "O JSON está inválido ou mal formatado.";
              
              if (truncatedInfo.reason === 'string_json_nao_foi_fechada' || truncatedInfo.reason === 'objeto_json_incompleto') {
                  reasonMsg = "O bloco JSON foi cortado no meio (limite de caracteres) ou faltam aspas/chaves finais.";
              } else if (truncatedInfo.reason.includes('grande_demais') || truncatedInfo.reason.includes('truncado')) {
                  reasonMsg = "Você enviou um payload muito grande e ele foi cortado pelo limite do terminal. Pare de usar 'write' para arquivos inteiros e use 'edit' focado no trecho exato.";
              }
              
              currentInput = `[ERRO DE SINTAXE DE FERRAMENTA] Você tentou chamar a ferramenta '${truncatedInfo.likelyTool}', mas falhou. Motivo: ${reasonMsg}\nPor favor, corrija e envie APENAS o JSON válido.`;
              
          } else if (/(concluíd[oa]|pronto|finalizad[oa]|terminei|aqui está|resolvido|feito)/i.test(raw) || raw.trim().length < 150) {
              // CASO 3B: A IA está conversando como se tivesse terminado, mas não gerou o .done.
              // Jogamos na cara dela a pendência exata do contrato!
              const contractFeedback = contractResult.feedbackToAgent || "Use a ferramenta 'exec' com 'touch .done' para finalizar.";
              
              currentInput = `[SISTEMA] Você respondeu com texto conversacional em vez de usar uma ferramenta.\n` +
                             `Se você acha que já terminou a implementação, o sistema detectou as seguintes pendências para esta tarefa:\n\n` +
                             `${contractFeedback}\n\n` +
                             `Por favor, execute a ação pendente acima utilizando o formato JSON.`;
          } else {
              // CASO 3C: IA está apenas pensando alto ou narrando o plano sem agir
              currentInput = `[SISTEMA] Você está apenas narrando ou planejando em texto puro. Você deve AGIR.\n` +
                             `Para interagir com o sistema, é OBRIGATÓRIO emitir um bloco JSON válido contendo uma das ferramentas (read, write, edit, exec).\n` +
                             `Se precisar alterar código longo, prefira a ferramenta 'edit' em pedaços menores.`;
          }
          
          await log(`⚠️ [Desenvolvedor] Feedback corretivo enviado (Caso a Caso).`);
      }
      
      const prog = EvidenceService.computeTurnProgress(res.toolResult || {}, contractResult, project?.pastaBase || TASKS_DIR);
      prog.hasMeaningfulProgress ? (turnosSemProgresso = 0) : turnosSemProgresso++;
      
      if (turnosSemProgresso >= 6) { 
        contractResult.executionNotes = 'Estagnação de IA detectada (6 turnos sem progresso real).'; 
        break; 
      }
    }

    // Garantir que contractResult está definido
    if (!contractResult || contractResult.contractFulfilled === undefined) {
      contractResult = { 
        contractFulfilled: false, 
        executionNotes: 'Loop finalizado sem verificação de contrato' 
      };
      await log(`⚠️ [Desenvolvedor] contractResult indefinido, definindo como falha`);
    }
    
    await log(`📊 [Desenvolvedor] Loop finalizado. contractResult: ${JSON.stringify(contractResult)}`);
    return { ...ctx, contractResult };
  }

  /**
   * Passo 4: Finaliza o log no banco e consolida o resultado.
   */
  static async stepTeardown(ctx) {
    console.log(`🔧 [DEBUG] stepTeardown chamado para tarefa ${ctx.task?.id}`);
    const { executionLog, files, task, architectPlan } = ctx;
    let { contractResult } = ctx; // Mudar para let para permitir reatribuição
    
    // Validação de segurança
    if (!contractResult) {
      console.error('❌ stepTeardown: contractResult é undefined!', { ctxKeys: Object.keys(ctx) });
      contractResult = { contractFulfilled: false, executionNotes: 'Erro: contractResult não definido' };
    }
    
    const finalResult = { 
      success: contractResult.contractFulfilled, 
      executionNotes: contractResult.executionNotes || (contractResult.contractFulfilled ? 'Sucesso' : 'Falha na execução')
    };

    if (executionLog) {
      await TaskExecutionService.finishExecutionLog(executionLog.id, finalResult);
    }

    // ==========================================
    // SALVAR CONTEÚDOS DOS ARQUIVOS GERADOS NO BANCO DE DADOS
    // ==========================================
    try {
      const updateData = {};
      
      // 1. Prompt do arquiteto (arquitetosPromptContent)
      // O prompt do arquiteto é gerado dinamicamente, não salvo em arquivo
      // Vamos usar o arquivo prompt-${taskId}.txt como referência
      if (files && files.promptFile) {
        const exists = await fileExists(files.promptFile);
        console.log(`📁 [DEBUG] promptFile ${files.promptFile} existe? ${exists}`);
        if (exists) {
          try {
            const promptContent = await fs.readFile(files.promptFile, 'utf8');
            updateData.arquitetosPromptContent = promptContent;
            console.log(`📄 [DEBUG] promptFile lido: ${promptContent.length} caracteres`);
          } catch (error) {
            console.error(`❌ Erro ao ler prompt file: ${error.message}`);
          }
        }
      }
      
      // 2. Análise do arquiteto (arquitetosAnalysisContent)
      // Pode vir do arquivo plano-arquiteto-${taskId}.txt ou da variável architectPlan
      console.log(`📝 [DEBUG] Verificando análise do arquiteto: arquivo=${files?.architectPlanFile}, existe=${files?.architectPlanFile ? await fileExists(files.architectPlanFile).catch(() => false) : false}, architectPlan=${architectPlan?.length || 0} chars`);
      if (files && files.architectPlanFile && await fileExists(files.architectPlanFile)) {
        try {
          const analysisContent = await fs.readFile(files.architectPlanFile, 'utf8');
          updateData.arquitetosAnalysisContent = analysisContent;
          console.log(`📄 [DEBUG] Análise lida do arquivo: ${analysisContent.length} caracteres`);
        } catch (error) {
          console.error(`❌ Erro ao ler arquivo de análise do arquiteto: ${error.message}`);
        }
      } else if (architectPlan && architectPlan.trim().length > 0) {
        // Usar a variável architectPlan do contexto se o arquivo não existir
        updateData.arquitetosAnalysisContent = architectPlan;
        console.log(`📄 [DEBUG] Análise lida do contexto: ${architectPlan.length} caracteres`);
      } else {
        console.log(`⚠️ [DEBUG] Nenhuma análise do arquiteto encontrada`);
      }
      
      // 3. Terminal do arquiteto (arquitetosTerminalContent)
      if (files && files.architectLogFile && await fileExists(files.architectLogFile)) {
        try {
          const terminalContent = await fs.readFile(files.architectLogFile, 'utf8');
          updateData.arquitetosTerminalContent = terminalContent;
        } catch (error) {
          console.error(`❌ Erro ao ler terminal do arquiteto: ${error.message}`);
        }
      }
      
      // 4. Terminal do programador (programadorTerminalContent)
      if (files && files.terminalLogFile && await fileExists(files.terminalLogFile)) {
        try {
          const terminalContent = await fs.readFile(files.terminalLogFile, 'utf8');
          updateData.programadorTerminalContent = terminalContent;
        } catch (error) {
          console.error(`❌ Erro ao ler terminal do programador: ${error.message}`);
        }
      }
      
      // 5. Relatório do programador (programadorReportContent)
      if (files && files.relatorioFile && await fileExists(files.relatorioFile)) {
        try {
          const reportContent = await fs.readFile(files.relatorioFile, 'utf8');
          updateData.programadorReportContent = reportContent;
        } catch (error) {
          console.error(`❌ Erro ao ler relatório do programador: ${error.message}`);
        }
      }
      
      // Atualizar a tarefa no banco de dados se houver dados para salvar
      if (Object.keys(updateData).length > 0 && task && task.id) {
        await prisma.task.update({
          where: { id: task.id },
          data: updateData
        });
        console.log(`✅ [DEBUG] Conteúdos dos arquivos salvos para tarefa ${task.id}: ${Object.keys(updateData).join(', ')}`);
        console.log(`✅ [DEBUG] Tamanhos: ${Object.entries(updateData).map(([k, v]) => `${k}:${v?.length || 0} chars`).join(', ')}`);
      } else if (task && task.id) {
        console.log(`⚠️ [DEBUG] Nenhum conteúdo para salvar para tarefa ${task.id}`);
      }
      
    } catch (error) {
      console.error(`❌ Erro ao salvar conteúdos dos arquivos: ${error.message}`);
      // Não falhar a execução por causa deste erro
    }

    return { ...ctx, finalResult };
  }

  // ==========================================
  // O ORQUESTRADOR PRINCIPAL
  // ==========================================

  static async executeTask(task, userId, config) {
    const initialContext = { task, userId, config };

    // Definição limpa da esteira de produção
    const steps = [
      this.stepSetupContext,
      this.stepArchitectPlanning,
      this.stepDeveloperLoop,
      this.stepTeardown
    ];

    try {
      // O motor do pipeline assume o controle
      const finalState = await runPipeline(`Task-${task.id}`, initialContext, steps);
      
      return { 
        success: finalState.finalResult.success, 
        executionNotes: finalState.finalResult.executionNotes, 
        taskId: task.id 
      };

    } catch (error) {
      // Tratamento de segurança caso alguma etapa estoure um erro não tratado
      await log(`💥 [FATAL] O pipeline falhou: ${error.message}`);
      throw error;
    }
  }
}

module.exports = TaskExecutionService;


