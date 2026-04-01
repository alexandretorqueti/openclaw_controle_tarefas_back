// monitor/__tests__/FaseAnaliseProgramadorFeedback.test.ts
// Testes para verificar feedback condicional e controle de sessão

import { MacroFaseAnaliseProgramador } from '../passos/macro/FaseAnaliseProgramador';
import { criarLoggerMock, criarTarefaFake } from './fixtures/fabricaMocks';

describe('FaseAnaliseProgramador - Feedback Condicional', () => {
  describe('Feedback específico para cada cenário', () => {
    it('deve retornar feedback para cenário a: alterou arquivos mas não criou .done', async () => {
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

      const fase = new MacroFaseAnaliseProgramador({ logger, inspecaoWorkspace });
      const input = {
        tarefaAtual: criarTarefaFake(),
        caminhoTaskDir: '/tmp/proj/tasks/123',
        diretorioBase: '/tmp/proj'
      };

      const resultado = await fase.execute(input);

      expect(resultado.workspaceValidado).toBe(false);
      expect(resultado.precisaCorrecao).toBe(true);
      expect(resultado.tipoFalha).toBe('SEM_DONE');
      expect(resultado.mensagemCorrecao).toContain('Você alterou arquivos, mas faltou criar o arquivo .done.');
      expect(resultado.instrucoesEspecificas).toContain('crie o arquivo .done na pasta da tarefa');
      expect(resultado.manterSessao).toBe(true);
    });

    it('deve retornar feedback para cenário b: criou .done mas não alterou arquivos', async () => {
      const logger = criarLoggerMock();
      const inspecaoWorkspace = {
        execute: jest.fn().mockResolvedValue({
          sucesso: true,
          hasDoneFile: true,
          doneFilePath: '/tmp/proj/tasks/123/.done',
          hasRealChanges: false,
          fileChanges: {
            modified: [],
            created: [],
            deleted: [],
            total: 0
          },
          evidence: {
            hasDoneFile: true,
            doneFilePath: '/tmp/proj/tasks/123/.done',
            hasRealChanges: false,
            fileChanges: {
              modified: [],
              created: [],
              deleted: [],
              total: 0
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
        caminhoTaskDir: '/tmp/proj/tasks/123',
        diretorioBase: '/tmp/proj'
      };

      const resultado = await fase.execute(input);

      expect(resultado.workspaceValidado).toBe(false);
      expect(resultado.precisaCorrecao).toBe(true);
      expect(resultado.tipoFalha).toBe('SEM_ALTERACOES');
      expect(resultado.mensagemCorrecao).toContain('Você criou o arquivo .done mas não houve alterações nos arquivos do código.');
      expect(resultado.instrucoesEspecificas).toContain('use as ferramentas de edição de código');
      expect(resultado.manterSessao).toBe(true);
    });

    it('deve retornar feedback para cenário d: nada feito - nem .done nem alterações', async () => {
      const logger = criarLoggerMock();
      const inspecaoWorkspace = {
        execute: jest.fn().mockResolvedValue({
          sucesso: true,
          hasDoneFile: false,
          doneFilePath: null,
          hasRealChanges: false,
          fileChanges: {
            modified: [],
            created: [],
            deleted: [],
            total: 0
          },
          evidence: {
            hasDoneFile: false,
            doneFilePath: null,
            hasRealChanges: false,
            fileChanges: {
              modified: [],
              created: [],
              deleted: [],
              total: 0
            },
            toolCalls: [],
            toolResults: [],
            rawOutput: '',
            analysis: {
              isDeclaringDone: false,
              missingRequirements: [],
              isTalkingWithoutAction: false,
              confidence: 10
            }
          }
        })
      } as any;

      const fase = new MacroFaseAnaliseProgramador({ logger, inspecaoWorkspace });
      const input = {
        tarefaAtual: criarTarefaFake(),
        caminhoTaskDir: '/tmp/proj/tasks/123',
        diretorioBase: '/tmp/proj'
      };

      const resultado = await fase.execute(input);

      expect(resultado.workspaceValidado).toBe(false);
      expect(resultado.precisaCorrecao).toBe(true);
      expect(resultado.tipoFalha).toBe('NADA_FEITO');
      expect(resultado.mensagemCorrecao).toContain('Não detectei nenhuma alteração no código nem arquivo .done criado.');
      expect(resultado.instrucoesEspecificas).toContain('comece a trabalhar na tarefa');
      expect(resultado.manterSessao).toBe(true);
    });

    it('deve validar quando tem .done e alterações suficientes', async () => {
      const logger = criarLoggerMock();
      const inspecaoWorkspace = {
        execute: jest.fn().mockResolvedValue({
          sucesso: true,
          hasDoneFile: true,
          doneFilePath: '/tmp/proj/tasks/123/.done',
          hasRealChanges: true,
          fileChanges: {
            modified: ['/tmp/proj/src/file.ts'],
            created: [],
            deleted: [],
            total: 1
          },
          evidence: {
            hasDoneFile: true,
            doneFilePath: '/tmp/proj/tasks/123/.done',
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
        caminhoTaskDir: '/tmp/proj/tasks/123',
        diretorioBase: '/tmp/proj'
      };

      const resultado = await fase.execute(input);

      expect(resultado.workspaceValidado).toBe(true);
      expect(resultado.precisaCorrecao).toBe(false);
      expect(resultado.manterSessao).toBe(false);
    });
  });
});