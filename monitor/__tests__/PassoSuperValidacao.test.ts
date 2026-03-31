// monitor/__tests__/PassoSuperValidacao.test.ts

import { PassoSuperValidacao } from '../passos/atomicos/PassoSuperValidacao';
import { criarLoggerMock, criarTaskAnalysisServiceMock, criarTarefaFake } from './fixtures/fabricaMocks';

describe('PassoSuperValidacao', () => {
  it('deve aprovar uma tarefa perfeitamente válida e extrair plano', async () => {
    const logger = criarLoggerMock();
    const taskAnalysisService = criarTaskAnalysisServiceMock();

    const passo = new PassoSuperValidacao({ logger, taskAnalysisService });
    const input = { tarefa: criarTarefaFake() };

    const resultado = await passo.execute(input);

    expect(resultado.valido).toBe(true);
    expect(resultado.planoDeAnalise?.taskType).toBe('feature');
    expect(taskAnalysisService.analyzeTaskScope).toHaveBeenCalledWith(input.tarefa, input.tarefa.project);
  });

  it('deve reprovar tarefa se faltar campo obrigatório', async () => {
    const logger = criarLoggerMock();
    const taskAnalysisService = criarTaskAnalysisServiceMock();

    const passo = new PassoSuperValidacao({ logger, taskAnalysisService });
    const tarefaInvalida = criarTarefaFake();
    // Removendo propriedade obrigatória em runtime
    delete (tarefaInvalida as any).description;

    const input = { tarefa: tarefaInvalida };

    const resultado = await passo.execute(input);

    expect(resultado.valido).toBe(false);
    expect(resultado.planoDeAnalise).toBeUndefined();
    expect(logger.erro).toHaveBeenCalledWith(expect.stringContaining('Campo obrigatório faltando: description'));
  });

  it('deve reprovar tarefa se projeto não existir na relação', async () => {
    const logger = criarLoggerMock();
    const taskAnalysisService = criarTaskAnalysisServiceMock();

    const passo = new PassoSuperValidacao({ logger, taskAnalysisService });
    const tarefaSemProjeto = criarTarefaFake({ project: null as any });

    const input = { tarefa: tarefaSemProjeto };

    const resultado = await passo.execute(input);

    expect(resultado.valido).toBe(false);
    expect(logger.erro).toHaveBeenCalledWith(expect.stringContaining('Projeto não é válido'));
  });
});
