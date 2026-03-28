// monitor.ts
import { Passo, ContextoExecucao } from "./interfaces/interfaceMonitor";
import config from './aux/config';
import { log } from './aux/logger';
import { mapaDeTransicoes } from "./aux/workflowMap"; 

// --- IMPORTS DOS PASSOS ---
import { passoVerificaLock } from "./steps/VerificaLock";
import { passoConfiguraUsuario } from "./steps/ConfiguraUsuario";
import { passoBuscaTarefa } from "./steps/BuscaTarefa";
import { passoInicializaTarefa } from "./steps/InicializaTarefa";
import { passoSuperValidacao } from "./steps/SuperValidacao";
import { passoDecomposicaoTarefa } from "./steps/DecomposicaoTarefa"; // Verifique se o .name é igual no map
import { passoVerificacaoDominio } from "./steps/VerificacaoDominio";

// Passos do Ciclo do Programador (OS QUE FALTAVAM)
import { passoPreparaSessaoEPromptInicial } from "./steps/PreparaSessaoEPromptInicial";
import { passoExecutaOpenClaw } from "./steps/ExecutaOpenClaw";           // <--- ADICIONADO
import { passoInspecionaWorkspace } from "./steps/InspecionaWorkspace";
import { passoAnalisaTurnoEFeedback } from "./steps/AnalisaTurnoEFeedback"; // <--- ADICIONADO
import { passoPreparaPromptDeCorrecao } from "./steps/PreparaPromptDeCorrecao";
import { passoFinalizaTarefa } from "./steps/FinalizaTarefa";             // <--- ADICIONADO
import { passoExecucaoProgramador } from "./steps/ExecucaoProgramador";
import './bootstrap';
import container from './container';

export class monitor {
    catalogo_de_passos: Record<string, Passo> = {};
    jaEnvieiMensagemQueEstouAguardando: boolean = false;
    lockService: any;
    stateService: any;

    constructor() {
        this.lockService = container.resolve('lockService');
        this.stateService = container.resolve('MonitorStateServiceClass');
        this.inicializaPassos();
    }

    inicializaPassos() {
        // Registro de todos os "trabalhadores" no catálogo
        this.addPasso(passoVerificaLock);
        this.addPasso(passoConfiguraUsuario);
        this.addPasso(passoBuscaTarefa);
        this.addPasso(passoInicializaTarefa);
        this.addPasso(passoSuperValidacao);
        this.addPasso(passoDecomposicaoTarefa);
        this.addPasso(passoVerificacaoDominio);
        
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

    async executaCiclo() {
        const contexto: ContextoExecucao = {
            tarefaAtual: null,
            UserId: null, 
            services: {
                lockService: this.lockService,
                stateService: this.stateService
            },
            config: config
        };
        const passosExecutads: string[] = [];
        try {
            // PONTO DE PARTIDA: Deve bater com o .name do primeiro passo
            let stepAtualNome: string | null = 'Verifica Lock';

            while (stepAtualNome !== null) {
                const passoAtual = this.catalogo_de_passos[stepAtualNome];
                
                if (!passoAtual) {
                    await log(`⚠️ ERRO CRÍTICO: Passo '${stepAtualNome}' não encontrado no catálogo!`);
                    break;
                }

                // 1. Executa a lógica do passo
                await passoAtual.func(contexto);
                passosExecutads.push(stepAtualNome);

                // Verifica Lock
                if (contexto.lockAtivo) {
                    await log(`🔒 Lock ativo detectado durante o ciclo. Interrompendo para evitar conflitos.`);
                    break;
                }

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
            // Libera o lock de arquivo para que o próximo ciclo possa rodar
            await contexto.services.lockService.releaseLock();
        }
    }
}

if (require.main === module) {
    monitor.main().catch(err => console.error(err));
}