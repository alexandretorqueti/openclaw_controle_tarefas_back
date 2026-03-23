declare const stageService: any;
declare class StageController {
    getAll(req: any, res: any): Promise<void>;
    getById(req: any, res: any): Promise<any>;
    create(req: any, res: any): Promise<any>;
    update(req: any, res: any): Promise<any>;
    delete(req: any, res: any): Promise<void>;
}
