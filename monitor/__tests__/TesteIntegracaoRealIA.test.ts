// /home/alexandrebragatorqueti/projetos/monitor-tarefas/tarefas-server/monitor/__tests__/TesteIntegracaoRealIA.test.ts
// Teste de integração REAL com IA usando OpenClaw real
// AVISO: Este teste pode custar tokens e levar tempo considerável

import { PassoDecompoeTarefaAdapter } from '../passos/adapters/DecomposicaoAdapter';
import { LogicaDecomposicao } from '../passos/atomicos/PassoDecompoeTarefa';
import { FabricaPromptsIA } from '../utils/FabricaPrompts';
import {
  criarLoggerMock,
  criarContextoMock,
  criarTarefaFake,
} from './fixtures/fabricaMocks';

// Configurações do ambiente de teste real
const CONFIG_TESTE = {
  BASE_DIR: '/home/alexandrebragatorqueti/testes_reais_IA',
  FRONT_DIR: '/home/alexandrebragatorqueti/testes_reais_IA/front_teste',
  BACK_DIR: '/home/alexandrebragatorqueti/testes_reais_IA/back_teste',
  LOCK_DIR: '/tmp/test_monitor/locks',
  PLAN_DIR: '/tmp/test_monitor/plans',
  REPORT_DIR: '/tmp/test_monitor/reports',
  
  // Configuração dos agentes e modelo
  AGENTE_ANALISTA: 'analista-junior',
  AGENTE_PROGRAMADOR: 'programador-junior',
  MODELO_AUXILIAR: 'deepseek/deepseek-chat', // modelo padrão se não tiver deepseek-r1:32b
  
  // Configuração da tarefa mock (usando factory para garantir tipo correto)
  TAREFA_MOCK: criarTarefaFake({
    id: 9999,
    title: 'Sistema de Gestão Empresarial',
    description: 'Crie um sistema para administrar uma pequena empresa, com cadastro de usuarios, login, controle de funcionários, cargos, salários e controle de ponto dos funcionários.',
    isAtomic: false,
    domain: null,
  }),
} as const;

describe('Teste de Integração REAL com IA (Decomposição)', () => {
  // Este teste é marcado como "lento" e "integração"
  // Jest: --testTimeout=60000
  
  beforeAll(async () => {
    // Criar estrutura de diretórios para o teste
    const fs = require('fs').promises;
    await fs.mkdir(CONFIG_TESTE.BASE_DIR, { recursive: true });
    await fs.mkdir(CONFIG_TESTE.FRONT_DIR, { recursive: true });
    await fs.mkdir(CONFIG_TESTE.BACK_DIR, { recursive: true });
    await fs.mkdir(CONFIG_TESTE.LOCK_DIR, { recursive: true });
    await fs.mkdir(CONFIG_TESTE.PLAN_DIR, { recursive: true });
    await fs.mkdir(CONFIG_TESTE.REPORT_DIR, { recursive: true });
  });

  it('deve decompor uma tarefa não-atômica usando IA real', async () => {
    // SKIP se não houver configuração do OpenClaw disponível
    if (!process.env.OPENCLAW_API_KEY) {
      console.warn('⚠️  OPENCLAW_API_KEY não configurada. Pulando teste de IA real.');
      return;
    }

    const logger = criarLoggerMock();
    
    // Usar serviço REAL de análise (não mockado)
    const { ServicoAnalistaLegacy } = require('../monitoramento');
    const analista = new ServicoAnalistaLegacy();

    // Criar prompt especializado usando a nova fábrica
    const promptDecomposicao = FabricaPromptsIA.gerarPromptDecomposicao(CONFIG_TESTE.TAREFA_MOCK);

    const passoPuro = new LogicaDecomposicao({ logger, analista });
    
    const input = {
      tarefaAtual: CONFIG_TESTE.TAREFA_MOCK,
      userId: 'test-user',
      prompt: promptDecomposicao,
    };

    console.log('🧪 Iniciando chamada REAL para IA...');
    console.log(`📝 Prompt enviado: ${promptDecomposicao.substring(0, 200)}...`);
    
    const resultado = await passoPuro.execute(input);

    console.log(`✅ Resposta da IA: ${JSON.stringify(resultado)}`);
    
    // Validações básicas
    expect(resultado.sucesso).toBe(true);
    expect(resultado.quantidadeSubtarefas).toBeGreaterThan(0);
    
    // Log para inspeção manual
    console.log(`📊 Subtarefas criadas: ${resultado.quantidadeSubtarefas}`);
  }, 120000); // Timeout de 2 minutos para a IA

  it('deve executar adapter de decomposição com contexto real', async () => {
    if (!process.env.OPENCLAW_API_KEY) {
      console.warn('⚠️  OPENCLAW_API_KEY não configurada. Pulando teste de IA real.');
      return;
    }

    const logger = criarLoggerMock();
    const { ServicoAnalistaLegacy } = require('../monitoramento');
    const analista = new ServicoAnalistaLegacy();

    const promptDecomposicao = FabricaPromptsIA.gerarPromptDecomposicao(CONFIG_TESTE.TAREFA_MOCK);

    const adapter = new PassoDecompoeTarefaAdapter({ logger, analista });
    const ctx = criarContextoMock({
      tarefaAtual: CONFIG_TESTE.TAREFA_MOCK,
      config: {
        TASKS_DIR: CONFIG_TESTE.BASE_DIR,
        API_URL: 'http://localhost:3000', // Mock, não será usado
        FRONTEND_DIR: CONFIG_TESTE.FRONT_DIR,
        BACKEND_DIR: CONFIG_TESTE.BACK_DIR,
      } as any,
    });

    // Forçar o prompt no contexto para uso pelo adapter
    (ctx as any).promptDecomposicao = promptDecomposicao;

    await adapter.execute(ctx);

    expect(ctx.resultados.decomposicao).toBeDefined();
    expect(ctx.resultados.decomposicao?.sucesso).toBe(true);
    expect(ctx.resultados.decomposicao?.subtasksCreated).toBeGreaterThan(0);
    
    console.log(`🎯 Contexto mutado com sucesso: ${JSON.stringify(ctx.resultados.decomposicao)}`);
  }, 120000);
});
