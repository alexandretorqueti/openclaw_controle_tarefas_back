// monitor/__tests__/PassoConfiguraUsuario.test.ts

import { PassoConfiguraUsuario } from '../passos/atomicos/PassoConfiguraUsuario';
import { criarLoggerMock, criarUserServiceMock } from './fixtures/fabricaMocks';

describe('PassoConfiguraUsuario', () => {
  it('deve retornar o userId quando encontrado na base', async () => {
    const logger = criarLoggerMock();
    const userService = criarUserServiceMock();

    const passo = new PassoConfiguraUsuario({ logger, userService });
    const result = await passo.execute({ nickname: 'jarbas' });

    expect(userService.getCurrentUser).toHaveBeenCalledWith('jarbas');
    expect(result.userId).toBe('user-123');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Usuário configurado'));
  });

  it('deve logar erro e retornar null quando usuário não existe', async () => {
    const logger = criarLoggerMock();
    const userService = criarUserServiceMock();
    userService.getCurrentUser.mockResolvedValueOnce(null);

    const passo = new PassoConfiguraUsuario({ logger, userService });
    const result = await passo.execute({ nickname: 'fantasma' });

    expect(result.userId).toBeNull();
    expect(logger.erro).toHaveBeenCalledWith(expect.stringContaining('não encontrado'));
  });
});
