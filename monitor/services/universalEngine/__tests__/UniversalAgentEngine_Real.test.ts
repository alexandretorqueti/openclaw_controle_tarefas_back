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
import { retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacaoSchema }
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
                model: 'qwen3-coder:30b',
                timeout: 300000,
                format:  esquema as JSONSchema7
            };

            const args = {
                configIA: config as AIExecutionConfig, 
                config: {} as ConfiguracaoMonitor, 
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
            const comando = z.object({
                comando: z.string().describe('Comando para executar')
            })
            
            const comandos = z.array(comando);
            
            const tarefa = z.object({
                id: z.string().describe('ID da tarefa'),
                titulo: z.string().describe('Título da tarefa'),
                descricao: z.string().describe('Descrição detalhada passo a passo'),
                ordem: z.number().describe('Ordem de execução das tarefa'),
                dificuldade : z.number().describe('Um valor de 0% a 100%'),
                escopo: z.string().describe('Escopo da tarefa: FRONTEND ou BACKEND'),
                comandos: comandos
            })

            const esquemaZod = z.array(tarefa);

            const esquema: JSONSchema7 = zodToJsonSchema(esquemaZod) as JSONSchema7;

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

            // 2. CONFIGURANDO PARA O OPENCLAW:
            // Precisamos garantir que as opções mandem a requisição para o lugar certo
            const opcoesReaisParaOpenclaw: LLMOptions = {
                provider: LLMProvider.OPENCLAW,
                model: 'qwen3:4b',
                agentId: config.agentId,
                timeout: 600000,
                format:  esquema as JSONSchema7
            };

            const args: executeWithValidationLoopArgs = { 
                configIA: config as AIExecutionConfig, 
                config: {} as ConfiguracaoMonitor,
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
            
            console.log("🤖 Resposta real do Ollama:", resultado);

        }, 600000); 
    });
    
    describe('Testando passo 2 - PreAnaliseEscopoTarefas', () => {
        it('deve chamar o modelo real e retornar uma resposta coerente', async () => {
            mockLlmCall.mockRestore();
            const prompt = 'Desenvolva um sistema para controle de borracharia';

            const deps: DependenciasPreAnaliseEscopoTarerefa = {
                logger: log,
                FabricaPromptsIA: new FabricaPromptsIA(),
                motorUniversal: engine
            };

            const mockProject = {
                id: 'project-123',
                name: 'Sistema para borracharia',
                frontendPath: 'frontend',
                backendPath: 'backend',
                pastaBase: '/projeto/sistema-borracharia/',
                modeloAuxiliar: 'qwen3.5:9b',
            } as Project
            mockContextStepPreAnalise = {
                tarefaAtual: { id: 'task-123',
                    title: 'Sistema para borracharia',
                    description: 'Desenvolva um sistema para controle de borracharia',
                    isCompleted: false,
                    isRecurring: false,
                    project: mockProject as Project
            } as TarefaCompleta,
                project: mockProject as Project,
                config: {
                    TASK_TIMEOUT_MS: 600000000,

                } as ConfiguracaoMonitor,
                configIA: {
                   agentId: 'analista-junior',
                   systemPrompt: 'Voce é um assistente amigável.',
                   userPrompt: prompt,
                   expectedOutcomes: retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacaoSchema,
                   maxRetries: 2,
                } as AIExecutionConfig,
                services: {} as ServicosDoMonitor,
                utils: {} as UtilidadesDoMonitor,
            } as ContextoExecucao;
            // TODO CONTINUAR DAQUI

            const preAnalise = new passoPreAnaliseEscopoTarerefa(deps);

            const resultado = await preAnalise.execute(mockContextStepPreAnalise);

        }, 60000);
    });
});