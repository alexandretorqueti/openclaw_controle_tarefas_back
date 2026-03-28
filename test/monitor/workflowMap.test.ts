// test/monitor/workflowMap.test.ts
import { mapaDeTransicoes } from '../../src/aux/workflowMap';

describe('Workflow Map: Lógica de Transição', () => {

    const encontrarDestino = (step: string, contexto: any) => {
        const rotas = mapaDeTransicoes[step];
        const rota = rotas.find(r => !r.condition || r.condition(contexto));
        return rota ? rota.to : null;
    };

    it('deve desviar para Decomposição se a tarefa não for atômica', () => {
        const ctx = { tarefaAtual: { isAtomic: false } };
        const proximo = encontrarDestino('Super Validação', ctx);
        expect(proximo).toBe('Decomposição de Tarefa');
    });

    it('deve entrar no loop de correção se houver erro de sintaxe JSON', () => {
        const ctx = { tarefaAtual: { erroSintaxeJSON: true } };
        const proximo = encontrarDestino('Analisa Turno e Feedback', ctx);
        expect(proximo).toBe('Prepara Prompt de Correção');
    });

    it('deve ejetar do loop se exceder 5 tentativas', () => {
        const ctx = { tarefaAtual: { loopsExecutados: 6 } };
        const proximo = encontrarDestino('Executa OpenClaw', ctx);
        expect(proximo).toBe(null);
    });

    it('deve finalizar a tarefa se houver .done e nenhum feedback negativo', () => {
        const ctx = { 
            tarefaAtual: { 
                doneExists: true, 
                feedbackForNextTurn: null 
            } 
        };
        const proximo = encontrarDestino('Analisa Turno e Feedback', ctx);
        expect(proximo).toBe('Finaliza Tarefa');
    });
});