// monitor/__tests__/FaseAnaliseProgramador.test.ts

import { AnaliseProgramadorInput, MacroFaseAnaliseProgramador } from '../passos/macro/FaseAnaliseProgramador';
import { criarLoggerMock, criarTarefaFake } from './fixtures/fabricaMocks';

describe('MacroFaseAnaliseProgramador', () => {
  it('deve validar workspace quando .done existe', async () => {
    const logger = criarLoggerMock();
    const inspecaoWorkspace = {
      execute: jest.fn().mockResolvedValue({
        sucesso: true,
        hasDoneFile: true,
        doneFilePath: '/tmp/proj/.done',
        hasRealChanges: true,
        fileChanges: {
          modified: ['/tmp/proj/src/file.ts'],
          created: [],
          deleted: [],
          total: 1
        },
        evidence: {
          hasDoneFile: true,
          doneFilePath: '/tmp/proj/.done',
          hasRealChanges: true,
          fileChanges: {
            modified: ['/tmp/proj/src/file.ts'],
            created: [],
            deleted: [],
            total: 1
          },
          toolCalls: [],
          toolResults: [],
          rawOutput: '',
          analysis: {
            isDeclaringDone: true,
            missingRequirements: [],
            isTalkingWithoutAction: false,
            confidence: 95
          }
        }
      })
    } as any;

    const fase = new MacroFaseAnaliseProgramador({ logger, inspecaoWorkspace });
    const input = {
      tarefaAtual: criarTarefaFake(),
      caminhoTaskDir: '/tmp/proj',
    };

    const resultado = await fase.execute(input);

    expect(inspecaoWorkspace.execute).toHaveBeenCalled();
    expect(resultado.workspaceValidado).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Arquivo .done encontrado!'));
  });

  it('deve rejeitar workspace se .done nao for encontrado', async () => {
    const logger = criarLoggerMock();
    const inspecaoWorkspace = {
      execute: jest.fn().mockResolvedValue({
        sucesso: true,
        hasDoneFile: false,
        doneFilePath: null,
        hasRealChanges: true,
        fileChanges: {
          modified: ['/tmp/proj/src/file.ts'],
          created: [],
          deleted: [],
          total: 1
        },
        evidence: {
          hasDoneFile: false,
          doneFilePath: null,
          hasRealChanges: true,
          fileChanges: {
            modified: ['/tmp/proj/src/file.ts'],
            created: [],
            deleted: [],
            total: 1
          },
          toolCalls: [],
          toolResults: [],
          rawOutput: '',
          analysis: {
            isDeclaringDone: false,
            missingRequirements: [],
            isTalkingWithoutAction: false,
            confidence: 50
          }
        }
      })
    } as any;
    const dependenciasAnaliseProgramador = {
      logger,
      inspecaoWorkspace
    };
    const fase: MacroFaseAnaliseProgramador = new MacroFaseAnaliseProgramador(
      dependenciasAnaliseProgramador
    );
    const input : AnaliseProgramadorInput = {
      tarefaAtual: criarTarefaFake(),
      caminhoTaskDir: '/tmp/proj',
    };
    const resultado = await fase.execute(input);

    expect(inspecaoWorkspace.execute).toHaveBeenCalled();
    // Com a nova lógica: se tem alterações mas não tem .done, workspaceValidado é false
    // e retorna feedback específico para correção
    expect(resultado.workspaceValidado).toBe(false);
    expect(resultado.precisaCorrecao).toBe(true);
    expect(resultado.tipoFalha).toBe('SEM_DONE');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Alterações detectadas'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('mas sem arquivo .done'));
  });
});
