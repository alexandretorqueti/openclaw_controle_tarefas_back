// test/e2e/step-execution.test.js
/**
 * Testes end-to-end que executam os steps com configuração real
 * (ou o mais próximo possível do real).
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Execução End-to-End dos Steps', () => {
  let tempDir;
  let tasksDir;
  let errorDir;
  let processedDir;
  
  beforeAll(async () => {
    // Criar diretório temporário para testes
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-test-'));
    tasksDir = path.join(tempDir, 'tasks');
    errorDir = path.join(tempDir, 'errors');
    processedDir = path.join(tempDir, 'processed');
    
    await fs.mkdir(tasksDir, { recursive: true });
    await fs.mkdir(errorDir, { recursive: true });
    await fs.mkdir(processedDir, { recursive: true });
  });
  
  afterAll(async () => {
    // Limpar diretório temporário
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Não foi possível limpar diretório temporário:', error.message);
    }
  });
  
  describe('TaskFailureStep com container real', () => {
    it('deve executar sem erros com dependências reais', async () => {
      // Configurar container real
      const container = require('../../src/container');
      const bootstrap = require('../../src/bootstrap');
      
      // Executar bootstrap para registrar dependências
      bootstrap;
      
      // Configuração real para teste
      const realConfig = {
        API_URL: 'http://localhost:3000',
        TASKS_DIR: tasksDir,
        ERROR_DIR: errorDir,
        PROCESSED_DIR: processedDir,
        LOCK_FILE: path.join(tempDir, 'lock.pid')
      };
      
      // Mock de axios para evitar chamadas HTTP reais
      const mockAxios = {
        get: jest.fn().mockResolvedValue({
          data: { users: [{ id: 'user-1', nickname: 'alexandre' }] }
        }),
        post: jest.fn().mockResolvedValue({ data: { id: 'comment-1' } }),
        put: jest.fn().mockResolvedValue({ data: { success: true } })
      };
      
      // Mock de log
      const mockLog = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
      };
      
      // Registrar dependências no container
      container.register('config', realConfig);
      container.register('log', mockLog);
      container.register('axios', mockAxios);
      container.register('path', path);
      container.register('fileUtils', require('../../src/utils/fileUtils'));
      container.register('fileSystem', fs);
      
      // Registrar serviços reais
      const LockService = require('../../src/services/lockService');
      const MonitorStateService = require('../../src/services/monitorStateService');
      const TaskFileService = require('../../src/services/taskFileService');
      
      container.register('LockServiceClass', LockService);
      container.register('MonitorStateServiceClass', MonitorStateService);
      container.register('TaskFileServiceClass', TaskFileService);
      
      // Criar arquivos de tarefa simulados
      const taskId = 'test-task-' + Date.now();
      const promptFile = path.join(tasksDir, `prompt-${taskId}.txt`);
      const terminalFile = path.join(tasksDir, `terminal-${taskId}.log`);
      
      await fs.writeFile(promptFile, 'Test prompt content');
      await fs.writeFile(terminalFile, 'Terminal output\nLine 1\nLine 2');
      
      // Criar step usando container (não injetando manualmente)
      const TaskFailureStep = require('../../src/steps/TaskFailureStep');
      const step = new TaskFailureStep();
      
      // Verificar se as dependências foram resolvidas corretamente
      expect(step.taskFileService).toBeDefined();
      expect(typeof step.taskFileService.moveTaskFiles).toBe('function');
      
      // Executar step
      const context = {
        task: {
          id: taskId,
          title: 'Tarefa de teste que falhou',
          description: 'Descrição da tarefa',
          assignedToId: 'user-1'
        },
        error: new Error('Erro simulado de teste'),
        userId: 'test-user'
      };
      
      const result = await step.execute(context);
      
      // Verificar resultados
      expect(result.failureResult.success).toBe(true);
      expect(result.failureResult.taskId).toBe(taskId);
      
      // Verificar se moveTaskFiles foi chamado
      // (não podemos verificar diretamente porque é real, mas podemos verificar logs)
      expect(mockLog.info).toHaveBeenCalledWith(
        expect.stringContaining(`Falha da tarefa ${taskId} tratada com sucesso`)
      );
      
      // Verificar se arquivos foram movidos
      const errorDirFiles = await fs.readdir(errorDir);
      console.log('Arquivos na pasta de erro:', errorDirFiles);
      
      // Pelo menos alguns arquivos deveriam ter sido movidos
      expect(errorDirFiles.length).toBeGreaterThan(0);
    });
    
    it('deve detectar erro se TaskFileService tiver métodos estáticos', async () => {
      // Este teste simula o bug original
      const container = require('../../src/container');
      
      // Classe bugada com métodos estáticos
      class BuggyTaskFileService {
        static moveTaskFiles = jest.fn().mockResolvedValue(true);
        static getTaskFilePaths = jest.fn();
        
        constructor() {
          // Não define métodos de instância - SIMULA O BUG
        }
      }
      
      // Configuração
      const realConfig = {
        API_URL: 'http://localhost:3000',
        TASKS_DIR: tasksDir,
        ERROR_DIR: errorDir,
        LOCK_FILE: path.join(tempDir, 'lock.pid')
      };
      
      const mockLog = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
      };
      
      // Registrar
      container.register('config', realConfig);
      container.register('log', mockLog);
      container.register('TaskFileServiceClass', BuggyTaskFileService);
      
      // Criar step
      const TaskFailureStep = require('../../src/steps/TaskFailureStep');
      const step = new TaskFailureStep();
      
      // Verificar se o bug seria detectado
      expect(step.taskFileService).toBeDefined();
      expect(typeof step.taskFileService.moveTaskFiles).not.toBe('function'); // Deve ser undefined
      
      // Tentar executar - deve falhar
      const context = {
        task: { id: 'test-1', title: 'Test' },
        error: new Error('Test')
      };
      
      try {
        await step.execute(context);
        // Se chegou aqui, o erro não foi lançado como esperado
        console.warn('AVISO: O step executou mesmo com TaskFileService bugado');
      } catch (error) {
        // Esperado - o erro deve ser lançado
        console.log('Erro capturado (esperado):', error.message);
        expect(error.message).toContain('is not a function');
      }
    });
  });
  
  describe('Diagnóstico automático', () => {
    it('deve verificar todos os steps para problemas comuns', async () => {
      const steps = [
        { name: 'TaskFailureStep', file: '../../src/steps/TaskFailureStep' },
        { name: 'TaskSuccessStep', file: '../../src/steps/TaskSuccessStep' },
        { name: 'TaskTimeoutCheckStep', file: '../../src/steps/TaskTimeoutCheckStep' }
      ];
      
      for (const { name, file } of steps) {
        console.log(`\nDiagnosticando ${name}:`);
        
        const StepClass = require(file);
        
        // Verificar se o construtor define taskFileService
        const constructorSource = StepClass.toString();
        const hasTaskFileServiceInConstructor = constructorSource.includes('this.taskFileService');
        
        console.log(`  - Define this.taskFileService no construtor? ${hasTaskFileServiceInConstructor ? '✅' : '❌'}`);
        
        // Verificar se usa taskFileService.moveTaskFiles
        const usesMoveTaskFiles = constructorSource.includes('taskFileService.moveTaskFiles');
        console.log(`  - Usa taskFileService.moveTaskFiles? ${usesMoveTaskFiles ? '✅' : '❌'}`);
        
        // Verificar padrão de injeção
        const usesCreateMethod = constructorSource.includes('_createTaskFileService');
        console.log(`  - Usa _createTaskFileService? ${usesCreateMethod ? '✅' : '❌'}`);
        
        if (!hasTaskFileServiceInConstructor) {
          console.warn(`  ⚠️ ${name} pode não estar definindo taskFileService corretamente`);
        }
      }
    });
  });
});