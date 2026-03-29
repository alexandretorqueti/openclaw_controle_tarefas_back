/**
 * Step responsável pela análise e planejamento do arquiteto.
 * O arquiteto analisa a tarefa, gera um plano de ação e pode até executar a tarefa.
 * Inclui validação inteligente de evidências e decisão de fluxo.
 */

import container from '../container';

// ============================================================================
// INTERFACES (Contratos de Tipagem)
// ============================================================================

export interface ArchitectAnalysis {
    hasExecuted: boolean;
    hasPlan: boolean;
    confidence: number;
    executionDetails: any;
    planDetails: string | null;
    analysisFailed: boolean;
    hadExecuted?: boolean;
}

export interface ArchitectPlanningContext {
    task: any; // Substitua pelo tipo real de Task
    project?: any; // Substitua pelo tipo real de Project
    files: any;
    initialSnapshot: any;
    config: any;
    analysisPlan: any;
    commentsSection?: string;
    developerPrompt?: string;
    currentInput?: string;
    architectPlanningResult?: {
        success: boolean;
        error?: string;
        taskId?: string;
        hasArchitectPlan?: boolean;
        hasArchitectExecution?: boolean;
        confidence?: number;
        promptUpdated?: boolean;
    };
    shouldAbort?: boolean;
    abortReason?: string;
    architectAnalysis?: ArchitectAnalysis;
    architectPlan?: string;
    [key: string]: any; // Permite propriedades adicionais no contexto
}

export interface ArchitectPlanningOptions {
    log?: any;
    openClawService?: any;
    sessionChainUtils?: any;
    smartFileFinder?: any;
    taskAnalysisService?: any;
    workspaceSnapshotService?: any;
    fileUtils?: any;
    fileSystem?: any;
    promptFactory?: any;
}

// ============================================================================
// CLASSE PRINCIPAL
// ============================================================================

