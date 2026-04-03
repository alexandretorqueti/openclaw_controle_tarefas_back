import { DependenciasBase, PassoBase } from "../PassoBase";
import { AnaliseArquitetoInput, AnaliseArquitetoOutput, DependenciasAnaliseArquiteto, MacroFaseAnaliseArquiteto } from "./FaseAnaliseArquiteto";
import { FaseArquitetoInput, FaseArquitetoOutput, DependenciasFaseArquiteto, MacroFaseArquiteto } from "./FaseArquiteto";
import { Snapshot, SnapshotInput, WorkspaceSnapshotService } from '../../services/WorkspaceSnapshotService';
import { FabricaPromptsIA } from "../../utils/FabricaPrompts";
import { ConfiguracaoMonitor, ControleGeral, PlanoDeAnalise, ResultadosPassos, TarefaCompleta } from "../../interfaces";
import { ServicoDisco } from "../atomicos/PassoManipularArquivo";
import { DependenciasFinalizacao, FinalizacaoInput, FinalizacaoOutput, MacroFaseFinalizacao } from "./FaseFinaliza";
import type { Logger } from '../../interfaces/logger';

export interface AnaliseArquitetoEAnaliseArquitetoInput extends AnaliseArquitetoInput, FaseArquitetoInput {
    taskDir?: string,
    tarefaAtual: TarefaCompleta,
    analysisPlan: PlanoDeAnalise, 
    resultados: any,
    inicialSnapshot: Snapshot,
    userId: string,
    controle: ControleGeral,
}

export interface AnaliseArquitetoEAnaliseArquitetoOutput extends AnaliseArquitetoOutput, FaseArquitetoOutput {
    
}

export interface DependenciasArquitetoEAnaliseArquiteto extends DependenciasFaseArquiteto, DependenciasAnaliseArquiteto, DependenciasBase {
    pathUtil: any,
    fabricaPrompts: FabricaPromptsIA,
    servicoDisco: ServicoDisco,
    config: ConfiguracaoMonitor,
    servicoSnapshot: WorkspaceSnapshotService, 
    clienteApi: any,
    servicoOpenClaw: any
}

export class FaseLoopAnalistaEAnalise extends PassoBase<AnaliseArquitetoEAnaliseArquitetoInput, AnaliseArquitetoEAnaliseArquitetoOutput> {
    readonly nome = 'Fase Loop Analista e Analise do Analista';
    private readonly snapshot: WorkspaceSnapshotService;
    private readonly fileSystem: DependenciasAnaliseArquiteto['fileSystem'];
    private taskDir: string | undefined;
    private tarefaAtual: TarefaCompleta;
    private analysisPlan: PlanoDeAnalise;
    private resultados: ResultadosPassos;
    private initialSnapshot: Snapshot;
    private userId: string | null;
    private fluxoEncerradoPrematuramente: boolean = false;
    private controle: ControleGeral;

    private deps: DependenciasArquitetoEAnaliseArquiteto;
    constructor(deps: DependenciasArquitetoEAnaliseArquiteto) {
        super(deps);
        
    }

    public async execute(input: AnaliseArquitetoEAnaliseArquitetoInput): Promise<AnaliseArquitetoEAnaliseArquitetoOutput> {
        this.taskDir = input.taskDir;
        this.tarefaAtual = input.tarefaAtual;
        this.analysisPlan = input.analysisPlan;
        this.resultados = input.resultados;
        this.initialSnapshot = input.inicialSnapshot;
        this.userId = input.userId;
        this.controle = input.controle;
    
        return await this.processar(input);
    }

