"use strict";
// test/steps/AnalisaTurnoEFeedback.test.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AnalisaTurnoEFeedback_1 = require("../../src/steps/AnalisaTurnoEFeedback");
const container_1 = __importDefault(require("../../src/container"));
jest.mock('../../src/container');
beforeAll(() => {
    // Faz o console.error não fazer nada durante o teste 
    // (ou apenas imprimir a mensagem sem o rastro do Jest)
    jest.spyOn(console, 'error').mockImplementation(() => { });
});
describe('Passo: Analisa Turno e Feedback', () => {
    let mockContexto;
    const mockAnalysisService = {
        analyzeDeveloperTurn: jest.fn()
    };
    beforeEach(() => {
        jest.clearAllMocks();
        container_1.default.resolve.mockReturnValue(mockAnalysisService);
        mockContexto = {
            tarefaAtual: {
                id: '123',
            },
            controleExecucao: {
                rawOutput: '{"tool": "exec"}',
                doneExists: false,
                hasRealChanges: true,
                evidence: {}
            }
        };
    });
    it('deve detectar erro de sintaxe se o JSON estiver truncado', async () => {
        mockContexto.controleExecucao.rawOutput = '{"action": "write_file", "content": "muito longo...';
        await AnalisaTurnoEFeedback_1.passoAnalisaTurnoEFeedback.func(mockContexto);
        expect(mockContexto.controleExecucao.erroSintaxeJSON).toBe(true);
        expect(mockContexto.controleExecucao.feedbackForNextTurn).toContain('ERRO DE SINTAXE');
    });
    it('deve gerar feedback de pendência se a IA disser que acabou mas faltarem requisitos', async () => {
        mockContexto.controleExecucao.doneExists = true;
        mockContexto.controleExecucao.hasRealChanges = false; // Força a chamada do service
        mockAnalysisService.analyzeDeveloperTurn.mockResolvedValue({
            isDeclaringDone: true,
            hasFulfilledContract: false,
            missingRequirements: ['Faltou o teste unitário']
        });
        await AnalisaTurnoEFeedback_1.passoAnalisaTurnoEFeedback.func(mockContexto);
        expect(mockContexto.controleExecucao.feedbackForNextTurn).toContain('Faltou o teste unitário');
    });
    it('deve aprovar o turno (feedback null) se tudo estiver correto', async () => {
        mockContexto.controleExecucao.doneExists = true;
        mockContexto.controleExecucao.hasRealChanges = true;
        await AnalisaTurnoEFeedback_1.passoAnalisaTurnoEFeedback.func(mockContexto);
        expect(mockContexto.controleExecucao.feedbackForNextTurn).toBeNull();
    });
});
afterAll(() => {
    jest.restoreAllMocks();
});
