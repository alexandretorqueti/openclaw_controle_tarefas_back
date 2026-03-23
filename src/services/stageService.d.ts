declare const prisma: any;
declare class StageService {
    getAll(): Promise<any>;
    getById(id: any): Promise<any>;
    create(data: any): Promise<any>;
    update(id: any, data: any): Promise<any>;
    delete(id: any): Promise<any>;
}
