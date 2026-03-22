// src/services/NotificationService.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Interface simples para representar Tarefas e Usuários nas notificações
 */
interface NotificationData {
  id: string;
  title: string;
  project?: { name: string };
  [key: string]: any;
}

class NotificationService {
  
  /**
   * Envia uma notificação no Telegram via OpenClaw CLI
   */
  static async sendTelegramNotification(message: string, chatId: string | null = null): Promise<boolean> {
    try {
      console.log(`📱 Tentando enviar notificação no Telegram: ${message.substring(0, 100)}...`);
      
      // ID padrão do Alexandre conforme configurado no sistema
      const targetChatId = chatId || '7147090795';
      
      // Escapa a mensagem para evitar injeção de comando no shell
      const escapedMsg = this.escapeMessage(message);
      const command = `openclaw message send --channel telegram --target ${targetChatId} --message "${escapedMsg}"`;
      
      console.log(`🔧 Executando comando de notificação...`);
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: 10000,
        shell: true as any
      });
      
      if (stderr && !stderr.toLowerCase().includes('warning')) {
        console.error(`❌ Erro no comando OpenClaw Telegram: ${stderr}`);
        return false;
      }
      
      console.log(`✅ Notificação enviada para chat ${targetChatId}`);
      return true;
      
    } catch (error: any) {
      console.error(`❌ Falha ao enviar notificação: ${error.message}`);
      
      // Fallback automático se o binário openclaw não estiver no PATH
      if (error.code === 'ENOENT' || error.message.includes('not found')) {
        console.log('⚠️ Comando openclaw não encontrado. Usando fallback...');
        return await this.sendTelegramNotificationFallback(message, chatId);
      }
      
      return false;
    }
  }
  
  /**
   * Método fallback (log local) caso a CLI do OpenClaw falhe
   */
  static async sendTelegramNotificationFallback(message: string, chatId: string | null = null): Promise<boolean> {
    try {
      console.log(`📝 [FALLBACK LOG] Telegram (${chatId || 'Alexandre'}): ${message}`);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Notifica conclusão de tarefa individual
   */
  static async sendTaskCompletedNotification(task: NotificationData, user: any, executionNotes: string | null = null): Promise<boolean> {
    try {
      if (!task || !user) return false;
      
      const projectName = task.project?.name || 'Projeto Geral';
      const userName = user.name || 'Agente Autônomo';
      
      let message = `✅ *TAREFA CONCLUÍDA!*\n\n`;
      message += `*Tarefa:* ${task.title}\n`;
      message += `*Projeto:* ${projectName}\n`;
      message += `*Concluída por:* ${userName}\n`;
      
      if (executionNotes?.trim()) {
        const cleanNotes = executionNotes.substring(0, 200).replace(/[_*`[\]()]/g, ''); // Limpa markdown problemático
        message += `\n*Notas:* ${cleanNotes}${executionNotes.length > 200 ? '...' : ''}\n`;
      }
      
      message += `\n📅 *Data:* ${new Date().toLocaleString('pt-BR')}`;
      message += `\n🔗 *ID:* \`${task.id.substring(0, 8)}\``;
      
      return await this.sendTelegramNotification(message);
    } catch (error: any) {
      console.error(`❌ Erro na notificação de conclusão: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Notifica finalização de tarefa pai (Decomposição concluída)
   */
  static async sendParentTaskAutoCompletedNotification(parentTask: NotificationData, completedSubtasks: any[]): Promise<boolean> {
    try {
      if (!parentTask || !completedSubtasks?.length) return false;
      
      let message = `🎯 *TAREFA PAI FINALIZADA!*\n\n`;
      message += `*Tarefa Pai:* ${parentTask.title}\n`;
      message += `*Projeto:* ${parentTask.project?.name || 'Projeto Geral'}\n`;
      message += `*Status:* Todas as ${completedSubtasks.length} subtasks concluídas.\n`;
      
      message += `\n📋 *Resumo:*\n`;
      completedSubtasks.slice(0, 5).forEach((st, i) => {
        message += `  ${i + 1}. ${st.title}\n`;
      });
      if (completedSubtasks.length > 5) message += `  ... e mais ${completedSubtasks.length - 5} tarefas.\n`;
      
      message += `\n📅 ${new Date().toLocaleString('pt-BR')}`;
      
      return await this.sendTelegramNotification(message);
    } catch (error: any) {
      return false;
    }
  }
  
  /**
   * Limpa a string para não quebrar o comando Shell
   */
  private static escapeMessage(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$')
      .substring(0, 4000);
  }

  /**
   * Teste de sanidade do serviço
   */
  static async testConnection(): Promise<boolean> {
    const testMessage = '🔔 *Teste de Sistema*\n\nAs notificações do Jarbas estão operacionais.';
    return await this.sendTelegramNotification(testMessage);
  }
}

export default NotificationService;