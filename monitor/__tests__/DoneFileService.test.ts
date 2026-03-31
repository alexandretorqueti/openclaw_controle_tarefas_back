// monitor/__tests__/DoneFileService.test.ts
// ─────────────────────────────────────────────────────
// Testes unitários para o serviço de busca de arquivos .done
// ─────────────────────────────────────────────────────

import { DoneFileService } from '../services/DoneFileService';

// Mock do logger
const mockLogger = {
  info: jest.fn(),
  erro: jest.fn(),
  debug: jest.fn()
};

// Mock do fileSystem
const mockFileSystem = {
  readdir: jest.fn(),
  access: jest.fn(),
  stat: jest.fn()
};

// Mock do path
const mockPath = {
  join: jest.fn((...parts) => parts.join('/'))
};

describe('DoneFileService', () => {
  let doneFileService: DoneFileService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    doneFileService = new DoneFileService({
      logger: mockLogger,
      fileSystem: mockFileSystem,
      path: mockPath,
    });
  });
  
  describe('findDoneFile', () => {
    test('deve encontrar .done no diretório da tarefa (primeira prioridade)', async () => {
      // Configurar mocks
      mockFileSystem.access.mockResolvedValue(undefined);
      mockFileSystem.readdir.mockResolvedValue(['file1.txt', '.done', 'file2.js']);
      
      // Executar
      const resultado = await doneFileService.findDoneFile('/task/dir', '/project/base');
      
      // Verificar
      expect(resultado.found).toBe(true);
      expect(resultado.path).toBe('/task/dir/.done');
      expect(resultado.searchedLocations).toContain('/task/dir');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('.done encontrado no diretório da tarefa'));
      
      // Verificar que não buscou em outros locais
      expect(mockFileSystem.readdir).toHaveBeenCalledTimes(1);
    });
    
    test('deve encontrar .done na pasta base do projeto (segunda prioridade)', async () => {
      // Configurar mocks - taskDir não tem .done, projectBase tem
      mockFileSystem.access
        .mockResolvedValueOnce(undefined) // taskDir existe
        .mockResolvedValueOnce(undefined); // projectBase existe
      
      mockFileSystem.readdir
        .mockResolvedValueOnce(['file1.txt', 'file2.js']) // taskDir sem .done
        .mockResolvedValueOnce(['.done', 'src', 'package.json']); // projectBase com .done
      
      // Executar
      const resultado = await doneFileService.findDoneFile('/task/dir', '/project/base');
      
      // Verificar
      expect(resultado.found).toBe(true);
      expect(resultado.path).toBe('/project/base/.done');
      expect(resultado.searchedLocations).toEqual(['/task/dir', '/project/base']);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('.done encontrado na pasta base do projeto'));
    });
    
    test('deve encontrar .done em subdiretório relevante (terceira prioridade)', async () => {
      // Configurar mocks - taskDir e projectBase não têm .done, subdir tem
      mockFileSystem.access
        .mockResolvedValueOnce(undefined) // taskDir existe
        .mockResolvedValueOnce(undefined) // projectBase existe
        .mockResolvedValueOnce(undefined); // subdir existe
      
      mockFileSystem.readdir
        .mockResolvedValueOnce(['file1.txt']) // taskDir sem .done
        .mockResolvedValueOnce(['src', 'package.json']) // projectBase sem .done
        .mockResolvedValueOnce(['src', 'tests', 'node_modules']) // projectBase entries
        .mockResolvedValueOnce(['.done', 'index.js']); // subdir com .done
      
      mockFileSystem.stat
        .mockResolvedValueOnce({ isDirectory: () => true }) // src é diretório
        .mockResolvedValueOnce({ isDirectory: () => true }) // tests é diretório
        .mockResolvedValueOnce({ isDirectory: () => false }); // node_modules é ignorado
      
      // Executar
      const resultado = await doneFileService.findDoneFile('/task/dir', '/project/base');
      
      // Verificar
      expect(resultado.found).toBe(true);
      expect(resultado.path).toBe('/project/base/src/.done');
      expect(resultado.searchedLocations).toContain('/project/base/src');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('.done encontrado em subdiretório'));
    });
    
    test('deve retornar não encontrado quando .done não existe em nenhum local', async () => {
      // Configurar mocks - nenhum local tem .done
      mockFileSystem.access.mockResolvedValue(undefined);
      
      // Mock para taskDir
      mockFileSystem.readdir.mockResolvedValueOnce(['file1.txt', 'file2.js']);
      
      // Mock para projectBase
      mockFileSystem.readdir.mockResolvedValueOnce(['src', 'package.json', 'README.md']);
      
      // Mock para findRelevantSubdirectories - primeira chamada (projectBase)
      mockFileSystem.readdir.mockResolvedValueOnce(['src', 'tests']);
      
      mockFileSystem.stat
        .mockResolvedValueOnce({ isDirectory: () => true }) // src
        .mockResolvedValueOnce({ isDirectory: () => true }); // tests
      
      // Mock para subdiretório src (sem .done)
      mockFileSystem.readdir.mockResolvedValueOnce(['index.ts', 'utils.ts']);
      
      mockFileSystem.stat
        .mockResolvedValueOnce({ isDirectory: () => false }) // index.ts
        .mockResolvedValueOnce({ isDirectory: () => false }); // utils.ts
      
      // Mock para subdiretório tests (sem .done)
      mockFileSystem.readdir.mockResolvedValueOnce(['test1.spec.ts']);
      
      mockFileSystem.stat
        .mockResolvedValueOnce({ isDirectory: () => false }); // test1.spec.ts
      
      mockFileSystem.readdir.mockResolvedValueOnce([]); // Nenhum outro subdiretório relevante

      // Executar
      const resultado = await doneFileService.findDoneFile('/task/dir', '/project/base');
      
      // Verificar
      expect(resultado.found).toBe(false);
      expect(resultado.path).toBeNull();
      expect(resultado.searchedLocations.length).toBeGreaterThan(0);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('.done não encontrado'));
    });
    
    test('deve lidar com erro ao acessar diretório', async () => {
      // Configurar mocks - taskDir não existe
      mockFileSystem.access.mockRejectedValue(new Error('Diretório não existe'));
      
      // Executar
      const resultado = await doneFileService.findDoneFile('/task/dir', '/project/base');
      
      // Verificar - deve retornar não encontrado sem lançar erro
      expect(resultado.found).toBe(false);
      expect(resultado.path).toBeNull();
    });
    
    test('deve buscar apenas no taskDir quando projectBase não for fornecido', async () => {
      // Configurar mocks
      mockFileSystem.access.mockResolvedValue(undefined);
      mockFileSystem.readdir.mockResolvedValue(['.done']);
      
      // Executar sem projectBase
      const resultado = await doneFileService.findDoneFile('/task/dir');
      
      // Verificar
      expect(resultado.found).toBe(true);
      expect(resultado.path).toBe('/task/dir/.done');
      expect(resultado.searchedLocations).toEqual(['/task/dir']);
      // Não deve chamar readdir para projectBase
      expect(mockFileSystem.readdir).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('searchInDirectory', () => {
    test('deve encontrar arquivo com nome exato', async () => {
      mockFileSystem.access.mockResolvedValue(undefined);
      mockFileSystem.readdir.mockResolvedValue(['file1.txt', '.done', 'file2.js']);
      
      const resultado = await (doneFileService as any).searchInDirectory('/dir', '.done');
      
      expect(resultado.found).toBe(true);
      expect(resultado.path).toBe('/dir/.done');
    });
    
    test('deve encontrar arquivo que termina com sufixo', async () => {
      mockFileSystem.access.mockResolvedValue(undefined);
      mockFileSystem.readdir.mockResolvedValue(['file1.txt', 'task.done', 'file2.js']);
      
      const resultado = await (doneFileService as any).searchInDirectory('/dir', '.done');
      
      expect(resultado.found).toBe(true);
      expect(resultado.path).toBe('/dir/task.done');
    });
    
    test('deve retornar não encontrado quando arquivo não existe', async () => {
      mockFileSystem.access.mockResolvedValue(undefined);
      mockFileSystem.readdir.mockResolvedValue(['file1.txt', 'file2.js']);
      
      const resultado = await (doneFileService as any).searchInDirectory('/dir', '.done');
      
      expect(resultado.found).toBe(false);
      expect(resultado.path).toBeNull();
    });
    
    test('deve lidar com erro ao acessar diretório', async () => {
      mockFileSystem.access.mockRejectedValue(new Error('Sem permissão'));
      
      const resultado = await (doneFileService as any).searchInDirectory('/dir', '.done');
      
      expect(resultado.found).toBe(false);
      expect(resultado.path).toBeNull();
    });
  });
  
  describe('findRelevantSubdirectories', () => {
    test('deve retornar subdiretórios relevantes excluindo ignorados', async () => {
      // Configurar mocks sequenciais
      mockFileSystem.access.mockResolvedValue(undefined);
      
      // Primeira chamada: leitura do diretório base
      mockFileSystem.readdir
        .mockResolvedValueOnce(['src', 'node_modules', '.git', 'dist', 'package.json']) // base dir
        .mockResolvedValueOnce(['utils', 'components']); // src dir
      
      mockFileSystem.stat
        .mockResolvedValueOnce({ isDirectory: () => true }) // src
        .mockResolvedValueOnce({ isDirectory: () => true }) // node_modules (ignorado)
        .mockResolvedValueOnce({ isDirectory: () => true }) // .git (ignorado)
        .mockResolvedValueOnce({ isDirectory: () => true }) // dist (ignorado)
        .mockResolvedValueOnce({ isDirectory: () => false }) // package.json (não é diretório)
        .mockResolvedValueOnce({ isDirectory: () => true }) // utils
        .mockResolvedValueOnce({ isDirectory: () => true }); // components
      
      const resultado = await (doneFileService as any).findRelevantSubdirectories('/project');
      
      expect(resultado).toContain('/project/src');
      expect(resultado).toContain('/project/src/utils');
      expect(resultado).toContain('/project/src/components');
      expect(resultado).not.toContain('/project/node_modules');
      expect(resultado).not.toContain('/project/.git');
      expect(resultado).not.toContain('/project/dist');
    });
    
    test('deve lidar com erro ao acessar diretório base', async () => {
      mockFileSystem.access.mockRejectedValue(new Error('Diretório não existe'));
      
      const resultado = await (doneFileService as any).findRelevantSubdirectories('/project');
      
      expect(resultado).toEqual([]);
    });
  });
  
  describe('checkDoneFileExists', () => {
    test('deve retornar true quando arquivo existe', async () => {
      mockFileSystem.access.mockResolvedValue(undefined);
      
      const resultado = await doneFileService.checkDoneFileExists('/path/to/.done');
      
      expect(resultado).toBe(true);
    });
    
    test('deve retornar false quando arquivo não existe', async () => {
      mockFileSystem.access.mockRejectedValue(new Error('Arquivo não encontrado'));
      
      const resultado = await doneFileService.checkDoneFileExists('/path/to/.done');
      
      expect(resultado).toBe(false);
    });
  });
  
  describe('createDoneFile', () => {
    test('deve logar criação de arquivo .done', async () => {
      mockFileSystem.access.mockResolvedValue(undefined);
      
      const resultado = await doneFileService.createDoneFile('/path/to/.done');
      
      expect(resultado).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Criando arquivo .done'));
    });
    
    test('deve lidar com erro ao criar arquivo .done', async () => {
      mockFileSystem.access.mockRejectedValue(new Error('Sem permissão'));
      
      const resultado = await doneFileService.createDoneFile('/path/to/.done');
      
      expect(resultado).toBe(false);
      expect(mockLogger.erro).toHaveBeenCalledWith(expect.stringContaining('Erro ao criar .done'));
    });
  });
});