    protected async processar(input: AnaliseArquitetoInput): Promise<AnaliseArquitetoOutput> {
        let contadorIA = 0;
        let isAnalistSuccess = false;
        {
            while (!isAnalistSuccess && contadorIA++ < 3) {
                const caminhoPlanoParaSalvar = this.deps.pathUtil.join(this.taskDir || '', `${this.tarefaAtual.id}_architect_plan.json`);
                let prompt = FabricaPromptsIA.gerarPromptArquiteto(
                    this.tarefaAtual, 
                    this.tarefaAtual.project, 
                    caminhoPlanoParaSalvar, 
                    this.analysisPlan?.taskType || 'development', 
                    this.gerarSecaoComentariosParaArquiteto(this.tarefaAtual)
                );
                if (contadorIA > 1) {
                prompt = `PARECE QUE VOCÊ JÁ TENTOU ${contadorIA} VEZ(ES), MAS NÃO CRIOU O ARQUIVO DO PLANO DA ANÁLISE.
                CRIE O ARQUIVO DA ANALISE NO LOCAL CORRETO: ${caminhoPlanoParaSalvar}
                ${prompt}
                `
                }
                const arquiteto = await new MacroFaseArquiteto({
                    logger: this.deps.logger,
                    openClaw: this.deps.openClaw,
                    disco: this.deps.servicoDisco,
                    jsonValidator: this.deps.jsonValidator,
                } as DependenciasFaseArquiteto).execute({
                tarefaAtual: this.tarefaAtual,
                planoAnalise: this.analysisPlan,
                caminhoPlanoParaSalvar,
                promptInicial: prompt
                } as FaseArquitetoInput);

                if (!arquiteto.sucesso) {
                await this.deps.logger.erro('O Arquiteto falhou criticamente.');
                return;
                }
                
                if (!this.resultados) this.resultados = {
                arquiteto: {
                    sucesso: false,
                },
                dominio: {
                    dominioValido: false
                },
                superValidacao: {
                    valido: false
                }
                };
                this.resultados.arquiteto = { ...arquiteto, caminhoPlanoSalvo: caminhoPlanoParaSalvar };
                // PASSO 10: ANÁLISE DO ARQUITETO
                {
                const analiseArquiteto = await new MacroFaseAnaliseArquiteto({
                    logger: this.deps.logger, 
                    snapshot: this.deps.servicoSnapshot, 
                    fileSystem: this.deps.fileSystem
                } as DependenciasAnaliseArquiteto).execute({
                    tarefaAtual: this.tarefaAtual,
                    planoAnalise: this.analysisPlan,
                    respostaArquiteto: this.resultados.arquiteto.planDetails || '',
                    caminhoPlanoArquiteto: this.resultados.arquiteto.caminhoPlanoSalvo || '',
                    snapshotInicial: this.initialSnapshot,
                    diretorioBase: this.deps.config.BASE_DIR,
                } as AnaliseArquitetoInput);

                if (!analiseArquiteto.sucesso) return;
                isAnalistSuccess = true;
                // Se o Arquiteto decidiu fazer a tarefa inteira sozinho e gerou o done.
                if (analiseArquiteto.hasRealChanges && analiseArquiteto.existsDoneFile) {
                    await this.finalizarTarefa(
                        this.userId, 
                        this.tarefaAtual, 
                        `✅ Implementação concluída pelo arquiteto.`, 
                        this.deps.config,
                        this.deps.logger);
                    this.fluxoEncerradoPrematuramente = true; 
                    
                } else if (analiseArquiteto.existsPlanoFile) {
                    // Lê o plano gerado para passar ao programador
                    this.resultados.arquiteto.planoArquiteto = await this.deps.fileSystem.readFile(this.resultados.arquiteto.caminhoPlanoSalvo || '', 'utf-8');
                } else {
                    await this.deps.logger.info('✅ Arquiteto não fez plano nem resolveu a tarefa. Deve tentar de novo com mensagem');
                    isAnalistSuccess = false;
                }
                }
            }
        }
    }

    /**
     * Gera seção de comentários para o arquiteto seguindo lógica do sistema legado
     */
    private gerarSecaoComentariosParaArquiteto(tarefa: TarefaCompleta): string {
        let commentsSection = '';
        
        if (tarefa.comments && tarefa.comments.length > 0) {
            commentsSection = '\n\n=== COMENTÁRIOS DA TAREFA ===\n';
            tarefa.comments.forEach((comment, index) => {
            const userInfo = comment.user ? `${comment.user.name} (${comment.user.nickname})` : 'Usuário';
            const timestamp = new Date(comment.createdAt).toLocaleString('pt-BR');
            commentsSection += `\n${index + 1}. [${timestamp}] ${userInfo}: ${comment.content}`;
            });
            this.deps.logger.info(`💬 ${tarefa.comments.length} comentários incluídos no contexto do arquiteto`);
        }
        
        return commentsSection;
    }

   /**
    * Método auxiliar para finalizar tarefa quando arquiteto já executou
    */
    private async finalizarTarefa(
        UserId: string,
        tarefa: TarefaCompleta,
        mensagemFinal: string,
        config: ConfiguracaoMonitor,
        logger: Logger   ): Promise<void> {
        await logger.info(`🚀 Finalizando tarefa executada pelo arquiteto...`);

        // Pular análise do programador e ir direto para finalização
        const passoFinaliza: MacroFaseFinalizacao = new MacroFaseFinalizacao({
        logger,
        clienteApi: this.deps.clienteApi,
        apiUrl: this.deps.config.API_URL,
        userId: UserId,
        } as DependenciasFinalizacao);

        const finalizacao: FinalizacaoOutput = await passoFinaliza.execute({
        tarefaAtual: tarefa,
        novoStatus: config.STATUS.COMPLETED,
        mensagemFechamento: mensagemFinal,
        } as FinalizacaoInput);

        if (!finalizacao.sucesso) {
        await logger.erro('Falha ao finalizar tarefa executada pelo arquiteto.');
        } else {
        await logger.info(`🎉 Tarefa [${tarefa.id}] finalizada pelo arquiteto!`);
        }
    }
}   