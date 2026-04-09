
// monitor/monitoramento.ts
// ═══════════════════════════════════════════════════════════════
// ENTRY POINT — Motor de Monitoramento e Execução de Tarefas por IA
//
// Este é o ponto de partida do sistema. Ele:
//   1. Inicializa a infraestrutura (logger, config, container)
//   2. Instancia o Orquestrador Mestre
//   3. Roda o daemon loop eternamente
//
// Arquitetura:
//   - Orquestrador Imperativo (Imperative Orchestration)
//   - Passos com contrato estrito (Template Method + DI)
//
// Para rodar:
//   npx tsx monitor/monitoramento.ts
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────
// 1. INFRAESTRUTURA
// ─────────────────────────────────────────────────────

import '../src/bootstrap';
import * as container from '../src/container';
import config from '../src/aux/config';

import type {
  ConfiguracaoMonitor,
  ServicoLock,
  ServicoEstado,
  ServicoUsuario,
  ServicoAnaliseTarefa,
  FabricaPrompts,
} from './interfaces';
import type { Logger } from './interfaces/logger';

// ─────────────────────────────────────────────────────
// 2. UTILS E ORQUESTRADOR
// ─────────────────────────────────────────────────────

import { LoggerConsole } from './utils/LoggerConsole';
import { criarContextoLimpo } from './utils/fabricaContexto';
import { salvarContextoParaDebug } from './utils/debugContexto';
import { OrquestradorTarefas } from './Orquestrador';
import  TaskService from '../src/services/taskService';
// ─────────────────────────────────────────────────────
// 3. NOVOS SERVIÇOS PARA FEEDBACK ITERATIVO (TODOs 4 e 6)
// ─────────────────────────────────────────────────────

import { SessionManagerService } from './services/SessionManagerService';
import { FeedbackServiceImpl } from './services/FeedbackService';

// ─────────────────────────────────────────────────────
// 3. ADAPTERS — Conecta ao sistema legado
// ─────────────────────────────────────────────────────

import type { BuscadorTarefa } from './passos/atomicos/PassoBuscaTarefa';
import type { ClienteApiStatus } from './passos/atomicos/PassoInicializaTarefa';
import { WorkspaceSnapshotService } from './services/WorkspaceSnapshotService';
import type { ServicoAnalistaTarefa, DecomposicaoOutput } from './passos/atomicos/PassoDecompoeTarefa';
import type { GerenciadorFalhaTarefa, ConfiguracaoFalha } from './passos/atomicos/PassoVerificaDominio';
import type { ChamarIAInput } from './passos/atomicos/PassoChamarIA';
import type { TarefaCompleta } from './interfaces';
import * as fs from 'fs';
import axios from 'axios';
import { UniversalAgentEngine } from './services/universalEngine/universalAgentEngine';

/**
 * Adapter para usar o módulo "fs" real no FileSystem
 */
class ServicoDiscoLegacy {
  async escrever(caminho: string, conteudo: string, criar: boolean): Promise<void> {
    if (criar) {
      const { dirname } = require('path');
      await fs.promises.mkdir(dirname(caminho), { recursive: true });
    }
    await fs.promises.writeFile(caminho, conteudo, 'utf-8');
  }
  async ler(caminho: string): Promise<string> {
    return fs.promises.readFile(caminho, 'utf-8');
  }
  async apagar(caminho: string): Promise<void> {
    await fs.promises.unlink(caminho);
  }
}

export interface outputExecutarTurno {
  sucesso: boolean; 
  output: string;
  rawOutput?: string;
  toolCall?: Record<string, any>;
  toolResult?: Record<string, any>;
}

/**
 * Adapter para chamar a API real do OpenClaw usando container legado
 * Suporte a sessões persistentes para feedback iterativo (TODO 6)
 */
