// monitor/__tests__/integracao_real/DecomposicaoReal.test.ts
// Teste REAL de decomposição usando IA com analista-junior e qwen3.5:9b

import { FabricaPromptsIA } from '../../utils/fabricaPrompts';
import { criarTarefaFake } from '../fixtures/fabricaMocks';

// Configurações do teste
const CONFIG = {
  AGENTE_ANALISTA: 'analista-junior',
  MODELO_AUXILIAR: 'qwen3.5:9b',
  BASE_DIR: '/home/alexandrebragatorqueti/testes_reais_IA',
  FRONT_DIR: '/home/alexandrebragatorqueti/testes_reais_IA/front_teste',
  BACK_DIR: '/home/alexandrebragatorqueti/testes_reais_IA/back_teste',
  TIMEOUT_MS: 120000, // 2 minutos para IA
};

// Mock de tarefa não-atômica
const TAREFA_MOCK = criarTarefaFake({
  id: 9999,
  title: 'Sistema de Gestão Empresarial',
  description: 'Crie um sistema para administrar uma pequena empresa, com cadastro de usuarios, login, controle de funcionários, cargos, salários e controle de ponto dos funcionários.',
  isAtomic: false,
  domain: null,
});

const hasApiKey = !!process.env.OPENCLAW_API_KEY;
const describeOrSkip = hasApiKey ? describe : describe.skip;

describeOrSkip('Decomposição REAL com IA (analista-junior + qwen3.5:9b)', () => {
  // Se não houver chave, describe.skip será usado e este bloco não executará

  beforeAll(async () => {
    // Garantir que diretórios existam
    const fs = require('fs').promises;
    await fs.mkdir(CONFIG.BASE_DIR, { recursive: true });
    await fs.mkdir(CONFIG.FRONT_DIR, { recursive: true });
    await fs.mkdir(CONFIG.BACK_DIR, { recursive: true });
  });

  it('deve gerar subtarefas válidas para uma tarefa não-atômica', async () => {
    // 1. Gerar prompt especializado usando a nova fábrica
    const prompt = FabricaPromptsIA.gerarPromptDecomposicao(TAREFA_MOCK);

    console.log(`📝 Prompt gerado (${prompt.length} chars):\n---\n${prompt.substring(0, 500)}...\n---`);

    // 2. Chamar OpenClaw real
    const OpenClawService = require('../../../src/services/openclawService');
    
    const sessionId = `test-decomposicao-${Date.now()}`;
    const terminalLogFile = `/tmp/test_monitor/reports/${sessionId}.log`;
    
    console.log(`🚀 Invocando agente ${CONFIG.AGENTE_ANALISTA} com modelo ${CONFIG.MODELO_AUXILIAR}...`);
    
    const resultado = await OpenClawService.executeOptimized(
      sessionId,
      prompt,
      CONFIG.AGENTE_ANALISTA,
      CONFIG.MODELO_AUXILIAR,
      CONFIG.BASE_DIR, // tasksDir
      terminalLogFile,
      CONFIG.BASE_DIR, // projectPath
      CONFIG.TIMEOUT_MS,
      {
        enableBrowser: false,
        enableElevated: false,
        enableThinking: true,
        fallbackAgent: 'main',
        maxRetries: 1
      }
    );

    console.log(`📦 Resposta da IA (sucesso: ${resultado.success}): ${resultado.rawOutput?.length || 0} chars`);
    
    if (!resultado.success) {
      console.error('❌ OpenClaw error:', resultado.errorMessage);
      console.error('Raw output:', resultado.rawOutput);
    }
    
    // 3. Validar que a resposta contém JSON com subtarefas
    expect(resultado.success).toBe(true);
    expect(resultado.rawOutput).toBeTruthy();
    
    // Tentar extrair JSON da resposta (pode estar em markdown code block)
    const raw = resultado.rawOutput;
    let jsonStr = raw;
    
    // Tentar extrair bloco ```json ... ```
    const jsonBlockMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1];
    } else {
      // Tentar extrair bloco ``` ... ```
      const genericBlockMatch = raw.match(/```\s*([\s\S]*?)\s*```/);
      if (genericBlockMatch) {
        jsonStr = genericBlockMatch[1];
      }
    }
    
    console.log(`🔍 JSON extraído (${jsonStr.length} chars):\n---\n${jsonStr.substring(0, 500)}...\n---`);
    
    // 4. Parsear JSON e validar estrutura
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      // Se falhar, tentar parsear a raw output diretamente
      try {
        parsed = JSON.parse(raw);
      } catch (e2) {
        // Falha total
        console.error('❌ Falha ao parsear JSON:', e2.message);
        console.error('Conteúdo raw:', raw.substring(0, 1000));
        throw new Error('Resposta da IA não é JSON válido');
      }
    }
    
    // Validar estrutura básica esperada (conforme prompt)
    expect(parsed).toBeDefined();
    expect(typeof parsed.precisaDividir).toBe('boolean');
    expect(Array.isArray(parsed.subtarefas)).toBe(true);
    
    const subtarefas = parsed.subtarefas;
    console.log(`✅ precisaDividir: ${parsed.precisaDividir}, subtarefas: ${subtarefas.length}`);
    
    // Se a tarefa é não-atômica, esperamos que precise dividir
    if (!TAREFA_MOCK.isAtomic) {
      expect(parsed.precisaDividir).toBe(true);
      expect(subtarefas.length).toBeGreaterThan(0);
    }
    
    // Validar cada subtarefa (se houver)
    subtarefas.forEach((subtarefa: any, index: number) => {
      expect(subtarefa.title).toBeTruthy();
      expect(subtarefa.description).toBeTruthy();
      expect(subtarefa.domain).toMatch(/^(FRONTEND|BACKEND|FULLSTACK)$/);
      console.log(`   ${index + 1}. ${subtarefa.title} [${subtarefa.domain}]`);
    });
    
    // 5. Salvar resultado para inspeção manual
    const fs = require('fs').promises;
    const reportDir = '/tmp/test_monitor/reports';
    await fs.mkdir(reportDir, { recursive: true });
    
    const reportFile = `${reportDir}/decomposicao_${Date.now()}.json`;
    await fs.writeFile(reportFile, JSON.stringify({
      prompt,
      rawOutput: raw,
      parsed,
      subtarefasCount: subtarefas.length,
      timestamp: new Date().toISOString(),
    }, null, 2));
    
    console.log(`📄 Relatório salvo em: ${reportFile}`);
  }, CONFIG.TIMEOUT_MS + 30000); // Timeout maior que o da IA
});
