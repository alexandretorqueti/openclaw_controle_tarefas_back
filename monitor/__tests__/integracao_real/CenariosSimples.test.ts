// monitor/__tests__/integracao_real/CenariosSimples.test.ts
// Teste parametrizado dos cenários MAIS IMPORTANTES do orquestrador.
// Demonstra a lógica de gerar cenários e testar cada um.

import { OrquestradorTarefas } from '../../Orquestrador';
import { criarLoggerMock } from '../fixtures/fabricaMocks';
import type { Logger } from '../../interfaces/logger';

// Mock global do child_process para interceptar comandos de build/test
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, options, callback) => {
    // Comportamento padrão: sucesso
    callback(null, '', '');
  }),
}));

// Configuração base para todos os cenários
const CONFIG_BASE = {
  BASE_DIR: '/tmp/test_cenarios',
  TASKS_DIR: '/tmp/test_cenarios/tasks',
  PROCESSED_DIR: '/tmp/test_cenarios/processed',
  ERROR_DIR: '/tmp/test_cenarios/error',
  API_URL: 'http://localhost:9999',
  STATE_FILE: '/tmp/test_cenarios/state.json',
  LOG_FILE: '/tmp/test_cenarios/test.log',
  MY_USER_NICKNAME: 'jarbas',
  MAX_LOG_LINES: 1000,
  TASK_TIMEOUT_MS: 300000,
  MINUTOS: 30,
  LOCK_FILE: '/tmp/test_cenarios/lock.json',
  OPENCLAW_EXECUTION_TIMEOUT_MS: 120000,
  DEBUG_TASK_ANALYSIS: false,
  DEBUG_TASK_PROMPT: false,
  DEBUG_TASK_CONTRACT: false,
  servicesConfig: {},
  STATUS: {
    IN_PROGRESS: 'Em Andamento',
    COMPLETED: 'Concluída',
  },
};

// Tipos para definir um cenário
interface Cenario {
  nome: string;
  descricao: string;
  configurarMocks: (mocks: any) => void;
  validar: (ctx: any, logs: string[], mocks: any) => void;
  esperaExecucaoCompleta: boolean;
}

