declare const taskService: any;
declare class RecurrenceController {
    getRecurringTasksDue(req: any, res: any, next: any): Promise<void>;
    markTaskAsExecuted(req: any, res: any, next: any): Promise<any>;
    executeAllDueTasks(req: any, res: any, next: any): Promise<void>;
    calculateNextExecution(req: any, res: any, next: any): Promise<any>;
}