class ArchitectPlanningStep {
    private log: any;
    private openClawService: any;
    private sessionChainUtils: any;
    private smartFileFinder: any;
    private taskAnalysisService: any;
    private workspaceSnapshotService: any;
    private fileUtils: any;
    private fileSystem: any;
    private promptFactory: any;

    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options: ArchitectPlanningOptions = {}) {
        this.log = options.log || container.resolve('log');
        
        // Usar instâncias fornecidas ou criar do container
        this.openClawService = options.openClawService || container.resolve('openClawService');
        this.sessionChainUtils = options.sessionChainUtils || container.resolve('sessionChainUtils');
        this.smartFileFinder = options.smartFileFinder || container.resolve('smartFileFinder');
        this.taskAnalysisService = options.taskAnalysisService || container.resolve('taskAnalysisService');
        this.workspaceSnapshotService = options.workspaceSnapshotService || container.resolve('workspaceSnapshotService');
        this.fileUtils = options.fileUtils || container.resolve('fileUtils');
        this.fileSystem = options.fileSystem || container.resolve('fileSystem');
        this.promptFactory = options.promptFactory || container.resolve('promptFactory');
    }

    /**
     * Executa o step de planejamento do arquiteto
     * @param context - Contexto do pipeline (deve conter dados do SetupContextStep)
     * @returns Contexto atualizado com análise do arquiteto
     */
    async execute(context: ContextoExecucao): Promise<ContextoExecucao> {
        const { 
            tarefaAtual, 
            project, 
            files, 
            initialSnapshot, 
            config, 
            analysisPlan, 
            developerPrompt = '',
            currentInput = ''
        } = context;
        
        if (!tarefaAtual || !files || !config) {
            await this.log(`⚠️ ArchitectPlanningStep: contexto incompleto`);
            return {
                ...context,
                architectPlanningResult: {
                    success: false,
                    error: 'contexto incompleto (task, files ou config faltando)'
                }
            };
        }

        try {
            await this.log(`📋 [Arquiteto] Tipo de tarefa: ${analysisPlan.taskType}`);
            
            // ✅ CORREÇÃO 1: Removemos o PromptFactory daqui. Usamos direto o que veio do SetupContext
            const architectInput = currentInput; 
            
            await this.log(`🧠 [Arquiteto] Avaliando a tarefa ${tarefaAtual.id} e montando o plano de ação...`);
            
            // Gera um ID de sessão unificado baseado na primeira tarefa da cadeia de dependências
            const architectSessionId = await this.sessionChainUtils.generateIsolatedSessionId(tarefaAtual.id, 'arquiteto');
            
            await this.log(`🔗 Sessão do arquiteto: ${architectSessionId} (baseada na cadeia de dependências)`);
            
            // Roda o Arquiteto com timeout de 10 minutos (600000ms)
            const architectResult = await this.openClawService.executeWithFallback(
                architectSessionId,
                architectInput,
                project?.agent || tarefaAtual.agent || 'main',
                tarefaAtual.agent || 'main',
                null,
                config.TASKS_DIR,
                files.architectLogFile,
                project?.pastaBase,
                config.TASK_TIMEOUT_MS
            );
            
            let architectPlan = "";
            let architectAnalysis: ArchitectAnalysis | null = null;
            
            // =====================================================================
            // PASSO 1: Busca inteligente pelo plano do arquiteto
            // =====================================================================
            const planSearch = await this.smartFileFinder.findRealArchitectPlan(
                files.architectPlanFile, 
                config.TASKS_DIR, 
                5
            );
            
            if (planSearch.content) {
                architectPlan = planSearch.content;
                await this.log(`📝 [Arquiteto] Plano recuperado com sucesso (${architectPlan.length} caracteres).`);
            } else if (architectResult.rawOutput && architectResult.rawOutput.trim().length > 50) {
                // Fallback: Se não salvou em arquivo nenhum, tenta usar rawOutput do terminal
                architectPlan = architectResult.rawOutput;
                await this.log(`📝 [Arquiteto] Arquivo não encontrado. Usando rawOutput do terminal como fallback (${architectPlan.length} chars)`);
                // Força a gravação no arquivo correto
                await this.fileSystem.writeFile(files.architectPlanFile, architectPlan).catch(() => {});
            }
            
            // =====================================================================
            // PASSO 2: Analisar o plano encontrado
            // =====================================================================
            if (architectPlan && architectPlan.trim().length > 0) {
                await this.log(`🧠 [Arquiteto] Analisando resposta com IA...`);
                const existsDoneFile = await this.fileUtils.fileExists(files.doneFile);
                
                // 🕵️ DETETIVE DE ARQUIVOS: Verifica se houve "mão na massa" antes de perguntar à IA
                const currentSnapshot = await this.workspaceSnapshotService.takeSnapshot(project?.pastaBase || config.TASKS_DIR);
                const changes = this.workspaceSnapshotService.compareSnapshots(initialSnapshot, currentSnapshot);
                const hasRealChanges = changes.modified.length > 0 || changes.created.length > 0;
                
                if (hasRealChanges) {
                    await this.log(`👀 [Arquiteto] DETECTADO: O Arquiteto alterou ${changes.modified.length} e criou ${changes.created.length} arquivos reais. Avisando o avaliador...`);
                }

                // Agora passamos essas evidências reais como o quarto parâmetro para a IA avaliadora
                architectAnalysis = await this.taskAnalysisService.analyzeArchitectResponse(
                    architectPlan, 
                    tarefaAtual, 
                    project,
                    { hasRealChanges, existsDoneFile, changes } // <-- Passando as provas!
                ) as ArchitectAnalysis;
                
                await this.log(`📊 [Arquiteto] Análise inicial: hasExecuted=${architectAnalysis.hasExecuted}, hasPlan=${architectAnalysis.hasPlan}, confidence=${architectAnalysis.confidence}%`);
                
                const hadExecuted = architectAnalysis.hadExecuted;
                
                // VALIDAÇÃO CRÍTICA: Se a IA diz que executou, verificar evidências reais
                if ((architectAnalysis.hasExecuted && architectAnalysis.confidence > 70) || existsDoneFile) {
                    await this.log(`🔍 [Validação] IA diz que arquiteto executou. Verificando evidências...`);
                    
                    const architectReportExists = await this.fileUtils.fileExists(files.relatorioFile);
                    
                    // Para tarefas de análise, evidência pode ser apenas relatório/.done (não precisa de alterações)
                    const hasEvidence = existsDoneFile || architectReportExists || 
                                     (analysisPlan.taskType === 'analysis' ? true : (hasRealChanges || hadExecuted));
                    
                    if (!hasEvidence) {
                        await this.log(`⚠️ [Validação] NENHUMA evidência encontrada! IA provavelmente errou. Corrigindo análise...`);
                        // Corrigir a análise: não executou, apenas planejou
                        architectAnalysis = {
                            hasExecuted: false,
                            hasPlan: true,
                            confidence: 80,
                            executionDetails: null,
                            planDetails: "Arquiteto gerou plano detalhado, mas não executou alterações (validação de evidências falhou)",
                            analysisFailed: false
                        };
                        await this.log(`📊 [Arquiteto] Análise CORRIGIDA: hasExecuted=false, hasPlan=true (falta de evidências)`);
                    } else {
                        if (analysisPlan.taskType === 'analysis') {
                            await this.log(`✅ [Validação] Evidências confirmadas para análise: relatório/.done criados`);
                        } else {
                            await this.log(`✅ [Validação] Evidências confirmadas: ${changes.modified.length} arquivos modificados, ${changes.created.length} criados`);
                        }
                    }
                }
                
                if (architectAnalysis.hasExecuted) {
                    await this.log(`✅ [Arquiteto] Análise indica que já executou a tarefa (${architectAnalysis.confidence}% confiança).`);
                } else if (architectAnalysis.hasPlan) {
                    await this.log(`📋 [Arquiteto] Análise indica que gerou plano de ação (${architectAnalysis.confidence}% confiança).`);
                } else if (architectAnalysis.analysisFailed) {
                    await this.log(`⚠️ [Arquiteto] Análise falhou ou resposta incompreensível.`);
                }
                
            } else {
                // Se o plano chegou vazio ou não foi encontrado em lugar nenhum
                architectPlan = "O arquiteto não conseguiu gerar um plano detalhado. Siga a descrição original da tarefa.";
                architectAnalysis = {
                    hasExecuted: false,
                    hasPlan: false,
                    confidence: 0,
                    executionDetails: null,
                    planDetails: null,
                    analysisFailed: true
                };
                await this.log(`⚠️ [Arquiteto] Resposta vazia ou inválida. Usando descrição original.`);
            }

            // =====================================================================
            // 3. DECIDIR FLUXO COM BASE NA ANÁLISE INTELIGENTE
            // =====================================================================
            let updatedPromptContent;
            
            // AGORA É SEGURO ACESSAR architectAnalysis
            if (architectAnalysis.hasExecuted && architectAnalysis.confidence > 70 && architectPlan.trim()) {
                updatedPromptContent = `=== EXECUÇÃO CONCLUÍDA PELO ARQUITETO ===\n${architectPlan}\n\nVerifique se as alterações descritas acima foram realmente implementadas.`;
                await this.log(`🔄 [Arquiteto] Fluxo: Usando execução do arquiteto.`);
            } else if (architectAnalysis.hasPlan && architectPlan.trim()) {
                updatedPromptContent = `=== PLANO DE AÇÃO DO ARQUITETO ===\n${architectPlan}\n\n${developerPrompt}`;
                await this.log(`🔄 [Arquiteto] Fluxo: Substituindo prompt pelo plano + instruções do desenvolvedor.`);
            } else if (architectAnalysis.analysisFailed || !architectPlan.trim()) {
                updatedPromptContent = developerPrompt;
                await this.log(`🔄 [Arquiteto] Fluxo: Mantendo APENAS instruções do desenvolvedor (análise falhou).`);
            } else {
                updatedPromptContent = `=== ANÁLISE DO ARQUITETO ===\n${architectPlan}\n\n${developerPrompt}\n\nAnalise a resposta acima e execute a tarefa.`;
                await this.log(`🔄 [Arquiteto] Fluxo: Resposta ambígua, incluindo análise como referência.`);
            }
            
            await this.fileSystem.writeFile(files.promptFile, updatedPromptContent);
            
            await this.log(`✅ [Arquiteto] Planejamento concluído para tarefa ${tarefaAtual.id}`);
            
            return {
                ...context,
                architectPlanningResult: {
                    success: true,
                    taskId: tarefaAtual.id,
                    hasArchitectPlan: architectAnalysis.hasPlan,
                    hasArchitectExecution: architectAnalysis.hasExecuted,
                    confidence: architectAnalysis.confidence,
                    promptUpdated: true,
                    error: null
                },
                currentInput: updatedPromptContent,
                architectAnalysis,
                architectPlan
            };
            
        } catch (stepError: any) {
            await this.log(`💥 Erro no ArchitectPlanningStep para tarefa ${tarefaAtual?.id}: ${stepError.message}`);
            
            return {
                ...context,
                architectPlanningResult: {
                    success: false,
                    error: stepError.message,
                    taskId: tarefaAtual?.id
                },
                shouldAbort: true,
                abortReason: `Falha no planejamento do arquiteto: ${stepError.message}`
            };
        }
    }

    /**
     * Método estático de conveniência para uso direto
     * @param context - Contexto completo (deve conter todos os dados necessários)
     * @returns Resultado do planejamento
     */
}
import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";

export const passoArchitectPlanning: Passo = {
    name: 'Planejamento do Arquiteto',
    func: async (ctx: ContextoExecucao) => {
        const architectPlanningStep = new ArchitectPlanningStep();
        const result: ContextoExecucao = await architectPlanningStep.execute(ctx);
    }
};

// ============================================================================
// EXPORTAÇÕES
// ============================================================================

export default ArchitectPlanningStep;