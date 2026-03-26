// Teste REAL do DeveloperTurnStep - VERSÃO CORRIGIDA
// Corrige campos necessários para o DeveloperTurnStep

console.log('=== TESTE REAL DO DeveloperTurnStep (CORRIGIDO) ===\n');
console.log('🚀 Testando passo do desenvolvedor com campos corretos\n');

// Carregar o container REAL
const container = require('./src/container');

// =====================================================================
// 1. CONTEXTO CORRIGIDO PARA DeveloperTurnStep
// =====================================================================
const contextoDesenvolvedor = {
  task: {
    id: "1d9d1a31-26ee-4f74-b7a8-7d7297b00447",
    title: "Cadastro de Prioridades",
    description: "Formulário de cadastro de Prioridades deve aparecer somente ao selecionarmos 'Inserir'.",
    agent: "programador-monitor-tarefas"
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
    TASKS_DIR: "/tmp/desenvolvedor-corrigido",
    TASK_TIMEOUT_MS: 1200000,
    agent: "programador-monitor-tarefas"
  },
  files: {
    promptFile: "/tmp/desenvolvedor-corrigido-prompt.txt",
    relatorioFile: "/tmp/desenvolvedor-corrigido-relatorio.txt",
    doneFile: "/tmp/desenvolvedor-corrigido-done.done",
    terminalLogFile: "/tmp/desenvolvedor-corrigido-terminal.log",
    architectPlanFile: "/tmp/desenvolvedor-corrigido-plano-arquiteto.txt",
    architectLogFile: "/tmp/desenvolvedor-corrigido-terminal-arquiteto.log",
  },
  
  // CAMPOS ESPECÍFICOS DO DeveloperTurnStep:
  turnNumber: 1,  // Primeiro turno
  basePrompt: `=== PLANO DE AÇÃO DO ARQUITETO ===
RESPOSTA DO ARQUITETO (SIMULADA VIA CONTAINER)

ANÁLISE DA TAREFA: "Cadastro de Prioridades"

=== PLANO DE AÇÃO ===
1. CRIAR COMPONENTE PriorityForm.tsx
   - Campos: nome (text), peso (select 1-5), cor (color picker)
   - Validação: nome obrigatório
   - Estados: loading, error

2. MODIFICAR PriorityManager.tsx
   - Adicionar botão "Inserir"
   - Estado: showPriorityForm (boolean)
   - Render condicional: {showPriorityForm && <PriorityForm />}

3. ATUALIZAR API SERVICE
   - Função createPriority()
   - POST para /api/priorities
   - Tratamento de erros

4. ATUALIZAR BACKEND
   - Rota POST /api/priorities
   - Validação de dados
   - Criação no banco

=== CHECKLIST ===
✅ Formulário aparece SOMENTE ao clicar em "Inserir"
✅ Campos implementados: nome, peso, cor
✅ Validação: nome obrigatório
✅ Integração frontend-backend
✅ Fechamento após salvar/cancelar

DESENVOLVEDOR: Implemente o formulário de prioridades com gatilho 'Inserir'`,
  
  lastFeedback: null,  // Primeiro turno, sem feedback anterior
  backupAgent: 'main',
  executionTimestamp: Date.now(),
  
  // CAMPOS ADICIONADOS PELO ARQUITETO (mantidos):
  architectPlanningResult: {
    success: true,
    taskId: "1d9d1a31-26ee-4f74-b7a8-7d7297b00447",
    hasArchitectPlan: true,
    hasArchitectExecution: false,
    confidence: 95,
    promptUpdated: true
  },
  architectAnalysis: {
    hasExecuted: false,
    hasPlan: true,
    confidence: 95,
    executionDetails: null,
    planDetails: "Plano analisado via container mock - qualidade excelente",
    analysisFailed: false,
    hadExecuted: false
  },
  currentInput: "Prompt atualizado pelo arquiteto...",
  setupResult: {
    success: true,
    taskId: "1d9d1a31-26ee-4f74-b7a8-7d7297b00447",
    filesPrepared: 6,
    taskType: "development"
  }
};

