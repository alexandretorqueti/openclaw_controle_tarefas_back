declare const prisma: any;
declare const sseService: any;
declare class ProjectService {
    createProject(data: any): Promise<any>;
    getAllProjects(options?: {}): Promise<any>;
    getProjectById(id: any): Promise<any>;
    updateProject(id: any, data: any): Promise<any>;
    deleteProject(id: any): Promise<any>;
    getProjectStatistics(id: any): Promise<{
        totalTasks: any;
        completedTasks: any;
        overdueTasks: any;
        progress: number;
        statusCounts: {};
        priorityCounts: {};
    }>;
}
