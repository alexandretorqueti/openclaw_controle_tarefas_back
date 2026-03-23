/**
 * Mock do MonitorStateService para testes (retorna uma classe construtora)
 */
export function createMonitorStateServiceMock(customizations?: {}): {
    new (tasksDir: any): {
        tasksDir: any;
        readState: jest.Mock<any, any, any>;
        saveState: jest.Mock<any, any, any>;
        registerActiveTask: jest.Mock<any, any, any>;
        cleanupTask: jest.Mock<any, any, any>;
        getActiveTask: jest.Mock<any, any, any>;
        getActiveTasks: jest.Mock<any, any, any>;
        getTaskElapsedTime: jest.Mock<any, any, any>;
        isTaskTimedOut: jest.Mock<any, any, any>;
        clearState: jest.Mock<any, any, any>;
    };
};
