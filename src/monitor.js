"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitor = void 0;
const config_1 = __importDefault(require("./aux/config"));
const logger_1 = require("./aux/logger");
const workflowMap_1 = require("./aux/workflowMap");
// --- IMPORTS DOS PASSOS ---
const VerificaLock_1 = require("./steps/VerificaLock");
const ConfiguraUsuario_1 = require("./steps/ConfiguraUsuario");
const BuscaTarefa_1 = require("./steps/BuscaTarefa");
const InicializaTarefa_1 = require("./steps/InicializaTarefa");
const SuperValidacao_1 = require("./steps/SuperValidacao");
const DecomposicaoTarefa_1 = require("./steps/DecomposicaoTarefa"); // Verifique se o .name é igual no map
const VerificacaoDominio_1 = require("./steps/VerificacaoDominio");
// Passos do Ciclo do Programador (OS QUE FALTAVAM)
const PreparaSessaoEPromptInicial_1 = require("./steps/PreparaSessaoEPromptInicial");
const ExecutaOpenClaw_1 = require("./steps/ExecutaOpenClaw"); // <--- ADICIONADO
const InspecionaWorkspace_1 = require("./steps/InspecionaWorkspace");
const AnalisaTurnoEFeedback_1 = require("./steps/AnalisaTurnoEFeedback"); // <--- ADICIONADO
const PreparaPromptDeCorrecao_1 = require("./steps/PreparaPromptDeCorrecao");
const FinalizaTarefa_1 = require("./steps/FinalizaTarefa"); // <--- ADICIONADO
const ExecucaoProgramador_1 = require("./steps/ExecucaoProgramador");
require("./bootstrap");
const container_1 = __importDefault(require("./container"));
class monitor {
    catalogo_de_passos = {};
    jaEnvieiMensagemQueEstouAguardando = false;
    lockService;
    stateService;
    constructor() {
        this.lockService = container_1.default.resolve('lockService');
        this.stateService = container_1.default.resolve('monitorStateService');
        this.inicializaPassos();
    }
    inicializaPassos() {
        // Registro de todos os "trabalhadores" no catálogo
        this.addPasso(VerificaLock_1.passoVerificaLock);
        this.addPasso(ConfiguraUsuario_1.passoConfiguraUsuario);
        this.addPasso(BuscaTarefa_1.passoBuscaTarefa);
        this.addPasso(InicializaTarefa_1.passoInicializaTarefa);
        this.addPasso(SuperValidacao_1.passoSuperValidacao);
        this.addPasso(DecomposicaoTarefa_1.passoDecomposicaoTarefa);
        this.addPasso(VerificacaoDominio_1.passoVerificacaoDominio);
        // Loop do Desenvolvedor
        this.addPasso(PreparaSessaoEPromptInicial_1.passoPreparaSessaoEPromptInicial);
        this.addPasso(ExecutaOpenClaw_1.passoExecutaOpenClaw); // <--- REGISTRADO
        this.addPasso(InspecionaWorkspace_1.passoInspecionaWorkspace);
        this.addPasso(AnalisaTurnoEFeedback_1.passoAnalisaTurnoEFeedback); // <--- REGISTRADO
        this.addPasso(PreparaPromptDeCorrecao_1.passoPreparaPromptDeCorrecao);
        // Finalização
        this.addPasso(FinalizaTarefa_1.passoFinalizaTarefa); // <--- REGISTRADO
        // Loop do Programador
        this.addPasso(ExecucaoProgramador_1.passoExecucaoProgramador);
    }
    addPasso(passo) {
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
                    await (0, logger_1.log)(`⏳ Aguardando a próxima verificação...`);
                    this.jaEnvieiMensagemQueEstouAguardando = true;
                }
                await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
            }
            catch (loopError) {
                await (0, logger_1.log)(`💥 Erro no loop: ${loopError.message}`);
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
        }
    }
    async executaCiclo() {
        const contexto = {
            tarefaAtual: null,
            UserId: null,
            services: {
                lockService: this.lockService,
                stateService: this.stateService
            },
            config: config_1.default
        };
        const passosExecutads = [];
        try {
            // PONTO DE PARTIDA: Deve bater com o .name do primeiro passo
            let stepAtualNome = 'Verifica Lock';
            while (stepAtualNome !== null) {
                const passoAtual = this.catalogo_de_passos[stepAtualNome];
                if (!passoAtual) {
                    await (0, logger_1.log)(`⚠️ ERRO CRÍTICO: Passo '${stepAtualNome}' não encontrado no catálogo!`);
                    break;
                }
                // 1. Executa a lógica do passo
                await passoAtual.func(contexto);
                passosExecutads.push(stepAtualNome);
                // Verifica Lock
                if (contexto.lockAtivo) {
                    await (0, logger_1.log)(`🔒 Lock ativo detectado durante o ciclo. Interrompendo para evitar conflitos.`);
                    break;
                }
                // 2. Busca as rotas no mapa
                const rotasDisponiveis = workflowMap_1.mapaDeTransicoes[stepAtualNome];
                if (!rotasDisponiveis || rotasDisponiveis.length === 0) {
                    stepAtualNome = null;
                    break;
                }
                // 3. Decide o próximo destino
                const rotaEscolhida = rotasDisponiveis.find((rota) => !rota.condition || rota.condition(contexto));
                if (rotaEscolhida) {
                    stepAtualNome = rotaEscolhida.to;
                }
                else {
                    await (0, logger_1.log)(`⚠️ Nenhuma condição de rota atendida em '${stepAtualNome}'.`);
                    stepAtualNome = null;
                }
            }
            console.log(`Ciclo finalizado. Passos executados: ${passosExecutads.join(' -> ')}`);
            if (contexto.tarefaAtual) {
                this.jaEnvieiMensagemQueEstouAguardando = false;
            }
        }
        catch (error) {
            await (0, logger_1.log)(`💥 Erro Fatal no ciclo: ${error.message}`);
        }
        finally {
            // Libera o lock de arquivo para que o próximo ciclo possa rodar
            await contexto.services.lockService.releaseLock();
        }
    }
}
exports.monitor = monitor;
if (require.main === module) {
    monitor.main().catch(err => console.error(err));
}
