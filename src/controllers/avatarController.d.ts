declare const AvatarService: any;
declare class AvatarController {
    /**
     * Upload de avatar para agente
     * @route POST /api/agents/:id/avatar
     */
    static uploadAgentAvatar(req: any, res: any): Promise<any>;
    /**
     * Remove avatar de agente
     * @route DELETE /api/agents/:id/avatar
     */
    static deleteAgentAvatar(req: any, res: any): Promise<any>;
    /**
     * Obtém informações do avatar de um agente
     * @route GET /api/agents/:id/avatar
     */
    static getAgentAvatar(req: any, res: any): Promise<any>;
    /**
     * Serve arquivo de avatar
     * @route GET /agent-avatars/:agentId/:filename
     */
    static serveAvatarFile(req: any, res: any): Promise<any>;
}
