// monitor/__tests__/EvidenceService.test.ts
// ─────────────────────────────────────────────────────
// Testes unitários para o serviço de evidências
// ─────────────────────────────────────────────────────

import { EvidenceService } from '../services/EvidenceService';

// Mock do logger
const mockLogger = {
  info: jest.fn(),
  erro: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

describe('EvidenceService', () => {
  let evidenceService: EvidenceService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    evidenceService = new EvidenceService({ logger: mockLogger });
  });
  
  describe('createEmptyEvidence', () => {
    test('deve criar evidência vazia com taskId correto', () => {
      const evidence = evidenceService.createEmptyEvidence('task-123');
      
      expect(evidence.taskId).toBe('task-123');
      expect(evidence.timestamp).toBeDefined();
      expect(evidence.hasDoneFile).toBe(false);
      expect(evidence.hasRealChanges).toBe(false);
      expect(evidence.fileChanges.total).toBe(0);
      expect(evidence.toolCalls).toEqual([]);
      expect(evidence.toolResults).toEqual([]);
      expect(evidence.analysis).toBeDefined();
    });
  });
  
  describe('applyExecutionEvidence', () => {
    test('deve adicionar tool call e tool result às evidências', async () => {
      const initialEvidence = evidenceService.createEmptyEvidence('task-123');
      const toolCall = {
        type: 'tool_use',
        name: 'write',
        args: { path: '/file.txt', content: 'test' }
      };
      const toolResult = {
        type: 'tool_result',
        success: true,
        result: 'Arquivo criado com sucesso'
      };
      
      const updatedEvidence = await evidenceService.applyExecutionEvidence(
        initialEvidence,
        toolCall,
        toolResult,
        { rawOutput: 'Raw output text' }
      );
      
      expect(updatedEvidence.toolCalls).toHaveLength(1);
      expect(updatedEvidence.toolCalls[0].name).toBe('write');
      expect(updatedEvidence.toolResults).toHaveLength(1);
      expect(updatedEvidence.toolResults[0].success).toBe(true);
      expect(updatedEvidence.rawOutput).toBe('Raw output text');
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Evidência atualizada'));
    });
    
    test('deve lidar com tool call vazio', () => {
      const initialEvidence = evidenceService.createEmptyEvidence('task-123');
      
      const updatedEvidence = await evidenceService.applyExecutionEvidence(
        initialEvidence,
        {},
        {},
        {}
      );
      
      expect(updatedEvidence.toolCalls).toHaveLength(0);
      expect(updatedEvidence.toolResults).toHaveLength(0);
    });
  });
  
  describe('applyFileChangesEvidence', () => {
    test('deve adicionar alterações de arquivos às evidências', () => {
      const initialEvidence = evidenceService.createEmptyEvidence('task-123');
      const fileChanges = {
        modified: ['/file1.txt', '/file2.js'],
        created: ['/newfile.ts'],
        deleted: ['/oldfile.js']
      };
      
      const updatedEvidence = await evidenceService.applyFileChangesEvidence(
        initialEvidence,
        fileChanges
      );
      
      expect(updatedEvidence.fileChanges.modified).toEqual(['/file1.txt', '/file2.js']);
      expect(updatedEvidence.fileChanges.created).toEqual(['/newfile.ts']);
      expect(updatedEvidence.fileChanges.deleted).toEqual(['/oldfile.js']);
      expect(updatedEvidence.fileChanges.total).toBe(4);
      expect(updatedEvidence.hasRealChanges).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Evidência atualizada'));
    });
    
    test('deve acumular múltiplas aplicações de alterações', () => {
      let evidence = evidenceService.createEmptyEvidence('task-123');
      
      // Primeira aplicação
      evidence = await evidenceService.applyFileChangesEvidence(evidence, {
        modified: ['/file1.txt'],
        created: [],
        deleted: []
      });
      
      // Segunda aplicação
      evidence = await evidenceService.applyFileChangesEvidence(evidence, {
        modified: ['/file2.js'],
        created: ['/newfile.ts'],
        deleted: []
      });
      
      expect(evidence.fileChanges.modified).toEqual(['/file1.txt', '/file2.js']);
      expect(evidence.fileChanges.created).toEqual(['/newfile.ts']);
      expect(evidence.fileChanges.total).toBe(3);
    });
  });
  
  describe('applyDoneFileEvidence', () => {
    test('deve atualizar evidência com arquivo .done encontrado', () => {
      const initialEvidence = evidenceService.createEmptyEvidence('task-123');
      
      const updatedEvidence = await evidenceService.applyDoneFileEvidence(
        initialEvidence,
        '/path/to/.done'
      );
      
      expect(updatedEvidence.hasDoneFile).toBe(true);
      expect(updatedEvidence.doneFilePath).toBe('/path/to/.done');
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Evidência atualizada com .done'));
    });
    
    test('deve atualizar evidência sem arquivo .done', () => {
      const initialEvidence = evidenceService.createEmptyEvidence('task-123');
      
      const updatedEvidence = await evidenceService.applyDoneFileEvidence(
        initialEvidence,
        null
      );
      
      expect(updatedEvidence.hasDoneFile).toBe(false);
      expect(updatedEvidence.doneFilePath).toBeNull();
    });
  });
  
  describe('applyAnalysisEvidence', () => {
    test('deve aplicar análise às evidências', () => {
      const initialEvidence = evidenceService.createEmptyEvidence('task-123');
      const analysis = {
        isDeclaringDone: true,
        hasFulfilledContract: true,
        missingRequirements: [],
        isTalkingWithoutAction: false,
        confidence: 95
      };
      
      const updatedEvidence = await evidenceService.applyAnalysisEvidence(
        initialEvidence,
        analysis
      );
      
      expect(updatedEvidence.analysis).toEqual(analysis);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Análise aplicada'));
    });
  });
  
  describe('hasSufficientEvidence', () => {
    test('deve considerar suficiente quando tem .done', () => {
      const evidence = evidenceService.createEmptyEvidence('task-123');
      evidence.hasDoneFile = true;
      evidence.doneFilePath = '/path/to/.done';
      
      const resultado = evidenceService.hasSufficientEvidence(evidence);
      
      expect(resultado.sufficient).toBe(true);
      expect(resultado.reasons).toContain('Arquivo .done encontrado');
    });
    
    test('deve considerar suficiente quando tem alterações e análise positiva', () => {
      const evidence = evidenceService.createEmptyEvidence('task-123');
      evidence.hasRealChanges = true;
      evidence.fileChanges.total = 3;
      evidence.analysis = {
        isDeclaringDone: true,
        hasFulfilledContract: true,
        missingRequirements: [],
        isTalkingWithoutAction: false,
        confidence: 90
      };
      
      const resultado = evidenceService.hasSufficientEvidence(evidence);
      
      expect(resultado.sufficient).toBe(true);
      expect(resultado.reasons).toContain('Alterações detectadas');
      expect(resultado.reasons).toContain('Análise indica contrato cumprido');
    });
    
    test('deve considerar insuficiente quando não tem .done nem alterações', () => {
      const evidence = evidenceService.createEmptyEvidence('task-123');
      
      const resultado = evidenceService.hasSufficientEvidence(evidence);
      
      expect(resultado.sufficient).toBe(false);
      expect(resultado.reasons).toHaveLength(0);
    });
    
    test('deve considerar insuficiente quando tem alterações mas análise negativa', () => {
      const evidence = evidenceService.createEmptyEvidence('task-123');
      evidence.hasRealChanges = true;
      evidence.fileChanges.total = 2;
      evidence.analysis = {
        isDeclaringDone: false,
        hasFulfilledContract: false,
        missingRequirements: ['Requisito X'],
        isTalkingWithoutAction: false,
        confidence: 30
      };
      
      const resultado = evidenceService.hasSufficientEvidence(evidence);
      
      expect(resultado.sufficient).toBe(false);
    });
    
    test('deve incluir tool calls nas razões', () => {
      const evidence = evidenceService.createEmptyEvidence('task-123');
      evidence.toolCalls = [
        { type: 'tool_use', name: 'write', args: {}, timestamp: '2024-01-01' }
      ];
      evidence.hasDoneFile = true;
      
      const resultado = evidenceService.hasSufficientEvidence(evidence);
      
      expect(resultado.reasons).toContain('1 ferramentas executadas');
    });
  });
  
  describe('generateEvidenceSummary', () => {
    test('deve gerar resumo formatado das evidências', () => {
      const evidence = evidenceService.createEmptyEvidence('task-123');
      evidence.hasDoneFile = true;
      evidence.doneFilePath = '/path/to/.done';
      evidence.hasRealChanges = true;
      evidence.fileChanges = {
        modified: ['/file1.txt'],
        created: ['/newfile.ts'],
        deleted: [],
        total: 2
      };
      evidence.toolCalls = [
        { type: 'tool_use', name: 'write', args: { path: '/file.txt' }, timestamp: '2024-01-01' }
      ];
      evidence.analysis = {
        isDeclaringDone: true,
        hasFulfilledContract: true,
        missingRequirements: [],
        isTalkingWithoutAction: false,
        confidence: 95
      };
      
      const summary = evidenceService.generateEvidenceSummary(evidence);
      
      expect(summary).toContain('RESUMO DE EVIDÊNCIAS');
      expect(summary).toContain('Tarefa task-123');
      expect(summary).toContain('.done: ✅');
      expect(summary).toContain('Alterações: ✅');
      expect(summary).toContain('Tool Calls: 1');
      expect(summary).toContain('Análise: ✅ Contrato cumprido');
    });
    
    test('deve gerar resumo para evidências insuficientes', () => {
      const evidence = evidenceService.createEmptyEvidence('task-123');
      
      const summary = evidenceService.generateEvidenceSummary(evidence);
      
      expect(summary).toContain('.done: ❌ Não encontrado');
      expect(summary).toContain('Alterações: ❌ Nenhuma');
      expect(summary).toContain('Suficiência: ❌ Insuficiente');
    });
  });
  
  describe('validateEvidenceConsistency', () => {
    test('deve detectar inconsistência quando declara .done mas não tem arquivo', () => {
      const evidence = evidenceService.createEmptyEvidence('task-123');
      evidence.analysis = {
        isDeclaringDone: true,
        hasFulfilledContract: false,
        missingRequirements: [],
        isTalkingWithoutAction: false,
        confidence: 0
      };
      evidence.hasDoneFile = false;
      
      const resultado = evidenceService.validateEvidenceConsistency(evidence);
      
      expect(resultado.valid).toBe(false);
      expect(resultado.inconsistencies).toContain('Declarou conclusão mas arquivo .done não encontrado');
    });
    
    test('deve detectar inconsistência quando tem .done mas análise diz que contrato não foi cumprido', () => {
      const evidence = evidenceService.createEmptyEvidence('task-123');
      evidence.hasDoneFile = true;
      evidence.doneFilePath = '/path/to/.done';
      evidence.analysis = {
        isDeclaringDone: true,
        hasFulfilledContract: false,
        missingRequirements: ['Requisito X'],
        isTalkingWithoutAction: false,
        confidence: 30
      };
      
      const resultado = evidenceService.validateEvidenceConsistency(evidence);
      
      expect(resultado.valid).toBe(false);
      expect(resultado.inconsistencies).toContain('Arquivo .done existe mas análise indica contrato não cumprido');
    });
    
    test('deve detectar inconsistência quando tem alterações mas nenhum tool call', () => {
      const evidence = evidenceService.createEmptyEvidence('task-123');
      evidence.hasRealChanges = true;
      evidence.fileChanges.total = 3;
      evidence.toolCalls = [];
      
      const resultado = evidenceService.validateEvidenceConsistency(evidence);
      
      expect(resultado.valid).toBe(false);
      expect(resultado.inconsistencies).toContain('Alterações detectadas mas nenhum tool call registrado');
    });
    
    test('deve detectar inconsistência quando tem muitos tool calls mas nenhuma alteração', () => {
      const evidence = evidenceService.createEmptyEvidence('task-123');
      evidence.toolCalls = [
        { type: 'tool_use', name: 'read', args: {}, timestamp: '2024-01-01' },
        { type: 'tool_use', name: 'read', args: {}, timestamp: '2024-01-01' },
        { type: 'tool_use', name: 'read', args: {}, timestamp: '2024-01-01' }
      ];
      evidence.hasRealChanges = false;
      
      const resultado = evidenceService.validateEvidenceConsistency(evidence);
      
      expect(resultado.valid).toBe(false);
      expect(resultado.inconsistencies).toContain('Múltiplos tool calls executados mas nenhuma alteração detectada');
    });
    
    test('deve considerar consistente quando evidências são coerentes', () => {
      const evidence = evidenceService.createEmptyEvidence('task-123');
      evidence.hasDoneFile = true;
      evidence.doneFilePath = '/path/to/.done';
      evidence.hasRealChanges = true;
      evidence.fileChanges.total = 2;
      evidence.toolCalls = [
        { type: 'tool_use', name: 'write', args: {}, timestamp: '2024-01-01' }
      ];
      evidence.analysis = {
        isDeclaringDone: true,
        hasFulfilledContract: true,
        missingRequirements: [],
        isTalkingWithoutAction: false,
        confidence: 95
      };
      
      const resultado = evidenceService.validateEvidenceConsistency(evidence);
      
      expect(resultado.valid).toBe(true);
      expect(resultado.inconsistencies).toHaveLength(0);
    });
  });
});