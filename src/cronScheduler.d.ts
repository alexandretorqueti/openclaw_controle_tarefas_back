declare const cron: any;
declare const taskService: any;
declare class CronScheduler {
    constructor();
    init(): void;
    stop(): void;
    checkAndExecuteDueTasks(): Promise<void>;
    manualExecuteDueTasks(): Promise<void>;
    getStatus(): {
        active: boolean;
        jobCount: any;
        nextRun: string;
    };
}
declare const scheduler: CronScheduler;
