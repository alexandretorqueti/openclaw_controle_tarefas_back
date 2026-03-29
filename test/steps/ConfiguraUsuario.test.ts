// test/steps/ConfiguraUsuario.test.ts

import { passoConfiguraUsuario } from '../../src/steps/ConfiguraUsuario';
import axios from 'axios';
import container from '../../src/container'; // <-- IMPORTA O CONTAINER

// Mocks
jest.mock('axios');
jest.mock('../../src/container'); // <-- MOCKA O CONTAINER

const mockedAxios = axios as jest.Mocked<typeof axios>;

beforeAll(() => {
  // Faz o console.error não fazer nada durante o teste 
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Passo: Configura Usuário', () => {
    let mockContexto: any;
    let mockUserService: any;

    beforeEach(() => {
        jest.clearAllMocks();
        container.clear(); // Limpa o container real

        // 1. CRIE O SEU DUBLÊ PRIMEIRO
        mockUserService = {
            getUserByNickname: jest.fn().mockResolvedValue({
                id: '123', 
                nickname: 'Alexandre'
            })
        };

        // 2. REGISTRE NO CONTAINER (se o seu passo usar container.resolve)
        container.register('userService', mockUserService);

        // 3. MONTE O CONTEXTO USANDO O MESMO DUBLÊ
        mockContexto = {
            config: {
                API_URL: 'http://localhost:3000',
                MY_USER_NICKNAME: 'Alexandre'
            },
            UserId: null,
            services: {
                // Aqui está o pulo do gato! Injete a MESMA variável aqui.
                // Assim, não importa se o passo usa o ctx.services ou o container, 
                // ele vai bater no mesmo mock que retorna '123'.
                userService: mockUserService 
            }
        };
    });

    it('deve extrair e salvar o UserId...', async () => {
        await passoConfiguraUsuario.func(mockContexto);
        
        expect(mockContexto.UserId).toBe('123');
        
        // Agora isso vai funcionar perfeitamente!
        expect(mockUserService.getUserByNickname).toHaveBeenCalledWith('Alexandre');
    });

    it('não deve alterar o UserId se o usuário não for encontrado', async () => {
        mockUserService.getUserByNickname.mockResolvedValueOnce(null);

        await passoConfiguraUsuario.func(mockContexto);

        expect(mockContexto.UserId).toBeNull();
    });

    it('deve tratar erros de rede graciosamente', async () => {
        // 1. Força o SEU serviço a simular uma falha catastrófica apenas nesta execução
        mockUserService.getUserByNickname.mockRejectedValueOnce(new Error('Network Error'));

        // 2. Garante que o passo captura o erro no try/catch e não deixa vazar
        await expect(passoConfiguraUsuario.func(mockContexto)).resolves.not.toThrow();
        
        // 3. Garante que, devido ao erro, o ID não foi preenchido
        expect(mockContexto.UserId).toBeNull();
    });
});

afterAll(() => {
  jest.restoreAllMocks();
});