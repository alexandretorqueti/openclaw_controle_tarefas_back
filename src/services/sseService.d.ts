declare class SseService {
    constructor();
    /**
     * Adiciona um novo cliente (navegador) à lista de transmissão
     */
    addClient(req: any, res: any): void;
    /**
     * Dispara um evento para todos os navegadores conectados
     * @param {string} eventName - Nome do evento (ex: 'task_updated', 'agent_typing')
     * @param {Object} data - Os dados que vão para o frontend
     */
    broadcast(eventName: any, data: any): void;
}
