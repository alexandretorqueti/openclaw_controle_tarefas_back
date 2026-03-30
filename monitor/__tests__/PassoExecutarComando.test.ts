// monitor/__tests__/PassoExecutarComando.test.ts

import { PassoExecutarComando } from '../passos/atomicos/PassoExecutarComando';
import { criarLoggerMock } from './fixtures/fabricaMocks';

describe('PassoExecutarComando', () => {
  const mockTerminal = {
    executar: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve retornar o stdout num comando de sucesso', async () => {
    const logger = criarLoggerMock();
    mockTerminal.executar.mockResolvedValueOnce({ stdout: 'build success', stderr: '' });

    const passo = new PassoExecutarComando({ logger, terminal: mockTerminal });

    const result = await passo.execute({
      comando: 'npm run build',
      diretorioDeTrabalho: '/tmp/proj',
    });

    expect(result.sucesso).toBe(true);
    expect(result.stdout).toContain('build success');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('npm run build'));
    expect(mockTerminal.executar).toHaveBeenCalledWith('npm run build', { cwd: '/tmp/proj', timeout: 120000 });
  });

  it('deve extrair stderr quando o comando falhar (throw)', async () => {
    const logger = criarLoggerMock();
    const mockError: any = new Error('Command failed with exit code 1');
    mockError.stdout = '';
    mockError.stderr = 'error stack';
    
    mockTerminal.executar.mockRejectedValueOnce(mockError);

    const passo = new PassoExecutarComando({ logger, terminal: mockTerminal });

    const result = await passo.execute({
      comando: 'npm run error',
      diretorioDeTrabalho: '/tmp/proj',
    });

    expect(result.sucesso).toBe(false);
    expect(result.mensagemErro).toContain('Command failed');
    expect(result.stderr).toBe('error stack');
    expect(logger.erro).toHaveBeenCalledWith(expect.stringContaining('Exit code != 0'));
  });
});
