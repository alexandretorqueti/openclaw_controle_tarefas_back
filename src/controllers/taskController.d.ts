declare const taskService: any;
declare const validateTask: any, validateTaskUpdate: any, validateTaskFilters: any;
declare const ErrorMiddleware: any;
declare const snakeToCamel: any;
declare const prisma: any;
declare const UserResolver: any;
declare class TaskController {
    /**
     * Helper para obter usuário a partir do nickname ou userId
     * Aceita: body.nickname, body.userNickname, body.createdByNickname,
     *         body.createdById, header X-User-Nickname, body.createBy
     */
    _resolveUser(req: any): Promise<any>;
    createTask: any;
    getAllTasks: any;
    getTaskById: any;
    updateTask: any;
    deleteTask: any;
    getTasksByProject: any;
    getTasksByStatus: any;
    getTasksByPriority: any;
    getTasksByUserId: any;
    getTasksWithRecurrence: any;
    getOverdueTasks: any;
    getUpcomingTasks: any;
    searchTasks: any;
    bulkUpdateTasks: any;
    getTaskStatistics: any;
    exportTasks: any;
    getNextTaskForUser: any;
    updateTaskPosition: any;
    toggleTaskCompletion: any;
    finalizeTask: any;
    finishTaskExecution: any;
}