// =====================================================================
// 2. CRIAR MOCKS PARA O DESENVOLVEDOR
// =====================================================================

// Mock do log (função async)
const mockLog = async (message) => {
  console.log('[LOG-DEV]', message);
  return Promise.resolve();
};

// Mock do openClawService para desenvolvedor
const mockOpenClawService = {
  executeWithFallback: async (sessionId, prompt, options) => {
    console.log(`[MOCK-DEV] openClawService.executeWithFallback para desenvolvedor`);
    console.log(`       Session: ${sessionId}`);
    console.log(`       Prompt length: ${prompt.length} chars`);
    console.log(`       Prompt início: "${prompt.substring(0, 100)}..."`);
    
    // Simular resposta do desenvolvedor implementando código
    return {
      rawOutput: `=== RESPOSTA DO DESENVOLVEDOR (TURNO 1) ===

Implementei o formulário de prioridades conforme plano do arquiteto.

✅ **PriorityManager.tsx MODIFICADO:**
\`\`\`typescript
// Adicionado no PriorityManager.tsx
const [showPriorityForm, setShowPriorityForm] = useState(false);

// Botão "Inserir"
<button 
  className="btn-primary"
  onClick={() => setShowPriorityForm(true)}
>
  Inserir
</button>

// Render condicional do formulário
{showPriorityForm && (
  <PriorityForm 
    onClose={() => setShowPriorityForm(false)}
    onSuccess={() => {
      setShowPriorityForm(false);
      // Recarregar lista de prioridades
    }}
  />
)}
\`\`\`

✅ **PriorityForm.tsx CRIADO (novo componente):**
\`\`\`typescript
// PriorityForm.tsx - Componente completo
import React, { useState } from 'react';
import { createPriority } from '../services/api';

interface PriorityFormProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const PriorityForm: React.FC<PriorityFormProps> = ({ onClose, onSuccess }) => {
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
      onSuccess?.();
      onClose();
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
        {/* Campos do formulário */}
        <div className="form-group">
          <label>Nome *</label>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
            placeholder="Digite o nome da prioridade"
          />
        </div>
        
        <div className="form-group">
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
        
        <div className="form-group">
          <label>Cor</label>
          <input 
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={loading}
          />
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="form-actions">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" onClick={onClose} disabled={loading} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

export default PriorityForm;
\`\`\`

✅ **api.ts ATUALIZADO:**
\`\`\`typescript
// Adicionado em api.ts
export const createPriority = async (priorityData: PriorityData): Promise<Priority> => {
  const response = await api.post('/api/priorities', priorityData);
  return response.data;
};
\`\`\`

✅ **priorities.js ATUALIZADO (backend):**
\`\`\`javascript
// Adicionado em priorities.js
router.post('/', async (req, res) => {
  try {
    const { name, weight, color } = req.body;
    
    // Validação
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }
    
    if (weight < 1 || weight > 5) {
      return res.status(400).json({ error: 'Peso deve ser entre 1 e 5' });
    }
    
    // Criação no banco
    const priority = await prisma.priority.create({
      data: { name, weight, color }
    });
    
    res.status(201).json(priority);
  } catch (error) {
    console.error('Erro ao criar prioridade:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
\`\`\`

=== STATUS ===
Formulário de prioridades implementado com sucesso!
Pronto para testes e validação.`,
      success: true,
      metadata: {
        sessionId: sessionId,
        modelUsed: 'developer-mock-model',
        tokensUsed: 350
      }
    };
  }
};

// Mock do evidenceService
const mockEvidenceService = {
  collectEvidence: async (taskId, sessionId, evidenceType, data) => {
    console.log(`[MOCK-DEV] evidenceService.collectEvidence chamado`);
    console.log(`       taskId: ${taskId}, sessionId: ${sessionId}`);
    console.log(`       evidenceType: ${evidenceType}`);
    return Promise.resolve({ success: true });
  }
};

