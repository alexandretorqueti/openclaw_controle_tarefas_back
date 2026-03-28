// test/steps/AnalisaTurnoEFeedback.test.ts

import { passoAnalisaTurnoEFeedback } from '../../src/steps/AnalisaTurnoEFeedback';
import container from '../../src/container';

jest.mock('../../src/container');

describe('Passo: Analisa Turno e Feedback', () => {
    let mockContexto: any;
    const mockAnalysisService = {
        analyzeDeveloperTurn: jest.fn()
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (container.resolve as jest.Mock).mockReturnValue(mockAnalysisService);

        mockContexto = {
            tarefaAtual: {
                id: '123',
                rawOutput: '{"tool": "exec"}',
                doneExists: false,
                hasRealChanges: true,
                evidence: {}
            }
        };
    });

    it('deve detectar erro de sintaxe se o JSON estiver truncado', async () => {
        mockContexto.tarefaAtual.rawOutput = '{"action": "write_file", "content": "muito longo...'; 
        
        await passoAnalisaTurnoEFeedback.func(mockContexto);

        expect(mockContexto.tarefaAtual.erroSintaxeJSON).toBe(true);
        expect(mockContexto.tarefaAtual.feedbackForNextTurn).toContain('ERRO DE SINTAXE');
    });

    it('deve gerar feedback de pendência se a IA disser que acabou mas faltarem requisitos', async () => {
        mockContexto.tarefaAtual.doneExists = true;
        mockContexto.tarefaAtual.hasRealChanges = false; // Força a chamada do service

        mockAnalysisService.analyzeDeveloperTurn.mockResolvedValue({
            isDeclaringDone: true,
            hasFulfilledContract: false,
            missingRequirements: ['Faltou o teste unitário']
        });

        await passoAnalisaTurnoEFeedback.func(mockContexto);

        expect(mockContexto.tarefaAtual.feedbackForNextTurn).toContain('Faltou o teste unitário');
    });

    it('deve aprovar o turno (feedback null) se tudo estiver correto', async () => {
        mockContexto.tarefaAtual.doneExists = true;
        mockContexto.tarefaAtual.hasRealChanges = true;

        await passoAnalisaTurnoEFeedback.func(mockContexto);

        expect(mockContexto.tarefaAtual.feedbackForNextTurn).toBeNull();
    });
});