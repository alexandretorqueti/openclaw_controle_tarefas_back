declare const fs: any;
declare const fileExists: any;
declare const taskHierarchyService: any;
declare const sseService: any;
declare const taskService: any;
declare class LockService {
    constructor(lockFilePath: any);
    /**
     * Verifica se um processo esta ativo pelo PID
     * @param {number} pid - Process ID
     * @returns {Promise<boolean>}
     */
    isProcessAlive(pid: any): Promise<boolean>;
    /**
     * Verifica se ha um lock ativo
     * @param {number} timeoutThresholdMs - Tempo em ms para considerar o lock como "recente"
     * @returns {Promise<Object>}
     */
    checkLock(timeoutThresholdMs?: number): Promise<{
        locked: boolean;
        pid: any;
        corrupted?: undefined;
        alive?: undefined;
        ageRecent?: undefined;
        mtime?: undefined;
        error?: undefined;
    } | {
        locked: boolean;
        pid: any;
        corrupted: boolean;
        alive?: undefined;
        ageRecent?: undefined;
        mtime?: undefined;
        error?: undefined;
    } | {
        locked: boolean;
        pid: number;
        alive: boolean;
        ageRecent: boolean;
        mtime: any;
        corrupted?: undefined;
        error?: undefined;
    } | {
        locked: boolean;
        pid: number;
        alive: boolean;
        mtime: any;
        corrupted?: undefined;
        ageRecent?: undefined;
        error?: undefined;
    } | {
        locked: boolean;
        pid: any;
        error: any;
        corrupted?: undefined;
        alive?: undefined;
        ageRecent?: undefined;
        mtime?: undefined;
    }>;
    /**
     * Adquire o lock e marca a tarefa como em execução
     * @param {string} taskId - ID da tarefa que será executada
     * @returns {Promise<boolean>}
     */
    acquireLock(taskId?: any): Promise<boolean>;
    /**
     * Libera o lock e marca a tarefa como não mais em execução
     * @returns {Promise<boolean>}
     */
    releaseLock(): Promise<boolean>;
    /**
     * Forca a remocao do lock (para locks orfaos) e marca tarefa como não mais em execução
     * @returns {Promise<boolean>}
     */
    forceReleaseLock(): Promise<boolean>;
    /**
     * Tenta matar um processo e liberar o lock
     * ⚠️ PERIGOSO: Pode matar processos válidos
     * @param {number} pid - PID do processo
     * @returns {Promise<boolean>}
     */
    killAndRelease(pid: any): Promise<boolean>;
}
