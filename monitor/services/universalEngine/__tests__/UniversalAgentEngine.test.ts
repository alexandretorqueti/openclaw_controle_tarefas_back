import { UniversalAgentEngine } from '../universalAgentEngine';
import { AIExecutionConfig, ValidationResult, OutcomeType, JsonSchema, executeWithValidationLoopArgs, ExpectedOutcome } from '../interfaces/interfaceUniversalAgentEngine';   
import { LLMOptions, LLMProvider } from '../interfaces/interfaceLLM';
import { JSONSchema7 } from 'json-schema';
import { RetornoOpenclaw } from '../interfaces/interfaceRestostasIA';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ConfiguracaoMonitor, ContextoExecucao, ServicosDoMonitor, TarefaCompleta, UtilidadesDoMonitor } from '../../../interfaces';
import passoPreAnaliseEscopoTarerefa, { DependenciasPreAnaliseEscopoTarerefa } from '../../../passos/atomicos/PreAnaliseEscopoTarefaStep';
import { FabricaPromptsIA } from '../../../utils/fabricaPrompts';
import { log } from '../../../../src/aux/logger';
import { title } from 'node:process';
import { de } from 'zod/v4/locales';
import { Project } from '@prisma/client';
import { retornoTipoDaTarefaSchema }
    from '../../../interfaces/retornosIA';
