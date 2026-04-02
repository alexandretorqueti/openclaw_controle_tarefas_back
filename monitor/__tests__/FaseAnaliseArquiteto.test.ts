// monitor/__tests__/FaseAnaliseArquiteto.test.ts
// ─────────────────────────────────────────────────────
// Testes unitários para a Fase de Análise do Arquiteto
// ─────────────────────────────────────────────────────

import { MacroFaseAnaliseArquiteto } from '../passos/macro/FaseAnaliseArquiteto';
import type { AnaliseArquitetoInput, AnaliseArquitetoOutput } from '../passos/macro/FaseAnaliseArquiteto';

// Mock do logger
const mockLogger = {
  info: jest.fn(),
  erro: jest.fn(),
  debug: jest.fn()
};

const mockFileSystem = {
  readdir: jest.fn(),
  stat: jest.fn()
};

// Mock do serviço de análise de tarefa
const mockAnaliseTarefa = {
  analisarRespostaArquiteto: jest.fn()
};

// Mock do serviço de snapshot
const mockSnapshot = {
  logger: mockLogger,
  fileSystem: mockFileSystem,
  takeSnapshot: jest.fn(),
  compareSnapshots: jest.fn(),
  getModifiedFiles: jest.fn()
};

// Mock do fileSystem para análise do arquiteto
const mockFileSystemAnalise = {
  access: jest.fn()
};

