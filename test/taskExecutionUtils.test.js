// test/taskExecutionUtils.test.js
// Testes unitários para utilitários de execução de tarefas

const path = require('path');

describe('TaskExecutionService Utils', () => {
  // Mock do TaskExecutionService para testar métodos estáticos
  const TaskExecutionService = require('../src/services/taskExecutionService');

  describe('detectTaskType', () => {
    test('deve detectar tarefa de análise', () => {
      const task = { title: 'Análise do sistema', description: 'Documentar a arquitetura' };
      const result = TaskExecutionService.detectTaskType(task);
      expect(result).toBe('analysis');
    });

    test('deve detectar tarefa de desenvolvimento', () => {
      const task = { title: 'Implementar endpoint', description: 'Criar controller e service' };
      const result = TaskExecutionService.detectTaskType(task);
      expect(result).toBe('development');
    });

    test('deve detectar tarefa de automação', () => {
      const task = { title: 'Executar deploy', description: 'Deploy no servidor' };
      const result = TaskExecutionService.detectTaskType(task);
      expect(result).toBe('automation');
    });

    test('deve lidar com task vazia', () => {
      const task = {};
      const result = TaskExecutionService.detectTaskType(task);
      expect(result).toBe('automation');
    });
  });

  describe('requiresReport', () => {
    test('deve retornar true para tarefas que pedem relatório', () => {
      const task = { title: 'Gerar relatório', description: 'documente tudo' };
      expect(TaskExecutionService.requiresReport(task)).toBe(true);
    });

    test('deve retornar false para tarefas sem pedido de relatório', () => {
      const task = { title: 'Corrigir bug', description: 'Ajustar código' };
      expect(TaskExecutionService.requiresReport(task)).toBe(false);
    });
  });

  describe('resolveProjectPath', () => {
    test('deve resolver caminho absoluto sem basePath', () => {
      const result = TaskExecutionService.resolveProjectPath(null, '/home/user/project');
      expect(result).toBe('/home/user/project');
    });

    test('deve resolver caminho relativo com basePath', () => {
      const result = TaskExecutionService.resolveProjectPath('/home/user', 'project/src');
      expect(result).toBe('/home/user/project/src');
    });

    test('deve retornar null para subPath vazio', () => {
      const result = TaskExecutionService.resolveProjectPath('/home/user', null);
      expect(result).toBeNull();
    });
  });

  describe('isPathInside', () => {
    test('deve retornar true quando targetPath está dentro de basePath', () => {
      const result = TaskExecutionService.isPathInside('/home/user/project/src', '/home/user/project');
      expect(result).toBe(true);
    });

    test('deve retornar false quando targetPath está fora de basePath', () => {
      const result = TaskExecutionService.isPathInside('/home/other/project', '/home/user/project');
      expect(result).toBe(false);
    });

    test('deve retornar true quando targetPath é igual a basePath', () => {
      const result = TaskExecutionService.isPathInside('/home/user/project', '/home/user/project');
      expect(result).toBe(true);
    });
  });

  describe('formatNumberedList', () => {
    test('deve formatar lista de itens', () => {
      const items = ['Item A', 'Item B', 'Item C'];
      const result = TaskExecutionService.formatNumberedList(items);
      expect(result).toBe('1. Item A\n2. Item B\n3. Item C');
    });

    test('deve retornar fallback para lista vazia', () => {
      const result = TaskExecutionService.formatNumberedList([]);
      expect(result).toBe('1. Nenhum item definido.');
    });

    test('deve retornar fallback customizado para lista vazia', () => {
      const result = TaskExecutionService.formatNumberedList([], 'Nada aqui');
      expect(result).toBe('1. Nada aqui');
    });
  });

  describe('formatInlineList', () => {
    test('deve formatar lista inline', () => {
      const items = ['A', 'B', 'C'];
      const result = TaskExecutionService.formatInlineList(items);
      expect(result).toBe('A, B, C');
    });

    test('deve retornar fallback para lista vazia', () => {
      const result = TaskExecutionService.formatInlineList([]);
      expect(result).toBe('nenhum');
    });
  });

  describe('normalizeCommandSignature', () => {
    test('deve normalizar comando', () => {
      const result = TaskExecutionService.normalizeCommandSignature('  ls   -la   ');
      expect(result).toBe('ls -la');
    });

    test('deve retornar string vazia para comando vazio', () => {
      const result = TaskExecutionService.normalizeCommandSignature('');
      expect(result).toBe('');
    });
  });

  describe('isInspectionCommand', () => {
    test('deve detectar comando de inspeção', () => {
      expect(TaskExecutionService.isInspectionCommand('cat file.txt')).toBe(true);
      expect(TaskExecutionService.isInspectionCommand('grep pattern file')).toBe(true);
      expect(TaskExecutionService.isInspectionCommand('ls -la')).toBe(true);
    });

    test('deve retornar false para comandos não de inspeção', () => {
      expect(TaskExecutionService.isInspectionCommand('rm file.txt')).toBe(false);
    });
  });

  describe('isMutationCommand', () => {
    test('deve detectar comando de mutação', () => {
      expect(TaskExecutionService.isMutationCommand('sed -i "s/a/b/g" file.txt')).toBe(true);
      expect(TaskExecutionService.isMutationCommand('rm file.txt')).toBe(true);
      expect(TaskExecutionService.isMutationCommand('mv old.txt new.txt')).toBe(true);
    });

    test('deve retornar false para comandos read-only', () => {
      expect(TaskExecutionService.isMutationCommand('cat file.txt')).toBe(false);
    });
  });

  describe('extractJsonObjects', () => {
    test('deve extrair objetos JSON do texto', () => {
      const text = 'Some text {"name": "test"} more text {"value": 123}';
      const result = TaskExecutionService.extractJsonObjects(text);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe('{"name": "test"}');
      expect(result[1]).toBe('{"value": 123}');
    });

    test('deve lidar com JSON aninhado', () => {
      const text = '{"outer": {"inner": "value"}}';
      const result = TaskExecutionService.extractJsonObjects(text);
      expect(result).toHaveLength(1);
      expect(JSON.parse(result[0])).toEqual({ outer: { inner: 'value' } });
    });

    test('deve retornar array vazio para texto sem JSON', () => {
      const result = TaskExecutionService.extractJsonObjects('No JSON here');
      expect(result).toHaveLength(0);
    });
  });

  describe('normalizeToolCall', () => {
    test('deve normalizar tool call exec', () => {
      const parsed = { name: 'exec', arguments: { command: 'ls -la' } };
      const result = TaskExecutionService.normalizeToolCall(parsed);
      expect(result).toEqual({ name: 'exec', arguments: { command: 'ls -la' } });
    });

    test('deve normalizar tool call read', () => {
      const parsed = { name: 'read', arguments: { file_path: '/path/to/file' } };
      const result = TaskExecutionService.normalizeToolCall(parsed);
      expect(result).toEqual({ name: 'read', arguments: { file_path: '/path/to/file' } });
    });

    test('deve normalizar tool call write', () => {
      const parsed = { name: 'write', arguments: { file_path: '/path/to/file', content: 'hello' } };
      const result = TaskExecutionService.normalizeToolCall(parsed);
      expect(result).toEqual({ name: 'write', arguments: { file_path: '/path/to/file', content: 'hello' } });
    });

    test('deve normalizar tool call edit', () => {
      const parsed = { name: 'edit', arguments: { file_path: '/path', oldText: 'old', newText: 'new' } };
      const result = TaskExecutionService.normalizeToolCall(parsed);
      expect(result).toEqual({ name: 'edit', arguments: { file_path: '/path', oldText: 'old', newText: 'new' } });
    });

    test('deve retornar null para ferramenta desconhecida', () => {
      const parsed = { name: 'unknown', arguments: {} };
      const result = TaskExecutionService.normalizeToolCall(parsed);
      expect(result).toBeNull();
    });

    test('deve retornar null para input inválido', () => {
      expect(TaskExecutionService.normalizeToolCall(null)).toBeNull();
      expect(TaskExecutionService.normalizeToolCall({})).toBeNull();
    });
  });

  describe('extractToolCallFromText', () => {
    test('deve extrair tool call de texto com JSON', () => {
      const text = '{"name": "exec", "arguments": {"command": "pwd"}}';
      const result = TaskExecutionService.extractToolCallFromText(text);
      expect(result).toEqual({ name: 'exec', arguments: { command: 'pwd' } });
    });

    test('deve extrair tool call de bloco code fenced', () => {
      const text = '```json\n{"name": "read", "arguments": {"file_path": "/tmp/test"}}\n```';
      const result = TaskExecutionService.extractToolCallFromText(text);
      expect(result).toEqual({ name: 'read', arguments: { file_path: '/tmp/test' } });
    });

    test('deve retornar null para texto sem tool call', () => {
      const result = TaskExecutionService.extractToolCallFromText('Just some text');
      expect(result).toBeNull();
    });
  });

  describe('detectRepeatedActionLoop', () => {
    test('deve detectar loop de ações repetidas', () => {
      const signatures = ['a', 'b', 'a', 'b', 'a', 'b'];
      const result = TaskExecutionService.detectRepeatedActionLoop(signatures, 12, 3);
      expect(result.detected).toBe(true);
    });

    test('deve não detectar loop quando não há repetição', () => {
      const signatures = ['a', 'b', 'c', 'd', 'e', 'f'];
      const result = TaskExecutionService.detectRepeatedActionLoop(signatures, 12, 3);
      expect(result.detected).toBe(false);
    });

    test('deve lidar com array vazio', () => {
      const result = TaskExecutionService.detectRepeatedActionLoop([]);
      expect(result.detected).toBe(false);
    });
  });

  describe('analyzeTaskScope', () => {
    test('deve analisar escopo de tarefa de análise', () => {
      const task = { title: 'Análise do sistema', description: 'Documentar arquitetura' };
      const project = { frontendPath: '/app/frontend', backendPath: '/app/backend' };
      const result = TaskExecutionService.analyzeTaskScope(task, project);
      
      expect(result.taskType).toBe('analysis');
      expect(result.mandatoryChecks.length).toBeGreaterThan(0);
      expect(result.definitionOfDone.length).toBeGreaterThan(0);
    });

    test('deve analisar escopo de tarefa de desenvolvimento', () => {
      const task = { title: 'Implementar endpoint', description: 'Criar controller e service no backend' };
      const project = { frontendPath: '/app/frontend', backendPath: '/app/backend' };
      const result = TaskExecutionService.analyzeTaskScope(task, project);
      
      expect(result.taskType).toBe('development');
      expect(result.expectedLayers).toContain('backend');
    });
  });
});
