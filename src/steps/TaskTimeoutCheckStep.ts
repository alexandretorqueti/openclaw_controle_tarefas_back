import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor_old";
import { log } from '../aux/logger';
import { segundosToMinutos_Segundos } from '../utils/timeUtils';

// Constante de negócio clara e documentada
const GRACE_PERIOD_MS = 60 * 1000; // 1 minuto de carência extra antes da interrupção crítica

export const passoTimeoutCheck: Passo = {
    name: 'Task Timeout Check',
    func: async (ctx: ContextoExecucao) => {
        // 1. Setup de dependências vindas do contexto
        const { lockService, stateService, fileService } = ctx.services;
        const { TASKS_DIR, ERROR_DIR, TASK_TIMEOUT_MS } = ctx.config;
        
        // No novo fluxo, o PID a verificar pode vir do contexto (setado pelo VerificaLock)
        const pidParaVerificar = ctx.controleExecucao?.processoFantasma?.pid;

        if (!pidParaVerificar) {
            return; // Nada para verificar
        }

        try {
            const activeTasks = await stateService.getActiveTasks();
            const taskIds = Object.keys(activeTasks);

            if (taskIds.length === 0) {
                await log(`ℹ️ Nenhuma tarefa registrada no state para o PID ${pidParaVerificar}`);
                return;
            }

            const now = Date.now();
            const taskId = taskIds[0]; // Assume-se uma tarefa por execução/lock
            const task = activeTasks[taskId];
            const elapsed = now - task.startTime;

            await log(`⏱️ Tarefa ${taskId} em execução há ${segundosToMinutos_Segundos(elapsed / 1000)}.`);

            /**
             * CENÁRIO 1: LIMITE CRÍTICO (Timeout + Carência)
             * Ação: Mata o processo e limpa arquivos.
             */
            if (elapsed > TASK_TIMEOUT_MS + GRACE_PERIOD_MS) {
                await log(`💀 CEIFADOR: Tarefa ${taskId} excedeu o limite crítico. Interrompendo PID ${pidParaVerificar}...`);
                
                await lockService.killAndRelease(pidParaVerificar);
                await fileService.moveTaskFiles(taskId, TASKS_DIR, ERROR_DIR);
                await stateService.cleanupTask(taskId);
                
                return;
            }

            /**
             * CENÁRIO 2: PERÍODO DE CARÊNCIA
             * Ação: Apenas loga o alerta.
             */
            if (elapsed > TASK_TIMEOUT_MS) {
                await log(`⚠️ ALERTA: Tarefa ${taskId} excedeu o tempo limite original. Aguardando carência de 1min.`);
                return;
            }

            /**
             * CENÁRIO 3: SAUDÁVEL
             */
            await log(`✅ Tarefa ${taskId} operando dentro do tempo limite.`);

        } catch (error) {
            await log(`💥 Falha crítica na verificação de timeout: ${error instanceof Error ? error.message : error}`);
            // Em caso de erro na ferramenta de monitoramento, talvez seja melhor abortar por segurança
        }
    }
};

