// Migrado para TypeScript - Fase: Services
// Arquivo: taskExecutionService.js

export // src/services/taskExecutionService.js

import fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

// Importação dos serviços
import prisma from "./prismaService"; // <-- 1. Usa o Singleton ao invés de 'new PrismaClient()'
import taskService from "./taskService"; // <-- 2. Importa o TaskService
import agentService from "./agentService";
import WorkspaceSnapshotService from "./workspaceSnapshotService";
import OpenClawService from "./openclawService";
import ContractVerificationService from "./contractVerificationService";
import EvidenceService from "./evidenceService";
import TaskAnalysisService from "./taskAnalysisService";
import PromptFactory from '../utils/promptFactory';
import SmartFileFinder from '../utils/smartFileFinder'; 

// Utilitários
import { fileExists } from '../utils/fileUtils';
import { runPipeline } from '../utils/pipelineUtils'; 
import { log } from '../../aux/logger';
import { arch } from 'os';
import projectService from "./projectService";

class TaskExecutionService {
  
  static async readTaskOutputFile(taskId, baseDir, fileType): Promise<any> {
    const fileNameMap = {
      relatorio: `relatorio-${taskId}.txt`,
      terminal: `terminal-${taskId}.log`
    };
    const fileName = fileNameMap[fileType];
    if (!fileName) return null;

    const filePath = path.join(baseDir, fileName);
    try {
      if (await fileExists(filePath)) {
        const content = await fs.readFile(filePath, 'utf8');
        return content;
      }
    } catch (error) {
      // Ignorar erro silenciosamente se não existir
    }
    return null;
  }

  // ==========================================
  // MÉTODOS AUXILIARES DE LOG
  // ==========================================
  static async createExecutionLog(task, userId, agentId): Promise<any> {
    let model = 'deepseek/deepseek-chat';
    if (agentId) {
      try {
        const agentDetails = await agentService.getAgentDetails(agentId);
        model = agentDetails.identity?.model || model;
      } catch (error) { /* Silencioso */ }
    }
    // Mantemos o uso do prisma aqui pois TaskExecutionLog é o domínio nativo deste arquivo
    return await prisma.taskExecutionLog.create({
      data: { taskId: task.id, userId, model, startedAt: new Date(), success: false }
    });
  }

