declare const spawn: any;
declare const fs: any;
declare const path: any;
declare const prisma: any;
declare const NotificationService: any;
declare const sseService: any;
declare const taskHierarchyService: any;
declare class TaskService {
    exec(command: any, args: any, cwd: any): Promise<unknown>;
    checkAndCommit(projectPath: any, taskId: any, taskTitle: any): Promise<boolean>;
    buildProject(projectPath: any): Promise<{
        success: boolean;
        output: unknown;
    }>;
    validateReferences(data: any): Promise<{
        project: any;
        status: any;
        priority: any;
        creator: any;
        assignee: any;
    }>;
    createTask(data: any): Promise<any>;
    getAllTasks(filters?: {}): Promise<any>;
    getTaskById(id: any): Promise<any>;
    validateUpdateReferences(id: any, data: any): Promise<void>;
    updateTask(id: any, data: any): Promise<any>;
    /**
     * INICIA a execução exclusiva de uma tarefa.
     */
    startTaskExecution(taskId: any): Promise<any>;
    /**
     * PARA a execução de uma tarefa.
     */
    stopTaskExecution(taskId: any): Promise<any>;
    deleteTask(id: any): Promise<any>;
    updateTaskPosition(id: any, position: any): Promise<any>;
    toggleTaskCompletion(id: any): Promise<any>;
    getTasksByProject(projectId: any, filters?: {}): Promise<any>;
    getRecurringTasksDue(): Promise<any>;
    markTaskAsExecuted(taskId: any): Promise<any>;
    calculateNextExecution(taskData: any): Date;
    calculateNextDailyExecution(lastExecuted: any, recurrenceTimes: any): Date;
    calculateNextWeeklyExecution(lastExecuted: any, recurrenceDays: any, recurrenceTimes: any): Date;
    calculateNextMonthlyExecution(lastExecuted: any, recurrenceTimes: any): Date;
    calculateDateTimeForDay(dayOfWeek: any, recurrenceTimes: any, baseDate: any): Date;
    getNextTaskForUser(nickname: any): Promise<any>;
    finalizeTask(taskId: any, userId: any, executionNotes?: any): Promise<{
        task: any;
        status: any;
        history: any;
        isRecurringReset: boolean;
        ancestorsFinalized?: undefined;
        ancestorsHistory?: undefined;
        parentTaskFinalized?: undefined;
        parentHistory?: undefined;
    } | {
        task: any;
        status: any;
        history: any;
        ancestorsFinalized: any[];
        ancestorsHistory: any[];
        parentTaskFinalized: any;
        parentHistory: any;
        isRecurringReset: boolean;
    }>;
}
