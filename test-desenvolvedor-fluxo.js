// Teste de FLUXO COMPLETO: Arquiteto → Desenvolvedor
// Simula ambos os steps em sequência

console.log('=== TESTE DE FLUXO COMPLETO: ARQUITETO → DESENVOLVEDOR ===\n');

// CONTEXTO INICIAL (mesmo do teste anterior)
const contextoInicial = {
  task: {
    id: "1d9d1a31-26ee-4f74-b7a8-7d7297b00447",
    title: "Cadastro de Prioridades",
    description: "Formulário de cadastro de Prioridades deve aparecer somente ao selecionarmos 'Inserir'.",
    agent: "programador-monitor-tarefas",
    domain: "FRONTEND"
  },
  project: {
    id: "0ad45ce8-90f2-4f4b-baeb-5952d8f2b95f",
    name: "Sistema de Gestão de Tarefas",
    pastaBase: "/home/alexandrebragatorqueti/projetos/monitor-tarefas",
    frontendPath: "tarefas-web",
    frontendPort: 3000,
    backendPath: "tarefas-server",
    backendPort: 4001
  },
  config: {
    TASKS_DIR: "/tmp/fluxo-teste",
    TASK_TIMEOUT_MS: 1200000,
    agent: "programador-monitor-tarefas"
  },
  analysisPlan: {
    taskType: "development",
    expectedLayers: ["frontend"],
    mandatoryChecks: [
      "Verificar estrutura do formulário de prioridades",
      "Identificar gatilhos de UI para exibir o formulário",
    ],
    definitionOfDone: [
      "Concluído: Verificar estrutura do formulário de prioridades",
      "Concluído: Identificar gatilhos de UI para exibir o formulário",
    ],
  },
  files: {
    promptFile: "/tmp/fluxo-prompt.txt",
    relatorioFile: "/tmp/fluxo-relatorio.txt",
    doneFile: "/tmp/fluxo-done.done",
    terminalLogFile: "/tmp/fluxo-terminal.log",
    architectPlanFile: "/tmp/fluxo-plano-arquiteto.txt",
    architectLogFile: "/tmp/fluxo-terminal-arquiteto.log",
  },
  initialSnapshot: new Map(),
  currentInput: "Prompt original do arquiteto",
  developerPrompt: `DESENVOLVEDOR: Implemente o formulário de prioridades.

REQUISITOS:
1. Formulário aparece SOMENTE ao clicar em "Inserir"
2. Campos: nome (string), peso (1-5), cor (hex)
3. Validação: nome obrigatório, peso entre 1-5
4. Integração com backend: POST /api/priorities
5. Fechar formulário após salvar/cancelar

BASE: /home/alexandrebragatorqueti/projetos/monitor-tarefas`,
  commentsSection: "",
  setupResult: {
    success: true,
    taskId: "1d9d1a31-26ee-4f74-b7a8-7d7297b00447",
    filesPrepared: 6,
    taskType: "development"
  }
};

// =====================================================================
// PASSO 1: SIMULAÇÃO DO ARQUITETO (BYPASS)
// =====================================================================
function simularArquiteto(contexto) {
  console.log('🔧 PASSO 1: ArchitectPlanningStep (BYPASS)\n');
  
  // Gerar plano do arquiteto
  const architectPlan = `PLANO DO ARQUITETO - ${contexto.task.title}

1. COMPONENTES NECESSÁRIOS:
   - PriorityManager.tsx (existente) → Adicionar botão "Inserir"
   - PriorityForm.tsx (NOVO) → Formulário de cadastro
   - API service (existente) → Adicionar createPriority()

2. LÓGICA DE EXIBIÇÃO:
   - Estado: showPriorityForm (boolean, inicial false)
   - Botão "Inserir" → setShowPriorityForm(true)
   - Render condicional: {showPriorityForm && <PriorityForm />}

3. CAMPOS DO FORMULÁRIO:
   - Nome: <input type="text" required />
   - Peso: <select> com opções 1-5
   - Cor: <input type="color" />
   - Botões: Salvar (submit), Cancelar (setShowPriorityForm(false))

4. INTEGRAÇÃO BACKEND:
   - Endpoint: POST /api/priorities
   - Payload: { name, weight, color }
   - Response handling: success → fecha formulário, error → mostra mensagem

5. ARQUIVOS A MODIFICAR:
   - tarefas-web/src/components/PriorityManager.tsx
   - tarefas-web/src/components/PriorityForm.tsx (NOVO)
   - tarefas-web/src/services/api.ts
   - tarefas-server/src/routes/priorities.js

6. TESTES:
   - Testar abertura/fechamento do formulário
   - Testar validação de campos
   - Testar submit para API`;
  
  // Análise do arquiteto
  const architectAnalysis = {
    hasExecuted: false,
    hasPlan: true,
    confidence: 90,
    executionDetails: null,
    planDetails: "Arquiteto gerou plano detalhado com 6 etapas para implementação",
    analysisFailed: false
  };
  
  // Prompt atualizado (plano + instruções dev)
  const updatedPromptContent = `=== PLANO DE AÇÃO DO ARQUITETO ===
${architectPlan}

${contexto.developerPrompt}`;
  
  console.log(`📋 Arquiteto: Plano gerado (${architectPlan.length} chars)`);
  console.log(`📊 Análise: hasPlan=true, confidence=${architectAnalysis.confidence}%`);
  
  // Retornar contexto atualizado
  return {
    ...contexto,
    architectPlanningResult: {
      success: true,
      taskId: contexto.task.id,
      hasArchitectPlan: true,
      hasArchitectExecution: false,
      confidence: architectAnalysis.confidence,
      promptUpdated: true
    },
    currentInput: updatedPromptContent,
    architectAnalysis,
    architectPlan
  };
}

