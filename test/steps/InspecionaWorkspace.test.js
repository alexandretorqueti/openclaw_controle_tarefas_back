"use strict";
// test/steps/InspecionaWorkspace.test.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const InspecionaWorkspace_1 = require("../../src/steps/InspecionaWorkspace");
const container_1 = __importDefault(require("../../src/container"));
jest.mock('../../src/container');
beforeAll(() => {
    // Faz o console.error não fazer nada durante o teste 
    // (ou apenas imprimir a mensagem sem o rastro do Jest)
    jest.spyOn(console, 'error').mockImplementation(() => { });
});
describe('Passo: Inspeciona Workspace', () => {
    let mockContexto;
    let mockFileSystem;
    let mockPath;
    let mockWorkspaceSnapshotService;
    let mockEvidenceService;
    beforeEach(() => {
        jest.clearAllMocks();
        mockFileSystem = {
            readdir: jest.fn()
        };
        mockPath = {
            join: jest.fn((dir, file) => `${dir}/${file}`)
        };
        mockWorkspaceSnapshotService = {
            takeSnapshot: jest.fn().mockResolvedValue({ files: { 'a.ts': 'hash1' } }),
            compareSnapshots: jest.fn().mockReturnValue({ modified: ['a.ts'], created: [] })
        };
        mockEvidenceService = {
            createEmptyEvidence: jest.fn().mockReturnValue({ steps: [] }),
            applyExecutionEvidence: jest.fn()
        };
        container_1.default.resolve.mockImplementation((name) => {
            if (name === 'fileSystem')
                return mockFileSystem;
            if (name === 'path')
                return mockPath;
            if (name === 'workspaceSnapshotService')
                return mockWorkspaceSnapshotService;
            if (name === 'evidenceService')
                return mockEvidenceService;
            return {};
        });
        mockContexto = {
            config: {
                TASKS_DIR: '/tmp/tasks'
            },
            tarefaAtual: {
                id: '123',
                project: { pastaBase: '/src/projeto' },
            },
            controleExecucao: {
                taskDir: '/tmp/tasks/123',
                initialSnapshot: { files: { 'a.ts': 'hash_antigo' } },
                toolCall: { name: 'write' },
                toolResult: { success: true }
            }
        };
    });
    it('deve encontrar o arquivo .done na pasta da tarefa (taskDir)', async () => {
        // Simula encontrar na primeira tentativa (taskDir)
        mockFileSystem.readdir.mockImplementation(async (dir) => {
            if (dir === '/tmp/tasks/123')
                return ['arquivo.txt', 'finalizado.done'];
            return [];
        });
        await InspecionaWorkspace_1.passoInspecionaWorkspace.func(mockContexto);
        expect(mockContexto.controleExecucao.doneExists).toBe(true);
        expect(mockContexto.controleExecucao.actualDonePath).toBe('/tmp/tasks/123/finalizado.done');
    });
    it('deve encontrar o arquivo .done na pasta do projeto se não achar na taskDir', async () => {
        mockFileSystem.readdir.mockImplementation(async (dir) => {
            if (dir === '/tmp/tasks/123')
                return ['apenas_log.txt']; // Não achou aqui
            if (dir === '/src/projeto')
                return ['src', 'package.json', 'meu.done']; // Achou aqui
            return [];
        });
        await InspecionaWorkspace_1.passoInspecionaWorkspace.func(mockContexto);
        expect(mockContexto.controleExecucao.doneExists).toBe(true);
        expect(mockContexto.controleExecucao.actualDonePath).toBe('/src/projeto/meu.done');
    });
    it('deve registrar hasRealChanges=true se o snapshot detectar modificações', async () => {
        // fileSystem não acha o .done para não atrapalhar esse teste
        mockFileSystem.readdir.mockResolvedValue([]);
        await InspecionaWorkspace_1.passoInspecionaWorkspace.func(mockContexto);
        expect(mockWorkspaceSnapshotService.takeSnapshot).toHaveBeenCalledWith('/src/projeto');
        expect(mockContexto.controleExecucao.hasRealChanges).toBe(true);
        expect(mockContexto.controleExecucao.changesSummary.modified).toContain('a.ts');
    });
    it('deve lidar graciosamente com erro no snapshot e setar hasRealChanges=false', async () => {
        mockFileSystem.readdir.mockResolvedValue([]);
        mockWorkspaceSnapshotService.takeSnapshot.mockRejectedValue(new Error('Permission Denied'));
        await InspecionaWorkspace_1.passoInspecionaWorkspace.func(mockContexto);
        expect(mockContexto.controleExecucao.hasRealChanges).toBe(false);
    });
    it('deve compilar as evidências usando o evidenceService', async () => {
        mockFileSystem.readdir.mockResolvedValue([]);
        await InspecionaWorkspace_1.passoInspecionaWorkspace.func(mockContexto);
        expect(mockEvidenceService.createEmptyEvidence).toHaveBeenCalled();
        expect(mockEvidenceService.applyExecutionEvidence).toHaveBeenCalledWith({ steps: [] }, // O empty evidence retornado pelo mock
        { name: 'write' }, { success: true }, { executionDirectory: '/src/projeto' });
        expect(mockContexto.controleExecucao.evidence).toBeDefined();
    });
});
afterAll(() => {
    jest.restoreAllMocks();
});
