// test/steps/VerificaLock.test.ts

import { passoVerificaLock } from '../../src/steps/VerificaLock';
import { handleTaskTimeoutCheck } from '../../src/steps/adapters/legacyTaskTimeoutCheck';

jest.mock('../../src/steps/adapters/legacyTaskTimeoutCheck');

describe('Passo: Verifica Lock', () => {
    let mockContexto: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockContexto = {
            config: { TASK_TIMEOUT_MS: 900000, TASKS_DIR: '/tmp', ERROR_DIR: '/err' },
            services: {
                lockService: {
                    checkLock: jest.fn(),
                    forceReleaseLock: jest.fn()
                },
                stateService: {
                    clearState: jest.fn()
                }
            }
        };
    });

    it('deve apenas logar e parar se o lock for recente', async () => {
        mockContexto.services.lockService.checkLock.mockResolvedValue({
            locked: true,
            ageRecent: true,
            mtime: Date.now() - 10000 // 10 segundos atrás
        });

        await passoVerificaLock.func(mockContexto);

        expect(handleTaskTimeoutCheck).not.toHaveBeenCalled();
        expect(mockContexto.services.lockService.forceReleaseLock).not.toHaveBeenCalled();
    });

    it('deve limpar lock órfão e resetar estado se o PID não estiver vivo', async () => {
        mockContexto.services.lockService.checkLock.mockResolvedValue({
            locked: false,
            pid: 1234,
            alive: false, // Processo morreu
            corrupted: false
        });

        await passoVerificaLock.func(mockContexto);

        expect(mockContexto.services.lockService.forceReleaseLock).toHaveBeenCalled();
        expect(mockContexto.services.stateService.clearState).toHaveBeenCalled();
    });

    it('deve tratar lock antigo/ativo chamando a rotina de timeout', async () => {
        mockContexto.services.lockService.checkLock.mockResolvedValue({
            locked: true,
            ageRecent: false, // Muito antigo
            pid: 999
        });

        await passoVerificaLock.func(mockContexto);

        expect(handleTaskTimeoutCheck).toHaveBeenCalledWith(999, expect.any(Object));
    });
});