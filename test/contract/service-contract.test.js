// test/contract/service-contract.test.js
/**
 * Testes de contrato que verificam a estrutura e tipos dos serviços.
 * Esses testes capturam problemas de incompatibilidade entre implementação e uso.
 */

describe('Contratos dos Serviços', () => {
  describe('TaskFileService', () => {
    it('deve ter métodos de instância (não estáticos)', () => {
      // Carregar o serviço real
      const TaskFileService = require('../../src/services/taskFileService');
      
      // Criar instância
      const instance = new TaskFileService();
      
      // Lista de métodos obrigatórios
      const requiredMethods = [
        'moveTaskFiles',
        'getTaskFilePaths', 
        'prepareTaskFiles',
        'generatePromptContent',
        'cleanupFiles'
      ];
      
      // Verificar cada método
      requiredMethods.forEach(methodName => {
        // Verificar se existe na instância
        const hasInstanceMethod = typeof instance[methodName] === 'function';
        
        // Verificar se existe como estático (não deveria)
        const hasStaticMethod = typeof TaskFileService[methodName] === 'function';
        
        // Reportar diagnóstico
        console.log(`${methodName}:`);
        console.log(`  - Na instância: ${hasInstanceMethod ? 'SIM' : 'NÃO'}`);
        console.log(`  - Como estático: ${hasStaticMethod ? 'SIM' : 'NÃO'}`);
        
        // Condições de erro
        if (!hasInstanceMethod) {
          throw new Error(`TaskFileService não tem método de instância: ${methodName}`);
        }
        
        // Aviso se tiver ambos (pode ser confuso)
        if (hasInstanceMethod && hasStaticMethod) {
          console.warn(`AVISO: ${methodName} existe como método de instância E estático`);
        }
      });
      
      // Verificação adicional: prototype deve ter os métodos
      const prototypeMethods = Object.getOwnPropertyNames(TaskFileService.prototype || {});
      console.log('Métodos no prototype:', prototypeMethods);
      
      // Pelo menos os métodos obrigatórios devem estar no prototype
      requiredMethods.forEach(methodName => {
        if (!prototypeMethods.includes(methodName)) {
          throw new Error(`Método ${methodName} não está no prototype de TaskFileService`);
        }
      });
    });

    it('deve ser compatível com os steps que o usam', () => {
      // Carregar serviços
      const TaskFileService = require('../../src/services/taskFileService');
      const TaskFailureStep = require('../../src/steps/TaskFailureStep');
      const TaskSuccessStep = require('../../src/steps/TaskSuccessStep');
      const TaskTimeoutCheckStep = require('../../src/steps/TaskTimeoutCheckStep');
      
      // Criar instância do serviço
      const taskFileService = new TaskFileService();
      
      // Mock de configuração básica
      const mockConfig = {
        API_URL: 'http://localhost:3000',
        TASKS_DIR: '/tmp/tasks',
        ERROR_DIR: '/tmp/errors',
        PROCESSED_DIR: '/tmp/processed',
        LOCK_FILE: '/tmp/lock.pid'
      };
      
      const mockLog = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
      };
      
      // Testar cada step
      const steps = [
        { name: 'TaskFailureStep', Class: TaskFailureStep },
        { name: 'TaskSuccessStep', Class: TaskSuccessStep },
        { name: 'TaskTimeoutCheckStep', Class: TaskTimeoutCheckStep }
      ];
      
      steps.forEach(({ name, Class }) => {
        console.log(`\nTestando ${name}:`);
        
        try {
          // Criar step com taskFileService injetado
          const step = new Class({
            taskFileService,
            config: mockConfig,
            log: mockLog
          });
          
          // Verificar se o serviço foi injetado corretamente
          expect(step.taskFileService).toBe(taskFileService);
          
          // Verificar se podemos chamar os métodos
          expect(typeof step.taskFileService.moveTaskFiles).toBe('function');
          
          console.log(`  ✅ ${name} compatível com TaskFileService`);
        } catch (error) {
          console.error(`  ❌ ${name} INCOMPATÍVEL: ${error.message}`);
          throw error;
        }
      });
    });
  });

  describe('Verificação cross-service', () => {
    it('deve verificar consistência entre todos os serviços', () => {
      // Lista de serviços e seus métodos obrigatórios
      const serviceContracts = {
        TaskFileService: [
          'moveTaskFiles',
          'getTaskFilePaths',
          'prepareTaskFiles',
          'generatePromptContent',
          'cleanupFiles'
        ],
        LockService: [
          'releaseLock',
          'killAndRelease',
          'isProcessAlive'
        ],
        MonitorStateService: [
          'cleanupTask',
          'getTaskState',
          'setTaskState'
        ]
      };
      
      Object.entries(serviceContracts).forEach(([serviceName, requiredMethods]) => {
        console.log(`\nVerificando ${serviceName}:`);
        
        try {
          // Carregar serviço
          const ServiceClass = require(`../../src/services/${serviceName.charAt(0).toLowerCase() + serviceName.slice(1)}`);
          
          // Criar instância
          const instance = new ServiceClass('/tmp/test');
          
          // Verificar métodos
          requiredMethods.forEach(methodName => {
            const hasMethod = typeof instance[methodName] === 'function';
            
            if (!hasMethod) {
              throw new Error(`${serviceName} não tem método: ${methodName}`);
            }
            
            console.log(`  ✅ ${methodName}`);
          });
        } catch (error) {
          console.error(`  ❌ ${serviceName}: ${error.message}`);
          throw error;
        }
      });
    });
  });
});