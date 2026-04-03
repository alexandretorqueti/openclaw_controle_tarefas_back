
import { MacroFaseAnaliseArquiteto } from "../../passos/macro/FaseAnaliseArquiteto";
import type { AnaliseArquitetoInput, AnaliseArquitetoOutput, DependenciasAnaliseArquiteto } from "../../passos/macro/FaseAnaliseArquiteto";


const mockLogger = {
  info: jest.fn(),
  erro: jest.fn(),
  debug: jest.fn()
};

const mockFileSystem = {
  readdir: jest.fn(),
  stat: jest.fn()
};

const mockSnapshot = {
  logger: mockLogger,
  fileSystem: mockFileSystem,
  takeSnapshot: jest.fn(),
  compareSnapshots: jest.fn(),
  getModifiedFiles: jest.fn()
};


describe('MacroFaseAnaliseArquiteto_comIaReal', () => {
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
    let faseAnalise: MacroFaseAnaliseArquiteto;
    
    beforeEach(() => {
      jest.clearAllMocks();
        // Aqui quero que o access retorne um erro.      
        faseAnalise = new MacroFaseAnaliseArquiteto({
          logger: mockLogger,
          snapshot: mockSnapshot,
          fileSystem: {
            access: () => Promise.reject(new Error('Sem permissão'))
          }
        } as DependenciasAnaliseArquiteto);
    });
  
    test('Não alterou arquivos, não gerou o .done e nem gerou a análise. Deve tentar 3 vezes', 
        async () => {
            const inputAnalise: AnaliseArquitetoInput = {
                ...inputPadrao,
                planoAnalise: {
                    taskType: 'development'
                } as any
            }
            // Executar
            
            mockSnapshot.takeSnapshot.mockResolvedValue(new Map([['/test/project/file1.ts', 123456789]]));
            mockSnapshot.compareSnapshots.mockReturnValue({
              modified: [],
              created: [],
              deleted: [],
              totalChanges: 0
            });

            const resultado = await faseAnalise.execute(inputAnalise);

            
            expect(resultado.sucesso).toBe(true);
            expect(resultado.existsPlanoFile).toBe(false);
            expect(resultado.existsDoneFile).toBe(false);
            expect(resultado.hasRealChanges).toBe(false);
        });
    

});