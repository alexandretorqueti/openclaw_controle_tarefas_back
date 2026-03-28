// test/steps/ConfiguraUsuario.test.ts

import { passoConfiguraUsuario } from '../../src/steps/ConfiguraUsuario';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
beforeAll(() => {
  // Faz o console.error não fazer nada durante o teste 
  // (ou apenas imprimir a mensagem sem o rastro do Jest)
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Passo: Configura Usuário', () => {
    let mockContexto: any;

    beforeEach(() => {
        jest.clearAllMocks();
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

        // Não deve explodir o processo, apenas logar (o que o func faz internamente)
        await expect(passoConfiguraUsuario.func(mockContexto)).resolves.not.toThrow();
        expect(mockContexto.UserId).toBeNull();
    });
});

afterAll(() => {
  jest.restoreAllMocks();
});