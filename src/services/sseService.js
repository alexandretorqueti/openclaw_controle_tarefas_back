// src/services/sseService.js

class SseService {
  constructor() {
    // Array para guardar todas as abas do navegador que estão abertas
    this.clients = [];
  }

  /**
   * Adiciona um novo cliente (navegador) à lista de transmissão
   */
  addClient(req, res) {
    // Cabeçalhos obrigatórios para manter a conexão viva no formato SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Evita problemas de timeout no Node/Nginx
    res.flushHeaders();

    this.clients.push(res);
    console.log(`🔌 Novo cliente SSE conectado. Total: ${this.clients.length}`);

    // Remove o cliente da lista automaticamente se ele fechar a aba
    req.on('close', () => {
      this.clients = this.clients.filter(client => client !== res);
      console.log(`🔌 Cliente SSE desconectado. Total: ${this.clients.length}`);
    });
  }

  /**
   * Dispara um evento para todos os navegadores conectados
   * @param {string} eventName - Nome do evento (ex: 'task_updated', 'agent_typing')
   * @param {Object} data - Os dados que vão para o frontend
   */
  broadcast(eventName, data) {
    if (this.clients.length === 0) return;

    // O protocolo SSE exige este formato exato de string
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    
    this.clients.forEach(client => {
      // Usamos apenas o write, e não o send(), para não fechar a conexão
      client.write(payload);
    });
  }
}

// Exportamos uma instância única (Singleton) para que o sistema inteiro 
// compartilhe a mesma lista de clientes conectados.
module.exports = new SseService();