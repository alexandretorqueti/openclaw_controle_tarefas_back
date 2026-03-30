// monitor/__tests__/MotorDePassos.test.ts

import { MotorDePassos } from '../utils/MotorDePassos';
import { criarLoggerMock, criarContextoMock } from './fixtures/fabricaMocks';
import type { Passo, ContextoExecucao, MapaDeTransicoes } from '../interfaces';
import { StepName } from '../interfaces';

/**
 * Helper: cria um passo fake que apenas executa um callback.
 */
function criarPassoFake(
  nome: StepName,
  callback?: (ctx: ContextoExecucao) => void
): Passo {
  return {
    name: nome,
    executar: jest.fn().mockImplementation(async (ctx: ContextoExecucao) => {
      callback?.(ctx);
    }),
  };
}

describe('MotorDePassos', () => {
  it('deve executar passos na ordem definida pelo mapa', async () => {
    const logger = criarLoggerMock();
    const mapa: MapaDeTransicoes = {
      [StepName.VERIFICA_LOCK]: [{ to: StepName.CONFIGURA_USUARIO }],
      [StepName.CONFIGURA_USUARIO]: [{ to: StepName.BUSCA_TAREFA }],
      [StepName.BUSCA_TAREFA]: [{ to: null }],
    };

    const motor = new MotorDePassos({ logger, mapaDeTransicoes: mapa });
    motor.registrarTodos([
      criarPassoFake(StepName.VERIFICA_LOCK),
      criarPassoFake(StepName.CONFIGURA_USUARIO),
      criarPassoFake(StepName.BUSCA_TAREFA),
    ]);

    const ctx = criarContextoMock();
    const resultado = await motor.executar(StepName.VERIFICA_LOCK, ctx);

    expect(resultado).toEqual([StepName.VERIFICA_LOCK, StepName.CONFIGURA_USUARIO, StepName.BUSCA_TAREFA]);
  });

  it('deve respeitar condições de rota', async () => {
    const logger = criarLoggerMock();
    const mapa: MapaDeTransicoes = {
      [StepName.VERIFICA_LOCK]: [
        { condition: (c) => c.lockAtivo === true, to: null },
        { to: StepName.CONFIGURA_USUARIO },
      ],
      [StepName.CONFIGURA_USUARIO]: [{ to: null }],
    };

    const motor = new MotorDePassos({ logger, mapaDeTransicoes: mapa });
    motor.registrarTodos([
      criarPassoFake(StepName.VERIFICA_LOCK, (ctx) => {
        ctx.lockAtivo = true;
      }),
      criarPassoFake(StepName.CONFIGURA_USUARIO),
    ]);

    const ctx = criarContextoMock();
    const resultado = await motor.executar(StepName.VERIFICA_LOCK, ctx);

    // Início seta lockAtivo=true → condição bate → to: null → para
    expect(resultado).toEqual([StepName.VERIFICA_LOCK]);
  });

  it('deve parar se passo não está registrado', async () => {
    const logger = criarLoggerMock();
    const mapa: MapaDeTransicoes = {
      [StepName.VERIFICA_LOCK]: [{ to: StepName.CONFIGURA_USUARIO }],
    };

    const motor = new MotorDePassos({ logger, mapaDeTransicoes: mapa });
    motor.registrar(criarPassoFake(StepName.VERIFICA_LOCK));

    const ctx = criarContextoMock();
    const resultado = await motor.executar(StepName.VERIFICA_LOCK, ctx);

    expect(resultado).toEqual([StepName.VERIFICA_LOCK]);
    expect(logger.erro).toHaveBeenCalledWith(
      expect.stringContaining(StepName.CONFIGURA_USUARIO)
    );
  });

  it('não deve permitir registro duplicado', () => {
    const logger = criarLoggerMock();
    const motor = new MotorDePassos({
      logger,
      mapaDeTransicoes: {},
    });

    motor.registrar(criarPassoFake(StepName.VERIFICA_LOCK));

    expect(() => motor.registrar(criarPassoFake(StepName.VERIFICA_LOCK))).toThrow(
      'já registrado'
    );
  });

  it('deve suportar loops (passo volta pra si mesmo com condição de saída)', async () => {
    const logger = criarLoggerMock();
    let contador = 0;

    const mapa: MapaDeTransicoes = {
      [StepName.PROGRAMADOR]: [
        { condition: (c) => (c.controle.loopsExecutados ?? 0) >= 3, to: null },
        { to: StepName.PROGRAMADOR },
      ],
    };

    const motor = new MotorDePassos({ logger, mapaDeTransicoes: mapa });
    motor.registrar(
      criarPassoFake(StepName.PROGRAMADOR, (ctx) => {
        contador++;
        ctx.controle.loopsExecutados = contador;
      })
    );

    const ctx = criarContextoMock();
    const resultado = await motor.executar(StepName.PROGRAMADOR, ctx);

    expect(resultado).toEqual([StepName.PROGRAMADOR, StepName.PROGRAMADOR, StepName.PROGRAMADOR]);
    expect(ctx.controle.loopsExecutados).toBe(3);
  });
});
