// monitor.ts

// 1. PRIMEIRO: Inicializa a infraestrutura (Injeção de dependência e configs)
import './bootstrap';
import container = require('./container');
import config from './aux/config';
import { log } from './aux/logger';
import { mapaDeTransicoes } from "./aux/workflowMap"; 
import { Passo, ContextoExecucao } from "./interfaces/interfaceMonitor_old";

// 2. DEPOIS: Importa os passos (que dependem da infraestrutura já estar pronta)
import { passoVerificaLock } from "./steps/VerificaLock";
import { passoConfiguraUsuario } from "./steps/ConfiguraUsuario";
import { passoBuscaTarefa } from "./steps/BuscaTarefa";
import { passoInicializaTarefa } from "./steps/InicializaTarefa";
import { passoSuperValidacao } from "./steps/SuperValidacao";
import { passoDecomposicaoTarefa } from "./steps/DecomposicaoTarefa"; 
import { passoVerificacaoDominio } from "./steps/VerificacaoDominio";
import { passoTimeoutCheck } from "./steps/TaskTimeoutCheckStep";

// Passos do Ciclo do Programador 
import { passoPreparaSessaoEPromptInicial } from "./steps/PreparaSessaoEPromptInicial";
import { passoExecutaOpenClaw } from "./steps/ExecutaOpenClaw";           
import { passoInspecionaWorkspace } from "./steps/InspecionaWorkspace";
import { passoAnalisaTurnoEFeedback } from "./steps/AnalisaTurnoEFeedback"; 
import { passoPreparaPromptDeCorrecao } from "./steps/PreparaPromptDeCorrecao";
import { passoFinalizaTarefa } from "./steps/FinalizaTarefa";             
import { passoExecucaoProgramador } from "./steps/ExecucaoProgramador";
import { passoArchitectPlanning } from "./steps/ArchitectPlanning";

const path = require('path'); 
const fs = require('fs');
export class monitor {
    catalogo_de_passos: Record<string, Passo> = {};
    jaEnvieiMensagemQueEstouAguardando: boolean = false;
    lockService: any;
    stateService: any;
    fileService: any;
    promptFactory: any;
    userService: any;
    taskAnalysisService: any;

    constructor() {
        this.lockService = container.resolve('lockService');
        this.stateService = container.resolve('monitorStateService');
        this.fileService = container.resolve('taskFileService');
        this.promptFactory = container.resolve('promptFactory');
        this.userService = container.resolve('userService');
        this.taskAnalysisService = container.resolve('taskAnalysisService');
        this.inicializaPassos();
    }

    inicializaPassos() {
        // Registro de todos os "trabalhadores" no catálogo
        this.addPasso(passoVerificaLock);
        this.addPasso(passoTimeoutCheck)
        this.addPasso(passoConfiguraUsuario);
        this.addPasso(passoBuscaTarefa);
        this.addPasso(passoInicializaTarefa);
        this.addPasso(passoSuperValidacao);
        this.addPasso(passoDecomposicaoTarefa);
        this.addPasso(passoVerificacaoDominio);

        this.addPasso(passoArchitectPlanning); // Passo do Arquiteto
        
        // Loop do Desenvolvedor
        this.addPasso(passoPreparaSessaoEPromptInicial);
        this.addPasso(passoExecutaOpenClaw);        // <--- REGISTRADO
        this.addPasso(passoInspecionaWorkspace);
        this.addPasso(passoAnalisaTurnoEFeedback);  // <--- REGISTRADO
        this.addPasso(passoPreparaPromptDeCorrecao);
        
        // Finalização
        this.addPasso(passoFinalizaTarefa);         // <--- REGISTRADO
        
        // Loop do Programador
        this.addPasso(passoExecucaoProgramador);
    }

    addPasso(passo: Passo) {
        this.catalogo_de_passos[passo.name] = passo;
    }

    static async main() {
        console.log('🚀 Monitor de tarefas iniciado (Workflow Engine)');
        const instancia = new monitor();
        await instancia.daemonLoop();
    }

