// monitor/__tests__/FaseInspecaoWorkspace.test.ts
// ─────────────────────────────────────────────────────
// Testes unitários para a fase de inspeção do workspace
// ─────────────────────────────────────────────────────

import { MacroFaseInspecaoWorkspace } from '../passos/macro/FaseInspecaoWorkspace';

// Mock do logger
const mockLogger = {
  info: jest.fn(),
  erro: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

// Mock do snapshot service
const mockSnapshotService = {
  takeSnapshot: jest.fn(),
  compareSnapshots: jest.fn(),
  getModifiedFiles: jest.fn(),
  logger: mockLogger,
  fileSystem: {} as any
};

// Mock do done file service
const mockDoneFileService = {
  findDoneFile: jest.fn(),
  checkDoneFileExists: jest.fn(),
  createDoneFile: jest.fn(),
  logger: mockLogger,
  fileSystem: {} as any,
  path: { join: (...parts: string[]) => parts.join('/') },
  searchInDirectory: jest.fn(),
  findRelevantSubdirectories: jest.fn()
};

// Mock do evidence service
const mockEvidenceService = {
  createEmptyEvidence: jest.fn(),
  applyDoneFileEvidence: jest.fn(),
  applyFileChangesEvidence: jest.fn(),
  applyExecutionEvidence: jest.fn(),
  applyAnalysisEvidence: jest.fn(),
  validateEvidenceConsistency: jest.fn(),
  hasSufficientEvidence: jest.fn(),
  generateEvidenceSummary: jest.fn(),
  logger: mockLogger
};

describe('MacroFaseInspecaoWorkspace', () => {
  let faseInspecao: MacroFaseInspecaoWorkspace;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    faseInspecao = new MacroFaseInspecaoWorkspace({
      logger: mockLogger,
      snapshotService: mockSnapshotService,
      doneFileService: mockDoneFileService,
      evidenceService: mockEvidenceService
    });
  });
  
  describe('processar', () => {
    const inputPadrao = {
      tarefaAtual: {
        id: 'task-123',
        title: 'Test Task',
        project: {
          id: 'proj-123',
          pastaBase: '/project/base'
        }
      } as any,
      snapshotInicial: new Map([['/project/base/file1.txt', 123456789]]),
      taskDir: '/task/dir',
      rawOutput: 'Raw output from AI',
      toolCall: { type: 'tool_use', name: 'write', args: {} },
      toolResult: { type: 'tool_result', success: true }
    };
    
    test('deve inspecionar workspace com .done encontrado e alterações detectadas', async () => {
      // Configurar mocks
      mockDoneFileService.findDoneFile.mockResolvedValue({
        found: true,
        path: '/task/dir/.done',
        searchedLocations: ['/task/dir']
      });
      
      mockSnapshotService.takeSnapshot.mockResolvedValue(
        new Map([
          ['/project/base/file1.txt', 123456790], // Modificado
          ['/project/base/newfile.ts', 123456789], // Criado
          ['/project/base/file2.js', 123456789] // Não modificado
        ])
      );
      
      mockSnapshotService.compareSnapshots.mockReturnValue({
        hasChanges: true,
        modified: ['/project/base/file1.txt'],
        created: ['/project/base/newfile.ts'],
        deleted: [],
        totalChanges: 2
      });
      
      // Mock das evidências
      const emptyEvidence = { taskId: 'task-123', fileChanges: { total: 0 } };
      const withDoneEvidence = { ...emptyEvidence, hasDoneFile: true };
      const withChangesEvidence = { ...withDoneEvidence, hasRealChanges: true, fileChanges: { total: 2 } };
      const finalEvidence = { ...withChangesEvidence, toolCalls: [{}] };
      
      mockEvidenceService.createEmptyEvidence.mockReturnValue(emptyEvidence);
      mockEvidenceService.applyDoneFileEvidence
        .mockReturnValueOnce(withDoneEvidence)
        .mockReturnValueOnce(withChangesEvidence);
      mockEvidenceService.applyFileChangesEvidence.mockReturnValue(withChangesEvidence);
      mockEvidenceService.applyExecutionEvidence.mockReturnValue(finalEvidence);
      mockEvidenceService.validateEvidenceConsistency.mockReturnValue({ valid: true, inconsistencies: [] });
      mockEvidenceService.hasSufficientEvidence.mockReturnValue({ sufficient: true, reasons: ['.done encontrado'] });
      mockEvidenceService.generateEvidenceSummary.mockReturnValue('Resumo das evidências');
      
      // Executar
      const resultado = await faseInspecao.execute(inputPadrao);
      
      // Verificar
      expect(resultado.sucesso).toBe(true);
      expect(resultado.hasDoneFile).toBe(true);
      expect(resultado.doneFilePath).toBe('/task/dir/.done');
      expect(resultado.hasRealChanges).toBe(true);
      expect(resultado.fileChanges.total).toBe(2);
      expect(resultado.evidence).toBe(finalEvidence);
      
      // Verificar chamadas
      expect(mockDoneFileService.findDoneFile).toHaveBeenCalledWith(
        '/task/dir',
        '/project/base'
      );
      expect(mockSnapshotService.takeSnapshot).toHaveBeenCalledWith({
        dir: '/project/base',
        ignoreList: expect.arrayContaining(['node_modules', '.git'])
      });
      expect(mockSnapshotService.compareSnapshots).toHaveBeenCalledWith({
        initialSnapshot: inputPadrao.snapshotInicial,
        currentSnapshot: expect.any(Map)
      });
      expect(mockEvidenceService.applyExecutionEvidence).toHaveBeenCalledWith(
        expect.anything(),
        inputPadrao.toolCall,
        inputPadrao.toolResult,
        expect.objectContaining({ rawOutput: 'Raw output from AI' })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Suficiência de evidências: ✅ Suficiente'));
    });
    
    test('deve inspecionar workspace sem .done e sem alterações', async () => {
      // Configurar mocks
      mockDoneFileService.findDoneFile.mockResolvedValue({
        found: false,
        path: null,
        searchedLocations: ['/task/dir', '/project/base']
      });
      
      mockSnapshotService.takeSnapshot.mockResolvedValue(
        new Map([['/project/base/file1.txt', 123456789]]) // Não modificado
      );
      
      mockSnapshotService.compareSnapshots.mockReturnValue({
        hasChanges: false,
        modified: [],
        created: [],
        deleted: [],
        totalChanges: 0
      });
      
      // Mock das evidências
      const emptyEvidence = { taskId: 'task-123', fileChanges: { total: 0 } };
      const finalEvidence = { ...emptyEvidence, hasDoneFile: false, hasRealChanges: false };
      
      mockEvidenceService.createEmptyEvidence.mockReturnValue(emptyEvidence);
      mockEvidenceService.applyDoneFileEvidence.mockReturnValue(finalEvidence);
      mockEvidenceService.applyFileChangesEvidence.mockReturnValue(finalEvidence);
      mockEvidenceService.applyExecutionEvidence.mockReturnValue(finalEvidence);
      mockEvidenceService.validateEvidenceConsistency.mockReturnValue({ valid: true, inconsistencies: [] });
      mockEvidenceService.hasSufficientEvidence.mockReturnValue({ sufficient: false, reasons: [] });
      
      // Executar
      const resultado = await faseInspecao.execute(inputPadrao);
      
      // Verificar
      expect(resultado.sucesso).toBe(true);
      expect(resultado.hasDoneFile).toBe(false);
      expect(resultado.doneFilePath).toBeNull();
      expect(resultado.hasRealChanges).toBe(false);
      expect(resultado.fileChanges.total).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('.done encontrado: Não'));
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Alterações detectadas: Não'));
    });
    
    test('deve usar taskDir quando projeto não tem pastaBase', async () => {
      const inputSemProjeto = {
        ...inputPadrao,
        tarefaAtual: {
          id: 'task-123',
          title: 'Test Task',
          project: null
        } as any
      };
      
      mockDoneFileService.findDoneFile.mockResolvedValue({
        found: false,
        path: null,
        searchedLocations: ['/task/dir']
      });
      
      mockSnapshotService.takeSnapshot.mockResolvedValue(new Map());
      mockSnapshotService.compareSnapshots.mockReturnValue({
        hasChanges: false,
        modified: [],
        created: [],
        deleted: [],
        totalChanges: 0
      });
      
      // Mock básico das evidências
      const emptyEvidence = { taskId: 'task-123', fileChanges: { total: 0 } };
      mockEvidenceService.createEmptyEvidence.mockReturnValue(emptyEvidence);
      mockEvidenceService.applyDoneFileEvidence.mockReturnValue(emptyEvidence);
      mockEvidenceService.applyFileChangesEvidence.mockReturnValue(emptyEvidence);
      mockEvidenceService.applyExecutionEvidence.mockReturnValue(emptyEvidence);
      mockEvidenceService.validateEvidenceConsistency.mockReturnValue({ valid: true, inconsistencies: [] });
      mockEvidenceService.hasSufficientEvidence.mockReturnValue({ sufficient: false, reasons: [] });
      
      // Executar
      await faseInspecao.execute(inputSemProjeto);
      
      // Verificar que usou taskDir para snapshot
      expect(mockSnapshotService.takeSnapshot).toHaveBeenCalledWith({
        dir: '/task/dir',
        ignoreList: expect.any(Array)
      });
    });
    
    test('deve lidar com erro na comparação de snapshots', async () => {
      // Configurar mocks - snapshot falha
      mockDoneFileService.findDoneFile.mockResolvedValue({
        found: false,
        path: null,
        searchedLocations: ['/task/dir']
      });
      
      mockSnapshotService.takeSnapshot.mockRejectedValue(new Error('Erro de permissão'));
      
      // Mock básico das evidências
      const emptyEvidence = { taskId: 'task-123', fileChanges: { total: 0 } };
      mockEvidenceService.createEmptyEvidence.mockReturnValue(emptyEvidence);
      mockEvidenceService.applyDoneFileEvidence.mockReturnValue(emptyEvidence);
      mockEvidenceService.applyFileChangesEvidence.mockReturnValue(emptyEvidence);
      mockEvidenceService.applyExecutionEvidence.mockReturnValue(emptyEvidence);
      
      // Executar
      const resultado = await faseInspecao.execute(inputPadrao);
      
      // Verificar que continua mesmo com erro
      expect(resultado.sucesso).toBe(true);
      expect(resultado.hasRealChanges).toBe(false);
      expect(mockLogger.erro).toHaveBeenCalledWith(expect.stringContaining('Erro ao comparar snapshots'));
    });
    
    test('deve detectar inconsistências nas evidências', async () => {
      // Configurar mocks
      mockDoneFileService.findDoneFile.mockResolvedValue({
        found: true,
        path: '/task/dir/.done',
        searchedLocations: ['/task/dir']
      });
      
      mockSnapshotService.takeSnapshot.mockResolvedValue(new Map());
      mockSnapshotService.compareSnapshots.mockReturnValue({
        hasChanges: false,
        modified: [],
        created: [],
        deleted: [],
        totalChanges: 0
      });
      
      // Mock das evidências com inconsistência
      const evidence = { taskId: 'task-123', fileChanges: { total: 0 } };
      mockEvidenceService.createEmptyEvidence.mockReturnValue(evidence);
      mockEvidenceService.applyDoneFileEvidence.mockReturnValue(evidence);
      mockEvidenceService.applyFileChangesEvidence.mockReturnValue(evidence);
      mockEvidenceService.applyExecutionEvidence.mockReturnValue(evidence);
      mockEvidenceService.validateEvidenceConsistency.mockReturnValue({
        valid: false,
        inconsistencies: ['Declarou conclusão mas arquivo .done não encontrado']
      });
      mockEvidenceService.hasSufficientEvidence.mockReturnValue({ sufficient: false, reasons: [] });
      
      // Executar
      await faseInspecao.execute(inputPadrao);
      
      // Verificar log de inconsistência
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Inconsistências nas evidências')
      );
    });
    
    test('deve lidar com erro crítico e retornar evidência mínima', async () => {
      // Configurar mocks com erro crítico
      mockDoneFileService.findDoneFile.mockRejectedValue(new Error('Erro crítico no sistema de arquivos'));
      
      // Mock de evidência mínima
      const emptyEvidence = { taskId: 'task-123', fileChanges: { total: 0 } };
      mockEvidenceService.createEmptyEvidence.mockReturnValue(emptyEvidence);
      
      // Executar
      const resultado = await faseInspecao.execute(inputPadrao);
      
      // Verificar fallback em caso de erro
      expect(resultado.sucesso).toBe(false);
      expect(resultado.errosCriticos).toContain('Erro na inspeção');
      expect(resultado.hasDoneFile).toBe(false);
      expect(resultado.hasRealChanges).toBe(false);
      expect(mockLogger.erro).toHaveBeenCalledWith(expect.stringContaining('Erro crítico na inspeção'));
    });
    
    test('deve logar exemplos de arquivos modificados quando houver alterações', async () => {
      // Configurar mocks com muitas alterações
      mockDoneFileService.findDoneFile.mockResolvedValue({
        found: false,
        path: null,
        searchedLocations: ['/task/dir']
      });
      
      mockSnapshotService.takeSnapshot.mockResolvedValue(
        new Map([
          ['/project/base/file1.txt', 123456790],
          ['/project/base/file2.js', 123456790],
          ['/project/base/file3.ts', 123456790],
          ['/project/base/file4.css', 123456790]
        ])
      );
      
      mockSnapshotService.compareSnapshots.mockReturnValue({
        hasChanges: true,
        modified: ['/project/base/file1.txt', '/project/base/file2.js', '/project/base/file3.ts', '/project/base/file4.css'],
        created: [],
        deleted: [],
        totalChanges: 4
      });
      
      // Mock básico das evidências
      const evidence = { taskId: 'task-123', fileChanges: { total: 4 } };
      mockEvidenceService.createEmptyEvidence.mockReturnValue(evidence);
      mockEvidenceService.applyDoneFileEvidence.mockReturnValue(evidence);
      mockEvidenceService.applyFileChangesEvidence.mockReturnValue(evidence);
      mockEvidenceService.applyExecutionEvidence.mockReturnValue(evidence);
      mockEvidenceService.validateEvidenceConsistency.mockReturnValue({ valid: true, inconsistencies: [] });
      mockEvidenceService.hasSufficientEvidence.mockReturnValue({ sufficient: false, reasons: [] });
      
      // Executar
      await faseInspecao.execute(inputPadrao);
      
      // Verificar log de exemplos
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Exemplos: /project/base/file1.txt, /project/base/file2.js, /project/base/file3.ts...')
      );
    });
  });
});