describe('MacroFaseAnaliseArquiteto', () => {
  let faseAnalise: MacroFaseAnaliseArquiteto;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    faseAnalise = new MacroFaseAnaliseArquiteto({
      logger: mockLogger,
      snapshot: mockSnapshot,
      fileSystem: mockFileSystemAnalise
    });
  });
  
  describe('processar', () => {
    const inputPadrao: AnaliseArquitetoInput = {
      tarefaAtual: {
        id: 'task-123',
        title: 'Test Task',
        description: 'Test description',
        domain: 'FRONTEND',
        project: {
          id: 'proj-123',
          name: 'Test Project',
          description: 'Test project',
          pastaBase: '/test/project',
          agent: 'test-agent',
          modeloAuxiliar: 'gpt-4'
        } as any
      } as any,
      planoAnalise: {
        taskType: 'development'
      } as any,
      respostaArquiteto: 'O arquiteto analisou a tarefa e gerou um plano detalhado.',
      caminhoPlanoArquiteto: '/tmp/plano-arquiteto.json',
      snapshotInicial: new Map([['/test/project/file1.ts', 123456789]]),
      diretorioBase: '/test/project'
    };
    
    test('deve analisar resposta do arquiteto quando ele apenas planejou', async () => {
      // Configurar mocks
      mockFileSystemAnalise.access.mockRejectedValue(new Error('Arquivo não existe'));
      mockSnapshot.takeSnapshot.mockResolvedValue(new Map([['/test/project/file1.ts', 123456789]]));
      mockSnapshot.compareSnapshots.mockReturnValue({
        modified: [],
        created: [],
        deleted: [],
        totalChanges: 0
      });
      
      mockAnaliseTarefa.analisarRespostaArquiteto.mockResolvedValue({
        hasExecuted: false,
        hasPlan: true,
        confidence: 85,
        executionDetails: null,
        planDetails: 'Plano detalhado para o desenvolvedor',
        analysisFailed: false,
        hadExecuted: false
      });
      
      // Executar
      const resultado = await faseAnalise.execute(inputPadrao);
      
      // Verificar
      expect(resultado.sucesso).toBe(true);
      
      // Verificar chamadas
      expect(mockSnapshot.takeSnapshot).toHaveBeenCalledWith({
        dir: '/test/project',
        ignoreList: ['node_modules', '.git', 'dist', 'build', '.next']
      });
      expect(mockSnapshot.compareSnapshots).toHaveBeenCalled();
    });
    
    test('deve detectar que arquiteto executou a tarefa (com evidências físicas)', async () => {
      // Configurar mocks
      mockFileSystemAnalise.access.mockResolvedValue(undefined); // .done file exists
      mockSnapshot.takeSnapshot.mockResolvedValue(new Map([
        ['/test/project/file1.ts', 123456790], // Modified
        ['/test/project/newfile.ts', 123456789] // Created
      ]));
      mockSnapshot.compareSnapshots.mockReturnValue({
        modified: ['/test/project/file1.ts'],
        created: ['/test/project/newfile.ts'],
        deleted: [],
        totalChanges: 2
      });
      
      mockAnaliseTarefa.analisarRespostaArquiteto.mockResolvedValue({
        hasExecuted: true,
        hasPlan: false,
        confidence: 90,
        executionDetails: 'Arquiteto implementou a funcionalidade X',
        planDetails: null,
        analysisFailed: false,
        hadExecuted: false
      });
      
      // Executar
      const resultado = await faseAnalise.execute(inputPadrao);
      
      // Verificar
      expect(resultado.sucesso).toBe(true);
      
    });
    
    test('deve corrigir análise quando IA diz que executou mas não há evidências', async () => {
      // Configurar mocks - IA diz que executou, mas não há evidências
      mockFileSystemAnalise.access.mockRejectedValue(new Error('Arquivo não existe'));
      mockSnapshot.takeSnapshot.mockResolvedValue(new Map([['/test/project/file1.ts', 123456789]]));
      mockSnapshot.compareSnapshots.mockReturnValue({
        modified: [],
        created: [],
        deleted: [],
        totalChanges: 0
      });
      
      mockAnaliseTarefa.analisarRespostaArquiteto.mockResolvedValue({
        hasExecuted: true, // IA errou - diz que executou
        hasPlan: false,
        confidence: 80,
        executionDetails: 'Arquiteto implementou algo',
        planDetails: null,
        analysisFailed: false,
        hadExecuted: false
      });
      
      // Executar
      const resultado = await faseAnalise.execute(inputPadrao);
      
      // Verificar que a análise foi corrigida
      expect(resultado.sucesso).toBe(true);
      
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Análise corrigida'));
    });
    
    test('deve considerar tarefa de análise como executada mesmo sem alterações de arquivos', async () => {
      const inputAnalise = {
        ...inputPadrao,
        planoAnalise: {
          taskType: 'analysis'
        } as any
      };
      
      // Configurar mocks - tarefa de análise com .done file
      mockFileSystemAnalise.access.mockResolvedValue(undefined); // .done file exists
      mockSnapshot.takeSnapshot.mockResolvedValue(new Map([['/test/project/file1.ts', 123456789]]));
      mockSnapshot.compareSnapshots.mockReturnValue({
        modified: [],
        created: [],
        deleted: [],
        totalChanges: 0
      });
      
      mockAnaliseTarefa.analisarRespostaArquiteto.mockResolvedValue({
        hasExecuted: true,
        hasPlan: false,
        confidence: 95,
        executionDetails: 'Arquiteto analisou e gerou relatório',
        planDetails: null,
        analysisFailed: false,
        hadExecuted: false
      });
      
      // Executar
      const resultado = await faseAnalise.execute(inputAnalise);
      
      // Verificar - para análise, .done file é evidência suficiente
      expect(resultado.sucesso).toBe(true);
    });
    
    test('deve passar para programador quando análise falhar', async () => {
      // Configurar mocks - análise falhou
      mockFileSystemAnalise.access.mockRejectedValue(new Error('Arquivo não existe'));
      mockSnapshot.takeSnapshot.mockResolvedValue(new Map([['/test/project/file1.ts', 123456789]]));
      mockSnapshot.compareSnapshots.mockReturnValue({
        modified: [],
        created: [],
        deleted: [],
        totalChanges: 0
      });
      
      mockAnaliseTarefa.analisarRespostaArquiteto.mockResolvedValue({
        hasExecuted: false,
        hasPlan: false,
        confidence: 0,
        executionDetails: null,
        planDetails: null,
        analysisFailed: true,
        hadExecuted: false
      });
      
      // Executar
      const resultado = await faseAnalise.execute(inputPadrao);
      
      // Verificar fallback seguro
      expect(resultado.sucesso).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Análise falhou'));
    });
    
    test('deve lidar com erro no serviço de análise', async () => {
      // Configurar mocks com erro
      mockFileSystemAnalise.access.mockRejectedValue(new Error('Arquivo não existe'));
      mockSnapshot.takeSnapshot.mockResolvedValue(new Map([['/test/project/file1.ts', 123456789]]));
      mockSnapshot.compareSnapshots.mockReturnValue({
        modified: [],
        created: [],
        deleted: [],
        totalChanges: 0
      });
      
      mockAnaliseTarefa.analisarRespostaArquiteto.mockRejectedValue(new Error('Serviço indisponível'));
      
      // Executar
      const resultado = await faseAnalise.execute(inputPadrao);
      
      // Verificar fallback em caso de erro

      expect(mockLogger.erro).toHaveBeenCalledWith(expect.stringContaining('Erro na análise do arquiteto'));
    });
    
    test('deve validar evidências quando arquiteto afirma que já havia executado anteriormente', async () => {
      // Configurar mocks - arquiteto diz que já executou antes
      mockFileSystemAnalise.access.mockRejectedValue(new Error('Arquivo não existe'));
      mockSnapshot.takeSnapshot.mockResolvedValue(new Map([['/test/project/file1.ts', 123456789]]));
      mockSnapshot.compareSnapshots.mockReturnValue({
        modified: [],
        created: [],
        deleted: [],
        totalChanges: 0
      });
      
      mockAnaliseTarefa.analisarRespostaArquiteto.mockResolvedValue({
        hasExecuted: false,
        hasPlan: true,
        confidence: 75,
        executionDetails: null,
        planDetails: 'Plano para verificar implementação existente',
        analysisFailed: false,
        hadExecuted: true // Afirma que já executou anteriormente
      });
      
      // Executar
      const resultado = await faseAnalise.execute(inputPadrao);
      
      // Verificar - hadExecuted é considerado como evidência
      expect(resultado.sucesso).toBe(true);
    });
  });
  
  describe('validação de entrada', () => {
    test('deve lidar com tarefa sem projeto', async () => {
      const inputSemProjeto = {
        tarefaAtual: {
          id: 'task-123',
          title: 'Test Task',
          description: 'Test description',
          project: null
        } as any,
        planoAnalise: null,
        respostaArquiteto: 'Resposta do arquiteto',
        caminhoPlanoArquiteto: '/tmp/plano.json',
        snapshotInicial: new Map(),
        diretorioBase: '/test'
      };
      
      // Configurar mocks básicos
      mockFileSystemAnalise.access.mockRejectedValue(new Error('Arquivo não existe'));
      mockSnapshot.takeSnapshot.mockResolvedValue(new Map());
      mockSnapshot.compareSnapshots.mockReturnValue({
        modified: [],
        created: [],
        deleted: [],
        totalChanges: 0
      });
      
      // Mock deve lidar com projeto null
      mockAnaliseTarefa.analisarRespostaArquiteto.mockResolvedValue({
        hasExecuted: false,
        hasPlan: true,
        confidence: 50,
        executionDetails: null,
        planDetails: 'Plano básico',
        analysisFailed: false,
        hadExecuted: false
      });
      
      const resultado = await faseAnalise.execute(inputSemProjeto as any);
      
      expect(resultado.sucesso).toBe(true);

    });
  });
});