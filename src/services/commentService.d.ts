declare const prisma: any;
declare class CommentService {
    checkTaskExists(taskId: any): Promise<boolean>;
    checkUserExists(userId: any): Promise<boolean>;
    createComment(data: any): Promise<any>;
    getCommentsByTask(taskId: any): Promise<any>;
    getCommentById(id: any): Promise<any>;
    updateComment(id: any, data: any): Promise<any>;
    deleteComment(id: any): Promise<any>;
    getCommentReplies(commentId: any): Promise<any>;
}