describe('UniversalAgentEngine - Testes do Motor de Loop', () => {
    let engine: UniversalAgentEngine;
    
    let mockContext: ContextoExecucao;
    let mockOptions: LLMOptions;
    let mockLlmCall: jest.SpyInstance;
    let mockContextStepPreAnalise: ContextoExecucao;

    beforeEach(() => {
        jest.clearAllMocks();

        // Instancia o motor "limpo" para cada teste
        engine = new UniversalAgentEngine();
        
        // Sequestra a chamada da IA (método privado) para controlarmos o que a IA responde
        mockLlmCall = jest.spyOn((engine as any).llmService as any, 'execute');
        mockLlmCall.mockResolvedValue({
            success: true,
            content: '{"resultado": "sucesso"}', // O JSON que seu motor vai validar
            raw: { model: 'mock-model' }
        });
        // Cria um contexto "virgem"
        mockContext = {
            tarefaAtual: { id: 'task-123' } as any,
            config: {} as any,
            services: {} as any,
            utils: {} as any,
        } as ContextoExecucao;
        const timeStamp = new Date().getTime();
        mockOptions = {
            provider: LLMProvider.OPENCLAW,
            model: 'qwen3:4b',
            agentId: 'main',
            sessionId: `session-123-${timeStamp}`,
            temperature: 0.7,
            timeout: 30000
        };
    });

    describe('Cenário 1: Saídas Padrão e Caminho Feliz', () => {
        
        it('deve retornar a string bruta quando expectedOutcomes pedir ANY', async () => {
            const config: AIExecutionConfig = {
                agentId: 'test-agent',
                systemPrompt: 'sys',
                userPrompt: 'Diga olá',
                expectedOutcomes: [{ type: OutcomeType.ANY }]
            };
            
            mockLlmCall.mockResolvedValue( { 
                success: true,
                content: 'Olá, eu sou o Jarbas!', // O JSON que seu motor vai validar
                raw: { response: 'Olá, eu sou o Jarbas!' }
            });

            const args = { configIA: config, ctx: mockContext, mockOptions } as executeWithValidationLoopArgs;
            const resultado = await engine.executeWithValidationLoop(
                args as executeWithValidationLoopArgs
            );
            const rawOutput = resultado.rawOutput;
            expect(mockLlmCall).toHaveBeenCalledTimes(1);
            expect(rawOutput).toContain("Olá, eu sou o Jarbas!");

        });

        it('deve validar, fazer o parse e retornar o objeto quando expectedOutcomes pedir JSON', async () => {
            const config: AIExecutionConfig = {
                agentId: 'test-agent',
                systemPrompt: 'sys',
                userPrompt: 'Gere um JSON',
                expectedOutcomes: [{ type: OutcomeType.JSON }]
            };
            
            // IA retorna um JSON com formatação markdown em volta (simulando a vida real)
            // ESCAPADO: Evitando o erro do chat de truncar o texto usando \`\`\`
            mockLlmCall.mockResolvedValue(
                { 
                    success: true,
                    content: '\`\`\`json\n{"nome": "Jarbas", "status": "ativo"}\n\`\`\`', // O JSON que seu motor vai validar
                    raw: { response: '\`\`\`json\n{"nome": "Jarbas", "status": "ativo"}\n\`\`\`' }
                }
            );
            const args = { configIA: config, ctx: mockContext, mockOptions } as executeWithValidationLoopArgs;
            const resultado = await engine.executeWithValidationLoop(args as executeWithValidationLoopArgs);

            expect(mockLlmCall).toHaveBeenCalledTimes(1);
            expect(resultado).toEqual({ nome: 'Jarbas', status: 'ativo' }); 
        });
    });

    describe('Cenário 2: O Loop de Bronca (Recuperação de Erro de Sintaxe)', () => {

        it('deve dar bronca e tentar novamente se o JSON for inválido na primeira tentativa', async () => {
            const config: AIExecutionConfig = {
                agentId: 'test-agent',
                systemPrompt: 'sys',
                userPrompt: 'Gere um JSON',
                expectedOutcomes: [{ type: OutcomeType.JSON }],
                maxRetries: 2
            };
            
            // Simulando a IA a errar na 1ª vez e a acertar na 2ª vez
            mockLlmCall
                .mockResolvedValueOnce({ 
                    success: true,
                    content: '{ "nome": "Jarbas", }', // O JSON que seu motor vai validar
                    raw: { response: '{ "nome": "Jarbas", }' }
                }) // Erro: vírgula a mais
                .mockResolvedValueOnce({ 
                    success: true,
                    content: '{ "nome": "Jarbas" }', // O JSON que seu motor vai validar
                    raw: { response: '{"nome": "Jarbas"}' }
                });   // Sucesso
            const args = { configIA: config, ctx: mockContext, llmOptions:mockOptions } as executeWithValidationLoopArgs;
            const resultado = await engine.executeWithValidationLoop
                (
                    args as executeWithValidationLoopArgs,
                );

            expect(mockLlmCall).toHaveBeenCalledTimes(2);
            
            const argumentoDaSegundaChamada = mockLlmCall.mock.calls[1][0];
            expect(argumentoDaSegundaChamada).toContain('Sua resposta anterior foi rejeitada');
            expect(argumentoDaSegundaChamada).toContain('Erro de sintaxe'); 

            expect(resultado).toEqual({ nome: 'Jarbas' });
        });
    });

    describe('Cenário 3: Limites de Segurança (Ejetar Tarefa)', () => {

        it('deve abortar a tarefa se a IA errar além do maxRetries', async () => {
            const config: AIExecutionConfig = {
                agentId: 'test-agent',
                systemPrompt: 'sys',
                userPrompt: 'Gere um JSON',
                expectedOutcomes: [{ type: OutcomeType.JSON }],
                maxRetries: 2
            };
            
            mockLlmCall.mockResolvedValue({ 
                success: true,
                content: 'Isto não é um JSON', // O JSON que seu motor vai validar
                raw: { response: 'Isto não é um JSON' }
            });
            const args = { configIA: config, ctx: mockContext, mockOptions } as executeWithValidationLoopArgs;

            await expect(engine.executeWithValidationLoop(args)).rejects.toThrow(/Abortando/);

            expect(mockLlmCall).toHaveBeenCalledTimes(2); 
        });
    });

    describe('Cenário 4: Validadores Customizados (Extensibilidade)', () => {

        it('deve usar o customValidator e repassar a bronca específica para a IA', async () => {
            const validadorChato = jest.fn().mockImplementation(async (raw: string): Promise<ValidationResult> => {
                if (!raw.includes('ABACAXI')) {
                    return { isValid: false, feedbackParaIA: 'Esqueceste-te da palavra secreta ABACAXI.' };
                }
                return { isValid: true, parsedData: { mensagem: 'SUCESSO TOTAL' } };
            });

            const config: AIExecutionConfig = {
                agentId: 'test-agent',
                systemPrompt: 'sys',
                userPrompt: 'Diz a palavra',
                expectedOutcomes: [
                    { 
                        type: OutcomeType.CUSTOM, 
                        customValidator: validadorChato 
                    }
                ]
            };
            
            mockLlmCall
                .mockResolvedValueOnce({ 
                    success: true,
                    content: 'Eu gosto de maçã', // O JSON que seu motor vai validar
                    raw: { response: 'Eu gosto de maçã' }
                }) 
                .mockResolvedValueOnce({ 
                    success: true,
                    content: 'Eu gosto de ABACAXI', // O JSON que seu motor vai validar
                    raw: { response: 'Eu gosto de ABACAXI' }
                }); 
            const args = { configIA: config, ctx: mockContext, mockOptions } as executeWithValidationLoopArgs;
            const resultado = await engine.executeWithValidationLoop(args as executeWithValidationLoopArgs);

            expect(validadorChato).toHaveBeenCalledTimes(2); 
            expect(mockLlmCall).toHaveBeenCalledTimes(2);
            
            const promptDaBronca = mockLlmCall.mock.calls[1][0];
            expect(promptDaBronca).toContain('Esqueceste-te da palavra secreta ABACAXI');
            expect(resultado).toEqual({ mensagem: 'SUCESSO TOTAL' });
        });
    });

    describe('Cenário 5: Injeção Automática e Validação por Schema', () => {

        it('deve injetar o schema no prompt e validar a resposta corretamente', async () => {
            
            const meuContrato: JSONSchema7 = {
                type: 'object',
                properties: {
                    tecnologia: { type: 'string' },
                    passos: { type: 'array' }
                },
                required: ['tecnologia', 'passos']
            };

            const config: AIExecutionConfig = {
                agentId: 'arquiteto',
                systemPrompt: 'És um arquiteto',
                userPrompt: '[INSTRUÇÃO DE SISTEMA AUTOMÁTICA] Faz um plano de "tecnologia".',
                expectedOutcomes: [{ 
                    type: OutcomeType.JSON,
                    schema: meuContrato 
                }]
            };
            
            // 1ª Resposta: Esqueceu-se do array de passos
            mockLlmCall.mockResolvedValueOnce({ 
                    success: true,
                    content: '{"tecnologia": "Node.js"}', // O JSON que seu motor vai validar
                    raw: { response: '{"tecnologia": "Node.js"}' }
                }); 
            
            // 2ª Resposta: IA corrigiu
            mockLlmCall.mockResolvedValueOnce({ 
                    success: true,
                    content: '{"tecnologia": "Node.js", "passos": ["instalar"]}', // O JSON que seu motor vai validar
                    raw: { response: '{"tecnologia": "Node.js", "passos": ["instalar"]}' }
                });

            mockOptions = {
                ...mockOptions,
                format: meuContrato
            }
            const args = { configIA: config, ctx: mockContext, mockOptions } as executeWithValidationLoopArgs;
            const resultado: RetornoOpenclaw = await engine.executeWithValidationLoop(args as executeWithValidationLoopArgs);

            // Verificações de Coesão
            const primeiroPromptEnviado = mockLlmCall.mock.calls[0][0];
            expect(primeiroPromptEnviado).toContain('[INSTRUÇÃO DE SISTEMA AUTOMÁTICA]');
            expect(primeiroPromptEnviado).toContain('"tecnologia"'); 
            
            // Verificação de Bronca de Schema
            const promptDaBronca = mockLlmCall.mock.calls[1][0];
            expect(promptDaBronca).toContain("Faltou a propriedade obrigatória 'passos'");
            
            expect(resultado).toEqual({ tecnologia: 'Node.js', passos: ['instalar'] });
        });
    });


});