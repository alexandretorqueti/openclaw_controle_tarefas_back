declare const logger: any;
declare class ProcessKiller {
    static killAfterDelay(delayMs?: number): void;
    static killNow(): void;
    static killAfterTaskCreation(task: any, delayMs?: number): void;
}