  static async finishExecutionLog(logId, result): Promise<any> {
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
/**
   * Passo 1: Prepara arquivos, banco de dados e analisa o escopo.
   */
  static async stepSetupContext(ctx): Promise<any> {
    const { task, userId, config } = ctx;
    const { TASKS_DIR } = config;

    const project = task.projectId ? await prisma.project.findUnique({ where: { id: task.projectId } }) : null;
    const taskId = task.id;
    
    // 1. Analisa o escopo da tarefa para definir o taskType (development, analysis, automation)
    const analysisPlan = await TaskAnalysisService.analyzeTaskScope(task, project, path.join(TASKS_DIR, `terminal-pre-analise-${taskId}.log`));
    
    // 2. Prepara os caminhos dos arquivos
    const files = {
      promptFile: path.join(TASKS_DIR, `prompt-${taskId}.txt`),
      relatorioFile: path.join(TASKS_DIR, `relatorio-${taskId}.txt`),
      doneFile: path.join(TASKS_DIR, `done-${taskId}.done`),
      terminalLogFile: path.join(TASKS_DIR, `terminal-${taskId}.log`),
      architectPlanFile: path.join(TASKS_DIR, `plano-arquiteto-${taskId}.txt`),
      architectLogFile: path.join(TASKS_DIR, `terminal-arquiteto-${taskId}.log`)
    };

    const dirBase = project?.pastaBase || 'Diretório atual';
    
    // 3. Monta a seção de comentários
    let commentsSection = '';
    if (task.comments && task.comments.length > 0) {
      commentsSection = '\n\n=== COMENTÁRIOS DA TAREFA ===\n';
      task.comments.forEach((comment, index) => {
        const userInfo = comment.user ? `${comment.user.name} (${comment.user.nickname})` : 'Usuário';
        const timestamp = new Date(comment.createdAt).toLocaleString('pt-BR');
        commentsSection += `\n${index + 1}. [${timestamp}] ${userInfo}: ${comment.content}`;
      });
    }

    // 4. Tira o Snapshot PRIMEIRO (Para obtermos a lista de arquivos para o prompt)
    const initialSnapshot = await WorkspaceSnapshotService.takeSnapshot(project?.pastaBase || TASKS_DIR);
    const fileList = Array.from(initialSnapshot.keys());

    // 5. Geração do Prompt Inteligente do Arquiteto usando o PromptFactory
    // Aqui a mágica acontece: passamos a lista de arquivos e o TIPO da tarefa
    const architectPrompt = PromptFactory.buildArchitectPrompt(
      task, 
      project, 
      fileList, 
      files.architectPlanFile, 
      commentsSection, 
      analysisPlan.taskType // <-- Injetando o tipo exato para o prompt condicional!
    );
    
    // 6. Salva nos arquivos físicos
    const architectPromptBackupFile = path.join(TASKS_DIR, `architect-prompt-${taskId}.txt`);
    await fs.writeFile(architectPromptBackupFile, architectPrompt);
    await fs.writeFile(files.promptFile, architectPrompt);
    await fs.writeFile(files.terminalLogFile, '');

    // 7. Geração do Prompt do Desenvolvedor
    const engineRules = PromptFactory.buildEngineRulesPrompt(files);
    const developerPrompt = `DESENVOLVEDOR: Analise o plano de ação e crie o código.\n\nTAREFA: ${task.title}. DESC: ${task.description}. BASE: ${dirBase}.${commentsSection}\n\n${engineRules}`;
    
    // 8. Cria o log de execução no banco
    const executionLog = await TaskExecutionService.createExecutionLog(task, userId, task.agent);

    return { 
      ...ctx, 
      project, 
      analysisPlan, 
      files, 
      initialSnapshot, 
      executionLog, 
      currentInput: architectPrompt, 
      developerPrompt, 
      commentsSection 
    };
  }

  /**
   * Passo 2: O Arquiteto analisa e, se possível, executa a tarefa.
   */
  static async stepArchitectPlanning(ctx): Promise<any> {
    const { task, project, files, initialSnapshot, config, analysisPlan } = ctx;
    
    // Log do tipo de tarefa
    await log(`📋 [Arquiteto] Tipo de tarefa: ${analysisPlan.taskType}`);
    
    const fileList = Array.from(initialSnapshot.keys());
    const architectInput = PromptFactory.buildArchitectPrompt(task, project, fileList, files.architectPlanFile, ctx.commentsSection || '', analysisPlan.taskType);
    await log(`🧠 [Arquiteto] Avaliando a tarefa ${task.id} e montando o plano de ação...`);
    
    // Importar utilitário de sessões em cadeia
    import SessionChainUtils from '../utils/sessionChainUtils';
    
    // Gera um ID de sessão unificado baseado na primeira tarefa da cadeia de dependências
    const architectSessionId = await SessionChainUtils.generateUnifiedSessionId(task.id, 'arquiteto');
    
    await log(`🔗 Sessão do arquiteto: ${architectSessionId} (baseada na cadeia de dependências)`);
    
    // Roda o Arquiteto com timeout de 10 minutos (600000ms)
    const architectResult = await OpenClawService.executeWithFallback(
      architectSessionId, // <--- SESSÃO UNIFICADA PARA CADEIAS DE DEPENDÊNCIAS
      architectInput,
      project?.agent || task.agent || 'main',
      task.agent || 'main',
      null,
      config.TASKS_DIR,
      files.architectLogFile,
      project?.pastaBase,
      config.TASK_TIMEOUT_MS
    );
    
    let architectPlan = "";
    let architectAnalysis = null;
    
    // === A NOVA INTELIGÊNCIA DE BUSCA ENTRA AQUI ===
    const planSearch = await SmartFileFinder.findRealArchitectPlan(files.architectPlanFile, config.TASKS_DIR, 5);
    
    if (planSearch.content) {
      architectPlan = planSearch.content;
      await log(`📝 [Arquiteto] Plano recuperado com sucesso (${architectPlan.length} caracteres).`);
    } else if (architectResult.rawOutput && architectResult.rawOutput.trim().length > 50) {
      // Fallback: Se não salvou em arquivo nenhum, tenta catar direto do que ele cuspiu no terminal
      architectPlan = architectResult.rawOutput;
      await log(`📝 [Arquiteto] Arquivo não encontrado. Usando rawOutput do terminal como fallback (${architectPlan.length} chars)`);
      // Força a gravação no arquivo correto
      await fs.writeFile(files.architectPlanFile, architectPlan).catch(()=>{});
    }

    // Verificar se temos um plano do arquiteto... (O código continua normal daqui pra baixo)
    if (architectPlan && architectPlan.trim().length > 0) {
      // 1. ANÁLISE INTELIGENTE DA RESPOSTA DO ARQUITETO
      // Usa LLM para compreender semanticamente se o arquiteto já executou ou só planejou
      await log(`🧠 [Arquiteto] Analisando resposta com IA...`);
      architectAnalysis = {};
      const existsDoneFile = await fileExists(files.doneFile);
      
      architectAnalysis = await TaskAnalysisService.analyzeArchitectResponse(architectPlan, task, project);
      await log(`📊 [Arquiteto] Análise inicial: hasExecuted=${architectAnalysis.hasExecuted}, hasPlan=${architectAnalysis.hasPlan}, confidence=${architectAnalysis.confidence}%`);
      const hadExecuted = architectAnalysis.hadExecuted;
      // VALIDAÇÃO CRÍTICA: Se a IA diz que executou, verificar evidências reais
      if ((architectAnalysis.hasExecuted && architectAnalysis.confidence > 70) || existsDoneFile) {
        await log(`🔍 [Validação] IA diz que arquiteto executou. Verificando evidências...`);
        
        // Verificar se há evidências reais de execução
        const currentSnapshot = await WorkspaceSnapshotService.takeSnapshot(project?.pastaBase || ctx.config.TASKS_DIR);
        const changes = WorkspaceSnapshotService.compareSnapshots(ctx.initialSnapshot, currentSnapshot);
        const hasRealChanges = changes.modified.length > 0 || changes.created.length > 0;
        const architectDoneExists = await fileExists(files.doneFile);
        const architectReportExists = await fileExists(files.relatorioFile);
        
        // Para tarefas de análise, evidência pode ser apenas relatório/.done (não precisa de alterações)
        const hasEvidence = architectDoneExists || architectReportExists || 
                           (analysisPlan.taskType === 'analysis' ? true : (hasRealChanges || hadExecuted));
        
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
          if (analysisPlan.taskType === 'analysis') {
            await log(`✅ [Validação] Evidências confirmadas para análise: relatório/.done criados`);
          } else {
            await log(`✅ [Validação] Evidências confirmadas: ${changes.modified.length} arquivos modificados, ${changes.created.length} criados`);
          }
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
  static async verifyArchitectWork(ctx): Promise<any> {
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
    
    // Para tarefas de análise, não exigimos alterações de arquivos (apenas leitura)
    if (analysisPlan.taskType !== 'analysis' && !hasRealChanges) {
      await log(`📝 [Verificação] Arquiteto deixou .done/relatório, mas não alterou arquivos (e a tarefa não é de análise).`);
      return { needsDeveloper: true, message: `O arquiteto analisou e disse que já fez a tarefa, mas não encontramos alterações nos arquivos.\n\n${architectPlan}\n\nPor favor, execute a tarefa conforme descrito acima.` };
    }
    
    if (analysisPlan.taskType === 'analysis') {
      await log(`📝 [Verificação] Tarefa de análise: ${changes.modified.length} arquivos modificados, ${changes.created.length} criados (alterações são opcionais para análise).`);
    } else {
      await log(`📁 [Verificação] Arquiteto alterou ${changes.modified.length} arquivos, criou ${changes.created.length}.`);
    }
    
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
    
    
    await log(`✅ [Verificação] Contrato cumprido pelo arquiteto.`);
    
    // Para tarefas de desenvolvimento, verificar ecossistema (build, testes)
    if (analysisPlan.taskType === 'development') {
      await log(`🔧 [Verificação] Verificando ecossistema (build, testes)...`);
      
      const qa = await TaskExecutionService.ensureAndValidateEcosystem(
        task, 
        project, 
        ctx.config
      );
      
      if (!qa.passed) {
        await log(`❌ QA Reprovado. Build falhou: ${qa.message}`);
        await fs.unlink(files.doneFile).catch(()=>{});
        return { needsDeveloper: true, message: `O arquiteto fez alterações, mas a validação de ecossistema falhou:\n\n${qa.message}\n\nCorrija o código e finalize novamente com .done.` };
      }
      
      await log(`✅ [Verificação] Ecossistema verificado com sucesso!`);
      
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
    } else {
      // Para tarefas de análise/automação, não verificar ecossistema
      await log(`✅ [Verificação] Tarefa de ${analysisPlan.taskType} concluída pelo arquiteto.`);
      
      return {
        success: true,
        contractResult: {
          contractFulfilled: true,
          executionNotes: `Tarefa de ${analysisPlan.taskType} executada pelo arquiteto.`
        },
        finalResult: { 
          success: true, 
          executionNotes: `Tarefa de ${analysisPlan.taskType} executada pelo arquiteto.` 
        }
      };
    }
  }

  /**
   * Varredura de Ecossistema (Sistema 1)
   * Descobre automaticamente as aplicações dentro do projeto, usa IA para 
   * entender a tecnologia de cada uma, e valida todas elas.
   */
  static async ensureAndValidateEcosystem(task, project, config): Promise<any> {
    if (!project || !project.pastaBase) return { passed: true };

    import { execSync } from 'child_process';
    import * as path from 'path';
    import fs from 'fs/promises';
    import { fileExists } from '../utils/fileUtils';
    import LlmService from "./llmService";
    import projectService from "./projectService"; 
    import { log } from '../../aux/logger';

    const domain = task.domain; // FRONTEND, BACKEND ou nulo
    const baseDir = project.pastaBase;
    const nodeBinDir = path.dirname(process.execPath);

    // --- FUNÇÃO AUXILIAR DE EXECUÇÃO (O "Coração" do Teste) ---
// --- FUNÇÃO AUXILIAR DE EXECUÇÃO ---
    const tryExecutingCommand = async (cmd, appName, appPath, port): Promise<any> => {
      try {
          await log(`⏳ [Sistema 1] Validando [${appName}] na porta ${port}: ${cmd}`);
          
          // --- ATUALIZAÇÃO CIRÚRGICA DO .ENV (Preservando outras variáveis) ---
          const envPath = path.join(appPath, '.env');
          let envContent = '';
          
          if (await fileExists(envPath)) {
              envContent = await fs.readFile(envPath, 'utf8');
          }
          
          // Se já tem PORT=alguma_coisa, substitui. Se não tem, adiciona no final.
          if (envContent.match(/^PORT=.*$/m)) {
              envContent = envContent.replace(/^PORT=.*$/m, `PORT=${port}`);
          } else {
              envContent += `\nPORT=${port}`;
          }
          
          // Salva o arquivo preservando todo o resto
          await fs.writeFile(envPath, envContent.trim() + '\n');
          // ------------------------------------------------------------------

          execSync(cmd, { 
              cwd: appPath, 
              stdio: 'pipe', 
              timeout: 90000, 
              shell: true, 
              env: { 
                  ...process.env, 
                  PORT: String(port),
                  PATH: `${nodeBinDir}:${process.env.PATH || ''}`
              } 
          });
          return { passed: true }; 
      } catch (e) {
          const errorLog = (e.stderr?.toString() || e.stdout?.toString() || e.message);
          if (e.signal === 'SIGTERM' || e.code === 'ETIMEDOUT' || errorLog.includes('ETIMEDOUT')) {
              await log(`✅ [Sistema 1] [${appName}] operacional (Server vivo).`);
              return { passed: true };
          }
          return { passed: false, message: `Falha em [${appName}]: ${errorLog.substring(0, 1000)}` };
      }
    };

    // --- 1. O SEU ATALHO (Fast Path) ---
    // Se a tarefa já diz o domínio e o banco tem os dados, não perdemos tempo escaneando pastas.
    if (domain === 'FRONTEND' && project.frontendBuildCmd && project.frontendPath && project.frontendPort) {
        const pasta = path.join(baseDir, project.frontendPath);
        return await tryExecutingCommand(project.frontendBuildCmd, 'FRONTEND', pasta, project.frontendPort || 7000);
    } 
    
    if (domain === 'BACKEND' && project.backendBuildCmd && project.backendPath && project.backendPort) {
        const pasta = path.join(baseDir, project.backendPath);
        return await tryExecutingCommand(project.backendBuildCmd, 'BACKEND', pasta, project.backendPort || 7001);
    }

    // --- 2. DESCOBERTA E SINCRONIZAÇÃO (Discovery Path) ---
    // Se o atalho falhou ou o domínio é nulo, varremos as pastas para "aprender" ou validar tudo.
    const items = await fs.readdir(baseDir, { withFileTypes: true });
    const apps = [];

    for (const item of items) {
        if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
            const appDir = path.join(baseDir, item.name);
            if (await fileExists(path.join(appDir, 'package.json'))) {
                apps.push({ name: item.name, path: appDir });
            }
        }
    }

    for (const app of apps) {
        await log(`🔍 [Sistema 1] Analisando módulo: [${app.name}]`);

        // 1. Identificação inicial (o que já sabemos no banco?)
        const isMappedFront = project.frontendPath === app.name;
        const isMappedBack = project.backendPath === app.name;
        
        let cmd = isMappedFront ? project.frontendBuildCmd : (isMappedBack ? project.backendBuildCmd : null);

        // 2. DESCOBERTA (Se o banco estiver vazio para este app, a IA entra em cena)
        if (!cmd) {
            await log(`🧠 [Sistema 1] Novo módulo detectado [${app.name}]. IA definindo escopo...`);
            const pkgContent = await fs.readFile(path.join(app.path, 'package.json'), 'utf8');
            const ai = new LlmService();
            const decision = await ai.analyze(`Analise este package.json e retorne JSON: {"comando": "string", "escopo": "front|back"}\n\n${pkgContent}`);
            
            cmd = decision?.comando || 'npm start';
            const escopo = decision?.escopo || (app.name.toLowerCase().includes('front') ? 'front' : 'back');

            // Atualiza o objeto do projeto com a nova descoberta
            if (escopo === 'front') {
                project.frontendBuildCmd = cmd;
                project.frontendPath = app.name;
            } else {
                project.backendBuildCmd = cmd;
                project.backendPath = app.name;
            }
            // Persiste no banco para não ter que perguntar à IA na próxima tarefa
            await projectService.updateProject(project.id, project);
        }

        // 3. CÁLCULO DA PORTA (AGORA SIM! Com o cmd e o escopo já garantidos)
        // Recalculamos as flags baseadas na decisão da IA ou do banco
        const finalIsFront = project.frontendPath === app.name;
        const finalPort = finalIsFront ? (project.frontendPort || 7000) : (project.backendPort || 7001);

        // 4. GARANTE O .ENV (Backup visual)
        const envPath = path.join(app.path, '.env');
        if (!(await fileExists(envPath))) {
            await fs.writeFile(envPath, `PORT=${finalPort}`);
        }

        // 5. EXECUÇÃO (O "Fast Path" e o "Discovery Path" se encontram aqui)
        const result = await tryExecutingCommand(cmd, app.name, app.path, finalPort);
        if (!result.passed) return result;
    }

    await log(`✅ [Sistema 1] Todos os módulos operacionais.`);
    return { passed: true };
  }



  /**
   * Passo 3: O loop principal de execução do Jarbas (Desenvolvedor) - STATLESS (Protocolo Amnésia)
  */
  static async stepDeveloperLoop(ctx): Promise<any> {
    let { task, project, analysisPlan, files, initialSnapshot, currentInput, config, architectAnalysis, architectPlan } = ctx;
    const { TASKS_DIR, TASK_TIMEOUT_MS } = config;

    const evidence = EvidenceService.createEmptyEvidence();
    
    // 1. VERIFICAR SE O ARQUITETO JÁ FEZ A TAREFA
    const architectVerification = await TaskExecutionService.verifyArchitectWork(ctx);
    
    if (architectVerification) {
      if (architectVerification.success) {
        return { 
          ...ctx, 
          contractResult: architectVerification.contractResult,
          finalResult: architectVerification.finalResult
        };
      } else if (architectVerification.needsDeveloper) {
        currentInput = architectVerification.message;
        await fs.writeFile(files.promptFile, currentInput);
        await log(`🔄 [Desenvolvedor] Necessita intervenção: ${architectVerification.message.substring(0, 100)}...`);
      }
    } else {
      currentInput = `${currentInput || ''}\n\n === PLANO DO ARQUITETO ===\n ${architectPlan}\n\n`;
    }

    // ==============================================================
    // PREPARAÇÃO DO PROTOCOLO AMNÉSIA E CONTEXTO DE DEPENDÊNCIAS
    // ==============================================================
    import SessionChainUtils from '../utils/sessionChainUtils';
    let contextFromPreviousTasks = '';
    
    try {
      const taskChain = await SessionChainUtils.getTaskChain(task.id);
      const previousTasks = taskChain.filter(t => t.id !== task.id);
      
      if (previousTasks.length > 0) {
        contextFromPreviousTasks += `\n\n=== CONTEXTO DAS TAREFAS ANTERIORES ===\n`;
        contextFromPreviousTasks += `Você está continuando um trabalho. Abaixo estão os relatórios e logs das tarefas que vieram antes desta:\n`;
        
        for (const prevTask of previousTasks) {
          const prevReport = await TaskExecutionService.readTaskOutputFile(prevTask.id, config.TASKS_DIR, 'relatorio');
          const prevTerminal = await TaskExecutionService.readTaskOutputFile(prevTask.id, config.TASKS_DIR, 'terminal');
          
          contextFromPreviousTasks += `\n--- Tarefa Anterior: ${prevTask.id} (${prevTask.title}) ---\n`;
          if (prevReport) {
            contextFromPreviousTasks += `Relatório gerado:\n${prevReport}\n`;
          }
          if (prevTerminal) {
            contextFromPreviousTasks += `Últimas linhas do terminal:\n${prevTerminal.slice(-1500)}\n`;
          }
        }
        contextFromPreviousTasks += `=== FIM DO CONTEXTO ANTERIOR ===\n\n`;
        await log(`📚 [Desenvolvedor] Contexto de ${previousTasks.length} tarefas anteriores carregado.`);
      }
    } catch (chainErr) {
      await log(`⚠️ [Desenvolvedor] Erro ao buscar cadeia de dependências: ${chainErr.message}`);
    }

    // O basePrompt é a bíblia da tarefa. Nunca muda.
    const basePrompt = currentInput + contextFromPreviousTasks; 
    
    // O lastFeedback guarda o que aconteceu no turno imediatamente anterior
    let lastFeedback = null; 
    
    let contractResult = { contractFulfilled: false };
    let turnos = 0; 
    let turnosSemProgresso = 0;

    const backupAgent = task.fallbackAgent || project?.fallbackAgent || 'main';

    await log(`🔄 [Desenvolvedor] Iniciando loop de execução (Modo Stateless)...`);

    while (!contractResult.contractFulfilled && turnos < 15) {
      await log(`🤖 Turno ${turnos + 1}...`);
      turnos++;
      
      // 1. GERAÇÃO DA SESSÃO DO DESENVOLVEDOR (Isolada por Tarefa/Turno)
      const timestamp = new Date().getTime();
      const turnSessionId = `programador-${task.id}-${timestamp}`;
      
      await log(`🔗 Sessão do turno ${turnos}: ${turnSessionId} (isolada por tarefa/turno)`);

      // 2. MONTAGEM DO DOSSIÊ DO TURNO
      let promptDesteTurno = basePrompt;
      if (lastFeedback) {
          promptDesteTurno += `\n\n=== RESULTADO DA SUA ÚLTIMA AÇÃO ===\n${lastFeedback}\n\nContinue a tarefa com base neste feedback. Você DEVE usar uma ferramenta JSON para prosseguir.`;
      }

      // Salva o prompt do turno no disco para você poder auditar o que foi enviado
      const developerPromptFile = path.join(TASKS_DIR, `developer-prompt-${task.id}-turn-${turnos}.txt`);
      await fs.writeFile(developerPromptFile, promptDesteTurno).catch(()=>{});

      // 3. CHAMA O OPENCLAW
      const res = await OpenClawService.executeWithFallback(
        turnSessionId, 
        promptDesteTurno, 
        task.agent || project?.agent || 'main', 
        backupAgent,                            
        null, 
        TASKS_DIR, 
        files.terminalLogFile, 
        project?.pastaBase, 
        TASK_TIMEOUT_MS
      );
      
      EvidenceService.applyExecutionEvidence(
        evidence, res.toolCall, res.toolResult || {}, { executionDirectory: project?.pastaBase || TASKS_DIR }
      );
      
      contractResult = await ContractVerificationService.verifyContract(files.doneFile, files.relatorioFile, files.terminalLogFile, { 
        taskType: analysisPlan.taskType, 
        evidence, task, project, analysisPlan, initialSnapshot
      });

      if (contractResult.contractFulfilled) {
        
        // Uma única linha aciona a IA de DevOps para varrer e testar tudo!
        const qa = await TaskExecutionService.ensureAndValidateEcosystem(
          task, 
          project, 
          config
        );
        
        if (!qa.passed) {
          await fs.unlink(files.doneFile).catch(()=>{});
          lastFeedback = `Validação de Ecossistema falhou:\n\n${qa.message}\n\nCorrija o código no módulo indicado e finalize novamente.`;
          await log(`❌ QA Reprovado. Retornando erro para o agente: ${qa.message}`);
          contractResult.contractFulfilled = false;
          continue;
        }
        
        break; // Passou no contrato e todo o ecossistema compilou/testou com sucesso!
      }

      // 4. ANÁLISE E FEEDBACK DO TURNO ATUAL
      let doneExists = false;
      let actualDonePath = files.doneFile;

      const findDynamicDone = async (dir): Promise<any> => {
          if (!dir) return null;
          try {
              const dirFiles = await fs.readdir(dir);
              const found = dirFiles.find(f => f.endsWith('.done'));
              return found ? path.join(dir, found) : null;
          } catch(e) { return null; }
      };

      const rogueDoneFile = (await findDynamicDone(config.TASKS_DIR)) || (await findDynamicDone(project?.pastaBase));

      if (rogueDoneFile) {
          doneExists = true;
          actualDonePath = rogueDoneFile; 
      }

      // Define qual será a mensagem entregue no PRÓXIMO turno (lastFeedback)
      if (doneExists && contractResult.feedbackToAgent) {
          await fs.unlink(actualDonePath).catch(()=>{}); 
          
          lastFeedback = res.toolFeedback 
            ? `${res.toolFeedback}\n\n[SISTEMA - ATENÇÃO CRÍTICA]\n${contractResult.feedbackToAgent}`
            : contractResult.feedbackToAgent;
            
          await log(`📝 [Desenvolvedor] Feedback de validação AGENDADO para o próximo turno.`);
          
      } else if (res.toolFeedback) {
          lastFeedback = res.toolFeedback;
          await log(`🛠️ [Desenvolvedor] Resultado da ferramenta AGENDADO para o próximo turno (${lastFeedback.length} chars)`);
          
      } else {
          const raw = res.rawOutput || '';
          let truncatedInfo = null;
          
          try {
              import ToolCallService from "./toolCallService";
              truncatedInfo = ToolCallService.detectTruncatedToolCall(raw);
          } catch (e) { }

          if (truncatedInfo && truncatedInfo.detected) {
              let reasonMsg = "O JSON está inválido ou mal formatado.";
              if (truncatedInfo.reason === 'string_json_nao_foi_fechada' || truncatedInfo.reason === 'objeto_json_incompleto') {
                  reasonMsg = "O bloco JSON foi cortado no meio (limite de caracteres) ou faltam aspas/chaves finais.";
              } else if (truncatedInfo.reason.includes('grande_demais') || truncatedInfo.reason.includes('truncado')) {
                  reasonMsg = "Você enviou um payload muito grande e ele foi cortado pelo limite do terminal. Pare de usar 'write' para arquivos inteiros e use 'edit' focado no trecho exato.";
              }
              lastFeedback = `[ERRO DE SINTAXE DE FERRAMENTA] Você tentou chamar a ferramenta '${truncatedInfo.likelyTool}', mas falhou. Motivo: ${reasonMsg}\nPor favor, corrija e envie APENAS o JSON válido.`;
              
          } else if (/(concluíd[oa]|pronto|finalizad[oa]|terminei|aqui está|resolvido|feito)/i.test(raw) || raw.trim().length < 150) {
              const contractFeedback = contractResult.feedbackToAgent || "Use a ferramenta 'exec' com 'touch .done' para finalizar.";
              lastFeedback = `[SISTEMA] Você respondeu com texto conversacional em vez de usar uma ferramenta.\nSe você acha que já terminou a implementação, o sistema detectou as seguintes pendências para esta tarefa:\n\n${contractFeedback}\n\nPor favor, execute a ação pendente acima utilizando o formato JSON.`;
          } else {
              lastFeedback = `[SISTEMA] Você está apenas narrando ou planejando em texto puro. Você deve AGIR.\nPara interagir com o sistema, é OBRIGATÓRIO emitir um bloco JSON válido contendo uma das ferramentas.\nSe precisar alterar código longo, prefira a ferramenta 'edit' em pedaços menores.`;
          }
          
          await log(`⚠️ [Desenvolvedor] Feedback corretivo AGENDADO.`);
      }
      
      const prog = EvidenceService.computeTurnProgress(res.toolResult || {}, contractResult, project?.pastaBase || TASKS_DIR);
      prog.hasMeaningfulProgress ? (turnosSemProgresso = 0) : turnosSemProgresso++;
      
      if (turnosSemProgresso >= 6) { 
        contractResult.executionNotes = 'Estagnação de IA detectada (6 turnos sem progresso real).'; 
        break; 
      }
    }

    if (!contractResult || contractResult.contractFulfilled === undefined) {
      contractResult = { contractFulfilled: false, executionNotes: 'Loop finalizado sem verificação de contrato' };
    }
    
    await log(`📊 [Desenvolvedor] Loop finalizado. contractResult: ${JSON.stringify(contractResult)}`);
    return { ...ctx, contractResult };
  }

  /**
   * Passo 4: Finaliza o log no banco e consolida o resultado.
   */
  static async stepTeardown(ctx): Promise<any> {
    console.log(`🔧 [DEBUG] stepTeardown chamado para tarefa ${ctx.task?.id}`);
    const { executionLog, files, task, architectPlan, config } = ctx;
    let { contractResult } = ctx; 
    const { TASKS_DIR } = config || {};
    
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
      
      // Helper para ler arquivos com segurança
      const readFileSafe = async (filePath): Promise<any> => {
        try {
          if (filePath && await fileExists(filePath)) {
            const content = await fs.readFile(filePath, 'utf8');
            await log(`📄 [Teardown] LIDO: ${path.basename(filePath)} (${content.length} chars)`);
            return content;
          }
        } catch (error) {
          await log(`❌ [Teardown] ERRO ao ler ${path.basename(filePath)}: ${error.message}`);
        }
        return null;
      };
      
      const architectPromptFile = path.join(TASKS_DIR, `architect-prompt-${task.id}.txt`);
      updateData.arquitetosPromptContent = await readFileSafe(architectPromptFile);
      
      if (!updateData.arquitetosPromptContent) {
        await log(`⚠️ [Teardown] Arquivo de prompt do arquiteto não encontrado: ${architectPromptFile}`);
        updateData.arquitetosPromptContent = await readFileSafe(files?.promptFile);
      }
      
      updateData.arquitetosAnalysisContent = await readFileSafe(files?.architectPlanFile) || architectPlan || null;
      updateData.arquitetosTerminalContent = await readFileSafe(files?.architectLogFile);
      updateData.programadorTerminalContent = await readFileSafe(files?.terminalLogFile);
      updateData.programadorReportContent = await readFileSafe(files?.relatorioFile);
      
      const finalUpdateData = Object.fromEntries(Object.entries(updateData).filter(([_, v]) => v !== null));
      
      if (Object.keys(finalUpdateData).length > 0 && task && task.id) {
        await log(`💾 [Teardown] ATUALIZANDO tarefa ${task.id} com ${Object.keys(finalUpdateData).length} campos de log...`);
        
        // 3. Substituído a chamada crua do Prisma pelo TaskService!
        await taskService.updateTask(task.id, finalUpdateData);
        
        await log(`✅ [Teardown] Tarefa ${task.id} atualizada com sucesso pelo TaskService.`);
      } else if (task && task.id) {
        await log(`⚠️ [Teardown] Nenhum conteúdo de arquivo encontrado para salvar na tarefa ${task.id}`);
      }
      
    } catch (error) {
      await log(`💥 [FATAL Teardown] Erro CRÍTICO ao salvar conteúdos no banco: ${error.message}\n${error.stack}`);
    }

    return { ...ctx, finalResult };
  }

  // ==========================================
  // O ORQUESTRADOR PRINCIPAL
  // ==========================================

  static async executeTask(task, userId, config): Promise<any> {
    const initialContext = { task, userId, config };

    const steps = [
      this.stepSetupContext,
      this.stepArchitectPlanning,
      this.stepDeveloperLoop,
      this.stepTeardown
    ];

    try {
      const finalState = await runPipeline(`Task-${task.id}`, initialContext, steps);
      
      return { 
        success: finalState.finalResult.success, 
        executionNotes: finalState.finalResult.executionNotes, 
        taskId: task.id 
      };

    } catch (error) {
      await log(`💥 [FATAL] O pipeline falhou: ${error.message}`);
      throw error;
    }
  }
}

export default TaskExecutionService;