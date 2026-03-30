// monitor/__tests__/FaseProgramador.test.ts

import { MacroFaseProgramador } from '../passos/macro/FaseProgramador';
import { criarLoggerMock, criarTarefaFake } from './fixtures/fabricaMocks';

describe('MacroFaseProgramador', () => {
  it('deve executar código em turnos até receber "feito"', async () => {
    const logger = criarLoggerMock();

    const openClaw = { 
      executarTurno: jest.fn()
        .mockResolvedValueOnce({ sucesso: true, output: '{"acao":"continuar"}' }) // Turno 1: Continua
        .mockResolvedValueOnce({ sucesso: true, output: '{"acao":"feito"}' })     // Turno 2: Feito
    };

    const jsonValidator = { 
      parsear: jest.fn()
        .mockReturnValueOnce({ acao: 'continuar' })
        .mockReturnValueOnce({ acao: 'feito' })
    };

    const fase = new MacroFaseProgramador({ logger, openClaw, jsonValidator });

    const input = {
      tarefaAtual: criarTarefaFake(),
      planoArquiteto: 'Plano 1',
    };

    const resultado = await fase.execute(input);

    expect(openClaw.executarTurno).toHaveBeenCalledTimes(2);
    expect(resultado.sucesso).toBe(true);

    // O primeiro turno inclui o plano
    expect(openClaw.executarTurno).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ prompt: expect.stringContaining('Plano 1') })
    );

    // O segundo turno não precisa reenviar o plano (já está no contexto da IA)
    expect(openClaw.executarTurno).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ prompt: expect.stringContaining('Continue o trabalho.') })
    );
  });

  it('deve pedir correção de sintaxe se o JSON quebrar no meio dos turnos', async () => {
    const logger = criarLoggerMock();

    const openClaw = { 
      executarTurno: jest.fn()
        .mockResolvedValueOnce({ sucesso: true, output: '{ quebrado }' }) 
        .mockResolvedValueOnce({ sucesso: true, output: '{"acao":"feito"}' }) 
    };

    const jsonValidator = { 
      parsear: jest.fn()
        .mockImplementationOnce(() => { throw new Error('Syntax Error'); })
        .mockReturnValueOnce({ acao: 'feito' })
    };

    const fase = new MacroFaseProgramador({ logger, openClaw, jsonValidator });

    const resultado = await fase.execute({
      tarefaAtual: criarTarefaFake(),
      planoArquiteto: 'Plano 1',
    });

    expect(openClaw.executarTurno).toHaveBeenCalledTimes(2);
    expect(resultado.sucesso).toBe(true);
    expect(openClaw.executarTurno).toHaveBeenLastCalledWith(
      expect.objectContaining({ prompt: expect.stringContaining('ERRO DE SINTAXE') })
    );
  });

  it('deve falhar se ultrapassar o limite de 5 turnos', async () => {
    const logger = criarLoggerMock();

    const openClaw = { 
      executarTurno: jest.fn().mockResolvedValue({ sucesso: true, output: '{"acao":"continuar"}' }) 
    };

    const jsonValidator = { 
      parsear: jest.fn().mockReturnValue({ acao: 'continuar' })
    };

    const fase = new MacroFaseProgramador({ logger, openClaw, jsonValidator });

    const resultado = await fase.execute({
      tarefaAtual: criarTarefaFake(),
      planoArquiteto: 'Plano Infinito',
    });

    expect(openClaw.executarTurno).toHaveBeenCalledTimes(5);
    expect(resultado.sucesso).toBe(false);
    expect(resultado.errosCriticos).toContain('Limite de turnos atingido');
  });
});
