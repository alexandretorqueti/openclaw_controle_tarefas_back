// src/steps/VerificaLock.ts

import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";
import { log } from '../aux/logger';
import { handleTaskTimeoutCheck } from '../steps/adapters/legacyTaskTimeoutCheck';
import { segundosToMinutos_Segundos } from '../utils/timeUtils';

export const passoVerificaLock: Passo = {
    name: 'Verifica Lock',
    func: async (ctx: ContextoExecucao) => {
        const { lockService, stateService } = ctx.services;
        ctx.lockAtivo = false;
        const lockCheck = await lockService.checkLock(ctx.config.TASK_TIMEOUT_MS);

        if (lockCheck.locked) {
            if (lockCheck.ageRecent) {
                ctx.lockAtivo = true;
                await log(`🔒 Lock recente (${segundosToMinutos_Segundos((Date.now() - lockCheck.mtime)/1000)}). Mantendo execução atual.`);
            } else {
                await log(`🔒 Lock antigo/ativo detectado. PID ${lockCheck.pid}.`);
                await handleTaskTimeoutCheck(lockCheck.pid, { 
                    TASK_TIMEOUT_MS: ctx.config.TASK_TIMEOUT_MS, 
                    TASKS_DIR: ctx.config.TASKS_DIR, 
                    ERROR_DIR: ctx.config.ERROR_DIR 
                });
            }

            return;
        }

        if (lockCheck.corrupted) {
            await log(`⚠️ Lock corrompido. Limpando...`);
            await lockService.forceReleaseLock();
        } else if (lockCheck.pid && !lockCheck.alive) {
            await log(`🧹 Lock órfão. Limpando...`);
            await lockService.forceReleaseLock();
            await stateService.clearState();
        }
    }
}