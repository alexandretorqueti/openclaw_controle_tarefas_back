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

    beforeEach(() => {
        jest.clearAllMocks();

        // <-- ENSINA O CONTAINER A DEVOLVER O AXIOS FALSO
        (container.resolve as jest.Mock).mockImplementation((name) => {
            if (name === 'apiService') return mockedAxios;
            return undefined;
        });

        mockContexto = {
            config: {
                API_URL: 'http://localhost:3000',
                MY_USER_NICKNAME: 'Alexandre'
            },
            UserId: null
        };
    });

    it('deve extrair e salvar o UserId quando o usuário existe na API', async () => {
        // Simula resposta da API
        mockedAxios.get.mockResolvedValue({
            data: {
                users: [
                    { id: '123', nickname: 'Alexandre' },
                    { id: '456', nickname: 'Fabricio' }
                ]
            }
        });

        await passoConfiguraUsuario.func(mockContexto);

        expect(mockContexto.UserId).toBe('123');
    });

    it('não deve alterar o UserId se o usuário não for encontrado', async () => {
        mockedAxios.get.mockResolvedValue({ data: { users: [] } });

        await passoConfiguraUsuario.func(mockContexto);

        expect(mockContexto.UserId).toBeNull();
    });

    it('deve tratar erros de rede graciosamente', async () => {
        mockedAxios.get.mockRejectedValue(new Error('Network Error'));

        await expect(passoConfiguraUsuario.func(mockContexto)).resolves.not.toThrow();
        expect(mockContexto.UserId).toBeNull();
    });
});

afterAll(() => {
  jest.restoreAllMocks();
});