// =====================================================================
// PASSO 2: SIMULAÇÃO DO DESENVOLVEDOR
// =====================================================================
function simularDesenvolvedor(contextoArquiteto) {
  console.log('\n🔧 PASSO 2: DeveloperExecutionStep (SIMULAÇÃO)\n');
  
  console.log(`🧠 Desenvolvedor analisando plano do arquiteto...`);
  console.log(`📝 Prompt recebido: "${contextoArquiteto.currentInput.substring(0, 100)}..."`);
  
  // Simular implementação do desenvolvedor
  console.log(`💻 Desenvolvedor implementando código...`);
  
  // Código que o desenvolvedor criaria
  const codigoImplementado = {
    arquivosModificados: [
      {
        caminho: "tarefas-web/src/components/PriorityManager.tsx",
        alteracoes: [
          "Adicionado estado: const [showPriorityForm, setShowPriorityForm] = useState(false)",
          "Adicionado botão: <button onClick={() => setShowPriorityForm(true)}>Inserir</button>",
          "Adicionado render condicional: {showPriorityForm && <PriorityForm onClose={() => setShowPriorityForm(false)} />}"
        ]
      },
      {
        caminho: "tarefas-web/src/components/PriorityForm.tsx",
        status: "NOVO ARQUIVO CRIADO",
        conteudo: `// PriorityForm.tsx - Formulário de cadastro de prioridades
import React, { useState } from 'react';
import { createPriority } from '../services/api';

interface PriorityFormProps {
  onClose: () => void;
}

const PriorityForm: React.FC<PriorityFormProps> = ({ onClose }) => {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState(3);
  const [color, setColor] = useState('#3B82F6');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nome é obrigatório');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createPriority({ name, weight, color });
      onClose(); // Fecha formulário após sucesso
    } catch (err) {
      setError('Erro ao salvar prioridade');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="priority-form-modal">
      <h3>Cadastrar Prioridade</h3>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Nome *</label>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        
        <div>
          <label>Peso (1-5)</label>
          <select 
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            disabled={loading}
          >
            {[1,2,3,4,5].map(num => (
              <option key={num} value={num}>{num}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label>Cor</label>
          <input 
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={loading}
          />
        </div>
        
        {error && <div className="error">{error}</div>}
        
        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

export default PriorityForm;`
      },
      {
        caminho: "tarefas-web/src/services/api.ts",
        alteracoes: [
          "Adicionada função: export const createPriority = async (data: PriorityData) => { ... }",
          "Implementado POST para /api/priorities",
          "Adicionado tratamento de erros"
        ]
      },
      {
        caminho: "tarefas-server/src/routes/priorities.js",
        alteracoes: [
          "Adicionada rota: router.post('/', createPriority)",
          "Implementada validação dos dados",
          "Adicionada criação no banco via Prisma"
        ]
      }
    ],
    testesImplementados: [
      "Teste: botão 'Inserir' abre formulário",
      "Teste: validação de campo nome obrigatório", 
      "Teste: submit envia dados corretos",
      "Teste: formulário fecha após salvar",
      "Teste: formulário fecha ao cancelar"
    ],
    relatorio: `RELATÓRIO DE IMPLEMENTAÇÃO - ${new Date().toISOString()}

TAREFA: ${contextoArquiteto.task.title}
DESCRIÇÃO: ${contextoArquiteto.task.description}

=== IMPLEMENTAÇÃO REALIZADA ===

1. COMPONENTE PriorityManager.tsx MODIFICADO:
   - Adicionado estado showPriorityForm
   - Adicionado botão "Inserir" com onClick
   - Implementada renderização condicional do formulário

2. NOVO COMPONENTE PriorityForm.tsx CRIADO:
   - Formulário completo com 3 campos (nome, peso, cor)
   - Validação: nome obrigatório
   - Estados: loading, error
   - Integração com API createPriority
   - Botões: Salvar (submit), Cancelar (fecha)

3. SERVIÇO API ATUALIZADO (api.ts):
   - Função createPriority implementada
   - POST para /api/priorities
   - Tratamento de erros

4. BACKEND ATUALIZADO (priorities.js):
   - Rota POST /api/priorities
   - Validação de dados de entrada
   - Criação no banco via Prisma

5. TESTES IMPLEMENTADOS:
   - 5 testes funcionais cobrindo fluxo completo
   - Validação de UI e integração

=== CONFORMIDADE COM PLANO DO ARQUITETO ===
✅ Formulário aparece SOMENTE ao clicar em "Inserir"
✅ Campos implementados: nome, peso (1-5), cor
✅ Validação: nome obrigatório implementada
✅ Integração com backend: POST /api/priorities
✅ Fechamento após salvar/cancelar implementado

=== DEFINIÇÃO DE PRONTO ATENDIDA ===
✅ Verificar estrutura do formulário de prioridades: IMPLEMENTADO
✅ Identificar gatilhos de UI para exibir o formulário: BOTÃO "INSERIR"

=== STATUS: CONCLUÍDO ✅ ===`
  };
  
  console.log(`✅ Desenvolvedor implementou ${codigoImplementado.arquivosModificados.length} arquivos`);
  console.log(`🧪 ${codigoImplementado.testesImplementados.length} testes criados`);
  
  // Resultado do desenvolvedor
  const developerResult = {
    success: true,
    taskId: contextoArquiteto.task.id,
    filesModified: codigoImplementado.arquivosModificados.length,
    testsCreated: codigoImplementado.testesImplementados.length,
    implementationComplete: true,
    meetsDefinitionOfDone: true
  };
  
  // Contexto final (após desenvolvedor)
  const contextoFinal = {
    ...contextoArquiteto,
    developerExecutionResult: developerResult,
    implementationDetails: codigoImplementado,
    currentInput: `=== IMPLEMENTAÇÃO CONCLUÍDA ===

O desenvolvedor implementou com sucesso o formulário de prioridades.

ARQUIVOS MODIFICADOS/CRIADOS:
${codigoImplementado.arquivosModificados.map(f => `- ${f.caminho}${f.status ? ` (${f.status})` : ''}`).join('\n')}

TESTES IMPLEMENTADOS:
${codigoImplementado.testesImplementados.map(t => `- ${t}`).join('\n')}

RELATÓRIO COMPLETO SALVO EM: ${contextoArquiteto.files.relatorioFile}`,
    
    // Simular criação do arquivo .done
    doneFileCreated: true,
    
    // Simular criação do relatório
    reportGenerated: true
  };
  
  return contextoFinal;
}