class ServicoOpenClawLegacy {
  async executarTurno(input: ChamarIAInput): Promise<outputExecutarTurno> {
    const OpenClawService = require('../src/services/openclawService');
    const configuracao = config as ConfiguracaoMonitor;
    
    // Usar sessionId fornecido ou gerar novo (TODO 6: persistência de sessão)
    const sessionId = input.sessionId || `session-${input.agente}-${Date.now()}`;
    const terminalLogFile = null; // não usamos log de terminal para chamadas simples
    const tasksDir = configuracao.TASKS_DIR || '/tmp';
    const projectPath = process.cwd();
    
    const resultado = await OpenClawService.executeOptimized(
      sessionId,
      input.prompt,
      input.agente,
      null, // model (usa o padrão do agente)
      tasksDir,
      terminalLogFile,
      projectPath,
      input.timeoutMs || 120_000, // timeout 2 minutos
      {
        enableBrowser: false,
        enableElevated: false,
        enableThinking: true,
        fallbackAgent: 'main',
        maxRetries: 0
      }
    );
    
    return {
      sucesso: resultado?.success ?? false,
      output: resultado?.rawOutput ?? '',
      rawOutput: resultado?.rawOutput ?? '',
      // toolCall e toolResult não são extraídos pelo serviço atual
      // Podem ser implementados posteriormente com parsing do rawOutput
    };
  }
}

/**
 * Utilitário: JSON parse genérico ou baseado em schema.
 */
class JsonValidator {
  parsear(texto: string): any {
    return JSON.parse(texto);
  }
}

/**
 * Adapter que conecta o BuscadorTarefa ao endpoint legado da API.
 */
class BuscadorTarefaViaApi implements BuscadorTarefa {
  private readonly apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async buscarProxima(nickname: string): Promise<TarefaCompleta | null> {
    const { createLegacyGetNextTask } = require('../src/steps/adapters/legacyGetNextTask');
    const getNextTask = createLegacyGetNextTask(this.apiUrl);
    return getNextTask(nickname);
  }
}

/**
 * Adapter que conecta o ClienteApiStatus ao endpoint legado.
 */
class ClienteApiStatusViaAxios implements ClienteApiStatus {
  async buscarStatusPorNome(
    apiUrl: string,
    nome: string
  ): Promise<{ id: number } | null> {
    const response = await axios.get(`${apiUrl}/api/statuses`);
    const statuses: Array<{ id: number; name: string }> = response.data?.statuses ?? [];
    const encontrado = statuses.find(
      (s) => s.name === nome || s.name === 'Em Andamento'
    );
    return encontrado ?? null;
  }

  async atualizarStatusTarefa(
    apiUrl: string,
    taskId: number | string,
    statusId: number
  ): Promise<void> {
    await axios.put(`${apiUrl}/api/tasks/${taskId}`, { statusId });
  }
}

/**
 * Adapter para chamar o serviço legado de decomposição (CallAnalyst)
 */
export class ServicoAnalistaLegacy implements ServicoAnalistaTarefa {
  async decompor(tarefa: TarefaCompleta, userId: string | null, prompt: string): Promise<DecomposicaoOutput> {
    const { createLegacyCallAnalyst } = require('../src/steps/adapters/legacyCallAnalyst');
    const callAnalyst = createLegacyCallAnalyst(userId);
    const resultado = await callAnalyst(tarefa);

    return {
      sucesso: resultado?.success ?? false,
      subtasks: resultado?.subtasks ?? [],
      subtasksCreated: resultado?.subtasksCreated ?? 0,
    };
  }
}

/**
 * Adapter para acionar a rotina legada de handleTaskFailure
 */
class GerenciadorFalhaLegacy implements GerenciadorFalhaTarefa {
  async registrarFalha(
    tarefa: TarefaCompleta,
    erro: Error,
    userId: string | null,
    configFalha: ConfiguracaoFalha
  ): Promise<void> {
    const { handleTaskFailure } = require('../src/steps/adapters/legacyTaskFailure');
    await handleTaskFailure(tarefa, erro, userId, {
      API_URL: configFalha.apiUrl,
      TASKS_DIR: configFalha.tasksDir,
      ERROR_DIR: configFalha.errorDir,
    });
  }
}

