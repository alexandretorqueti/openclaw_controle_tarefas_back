
// src/steps/VerificaLock.ts

import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";
import { log } from '../aux/logger';
import { handleTaskTimeoutCheck } from '../steps/adapters/legacyTaskTimeoutCheck';
import { segundosToMinutos_Segundos } from '../utils/timeUtils';

// Verifica se existe um lock ativo. 
export const passoVerificaLock: Passo = {
    name: 'Verifica Lock',
    func: async (ctx: ContextoExecucao) => {
        const { lockService, stateService } = ctx.services;
        const { controleExecucao } = ctx;
        ctx.lockAtivo = false;
        const lockCheck = await lockService.checkLock(ctx.config.TASK_TIMEOUT_MS);

        controleExecucao.processoFantasma = undefined; // Reset para evitar confusão com checagens anteriores
        if (lockCheck.locked) {
            if (lockCheck.ageRecent) {
                ctx.lockAtivo = true;
                await log(`🔒 Lock recente (${segundosToMinutos_Segundos((Date.now() - lockCheck.mtime)/1000)}). Mantendo execução atual.`);
            } else {
                // Se não limparmos ou verificarmos o timeout, o monitor morre aqui.
                controleExecucao.processoFantasma = { pid: lockCheck.pid }; // Para o monitor logar depois do ciclo
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

