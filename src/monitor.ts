// monitor.ts
import { Passo, ContextoExecucao } from "./interfaces/interfaceMonitor";
import LockService from './services/lockService';
import MonitorStateService from './services/monitorStateService';
import config from './aux/config';
import { log } from './aux/logger';
import { mapaDeTransicoes } from "./aux/workflowMap"; 

// Seus passos importados
import { passoVerificaLock } from "./steps/VerificaLock";
import { passoConfiguraUsuario } from "./steps/ConfiguraUsuario";
import { passoBuscaTarefa } from "./steps/BuscaTarefa";
import { passoInicializaTarefa } from "./steps/InicializaTarefa";

export class monitor {
    // ⚠️ MUDANÇA: Sai o array, entra o dicionário (catálogo)
    catalogo_de_passos: Record<string, Passo> = {};
    
    jaEnvieiMensagemQueEstouAguardando: boolean = false;
    
    lockService: any;
    stateService: any;

    static async main() {
        console.log('🚀 Monitor de tarefas iniciado (Workflow Engine)');
        const instancia = new monitor();
        await instancia.daemonLoop();
    }

    constructor() {
        this.lockService = new LockService(config.LOCK_FILE);
        this.stateService = new MonitorStateService(config.TASKS_DIR);
        this.inicializaPassos();
    }

    addPasso(passo: Passo) {
        // ⚠️ MUDANÇA: Registramos o passo no catálogo usando o nome dele como chave
        this.catalogo_de_passos[passo.name] = passo;
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
        // 1. Cria o contexto limpo para este ciclo
        const contexto: ContextoExecucao = {
            tarefaAtual: null,
            UserId: null, 
            services: {
                lockService: this.lockService,
                stateService: this.stateService
            },
            config: config
        };

        try {
            // 2. ⚠️ O PONTO DE PARTIDA DA ESTEIRA
            let stepAtualNome: string | null = 'Verifica Lock';

            // 3. ⚠️ O MOTOR DE TRANSIÇÃO DE ESTADOS
            while (stepAtualNome !== null) {
                const passoAtual = this.catalogo_de_passos[stepAtualNome];
                
                if (!passoAtual) {
                    await log(`⚠️ ERRO CRÍTICO: Passo '${stepAtualNome}' está no mapa, mas não foi implementado/adicionado! Abortando ciclo.`);
                    break;
                }

                // -> A. Executa o trabalho pesado (O Músculo)
                // Opcional: await log(`▶️ Executando: ${passoAtual.name}`);
                await passoAtual.func(contexto);

                // -> B. Consulta o mapa para saber qual o próximo destino
                const rotasDisponiveis = mapaDeTransicoes[stepAtualNome];
                
                if (!rotasDisponiveis || rotasDisponiveis.length === 0) {
                    stepAtualNome = null; // Fim da linha (sem rotas saindo daqui)
                    break;
                }

                // -> C. A Inteligência: Avalia qual rota seguir baseado no contexto
                const rotaEscolhida = rotasDisponiveis.find(
                    (rota) => !rota.condition || rota.condition(contexto)
                );

                if (rotaEscolhida) {
                    stepAtualNome = rotaEscolhida.to; // Gira a engrenagem para o próximo
                } else {
                    await log(`⚠️ Sem rota válida saindo de '${stepAtualNome}'. Encerrando ciclo.`);
                    stepAtualNome = null;
                }
            }
            
            // Se processou algo até o fim, reseta o log de aguardando
            if (contexto.tarefaAtual) {
                this.jaEnvieiMensagemQueEstouAguardando = false;
            }

        } catch (error: any) {
            await log(`💥 Erro Fatal no ciclo: ${error.message}`);
        } finally {
            await contexto.services.lockService.releaseLock();
        }
    }

    inicializaPassos() {
        // A ordem aqui já não importa mais para a execução! 
        // Estamos apenas "cadastrando" os trabalhadores na fábrica.
        this.addPasso(passoVerificaLock);
        this.addPasso(passoConfiguraUsuario);
        this.addPasso(passoBuscaTarefa);
        this.addPasso(passoInicializaTarefa);
    }
}

if (require.main === module) {
    monitor.main().catch(err => console.error(err));
}