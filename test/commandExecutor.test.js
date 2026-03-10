// test/commandExecutor.test.js
// Testes unitários para CommandExecutor

const fs = require('fs');
const path = require('path');
const CommandExecutor = require('../src/services/commandExecutor');

describe('CommandExecutor', () => {
  const testDir = path.join(__dirname, 'test-cmd-executor');
  const testFilePath = path.join(testDir, 'test-file.txt');

  beforeAll(async () => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  describe('buildResult', () => {
    test('deve construir resultado com sucesso', () => {
      const result = CommandExecutor.buildResult(true, {
        output: 'test output',
        filesRead: ['/path/to/file']
      });
      
      expect(result.success).toBe(true);
      expect(result.output).toBe('test output');
      expect(result.filesRead).toContain('/path/to/file');
    });

    test('deve construir resultado de falha', () => {
      const result = CommandExecutor.buildResult(false, {
        error: 'test error'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('test error');
    });
  });

  describe('resolveFilePath', () => {
    test('deve resolver caminho absoluto', () => {
      const result = CommandExecutor.resolveFilePath('/absolute/path/file.txt', '/cwd');
      expect(result).toBe('/absolute/path/file.txt');
    });

    test('deve resolver caminho relativo', () => {
      const result = CommandExecutor.resolveFilePath('relative/file.txt', '/home/user');
      expect(result).toBe('/home/user/relative/file.txt');
    });

    test('deve lancar erro para caminho invalido', () => {
      expect(() => CommandExecutor.resolveFilePath(null, '/cwd')).toThrow('Caminho de arquivo');
    });
  });

  describe('truncateOutput', () => {
    test('deve manter texto menor que o limite', () => {
      const result = CommandExecutor.truncateOutput('short text', 100);
      expect(result).toBe('short text');
    });

    test('deve truncar texto maior que o limite', () => {
      const longText = 'a'.repeat(200);
      const result = CommandExecutor.truncateOutput(longText, 50);
      expect(result.length).toBeLessThan(200);
      expect(result).toContain('[OUTPUT TRUNCADO]');
    });
  });

  describe('executeReadCommand', () => {
    test('deve ler arquivo existente', () => {
      fs.writeFileSync(testFilePath, 'test content');
      const result = CommandExecutor.executeReadCommand(testFilePath, testDir);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('test content');
      expect(result.filesRead).toContain(testFilePath);
    });

    test('deve retornar erro para arquivo inexistente', () => {
      const result = CommandExecutor.executeReadCommand('/nonexistent/file.txt', testDir);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('encontrado');
    });

    test('deve retornar erro para parametro ausente', () => {
      const result = CommandExecutor.executeReadCommand(null, testDir);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('ausente');
    });
  });

  describe('executeWriteCommand', () => {
    test('deve criar novo arquivo', () => {
      const result = CommandExecutor.executeWriteCommand(testFilePath, 'new content', testDir);
      
      expect(result.success).toBe(true);
      expect(fs.existsSync(testFilePath)).toBe(true);
      expect(fs.readFileSync(testFilePath, 'utf8')).toBe('new content');
    });

    test('deve sobrescrever arquivo existente', () => {
      fs.writeFileSync(testFilePath, 'old content');
      const result = CommandExecutor.executeWriteCommand(testFilePath, 'new content', testDir);
      
      expect(result.success).toBe(true);
      expect(fs.readFileSync(testFilePath, 'utf8')).toBe('new content');
    });

    test('deve retornar erro para parametros ausentes', () => {
      const result = CommandExecutor.executeWriteCommand(null, null, testDir);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('ausentes');
    });
  });

  describe('executeEditCommand', () => {
    test('deve editar arquivo com substituicao', () => {
      fs.writeFileSync(testFilePath, 'hello world');
      const result = CommandExecutor.executeEditCommand(testFilePath, 'world', 'universe', testDir);
      
      expect(result.success).toBe(true);
      expect(fs.readFileSync(testFilePath, 'utf8')).toBe('hello universe');
    });

    test('deve retornar erro quando oldText nao encontrado', () => {
      fs.writeFileSync(testFilePath, 'hello world');
      const result = CommandExecutor.executeEditCommand(testFilePath, 'not found', 'new', testDir);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('oldText');
    });

    test('deve retornar erro para arquivo inexistente', () => {
      const result = CommandExecutor.executeEditCommand('/nonexistent.txt', 'old', 'new', testDir);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('encontrado');
    });
  });

  describe('executeTool', () => {
    test('deve retornar erro para ferramenta invalida', async () => {
      const result = await CommandExecutor.executeTool({ name: null }, testDir);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('ausente');
    });

    test('deve retornar erro para ferramenta desconhecida', async () => {
      const result = await CommandExecutor.executeTool({ name: 'unknown_tool' }, testDir);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('suportada');
    });

    test('deve executar comando read', async () => {
      fs.writeFileSync(testFilePath, 'read test');
      const result = await CommandExecutor.executeTool(
        { name: 'read', arguments: { file_path: testFilePath } },
        testDir
      );
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('read test');
    });

    test('deve executar comando write', async () => {
      const result = await CommandExecutor.executeTool(
        { name: 'write', arguments: { file_path: testFilePath, content: 'write test' } },
        testDir
      );
      
      expect(result.success).toBe(true);
      expect(fs.readFileSync(testFilePath, 'utf8')).toBe('write test');
    });
  });
});
