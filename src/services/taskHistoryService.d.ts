declare const prisma: any;
declare class TaskHistoryService {
    getHistoryByTask(taskId: any): Promise<any>;
    createHistory(data: any): Promise<any>;
    getHistoryById(id: any): Promise<any>;
    deleteHistory(id: any): Promise<any>;
}