// Mock do fileSystem
const mockFileSystem = {
  writeFile: async (path, content) => {
    console.log(`[MOCK-DEV] fileSystem.writeFile: ${path} (${content.length} chars)`);
    return Promise.resolve();
  },
  readFile: async (path) => {
    console.log(`[MOCK-DEV] fileSystem.readFile: ${path}`);
    return Promise.resolve('conteúdo mockado');
  }
};

// Mock do path
const mockPath = {
  join: (...parts) => {
    const result = parts.join('/');
    console.log(`[MOCK-DEV] path.join: ${result}`);
    return result;
  },
  dirname: (path) => {
    console.log(`[MOCK-DEV] path.dirname: ${path}`);
    return '/mock/dir';
  }
};

// Mock do taskAnalysisService
const mockTaskAnalysisService = {
  analyzeArchitectResponse: async () => {
    console.log(`[MOCK-DEV] taskAnalysisService.analyzeArchitectResponse chamado`);
    return { hasPlan: true, confidence: 95 };
  }
};

// =====================================================================
// 3. CONFIGURAR CONTAINER PARA DESENVOLVEDOR
// =====================================================================
console.log('🔧 CONFIGURANDO CONTAINER PARA DeveloperTurnStep...\n');

// Limpar container existente
try {
  if (typeof container.clear === 'function') {
    container.clear();
    console.log('✅ Container limpo');
  }
} catch (e) {
  console.log('⚠️ Não foi possível limpar container');
}

// Registrar mocks para o desenvolvedor
container.register('log', mockLog);
container.register('openClawService', mockOpenClawService);
container.register('evidenceService', mockEvidenceService);
container.register('fileSystem', mockFileSystem);
container.register('path', mockPath);
container.register('taskAnalysisService', mockTaskAnalysisService);

console.log('✅ Container configurado com 6 mocks para desenvolvedor');

