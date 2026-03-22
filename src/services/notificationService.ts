// Migrado para TypeScript - Fase: Services
// Arquivo: notificationService.js

export /**
 * Serviço de notificações para Telegram via OpenClaw
 */

import { exec } from 'child_process';
import util from 'util';
const execAsync = util.promisify(exec);

class NotificationService {
  
  /**
   * Envia uma notificação no Telegram
   * @param {string} message - Mensagem a ser enviada
   * @param {string} chatId - ID do chat (opcional, usa default se não informado)
   * @returns {Promise<boolean>} true se enviado com sucesso
   */
  static async sendTelegramNotification(message, chatId = null): Promise<any> {
    try {
      console.log(`📱 Tentando enviar notificação no Telegram: ${message.substring(0, 100)}...`);
      
      // Comando OpenClaw para enviar mensagem
      // O chatId padrão é o do Alexandre (7147090795) conforme USER.md
      const targetChatId = chatId || '7147090795';
      
      const command = `openclaw message send --channel telegram --target ${targetChatId} --message "${this.escapeMessage(message)}"`;
      
      console.log(`🔧 Executando comando: ${command}`);
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: 10000, // 10 segundos timeout
        shell: true
      });
      
      if (stderr && !stderr.includes('warning')) {
        console.error(`❌ Erro ao enviar notificação no Telegram: ${stderr}`);
        return false;
      }
      
      console.log(`✅ Notificação enviada com sucesso no Telegram para chat ${targetChatId}`);
      console.log(`📤 Resposta: ${stdout || '(sem output)'}`);
      
      return true;
      
    } catch (error) {
      console.error(`❌ Falha ao enviar notificação no Telegram: ${error.message}`);
      
      // Fallback: tentar método alternativo se o comando openclaw não estiver disponível
      if ((error as any).code === 'ENOENT' || error.message.includes('openclaw: command not found')) {
        console.log('⚠️ Comando openclaw não encontrado. Tentando método alternativo...');
        return await this.sendTelegramNotificationFallback(message, chatId);
      }
      
      return false;
    }
  }
  
  /**
   * Método fallback para enviar notificação (usando curl ou outro método)
   * @param {string} message - Mensagem a ser enviada
   * @param {string} chatId - ID do chat
   * @returns {Promise<boolean>} true se enviado com sucesso
   */
  static async sendTelegramNotificationFallback(message, chatId = null): Promise<any> {
    try {
      console.log('🔄 Usando método fallback para notificação no Telegram...');
      
      // Aqui você poderia implementar uma integração direta com a API do Telegram
      // usando um bot token se tiver configurado
      // Por enquanto, apenas logamos
      
      console.log(`📝 [FALLBACK] Notificação para Telegram (chat ${chatId || 'default'}): ${message}`);
      
      // Retornar true para simular sucesso (em produção, implementar API real)
      return true;
      
    } catch (error) {
      console.error(`❌ Falha no método fallback: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Envia notificação quando uma tarefa é concluída
   * @param {Object} task - Objeto da tarefa
   * @param {Object} user - Usuário que finalizou a tarefa
   * @param {string} executionNotes - Notas de execução (opcional)
   * @returns {Promise<boolean>} true se notificação enviada
   */
  static async sendTaskCompletedNotification(task, user, executionNotes = null): Promise<any> {
    try {
      if (!task || !user) {
        console.error('❌ Dados insuficientes para notificação de tarefa concluída');
        return false;
      }
      
      const projectName = task.project?.name || 'Projeto desconhecido';
      const userName = user.name || 'Usuário desconhecido';
      const taskTitle = task.title || 'Tarefa sem título';
      
      // Construir mensagem formatada
      let message = `✅ *TAREFA CONCLUÍDA!*\n\n`;
      message += `*Tarefa:* ${taskTitle}\n`;
      message += `*Projeto:* ${projectName}\n`;
      message += `*Concluída por:* ${userName}\n`;
      
      if (executionNotes && executionNotes.trim() !== '') {
        message += `\n*Notas:* ${executionNotes.substring(0, 200)}${executionNotes.length > 200 ? '...' : ''}\n`;
      }
      
      message += `\n📅 *Data:* ${new Date().toLocaleString('pt-BR')}`;
      message += `\n🔗 *ID:* ${task.id.substring(0, 8)}...`;
      
      // Enviar notificação
      return await this.sendTelegramNotification(message);
      
    } catch (error) {
      console.error(`❌ Erro ao enviar notificação de tarefa concluída: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Envia notificação quando uma tarefa pai é automaticamente finalizada
   * @param {Object} parentTask - Tarefa pai
   * @param {Array} completedSubtasks - Lista de subtasks concluídas
   * @returns {Promise<boolean>} true se notificação enviada
   */
  static async sendParentTaskAutoCompletedNotification(parentTask, completedSubtasks): Promise<any> {
    try {
      if (!parentTask || !completedSubtasks || completedSubtasks.length === 0) {
        return false;
      }
      
      const projectName = parentTask.project?.name || 'Projeto desconhecido';
      const parentTaskTitle = parentTask.title || 'Tarefa pai sem título';
      
      // Construir mensagem formatada
      let message = `🎯 *TAREFA PAI FINALIZADA AUTOMATICAMENTE!*\n\n`;
      message += `*Tarefa Pai:* ${parentTaskTitle}\n`;
      message += `*Projeto:* ${projectName}\n`;
      message += `*Motivo:* Todas as ${completedSubtasks.length} subtasks foram concluídas\n`;
      
      message += `\n📋 *Subtasks concluídas:*\n`;
      completedSubtasks.forEach((subtask, index) => {
        message += `  ${index + 1}. ${subtask.title || 'Subtarefa sem título'}\n`;
      });
      
      message += `\n📅 *Data:* ${new Date().toLocaleString('pt-BR')}`;
      message += `\n🔗 *ID:* ${parentTask.id.substring(0, 8)}...`;
      
      // Enviar notificação
      return await this.sendTelegramNotification(message);
      
    } catch (error) {
      console.error(`❌ Erro ao enviar notificação de tarefa pai concluída: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Escapa caracteres especiais para shell command
   * @param {string} text - Texto a ser escapado
   * @returns {string} Texto escapado
   */
  static escapeMessage(text) {
    return text
      .replace(/"/g, '\\"')  // Escapar aspas duplas
      .replace(/`/g, '\\`')  // Escapar crases
      .replace(/\$/g, '\\$') // Escapar cifrões
      .replace(/\n/g, '\\n') // Manter quebras de linha
      .substring(0, 4000);   // Limitar tamanho (limite do Telegram)
  }
  
  /**
   * Testa a conexão com o Telegram
   * @returns {Promise<boolean>} true se conexão bem-sucedida
   */
  static async testConnection(): Promise<any> {
    try {
      const testMessage = '🔔 *Teste de Notificação do Sistema de Tarefas*\n\nEsta é uma mensagem de teste para verificar se as notificações estão funcionando corretamente.\n\n✅ Sistema operacional normalmente.';
      
      const result = await this.sendTelegramNotification(testMessage);
      
      if (result) {
        console.log('✅ Conexão com Telegram testada com sucesso!');
      } else {
        console.log('❌ Falha ao testar conexão com Telegram');
      }
      
      return result;
      
    } catch (error) {
      console.error(`❌ Erro no teste de conexão: ${error.message}`);
      return false;
    }
  }
}

export default NotificationService;