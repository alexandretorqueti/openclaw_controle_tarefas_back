// monitor/__tests__/FaseArquiteto.test.ts

import { MacroFaseArquiteto } from '../passos/macro/FaseArquiteto';
import { criarLoggerMock, criarTarefaFake } from './fixtures/fabricaMocks';

describe('MacroFaseArquiteto', () => {
  it('deve orquestrar IA, validar JSON e salvar arquivo com sucesso na primeira tentativa', async () => {
    const logger = criarLoggerMock();
    const openClaw = { executarTurno: jest.fn().mockResolvedValue({ sucesso: true, output: '```json\n{"plano": true}\n```' }) };
    const jsonValidator = { parsear: jest.fn().mockReturnValue({ plano: true }) };
    const disco = { escrever: jest.fn(), ler: jest.fn(), apagar: jest.fn() };

    const fase = new MacroFaseArquiteto({ logger, openClaw, disco, jsonValidator });

    const input = {
      tarefaAtual: criarTarefaFake(),
      planoAnalise: null,
      promptInicial: 'Gere um plano',
      caminhoPlanoParaSalvar: '/tmp/plano.json',
    };

    const resultado = await fase.execute(input);

    expect(resultado.sucesso).toBe(true);
    expect(openClaw.executarTurno).toHaveBeenCalledTimes(1);
    expect(disco.escrever).toHaveBeenCalledWith('/tmp/plano.json', expect.stringContaining('"plano": true'), true);
  });

  it('deve realizar auto-correção se o JSON inicial for inválido', async () => {
    const logger = criarLoggerMock();
    
    // Simula a IA errando na primeira, e acertando na segunda
    const openClaw = { 
      executarTurno: jest.fn()
        .mockResolvedValueOnce({ sucesso: true, output: '{ texto_quebrado }' })
        .mockResolvedValueOnce({ sucesso: true, output: '{"sucesso": true}' }) 
    };
    
    const jsonValidator = { 
      parsear: jest.fn()
        .mockImplementationOnce(() => { throw new Error('Syntax Error'); })
        .mockReturnValueOnce({ sucesso: true })
    };
    
    const disco = { escrever: jest.fn(), ler: jest.fn(), apagar: jest.fn() };

    const fase = new MacroFaseArquiteto({ logger, openClaw, disco, jsonValidator });

    const input = {
      tarefaAtual: criarTarefaFake(),
      planoAnalise: null,
      promptInicial: 'Gere um plano',
      caminhoPlanoParaSalvar: '/tmp/plano.json',
    };

    const resultado = await fase.execute(input);

    // Ocorreram 2 tentativas de chamar a IA
    expect(openClaw.executarTurno).toHaveBeenCalledTimes(2);
    // A segunda chamada incluiu o pedido de correção
    expect(openClaw.executarTurno).toHaveBeenLastCalledWith(
      expect.objectContaining({ prompt: expect.stringContaining('Corrija este erro') })
    );
    expect(resultado.sucesso).toBe(true);
  });

  it('deve abortar após 3 tentativas de sintaxe errada', async () => {
    const logger = criarLoggerMock();
    const openClaw = { executarTurno: jest.fn().mockResolvedValue({ sucesso: true, output: 'ruim' }) };
    const jsonValidator = { parsear: jest.fn().mockImplementation(() => { throw new Error('Bad JSON'); }) };
    const disco = { escrever: jest.fn(), ler: jest.fn(), apagar: jest.fn() };

    const fase = new MacroFaseArquiteto({ logger, openClaw, disco, jsonValidator });

    const resultado = await fase.execute({
      tarefaAtual: criarTarefaFake(),
      planoAnalise: null,
      promptInicial: 'start',
      caminhoPlanoParaSalvar: '/tmp/out',
    });

    expect(openClaw.executarTurno).toHaveBeenCalledTimes(3);
    expect(resultado.sucesso).toBe(false);
    expect(resultado.errosCriticos).toContain('Limite de auto-correção atingido');
  });
});