// ═══════════════════════════════════════════════════════
// 5. CLASSE PRINCIPAL — Monitoramento
// ═══════════════════════════════════════════════════════

const INTERVALO_VERIFICACAO_MS = 60_000; // 1 minuto
const INTERVALO_APOS_ERRO_MS = 30_000;  // 30 segundos

export class Monitoramento {
  private readonly orquestrador: OrquestradorTarefas;
  private readonly logger: Logger;
  private jaEnviouMensagemAguardando: boolean = false;

  constructor() {
    // ─── Logger ───
    const configuracao = config as ConfiguracaoMonitor;
    this.logger = new LoggerConsole({
      caminhoArquivo: configuracao.LOG_FILE,
      maxLinhas: configuracao.MAX_LOG_LINES,
    });

    // ─── Serviços do container legado ───
    const lockService = container.resolve('lockService') as ServicoLock;
    const stateService = container.resolve('monitorStateService') as ServicoEstado;
    const fileService = container.resolve('taskFileService') as any;
    const userServiceReal = container.resolve('userService') as any;
    const taskAnalysisService = container.resolve('taskAnalysisService') as ServicoAnaliseTarefa;
    const promptFactory = container.resolve('promptFactory') as FabricaPrompts;
    const llmServiceClass = container.resolve('llmService') as any;
    const motorUniversal = container.resolve('motorUniversal') as UniversalAgentEngine;
    const llmService = new llmServiceClass();
    // ─── Adapter para UserService ───
    const userService: ServicoUsuario = {
      getCurrentUser: async (nickname: string) => {
        // O serviço real tem getUserByNickname, não getCurrentUser
        return await userServiceReal.getUserByNickname(nickname);
      }
    };

    // ─── Serviço LLM para determinar domínio ───
    const servicoLlmAuxiliar = {
      determinarDominioTarefa: async (
        titulo: string,
        descricao: string,
        contextoProjeto: any,
        prompt: string
      ): Promise<'backend' | 'frontend' | 'indefinido'> => {
        try {
          const promptCompleto = prompt;

          const resposta = await llmService.analyze(promptCompleto);
          
          if (!resposta) {
            return 'indefinido';
          }

          // Extrair a resposta (pode ser objeto ou string)
          const respostaTexto = typeof resposta === 'string' 
            ? resposta.toLowerCase().trim()
            : JSON.stringify(resposta).toLowerCase();

          if (respostaTexto.includes('backend')) {
            return 'backend';
          } else if (respostaTexto.includes('frontend')) {
            return 'frontend';
          } else {
            return 'indefinido';
          }
        } catch (error) {
          console.error('❌ Erro ao determinar domínio com LLM:', error);
          return 'indefinido';
        }
      }
    };

    // ─── Serviço LLM para determinar atomicidade ───
    const servicoLlmAtomicidade = {
      determinarAtomicidadeTarefa: async (
        titulo: string,
        descricao: string,
        contextoProjeto: any,
        prompt: string
      ): Promise<{ isAtomic: boolean; certeza: number; razao: string }> => {
        try {
          const promptCompleto = `
Título da tarefa: ${titulo}
Descrição: ${descricao}
Contexto do projeto: ${JSON.stringify(contextoProjeto, null, 2)}

${prompt}

Analise a tarefa acima e determine se é ATÔMICA (pode ser executada por um único agente) 
ou se precisa ser DECOMPOSTA em subtarefas.

Responda APENAS no formato JSON:
{
  "isAtomic": true/false,
  "certeza": 0-100,
  "razao": "explicação breve"
}
          `;

          const resposta = await llmService.analyze(promptCompleto);
          
          if (!resposta) {
            return { isAtomic: true, certeza: 50, razao: 'LLM não respondeu' };
          }

          // Verificar se resposta já é objeto
          if (typeof resposta === 'object' && resposta !== null) {
            return {
              isAtomic: Boolean(resposta.isAtomic),
              certeza: Math.min(100, Math.max(0, Number(resposta.certeza) || 50)),
              razao: String(resposta.razao || 'Sem explicação')
            };
          }

          // Tentar parsear se for string
          try {
            const parsed = JSON.parse(String(resposta));
            return {
              isAtomic: Boolean(parsed.isAtomic),
              certeza: Math.min(100, Math.max(0, Number(parsed.certeza) || 50)),
              razao: String(parsed.razao || 'Sem explicação')
            };
          } catch {
            // Fallback: analisar texto
            const texto = String(resposta).toLowerCase();
            const isAtomic = !texto.includes('decompor') && 
                            !texto.includes('complexa') && 
                            !texto.includes('múltiplas');
            return { 
              isAtomic, 
              certeza: 60, 
              razao: 'Determinado por análise textual' 
            };
          }
        } catch (error) {
          console.error('❌ Erro ao determinar atomicidade com LLM:', error);
          return { isAtomic: true, certeza: 50, razao: 'Erro no LLM' };
        }
      }
    };

    // ─── Serviço de Snapshot ───
    const servicoSnapshot = new WorkspaceSnapshotService({
      logger: this.logger,
      fileSystem: require('fs').promises,
    });

    // ─── Novos serviços para feedback iterativo (TODOs 4 e 6) ───
    const sessionManager = new SessionManagerService({
      logger: this.logger,
    });
    
    const feedbackService = new FeedbackServiceImpl({
      logger: this.logger,
    });

    // ─── Orquestrador Imperativo ───
    this.orquestrador = new OrquestradorTarefas({
      logger: this.logger,
      config: configuracao,
      servicoLock: lockService,
      servicoEstado: stateService,
      servicoArquivos: fileService,
      servicoUsuario: userService,
      servicoAnaliseTarefa: taskAnalysisService,
      servicoSnapshot: servicoSnapshot,
      servicoLlmAuxiliar: servicoLlmAuxiliar,
      servicoLlmAtomicidade: servicoLlmAtomicidade,
      fabricaPrompts: promptFactory,
      clienteApi: new ClienteApiStatusViaAxios(),
      fileSystem: require('fs').promises,
      pathUtil: require('path'),
      servicoBusca: new BuscadorTarefaViaApi(configuracao.API_URL),
      servicoAnalista: new ServicoAnalistaLegacy(),
      servicoOpenClaw: new ServicoOpenClawLegacy(),
      servicoDisco: new ServicoDiscoLegacy(),
      jsonValidator: new JsonValidator(),
      gerenciadorFalha: new GerenciadorFalhaLegacy(),
      motorUniversal: motorUniversal,
      // Novos serviços para feedback iterativo (TODOs 4 e 6)
      sessionManager,
      feedbackService,
      criarContexto: () => criarContextoLimpo({
        config: configuracao,
        services: {
          lockService,
          stateService,
          fileService,
          userService,
          taskAnalysisService,
        },
        utils: { promptFactory }
      }),
      servicoTarefas: TaskService
    });
  }

  // ═══════════════════════════════════════════════════════
  // DAEMON LOOP
  // ═══════════════════════════════════════════════════════

  async iniciar(): Promise<void> {
    await this.logger.info('🚀 Monitor de tarefas iniciado (Orquestrador Imperativo v3)');

    while (true) {
      try {
        await this.orquestrador.executarCicloDaTarefa();

        if (!this.jaEnviouMensagemAguardando) {
          await this.logger.info('⏳ Aguardando a próxima verificação...');
          this.jaEnviouMensagemAguardando = true;
        }

        await this.aguardar(INTERVALO_VERIFICACAO_MS);
      } catch (erroLoop: unknown) {
        const mensagem = erroLoop instanceof Error ? erroLoop.message : String(erroLoop);
        await this.logger.erro(`💥 Erro no loop principal: ${mensagem}`);
        await this.aguardar(INTERVALO_APOS_ERRO_MS);
      }
    }
  }

  private async aguardar(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════
// EXECUÇÃO DIRETA
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const monitor = new Monitoramento();
  monitor.iniciar().catch((err) => {
    console.error('💀 Erro fatal ao iniciar monitoramento:', err);
    process.exit(1);
  });
}

