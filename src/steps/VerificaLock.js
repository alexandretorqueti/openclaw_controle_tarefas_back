"use strict";
// src/steps/VerificaLock.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.passoVerificaLock = void 0;
const logger_1 = require("../aux/logger");
const legacyTaskTimeoutCheck_1 = require("../steps/adapters/legacyTaskTimeoutCheck");
const timeUtils_1 = require("../utils/timeUtils");
exports.passoVerificaLock = {
    name: 'Verifica Lock',
    func: async (ctx) => {
        const { lockService, stateService } = ctx.services;
        ctx.lockAtivo = false;
        const lockCheck = await lockService.checkLock(ctx.config.TASK_TIMEOUT_MS);
        if (lockCheck.locked) {
            if (lockCheck.ageRecent) {
                ctx.lockAtivo = true;
                await (0, logger_1.log)(`🔒 Lock recente (${(0, timeUtils_1.segundosToMinutos_Segundos)((Date.now() - lockCheck.mtime) / 1000)}). Mantendo execução atual.`);
            }
            else {
                await (0, logger_1.log)(`🔒 Lock antigo/ativo detectado. PID ${lockCheck.pid}.`);
                await (0, legacyTaskTimeoutCheck_1.handleTaskTimeoutCheck)(lockCheck.pid, {
                    TASK_TIMEOUT_MS: ctx.config.TASK_TIMEOUT_MS,
                    TASKS_DIR: ctx.config.TASKS_DIR,
                    ERROR_DIR: ctx.config.ERROR_DIR
                });
            }
            return;
        }
        if (lockCheck.corrupted) {
            await (0, logger_1.log)(`⚠️ Lock corrompido. Limpando...`);
            await lockService.forceReleaseLock();
        }
        else if (lockCheck.pid && !lockCheck.alive) {
            await (0, logger_1.log)(`🧹 Lock órfão. Limpando...`);
            await lockService.forceReleaseLock();
            await stateService.clearState();
        }
    }
};