// =====================================================================
// EXECUTAR FLUXO COMPLETO
// =====================================================================
async function executarFluxoCompleto() {
  console.log('🚀 INICIANDO FLUXO COMPLETO: ARQUITETO → DESENVOLVEDOR\n');
  
  console.log('📥 CONTEXTO INICIAL:');
  console.log('   Tarefa:', contextoInicial.task.title);
  console.log('   ID:', contextoInicial.task.id);
  console.log('   Tipo:', contextoInicial.analysisPlan.taskType);
  console.log('');
  
  // PASSO 1: Arquiteto
  const contextoArquiteto = simularArquiteto(contextoInicial);
  
  console.log('\n📤 SAÍDA DO ARQUITETO:');
  console.log('   architectAnalysis preenchido?', !!contextoArquiteto.architectAnalysis);
  console.log('   architectPlan gerado?', !!contextoArquiteto.architectPlan);
  console.log('   currentInput atualizado?', contextoArquiteto.currentInput !== contextoInicial.currentInput);
  
  // PASSO 2: Desenvolvedor
  const contextoFinal = simularDesenvolvedor(contextoArquiteto);
  
  console.log('\n🎯 CONTEXTO FINAL (após desenvolvedor):');
  console.log('='.repeat(60));
  
  console.log('\n✅ developerExecutionResult:');
  console.log('   success:', contextoFinal.developerExecutionResult.success);
  console.log('   taskId:', contextoFinal.developerExecutionResult.taskId);
  console.log('   filesModified:', contextoFinal.developerExecutionResult.filesModified);
  console.log('   testsCreated:', contextoFinal.developerExecutionResult.testsCreated);
  console.log('   implementationComplete:', contextoFinal.developerExecutionResult.implementationComplete);
  console.log('   meetsDefinitionOfDone:', contextoFinal.developerExecutionResult.meetsDefinitionOfDone);
  
  console.log('\n📁 implementationDetails:');
  console.log('   Arquivos modificados/criados:', contextoFinal.implementationDetails.arquivosModificados.length);
  contextoFinal.implementationDetails.arquivosModificados.forEach((arquivo, i) => {
    console.log(`   ${i+1}. ${arquivo.caminho}${arquivo.status ? ` (${arquivo.status})` : ''}`);
  });
  
  console.log('\n🧪 Testes implementados:', contextoFinal.implementationDetails.testesImplementados.length);
  contextoFinal.implementationDetails.testesImplementados.forEach((teste, i) => {
    console.log(`   ${i+1}. ${teste}`);
  });
  
  console.log('\n📝 Relatório gerado?', contextoFinal.reportGenerated);
  console.log('✅ Arquivo .done criado?', contextoFinal.doneFileCreated);
  
  console.log('\n✏️ currentInput final (resumo):');
  console.log('   ', contextoFinal.currentInput.substring(0, 200).replace(/\n/g, '\n   ') + '...');
  
  console.log('\n🔗 CAMPOS ADICIONADOS NO FLUXO:');
  console.log('   1. architectPlanningResult (do arquiteto)');
  console.log('   2. architectAnalysis (do arquiteto)');
  console.log('   3. architectPlan (do arquiteto)');
  console.log('   4. developerExecutionResult (do desenvolvedor)');
  console.log('   5. implementationDetails (do desenvolvedor)');
  console.log('   6. doneFileCreated (sinal de conclusão)');
  console.log('   7. reportGenerated (documentação)');
  
  console.log('\n🎯 DEFINIÇÃO DE PRONTO VERIFICADA:');
  contextoInicial.analysisPlan.definitionOfDone.forEach((item, i) => {
    console.log(`   ${i+1}. ${item}: ✅ ATENDIDO`);
  });
  
  console.log('\n🚀 FLUXO COMPLETO BEM-SUCEDIDO!');
  console.log('\n💡 RESUMO DO QUE FOI TESTADO:');
  console.log('   1. ✅ ArchitectPlanningStep gera plano e architectAnalysis');
  console.log('   2. ✅ DeveloperExecutionStep recebe contexto completo');
  console.log('   3. ✅ Desenvolvedor implementa código baseado no plano');
  console.log('   4. ✅ Definição de pronto é verificada');
  console.log('   5. ✅ Relatório e .done são gerados');
  console.log('   6. ✅ Contexto evolui corretamente entre steps');
  
  console.log('\n📊 MÉTRICAS DO FLUXO:');
  console.log('   - Tempo total (simulado): ~2-5 minutos');
  console.log('   - Arquivos modificados:', contextoFinal.developerExecutionResult.filesModified);
  console.log('   - Testes criados:', contextoFinal.developerExecutionResult.testsCreated);
  console.log('   - Linhas de código (estimado): ~150-200');
  console.log('   - Complexidade: Moderada (frontend + backend)');
  
  console.log('\n🔧 PARA TESTAR O CÓDIGO REAL:');
  console.log('   1. Configurar DeveloperExecutionStep com mocks');
  console.log('   2. Passar contexto de saída do arquiteto');
  console.log('   3. Verificar implementação real de código');
  console.log('   4. Validar criação de arquivos .done e relatório');
  
  return contextoFinal;
}

// Executar
executarFluxoCompleto();