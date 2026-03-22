// test/integration/container-integration.test.js
/**
 * Teste de integração que verifica se as dependências do container
 * são resolvidas corretamente e têm os métodos esperados.
 */

const container = require('../../src/container');
const bootstrap = require('../../src/bootstrap');

describe('Integração do Container', () => {
  beforeAll(() => {
    // Executar bootstrap para registrar todas as dependências
    bootstrap;
  });

  afterEach(() => {
    container.clear();
  });

  describe('Resolução de dependências', () => {
    it('deve resolver TaskFileServiceClass e criar instância válida', () => {
      // Registrar dependências necessárias
      const mockConfig = {
        API_URL: 'http://localhost:3000',
        TASKS_DIR: '/tmp/tasks',
        ERROR_DIR: '/tmp/errors',
        LOCK_FILE: '/tmp/lock.pid'
      };
      
      const mockLog = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
      };
      
      container.register('config', mockConfig);
      container.register('log', mockLog);
      container.register('axios', require('axios'));
      container.register('path', require('path'));
      container.register('fileUtils', require('../../src/utils/fileUtils'));
      container.register('fileSystem', require('fs').promises);
      
      // Registrar TaskFileService real
      const TaskFileService = require('../../src/services/taskFileService');
      container.register('TaskFileServiceClass', TaskFileService);
      
      // Resolver e criar instância
      const TaskFileServiceClass = container.get('TaskFileServiceClass');
      const instance = new TaskFileServiceClass();
      
      // Verificar se a instância tem os métodos necessários
      expect(instance).toBeDefined();
      expect(typeof instance.moveTaskFiles).toBe('function');
      expect(typeof instance.getTaskFilePaths).toBe('function');
      expect(typeof instance.prepareTaskFiles).toBe('function');
      expect(typeof instance.generatePromptContent).toBe('function');
      expect(typeof instance.cleanupFiles).toBe('function');
    });

    it('deve criar TaskFailureStep com dependências válidas', () => {
      // Configurar mocks básicos
      const mockConfig = {
        API_URL: 'http://localhost:3000',
        TASKS_DIR: '/tmp/tasks',
        ERROR_DIR: '/tmp/errors',
        LOCK_FILE: '/tmp/lock.pid'
      };
      
      const mockLog = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
      };
      
      // Mock do LockService
      class MockLockService {
        constructor(lockFilePath) {
          this.lockFilePath = lockFilePath;
        }
        releaseLock = jest.fn().mockResolvedValue(true);
        killAndRelease = jest.fn().mockResolvedValue(true);
      }
      
      // Mock do MonitorStateService
      class MockMonitorStateService {
        constructor(tasksDir) {
          this.tasksDir = tasksDir;
        }
        cleanupTask = jest.fn().mockResolvedValue(true);
      }
      
      // Mock do TaskFileService (simulando o problema)
      class MockTaskFileServiceWithStaticMethods {
        // Métodos estáticos - SIMULA O ERRO ORIGINAL
        static moveTaskFiles = jest.fn().mockResolvedValue(true);
        static getTaskFilePaths = jest.fn();
        static prepareTaskFiles = jest.fn();
        static generatePromptContent = jest.fn();
        static cleanupFiles = jest.fn();
        
        // Construtor vazio
        constructor() {}
      }
      
      // Registrar dependências
      container.register('config', mockConfig);
      container.register('log', mockLog);
      container.register('axios', require('axios'));
      container.register('path', require('path'));
      container.register('fileUtils', require('../../src/utils/fileUtils'));
      container.register('fileSystem', require('fs').promises);
      container.register('LockServiceClass', MockLockService);
      container.register('MonitorStateServiceClass', MockMonitorStateService);
      container.register('TaskFileServiceClass', MockTaskFileServiceWithStaticMethods);
      
      // Importar TaskFailureStep
      const TaskFailureStep = require('../../src/steps/TaskFailureStep');
      
      // Criar instância (deve falhar com métodos estáticos)
      const step = new TaskFailureStep();
      
      // Verificar se taskFileService foi criado
      expect(step.taskFileService).toBeDefined();
      
      // Tentar chamar moveTaskFiles - deve falhar se for estático
      try {
        const hasMoveTaskFiles = typeof step.taskFileService.moveTaskFiles === 'function';
        console.log('moveTaskFiles disponível?', hasMoveTaskFiles);
        
        if (!hasMoveTaskFiles) {
          throw new Error('moveTaskFiles não é uma função na instância');
        }
      } catch (error) {
        // Capturar e reportar o erro
        console.error('ERRO DETECTADO:', error.message);
        throw error;
      }
    });
  });

  describe('Teste de métodos específicos', () => {
    it('deve detectar quando TaskFileService tem métodos estáticos em vez de instância', () => {
      // Classe com métodos estáticos (simulando o bug)
      class BuggyTaskFileService {
        static moveTaskFiles() { return 'static method'; }
        static getTaskFilePaths() { return 'static method'; }
        
        constructor() {
          // Não define métodos de instância
        }
      }
      
      const instance = new BuggyTaskFileService();
      
      // Verificações que detectariam o bug
      expect(typeof instance.moveTaskFiles).not.toBe('function'); // Deve falhar
      expect(typeof BuggyTaskFileService.moveTaskFiles).toBe('function'); // Mas o estático existe
      
      // Esta verificação capturaria o bug
      const hasInstanceMethod = typeof instance.moveTaskFiles === 'function';
      const hasStaticMethod = typeof BuggyTaskFileService.moveTaskFiles === 'function';
      
      console.log('Método na instância?', hasInstanceMethod);
      console.log('Método estático?', hasStaticMethod);
      
      // Condição que indica o problema
      if (hasStaticMethod && !hasInstanceMethod) {
        throw new Error('TaskFileService tem métodos estáticos mas não de instância');
      }
    });
  });
});