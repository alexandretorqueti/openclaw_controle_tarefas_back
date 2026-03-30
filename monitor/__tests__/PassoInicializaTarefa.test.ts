// monitor/__tests__/PassoInicializaTarefa.test.ts

import { PassoInicializaTarefa } from '../passos/atomicos/PassoInicializaTarefa';
import type { ClienteApiStatus, FileSystemMinimo } from '../passos/atomicos/PassoInicializaTarefa';
import {
  criarLoggerMock,
  criarLockServiceMock,
  criarStateServiceMock,
  criarTarefaFake,
} from './fixtures/fabricaMocks';

describe('PassoInicializaTarefa', () => {
  const pathFake = { join: (...args: string[]) => args.join('/') };

  const criarDependencias = () => {
    const logger = criarLoggerMock();
    const lockService = criarLockServiceMock();
    const stateService = criarStateServiceMock();
    const fileSystem: jest.Mocked<FileSystemMinimo> = {
      mkdir: jest.fn().mockResolvedValue(undefined),
    };
    const clienteApi: jest.Mocked<ClienteApiStatus> = {
      buscarStatusPorNome: jest.fn().mockResolvedValue({ id: 2 }),
      atualizarStatusTarefa: jest.fn().mockResolvedValue(undefined),
    };

    return { logger, lockService, stateService, fileSystem, clienteApi, path: pathFake };
  };

  it('deve realizar todo o setup de ambiente e retornar o path do diretório', async () => {
    const deps = criarDependencias();
    const passo = new PassoInicializaTarefa(deps);

    const input = {
      tarefa: criarTarefaFake({ id: 99 }),
      tasksDir: '/tmp/tasks',
      apiUrl: 'http://localhost',
      statusInProgress: 'Em Andamento',
    };

    const resultado = await passo.execute(input);

    expect(deps.lockService.acquireLock).toHaveBeenCalledWith(99);
    expect(deps.stateService.registerActiveTask).toHaveBeenCalledWith(99);
    expect(deps.fileSystem.mkdir).toHaveBeenCalledWith('/tmp/tasks/99', { recursive: true });
    expect(deps.clienteApi.atualizarStatusTarefa).toHaveBeenCalledWith('http://localhost', 99, 2);

    expect(resultado.sucesso).toBe(true);
    expect(resultado.taskDir).toBe('/tmp/tasks/99');
  });

  it('deve falhar a inicializacao se o lock ja estiver ocupado', async () => {
    const deps = criarDependencias();
    deps.lockService.acquireLock.mockResolvedValueOnce(false); // Já está processando!
    const passo = new PassoInicializaTarefa(deps);

    const input = {
      tarefa: criarTarefaFake({ id: 99 }),
      tasksDir: '/tmp/tasks',
      apiUrl: 'http://localhost',
      statusInProgress: 'Em Andamento',
    };

    const resultado = await passo.execute(input);

    expect(resultado.sucesso).toBe(false);
    expect(deps.fileSystem.mkdir).not.toHaveBeenCalled();
    expect(deps.logger.erro).toHaveBeenCalledWith(expect.stringContaining('processamento por outro worker'));
  });

  it('deve falhar se nao conseguir criar o diretório de trabalho no disco', async () => {
    const deps = criarDependencias();
    deps.fileSystem.mkdir.mockRejectedValueOnce(new Error('EACCES Permission Denied'));
    const passo = new PassoInicializaTarefa(deps);

    const input = {
      tarefa: criarTarefaFake({ id: 99 }),
      tasksDir: '/tmp/tasks',
      apiUrl: 'http://localhost',
      statusInProgress: 'Em Andamento',
    };

    const resultado = await passo.execute(input);

    expect(resultado.sucesso).toBe(false);
    expect(deps.logger.erro).toHaveBeenCalledWith(expect.stringContaining('Erro fatal ao criar diretório'));
  });

  it('deve degradar graciosamente se a API de status falhar, continuando o ciclo técnico', async () => {
    const deps = criarDependencias();
    deps.clienteApi.buscarStatusPorNome.mockRejectedValueOnce(new Error('Timeout na API'));
    const passo = new PassoInicializaTarefa(deps);

    const input = {
      tarefa: criarTarefaFake({ id: 99 }),
      tasksDir: '/tmp/tasks',
      apiUrl: 'http://localhost',
      statusInProgress: 'Em Andamento',
    };

    const resultado = await passo.execute(input);

    expect(resultado.sucesso).toBe(true); // O passo não morre por causa da UI!
    expect(deps.logger.info).toHaveBeenCalledWith(expect.stringContaining('Ignorando'));
  });
});
