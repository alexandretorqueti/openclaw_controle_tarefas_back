import { UniversalAgentEngine } from '../universalAgentEngine';
import { AIExecutionConfig, ValidationResult, OutcomeType, JsonSchema, executeWithValidationLoopArgs, ExpectedOutcome } from '../interfaces/interfaceUniversalAgentEngine';   
import { ContextoExecucaoMotorIA } from '../interfaces/interfaceMonitor';
import { LLMOptions, LLMProvider } from '../interfaces/interfaceLLM';
import { JSONSchema7 } from 'json-schema';

// 1. MOCK DO LOGGER PARA NÃO SUJAR O TERMINAL
jest.mock('../../aux/logger', () => ({
    log: jest.fn()
}));

describe('UniversalAgentEngine - Testes do Motor de Loop', () => {
    let engine: UniversalAgentEngine;
    
    let mockContext: ContextoExecucaoMotorIA;
    let mockOptions: LLMOptions;
    let mockLlmCall: jest.SpyInstance;

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
            shouldAbort: false,
            abortReason: undefined
        } as ContextoExecucaoMotorIA;

        mockOptions = {
            provider: LLMProvider.OPENCLAW,
            model: 'qwen3:4b',
            agentId: 'main',
            sessionId: 'session-123',
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
                content: '{"resultado": "sucesso"}', // O JSON que seu motor vai validar
                raw: { response: 'Olá, eu sou o Jarbas!' }
            });

            const args = { config, ctx: mockContext, mockOptions } as executeWithValidationLoopArgs;
            const resultado = await engine.executeWithValidationLoop(
                args as executeWithValidationLoopArgs
            );
            const rawOutput = resultado.rawOutput;
            expect(mockLlmCall).toHaveBeenCalledTimes(1);
            expect(rawOutput).toContain("Olá, eu sou o Jarbas!");
            expect(mockContext.shouldAbort).toBe(false); 
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
                    content: '{"resultado": "sucesso"}', // O JSON que seu motor vai validar
                    raw: { response: '\`\`\`json\n{"nome": "Jarbas", "status": "ativo"}\n\`\`\`' }
                }
            );
            const args = { config, ctx: mockContext, mockOptions } as executeWithValidationLoopArgs;
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
                maxRetries: 3
            };
            
            // Simulando a IA a errar na 1ª vez e a acertar na 2ª vez
            mockLlmCall
                .mockResolvedValueOnce({ 
                    success: true,
                    content: '{"resultado": "sucesso"}', // O JSON que seu motor vai validar
                    raw: { response: '{ "nome": "Jarbas", }' }
                }) // Erro: vírgula a mais
                .mockResolvedValueOnce({ 
                    success: true,
                    content: '{"resultado": "sucesso"}', // O JSON que seu motor vai validar
                    raw: { response: '{"nome": "Jarbas"}' }
                });   // Sucesso
            const args = { config, ctx: mockContext, mockOptions } as executeWithValidationLoopArgs;
            const resultado = await engine.executeWithValidationLoop(args as executeWithValidationLoopArgs);

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
                content: '{"resultado": "sucesso"}', // O JSON que seu motor vai validar
                raw: { response: 'Isto não é um JSON' }
            });
            const args = { config, ctx: mockContext, mockOptions } as executeWithValidationLoopArgs;

            await expect(engine.executeWithValidationLoop(args)).rejects.toThrow(/Abortando/);

            expect(mockLlmCall).toHaveBeenCalledTimes(2); 
            expect(mockContext.shouldAbort).toBe(true);
            expect(mockContext.abortReason).toContain('falhou em gerar uma saída válida após 2 tentativas');
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
                    content: '{"resultado": "sucesso"}', // O JSON que seu motor vai validar
                    raw: { response: 'Eu gosto de maçã' }
                }) 
                .mockResolvedValueOnce({ 
                    success: true,
                    content: '{"resultado": "sucesso"}', // O JSON que seu motor vai validar
                    raw: { response: 'Eu gosto de ABACAXI' }
                }); 
            const args = { config, ctx: mockContext, mockOptions } as executeWithValidationLoopArgs;
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
                userPrompt: 'Faz um plano.',
                expectedOutcomes: [{ 
                    type: OutcomeType.JSON,
                    schema: meuContrato 
                }]
            };
            
            // 1ª Resposta: Esqueceu-se do array de passos
            mockLlmCall.mockResolvedValueOnce({ 
                    success: true,
                    content: '{"resultado": "sucesso"}', // O JSON que seu motor vai validar
                    raw: { response: '{"tecnologia": "Node.js"}' }
                }); 
            
            // 2ª Resposta: IA corrigiu
            mockLlmCall.mockResolvedValueOnce({ 
                    success: true,
                    content: '{"resultado": "sucesso"}', // O JSON que seu motor vai validar
                    raw: { response: '{"tecnologia": "Node.js", "passos": ["instalar"]}' }
                });

            mockOptions = {
                ...mockOptions,
                format: meuContrato
            }
            const args = { config, ctx: mockContext, mockOptions } as executeWithValidationLoopArgs;
            const resultado = await engine.executeWithValidationLoop(args as executeWithValidationLoopArgs);

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

    describe('Testando o ollama sem mocar o modelo (Teste de Integração Real)', () => {
        
        // 👈 Adicionamos um tempo limite de 60 segundos no final do 'it' para dar tempo da IA pensar
        it('deve chamar o modelo real e retornar uma resposta coerente', async () => {
            
            // 1. DESLIGANDO O MOCK: 
            // Limpa o comportamento falso que foi definido no beforeEach
            mockLlmCall.mockRestore(); 
            
            // Se você ainda quiser contar quantas vezes a função foi chamada usando o expect(), 
            // você espiona novamente, mas DESTA VEZ sem colocar o .mockResolvedValue()
            mockLlmCall = jest.spyOn((engine as any).llmService, 'execute');
            const prompt = 'Crie uma lista de tarefas para desenvolver um cadastro de funcionários, usando node, typescrypt, react e prisma';
            
            const tarefa: JSONSchema7 = {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'ID da tarefa' },
                    titulo: { type: 'string', description: 'Título da tarefa' },
                    descricao: { type: 'string', description: 'Descrição detalhada passo a passo' },
                    ordem: { type: 'number', description: 'Ordem de execução das tarefa' },
                    dificuldade : { type: 'number', description: 'Um valor de 0% a 100%' },
                    escopo: { type: 'string', description: 'Escopo da tarefa: FRONTEND ou BACKEND' },
                }
            }
            
            const esquema : JSONSchema7 = {
                    type: 'array',
                    items: tarefa,
                }

            const outcome: ExpectedOutcome = {
                type: OutcomeType.JSON,
                schema: esquema
            }

            const config: AIExecutionConfig = {
                agentId: 'Jhon Doe',
                systemPrompt: 'Você é um assistente amigável.',
                userPrompt: prompt,
                expectedOutcomes: [ outcome ]
            };

            // 2. CONFIGURANDO PARA O OLLAMA:
            // Precisamos garantir que as opções mandem a requisição para o lugar certo
            const opcoesReaisParaOllama: LLMOptions = {
                provider: LLMProvider.OLLAMA,
                model: 'llama3.1:latest',
                timeout: 300000,
                format:  esquema as JSONSchema7
            };

            const args = { 
                config, 
                ctx: mockContext, 
                llmOptions: opcoesReaisParaOllama 
            } as executeWithValidationLoopArgs;            
            
            // 3. EXECUTA DE VERDADE (Vai bater no localhost:11434)
            const resultado = await engine.executeWithValidationLoop(args);

            // 4. VERIFICAÇÕES
            expect(mockLlmCall).toHaveBeenCalledTimes(1);
            
            // Verifica se os argumentos passados para a engine bateram com a realidade
            // Lembre-se que a engine injeta o system prompt no motor atual, então o texto exato pode variar 
            // dependendo de como sua engine monta a string final.
            const argumentoDoPrompt = mockLlmCall.mock.calls[0][0];
            expect(argumentoDoPrompt).toContain(prompt);
            
            // Verifica se a IA realmente respondeu algo (como pedimos ANY, ele devolve no rawOutput)
            expect(resultado).toBeDefined();
            expect(typeof resultado).toBe('object');
            expect(resultado[0]).toBeDefined();
            
            console.log("🤖 Resposta real do Ollama:", resultado.rawOutput);

        }, 300000); // ⏱️ TEMPO LIMITE DO JEST AUMENTADO PARA 60 SEGUNDOS AQUI!
    });

    describe('Testando o openclaw sem mocar o modelo (Teste de Integração Real)', () => {
        
        // 👈 Adicionamos um tempo limite de 60 segundos no final do 'it' para dar tempo da IA pensar
        it('deve chamar o modelo real e retornar uma resposta coerente', async () => {
            
            // 1. DESLIGANDO O MOCK: 
            // Limpa o comportamento falso que foi definido no beforeEach
            mockLlmCall.mockRestore(); 
            
            // Se você ainda quiser contar quantas vezes a função foi chamada usando o expect(), 
            // você espiona novamente, mas DESTA VEZ sem colocar o .mockResolvedValue()
            mockLlmCall = jest.spyOn((engine as any).llmService, 'execute');
            const prompt = 'Crie uma lista de tarefas para desenvolver um cadastro de funcionários, usando node, typescrypt, react e prisma';
            const comando: JSONSchema7 = {
                type: 'object',
                properties: {
                    comando: { type: 'string', description: 'Comando para executar' },
                }
            }

            const comandos: JSONSchema7 = {
                type: 'array',
                items: comando,
            }

            const tarefa: JSONSchema7 = {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'ID da tarefa' },
                    titulo: { type: 'string', description: 'Título da tarefa' },
                    descricao: { type: 'string', description: 'Descrição detalhada passo a passo' },
                    ordem: { type: 'number', description: 'Ordem de execução das tarefa' },
                    dificuldade : { type: 'number', description: 'Um valor de 0% a 100%' },
                    escopo: { type: 'string', description: 'Escopo da tarefa: FRONTEND ou BACKEND' },
                    comandos: comandos
                }
            }
            
            const esquema : JSONSchema7 = {
                    type: 'array',
                    items: tarefa,
                }

            const outcome: ExpectedOutcome = {
                type: OutcomeType.JSON,
                schema: esquema
            }

            const config: AIExecutionConfig = {
                agentId: 'analista-junior',
                systemPrompt: 'Você é um assistente amigável.',
                userPrompt: prompt,
                expectedOutcomes: [ outcome ]
            };

            // 2. CONFIGURANDO PARA O OLLAMA:
            // Precisamos garantir que as opções mandem a requisição para o lugar certo
            const opcoesReaisParaOpenclaw: LLMOptions = {
                provider: LLMProvider.OPENCLAW,
                model: 'llama3.1:latest',
                agentId: config.agentId,
                timeout: 600000,
                format:  esquema as JSONSchema7
            };

            const args = { 
                config, 
                ctx: mockContext, 
                llmOptions: opcoesReaisParaOpenclaw 
            } as executeWithValidationLoopArgs;            
            
            // 3. EXECUTA DE VERDADE (Vai bater no localhost:11434)
            const resultado = await engine.executeWithValidationLoop(args);

            // 4. VERIFICAÇÕES
            expect(mockLlmCall).toHaveBeenCalledTimes(1);
            
            // Verifica se os argumentos passados para a engine bateram com a realidade
            // Lembre-se que a engine injeta o system prompt no motor atual, então o texto exato pode variar 
            // dependendo de como sua engine monta a string final.
            const argumentoDoPrompt = mockLlmCall.mock.calls[0][0];
            expect(argumentoDoPrompt).toContain(prompt);
            
            // Verifica se a IA realmente respondeu algo (como pedimos ANY, ele devolve no rawOutput)
            expect(resultado).toBeDefined();
            expect(typeof resultado).toBe('object');
            expect(resultado[0]).toBeDefined();
            
            console.log("🤖 Resposta real do Ollama:", resultado.rawOutput);

        }, 600000); 
    });
    
});