declare const autoTaskService: {
  getMonitorProject(): Promise<any>;
  findExistingErrorTask(projectId: string, errorSignature: string): Promise<any>;
  createAutoTask(error: any, req: any, res: any): Promise<any>;
};

export default autoTaskService;