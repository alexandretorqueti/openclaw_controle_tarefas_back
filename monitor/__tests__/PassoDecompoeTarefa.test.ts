// monitor/__tests__/PassoDecompoeTarefa.test.ts

import { PassoDecompoeTarefaAdapter } from '../passos/adapters/DecomposicaoAdapter';
import { PassoDecompoeTarefa } from '../passos/atomicos/PassoDecompoeTarefa';
import {
  criarLoggerMock,
  criarContextoMock,
  criarServicoAnalistaMock,
  criarTarefaFake,
} from './fixtures/fabricaMocks';

describe('PassoDecompoeTarefa', () => {

  describe('Lógica Pura (Passo Base)', () => {
    it('deve chamar o analista e retornar subtarefas', async () => {
      const logger = criarLoggerMock();
      const analista = criarServicoAnalistaMock();

      // MOCK OBRIGATÓRIO: Garante que NUNCA chame a IA real
      analista.decompor.mockResolvedValueOnce({
        sucesso: true,
        quantidadeSubtarefas: 3,
      });

      const passoPuro = new PassoDecompoeTarefa({ logger, analista });
      
      const input = {
        tarefaAtual: criarTarefaFake({ id: 999 }),
        userId: 'user-123',
        prompt: 'Divida isso...',
      };

      const resultado = await passoPuro.execute(input);

      expect(analista.decompor).toHaveBeenCalledWith(input.tarefaAtual, input.userId, input.prompt);
      expect(resultado).toEqual({
        sucesso: true,
        quantidadeSubtarefas: 3,
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('✅ Tarefa-mãe decomposta em 3 subtarefa(s).')
      );
    });
  });

  describe('Adapter de Contexto (Efeito Colateral Explícito)', () => {
    it('deve extrair input, executar lógica e aplicar mutação no contexto', async () => {
      const logger = criarLoggerMock();
      const analista = criarServicoAnalistaMock();

      // MOCK: Nenhuma chamada real será feita à IA legada
      analista.decompor.mockResolvedValueOnce({
        sucesso: true,
        quantidadeSubtarefas: 2,
      });

      const adapter = new PassoDecompoeTarefaAdapter({ logger, analista });
      const ctx = criarContextoMock({
        tarefaAtual: criarTarefaFake(),
      });

      // Executa o adapter que injeta o contexto na lógica
      await adapter.execute(ctx);

      // EFEITO COLATERAL VALIDADO: Mutação ocorreu exatamente no namespace correto
      expect(ctx.resultados.decomposicao).toEqual({
        sucesso: true,
        subtasksCreated: 2,
      });
      
      // Garante que namespaces de erro estão limpos
      expect(ctx.erros.decomposicao).toBeUndefined();
    });

    it('deve capturar falhas da lógica e marcar namespace de erro', async () => {
      const logger = criarLoggerMock();
      const analista = criarServicoAnalistaMock();

      // Forçando erro da IA (timeout, json inválido, etc)
      analista.decompor.mockRejectedValueOnce(new Error('LLM Timeout'));

      const adapter = new PassoDecompoeTarefaAdapter({ logger, analista });
      const ctx = criarContextoMock({
        tarefaAtual: criarTarefaFake(),
      });

      // Adapter deve capturar a exceção e transformar em estado do fluxo
      await adapter.execute(ctx);

      // Mutação ocorreu exatamente no namespace correto de erros
      expect(ctx.erros.decomposicao).toBe(true);
      expect(ctx.resultados.decomposicao).toBeUndefined();
      
      expect(logger.erro).toHaveBeenCalledWith(
        expect.stringContaining('💥 Falha no processamento "Decompõe Tarefa": LLM Timeout')
      );
    });
  });

});