// Função que gera os cenários MAIS IMPORTANTES
function gerarCenariosImportantes(): Cenario[] {
  const cenarios: Cenario[] = [];

  // -----------------------------------------------------------------
  // 1. Lock ativo e recente - ciclo aborta
  // -----------------------------------------------------------------
  cenarios.push({
    nome: 'Lock ativo e recente - ciclo aborta',
    descricao: 'Lock existe e é recente, ciclo deve abortar sem buscar tarefa.',
    configurarMocks: (mocks) => {
      mocks.servicoLock.checkLock.mockResolvedValue({
        locked: true,
        ageRecent: true,
        mtime: Date.now() - 60000,
      });
    },
    validar: (ctx, logs, mocks) => {
      expect(ctx.lockAtivo).toBe(true);
      expect(logs).toContainEqual(expect.stringContaining('Lock recente'));
      expect(mocks.servicoBusca.buscarProxima).not.toHaveBeenCalled();
    },
    esperaExecucaoCompleta: false,
  });

  // -----------------------------------------------------------------
  // 2. Lock inativo - continua fluxo
  // -----------------------------------------------------------------
  cenarios.push({
    nome: 'Lock inativo - continua fluxo',
    descricao: 'Nenhum lock ativo, fluxo continua normalmente.',
    configurarMocks: (mocks) => {
      mocks.servicoLock.checkLock.mockResolvedValue({
        locked: false,
        corrupted: false,
      });
      mocks.servicoUsuario.getCurrentUser.mockResolvedValue({
        id: 'user-123',
        nickname: 'jarbas',
      });
      mocks.servicoBusca.buscarProxima.mockResolvedValue(null);
    },
    validar: (ctx, logs, mocks) => {
      expect(ctx.lockAtivo).toBe(false);
      expect(ctx.UserId).toBe('user-123');
      expect(logs).toContainEqual(expect.stringContaining('Lock inativo'));
    },
    esperaExecucaoCompleta: true,
  });

  // -----------------------------------------------------------------
  // 3. Usuário não encontrado - userId null, degradação
  // -----------------------------------------------------------------
  cenarios.push({
    nome: 'Usuário não encontrado - userId null, degradação',
    descricao: 'Nickname não existe na base, userId fica null mas fluxo continua.',
    configurarMocks: (mocks) => {
      mocks.servicoLock.checkLock.mockResolvedValue({ locked: false });
      mocks.servicoUsuario.getCurrentUser.mockResolvedValue(null);
      mocks.servicoBusca.buscarProxima.mockResolvedValue(null);
    },
    validar: (ctx, logs, mocks) => {
      expect(ctx.UserId).toBeNull();
      expect(logs).toContainEqual(expect.stringContaining('não encontrado na base'));
    },
    esperaExecucaoCompleta: true,
  });

  // -----------------------------------------------------------------
  // 4. Nenhuma tarefa disponível - ciclo termina
  // -----------------------------------------------------------------
  cenarios.push({
    nome: 'Nenhuma tarefa disponível - ciclo termina',
    descricao: 'Fila vazia, ciclo termina sem erro.',
    configurarMocks: (mocks) => {
      mocks.servicoLock.checkLock.mockResolvedValue({ locked: false });
      mocks.servicoUsuario.getCurrentUser.mockResolvedValue({ id: 'user-123', nickname: 'jarbas' });
      mocks.servicoBusca.buscarProxima.mockResolvedValue(null);
    },
    validar: (ctx, logs, mocks) => {
      expect(ctx.tarefaAtual).toBeNull();
      expect(logs).toContainEqual(expect.stringContaining('Nenhuma tarefa disponível'));
    },
    esperaExecucaoCompleta: true,
  });

  // -----------------------------------------------------------------
  // 5. Tarefa atômica sem domínio - inválida, aciona falha
  // -----------------------------------------------------------------
  cenarios.push({
    nome: 'Tarefa atômica sem domínio - inválida, aciona falha',
    descricao: 'Tarefa atômica mas domain = null, aborta e aciona rotina de falha.',
    configurarMocks: (mocks) => {
      mocks.servicoLock.checkLock.mockResolvedValue({ locked: false });
      mocks.servicoUsuario.getCurrentUser.mockResolvedValue({ id: 'user-123', nickname: 'jarbas' });
      mocks.servicoBusca.buscarProxima.mockResolvedValue({
        id: 1001,
        title: 'Tarefa Teste',
        description: 'Descrição',
        isAtomic: true,
        domain: null,
        project: { id: 1, name: 'Projeto' },
        comments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mocks.servicoLock.acquireLock.mockResolvedValue(true);
      mocks.fileSystem.mkdir.mockResolvedValue(undefined);
      mocks.clienteApi.buscarStatusPorNome.mockResolvedValue({ id: 2 });
      mocks.clienteApi.atualizarStatusTarefa.mockResolvedValue(undefined);
      mocks.servicoAnaliseTarefa.analyze.mockResolvedValue({ taskType: 'feature' });
    },
    validar: (ctx, logs, mocks) => {
      expect(logs).toContainEqual(expect.stringContaining('sem domínio definido'));
      expect(mocks.gerenciadorFalha.registrarFalha).toHaveBeenCalled();
    },
    esperaExecucaoCompleta: false,
  });

  // -----------------------------------------------------------------
  // 6. Fluxo completo de sucesso (happy path simplificado)
  // -----------------------------------------------------------------
  cenarios.push({
    nome: 'Fluxo completo de sucesso',
    descricao: 'Todas as etapas executam com sucesso, tarefa finalizada.',
    configurarMocks: (mocks) => {
      mocks.servicoLock.checkLock.mockResolvedValue({ locked: false });
      mocks.servicoUsuario.getCurrentUser.mockResolvedValue({ id: 'user-123', nickname: 'jarbas' });
      mocks.servicoBusca.buscarProxima.mockResolvedValue({
        id: 1002,
        title: 'Tarefa Válida',
        description: 'Descrição completa',
        isAtomic: true,
        domain: 'BACKEND',
        project: { id: 1, name: 'Projeto' },
        comments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mocks.servicoLock.acquireLock.mockResolvedValue(true);
      mocks.fileSystem.mkdir.mockResolvedValue(undefined);
      mocks.clienteApi.buscarStatusPorNome.mockResolvedValue({ id: 2 });
      mocks.clienteApi.atualizarStatusTarefa.mockResolvedValue(undefined);
      mocks.servicoAnaliseTarefa.analyze.mockResolvedValue({ taskType: 'feature' });
      mocks.servicoOpenClaw.executarTurno.mockResolvedValue({
        sucesso: true,
        output: '```json\n{"acao":"feito"}\n```',
      });
      mocks.jsonValidator.parsear.mockReturnValue({ acao: 'feito' });
      mocks.servicoDisco.escrever.mockResolvedValue(undefined);
      mocks.servicoDisco.existe.mockResolvedValue(true);
      mocks.clienteApi.buscarStatusPorNome.mockResolvedValue({ id: 3 }); // Status "Concluída"
    },
    validar: (ctx, logs, mocks) => {
      expect(ctx.tarefaAtual).toBeDefined();
      expect(logs).toContainEqual(expect.stringContaining('Tarefa movida para status'));
      expect(mocks.clienteApi.atualizarStatusTarefa).toHaveBeenCalled();
      expect(mocks.servicoLock.releaseLock).toHaveBeenCalled();
    },
    esperaExecucaoCompleta: true,
  });

  return cenarios;
}

// ============================================================================
// TESTE PARAMETRIZADO
// ============================================================================

describe('Cenários Importantes do Orquestrador', () => {
  const cenarios = gerarCenariosImportantes();
  
  cenarios.forEach((cenario) => {
    it(`Cenário: ${cenario.nome} - ${cenario.descricao}`, async () => {
      console.log(`🧪 Executando cenário: ${cenario.nome}`);
      
      // Criar mocks frescos para cada cenário
      const mocks = {
        logger: criarLoggerMock(),
        servicoLock: {
          checkLock: jest.fn(),
          acquireLock: jest.fn(),
          releaseLock: jest.fn(),
          forceReleaseLock: jest.fn(),
        },
        servicoEstado: {
          registerActiveTask: jest.fn().mockResolvedValue(undefined),
          clearState: jest.fn().mockResolvedValue(undefined),
          getState: jest.fn().mockResolvedValue({}),
        },
        servicoArquivos: {
          createTaskDir: jest.fn().mockResolvedValue('/tmp/test/task'),
          getTaskDir: jest.fn().mockReturnValue('/tmp/test/task'),
        },
        servicoUsuario: {
          getCurrentUser: jest.fn(),
        },
        clienteApi: {
          buscarStatusPorNome: jest.fn(),
          atualizarStatusTarefa: jest.fn(),
          adicionarComentarioTarefa: jest.fn(),
        },
        fileSystem: {
          mkdir: jest.fn(),
        },
        pathUtil: {
          join: jest.fn((...args) => args.join('/')),
        },
        servicoBusca: {
          buscarProxima: jest.fn(),
        },
        servicoAnaliseTarefa: {
          analyze: jest.fn(),
        },
        servicoAnalista: {
          decompor: jest.fn(),
        },
        servicoOpenClaw: {
          executarTurno: jest.fn(),
        },
        servicoDisco: {
          escrever: jest.fn(),
          ler: jest.fn(),
          apagar: jest.fn(),
          existe: jest.fn(),
        },
        jsonValidator: {
          parsear: jest.fn(),
        },
        gerenciadorFalha: {
          registrarFalha: jest.fn().mockResolvedValue(undefined),
        },
      };
      
      // Aplicar configuração específica do cenário
      cenario.configurarMocks(mocks);
      
      // Criar contexto mock
      const contextoMock: any = {
        tarefaAtual: null,
        UserId: null,
        config: CONFIG_BASE,
        services: {
          lockService: mocks.servicoLock,
          stateService: mocks.servicoEstado,
          fileService: mocks.servicoArquivos,
          userService: mocks.servicoUsuario,
          taskAnalysisService: mocks.servicoAnaliseTarefa,
        },
        utils: {
          promptFactory: null,
        },
        lockAtivo: false,
        project: null,
        files: {},
        initialSnapshot: null,
        analysisPlan: null,
        developerPrompt: null,
        currentInput: null,
        architectPlanningResult: null,
        historicoPassos: [],
        controle: {
          processoFantasma: null,
          shouldAbort: false,
        },
        erros: [],
        resultados: {},
      };
      
      const criarContexto = () => contextoMock;
      
      // Instanciar orquestrador
      const orquestrador = new OrquestradorTarefas({
        logger: mocks.logger,
        config: CONFIG_BASE,
        servicoLock: mocks.servicoLock,
        servicoEstado: mocks.servicoEstado,
        servicoArquivos: mocks.servicoArquivos,
        servicoUsuario: mocks.servicoUsuario,
        clienteApi: mocks.clienteApi,
        fileSystem: mocks.fileSystem,
        pathUtil: mocks.pathUtil,
        servicoBusca: mocks.servicoBusca,
        servicoAnaliseTarefa: mocks.servicoAnaliseTarefa,
        servicoAnalista: mocks.servicoAnalista,
        servicoOpenClaw: mocks.servicoOpenClaw,
        servicoDisco: mocks.servicoDisco,
        jsonValidator: mocks.jsonValidator,
        gerenciadorFalha: mocks.gerenciadorFalha,
        criarContexto,
      });
      
      // Executar ciclo
      await orquestrador.executarCicloDaTarefa();
      
      // Coletar logs
      const logs: string[] = [];
      mocks.logger.info.mock.calls.forEach((call) => logs.push(call[0]));
      mocks.logger.erro.mock.calls.forEach((call) => logs.push(call[0]));
      
      // Validar cenário
      cenario.validar(contextoMock, logs, mocks);
      
      console.log(`✅ Cenário "${cenario.nome}" passou.`);
    }, 30000);
  });
});