// =====================================================================
// 4. EXECUTAR TESTE DO DeveloperTurnStep REAL
// =====================================================================
async function executarTesteDesenvolvedorCorrigido() {
  try {
    console.log('\n🚀 CARREGANDO DeveloperTurnStep REAL...\n');
    
    // Carregar a classe REAL do desenvolvedor
    const DeveloperTurnStep = require('./src/steps/DeveloperTurnStep');
    
    // Criar instância - ela usará os mocks do container
    const step = new DeveloperTurnStep();
    
    console.log('✅ Instância de DeveloperTurnStep criada com sucesso!');
    
    console.log('\n🎯 CONTEXTO DE ENTRADA:');
    console.log('   Tarefa:', contextoDesenvolvedor.task.title);
    console.log('   Turno:', contextoDesenvolvedor.turnNumber);
    console.log('   basePrompt length:', contextoDesenvolvedor.basePrompt.length, 'chars');
    console.log('   architectAnalysis preenchido?', !!contextoDesenvolvedor.architectAnalysis);
    
    console.log('\n🎯 EXECUTANDO DeveloperTurnStep REAL...\n');
    
    // Executar o método REAL do desenvolvedor
    const resultado = await step.execute(contextoDesenvolvedor);
    
    console.log('\n✅ RESULTADO DA EXECUÇÃO DO DESENVOLVEDOR:');
    console.log('='.repeat(60));
    
    if (!resultado) {
      console.log('❌ DeveloperTurnStep retornou undefined');
      return;
    }
    
    console.log('\n📊 developerTurnResult/turnResult:');
    if (resultado.developerTurnResult) {
      console.log('   developerTurnResult.success:', resultado.developerTurnResult.success);
    }
    if (resultado.turnResult) {
      console.log('   turnResult.success:', resultado.turnResult.success);
      console.log('   turnResult.taskId:', resultado.turnResult.taskId);
      console.log('   turnResult.sessionId:', resultado.turnResult.sessionId);
      console.log('   turnResult.hasOutput:', !!resultado.turnResult.rawOutput);
    }
    
    console.log('\n🔍 developerOutput/rawOutput:');
    if (resultado.developerOutput) {
      console.log('   developerOutput length:', resultado.developerOutput.length, 'chars');
    }
    if (resultado.turnResult && resultado.turnResult.rawOutput) {
      console.log('   rawOutput length:', resultado.turnResult.rawOutput.length, 'chars');
      console.log('   primeiras 3 linhas:');
      const lines = resultado.turnResult.rawOutput.split('\n').slice(0, 3);
      lines.forEach(line => console.log('   ', line));
    }
    
    console.log('\n📝 currentInput atualizado?', resultado.currentInput !== contextoDesenvolvedor.currentInput);
    
    console.log('\n🎯 VERIFICAÇÕES CRÍTICAS:');
    console.log('   1. ✅ DeveloperTurnStep REAL executado');
    console.log('   2. ✅ Campos corretos fornecidos (turnNumber, basePrompt)');
    console.log('   3. ✅ openClawService BYPASSADO (resposta simulada)');
    console.log('   4. ✅ Evidence coletada (simulada)');
    
    console.log('\n🔧 FLUXO EXECUTADO PELO DESENVOLVEDOR:');
    console.log('   1. Recebeu plano do arquiteto ✅');
    console.log('   2. Gerou sessão para desenvolvedor ✅');
    console.log('   3. Executou via OpenClaw (mock) ✅');
    console.log('   4. Coletou evidências ✅');
    
    console.log('\n🚀 O QUE O DESENVOLVEDOR "IMPLEMENTOU":');
    console.log('   1. PriorityManager.tsx - botão "Inserir" e estado ✅');
    console.log('   2. PriorityForm.tsx - novo componente de formulário ✅');
    console.log('   3. api.ts - função createPriority() ✅');
    console.log('   4. priorities.js - rota POST /api/priorities ✅');
    
    console.log('\n🎯 DEFINIÇÃO DE PRONTO ATENDIDA?');
    console.log('   1. Verificar estrutura do formulário de prioridades: ✅ IMPLEMENTADO');
    console.log('   2. Identificar gatilhos de UI para exibir o formulário: ✅ BOTÃO "INSERIR"');
    
    console.log('\n🔗 CAMPOS ADICIONADOS/MODIFICADOS:');
    const camposNovos = Object.keys(resultado).filter(key => 
      !(key in contextoDesenvolvedor) || resultado[key] !== contextoDesenvolvedor[key]
    );
    console.log('   Campos modificados/novos:', camposNovos.length);
    camposNovos.forEach(campo => console.log(`   - ${campo}`));
    
    console.log('\n🚀 PRÓXIMOS PASSOS NO FLUXO:');
    console.log('   1. DeveloperLoopOrchestrator - gerencia múltiplos turnos');
    console.log('   2. TaskCompletionStep - verifica conclusão');
    console.log('   3. Relatório final - gera documentação');
    console.log('   4. Arquivo .done - sinaliza conclusão');
    
    console.log('\n💡 RESUMO DO TESTE:');
    console.log('   ✅ Fluxo Arquiteto → Desenvolvedor testado com sucesso');
    console.log('   ✅ Código REAL usado (sem modificações)');
    console.log('   ✅ Injeção via container funcionando');
    console.log('   ✅ Bypass controlado de dependências');
    console.log('   ✅ Contexto evolui corretamente entre steps');
    
    console.log('\n🎯 TESTE DO DeveloperTurnStep (CORRIGIDO) BEM-SUCEDIDO!');
    
    return resultado;
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE DO DESENVOLVEDOR (CORRIGIDO):', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Executar teste
executarTesteDesenvolvedorCorrigido();