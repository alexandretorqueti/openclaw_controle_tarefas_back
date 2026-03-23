declare const prisma: any;
declare const logger: any;
declare const ProcessKiller: any;
declare class AutoTaskService {
    getMonitorProject(): Promise<any>;
    findExistingErrorTask(projectId: any, errorSignature: any): Promise<any>;
    generateErrorSignature(error: any, req: any): string;
    generateErrorDescription(error: any, req: any, res: any): string;
    getFirstVisibleStatus(): Promise<any>;
    getDefaultPriorityId(): Promise<any>;
    getSystemUserId(): Promise<any>;
    createAutoTask(error: any, req: any, res: any): Promise<any>;
}
