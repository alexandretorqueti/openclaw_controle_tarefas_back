declare const prisma: any;
declare class UserService {
    getAllUsers(): Promise<any>;
    getUserById(id: any): Promise<any>;
    getUserByEmail(email: any): Promise<any>;
    getUserByNickname(nickname: any): Promise<any>;
}