    async daemonLoop() {
        const CHECK_INTERVAL_MS = 60000;
        
        while (true) {
            try {
                await this.executaCiclo();
                
                if (!this.jaEnvieiMensagemQueEstouAguardando) {
                    await log(`⏳ Aguardando a próxima verificação...`);
                    this.jaEnvieiMensagemQueEstouAguardando = true;
                }
                
                await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
            } catch (loopError: any) {
                await log(`💥 Erro no loop: ${loopError.message}`);
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
        }
    }

    formataJsonParaFacilLeitura(obj: any): string {
        // Primeiro substituimos no json todas as strings longas por uma versão truncada para evitar poluição visual
        const replacer = (key: string, value: any) => {
            if (typeof value === 'string' && value.length > 100) {
                return value.substring(0, 100) + '...';
            }
            return value;
        };
        
        // Depois aplicamos a formatação tradicional com indentação
        let jsonString = JSON.stringify(obj, replacer, 2);
        
        // Colocamos quebras de linha extras entre objetos para melhorar a leitura
        jsonString = jsonString.replace(/},\n\s*{/g, '},\n\n{');
        
        return jsonString;
    }

    salvaContextoEmArquivoParaDebug = async (contexto: ContextoExecucao, nomeArquivo: string, passo: string) => {
        const caminhoCompleto = path.join(config.TASKS_DIR, 'contexto-debug', `${nomeArquivo}.json`);
        const datahora = new Date().toISOString().replace(/[:.]/g, '-');
        const conteudo = {
            passo,
            timestamp: datahora,
            contexto
        };
        fs.writeFileSync(caminhoCompleto, this.formataJsonParaFacilLeitura(conteudo), 'utf-8');
        log(`Contexto salvo para debug: ${caminhoCompleto}`);
    }

    async executaCiclo() {
        const contexto: ContextoExecucao = {
            tarefaAtual: null,
            UserId: null, 
            services: {
                lockService: this.lockService,
                stateService: this.stateService,
                fileService: this.fileService,
                userService: this.userService,
                taskAnalysisService: this.taskAnalysisService
            },
            analysisPlan: {},
            utils: {
                promptFactory: this.promptFactory,
            },
            config: config,
            controleExecucao: {
                loopsExecutados: 0,
            },
            lockAtivo: false,
            files: {
                promptFile: null,
                relatorioFile: null,
                doneFile: null,
                terminalLogFile: null,
                architectPlanFile: null,
                architectLogFile: null
            }
        };
        const passosExecutads: string[] = [];
        try {
            // PONTO DE PARTIDA: Deve bater com o .name do primeiro passo
            let stepAtualNome: string | null = 'Verifica Lock';

            while (stepAtualNome !== null) {
                const passoAtual = this.catalogo_de_passos[stepAtualNome];
                this.salvaContextoEmArquivoParaDebug(contexto, 'debug', stepAtualNome);
                if (!passoAtual) {
                    await log(`⚠️ ERRO CRÍTICO: Passo '${stepAtualNome}' não encontrado no catálogo!`);
                    break;
                }

                // 1. Executa a lógica do passo
                await passoAtual.func(contexto);
                passosExecutads.push(stepAtualNome);

                // 2. Busca as rotas no mapa
                const rotasDisponiveis = mapaDeTransicoes[stepAtualNome];
                
                if (!rotasDisponiveis || rotasDisponiveis.length === 0) {
                    stepAtualNome = null;
                    break;
                }

                // 3. Decide o próximo destino
                const rotaEscolhida = rotasDisponiveis.find(
                    (rota) => !rota.condition || rota.condition(contexto)
                );

                if (rotaEscolhida) {
                    stepAtualNome = rotaEscolhida.to; 
                } else {
                    await log(`⚠️ Nenhuma condição de rota atendida em '${stepAtualNome}'.`);
                    stepAtualNome = null;
                }
            }
            console.log(`Ciclo finalizado. Passos executados: ${passosExecutads.join(' -> ')}`);
            if (contexto.tarefaAtual) {
                this.jaEnvieiMensagemQueEstouAguardando = false;
            }

        } catch (error: any) {
            await log(`💥 Erro Fatal no ciclo: ${error.message}`);
        } finally {
            if (!contexto.lockAtivo && !contexto.controleExecucao?.processoFantasma) {
                await contexto.services.lockService.releaseLock();
            }
        }
    }
}

if (require.main === module) {
    monitor.main().catch(err => console.error(err));
}
