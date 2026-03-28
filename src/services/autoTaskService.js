const prisma = require('./prismaService');
const logger = require('../utils/logger');
const ProcessKiller = require('../utils/processKiller');
const { writeFileSync, existsSync, mkdirSync, readFileSync } = require('fs');
const { join } = require('path');

class AutoTaskService {
  // Buscar projeto pelo ID da variável de ambiente
  async getMonitorProject() {
    const projectId = process.env.PROJETO_MONITOR;
    if (!projectId) {
      console.error('Variável PROJETO_MONITOR não configurada no .env');
      return null;
    }
    
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId }
      });
      
      if (!project) {
        console.error(`Projeto com ID ${projectId} não encontrado`);
        return null;
      }
      
      return project;
    } catch (error) {
      console.error(`Erro ao buscar projeto: ${error.message}`);
      return null;
    }
  }
  
  // Buscar tarefa existente com mesmo erro
  async findExistingErrorTask(projectId, errorSignature) {
    try {
      const tasks = await prisma.task.findMany({
        where: {
          projectId: projectId,
          isCompleted: false,
          title: { contains: 'Bug automático detectado' },
          status: {
            isFinalState: false
          }
        }
      });
      
      // Filtrar por assinatura do erro na descrição
      const matchingTasks = tasks.filter(task => {
        if (!task.description) return false;
        
        // Tentar buscar pela assinatura completa
        if (task.description.includes(errorSignature)) {
          return true;
        }
        
        // Para tarefas antigas (sem linha **Error Signature:**), 
        // tentar reconstruir a assinatura a partir do endpoint e primeira linha do erro
        const endpointMatch = task.description.match(/\*\*Endpoint:\*\*\s*(.+)/);
        const errorMatch = task.description.match(/\*\*Error:\*\*\s*([^\n]+)/);
        
        if (endpointMatch && errorMatch) {
          const endpoint = endpointMatch[1].trim();
          const firstErrorLine = errorMatch[1].trim();
          const reconstructedSignature = `${endpoint}:${firstErrorLine}`.substring(0, 100);
          return reconstructedSignature === errorSignature;
        }
        
        return false;
      });
      
      return matchingTasks.length > 0 ? matchingTasks[0] : null;
    } catch (error) {
      console.error(`Erro ao buscar tarefa existente: ${error.message}`);
      return null;
    }
  }
  
  // Gerar assinatura do erro para comparação
  generateErrorSignature(error, req) {
    const endpoint = req ? `${req.method} ${req.originalUrl}` : 'Unknown endpoint';
    const errorMessage = error.message || 'Unknown error';
    // Pegar apenas a primeira linha da mensagem de erro para a assinatura
    const firstLine = errorMessage.split('\n')[0];
    return `${endpoint}:${firstLine}`.substring(0, 100);
  }
  
  // Gerar descrição detalhada do erro
  generateErrorDescription(error, req, res) {
    const parts = [];
    
    if (req) {
      parts.push(`**Endpoint:** ${req.method} ${req.originalUrl}`);
      // Adicionar assinatura do erro para detecção de duplicatas
      const errorSignature = this.generateErrorSignature(error, req);
      parts.push(`**Error Signature:** ${errorSignature}`);
      parts.push(`**IP:** ${req.ip || 'N/A'}`);
      parts.push(`**User Agent:** ${req.get('User-Agent') || 'N/A'}`);
      
      if (req.body && Object.keys(req.body).length > 0) {
        try {
          parts.push(`**Body:** \`\`\`json\n${JSON.stringify(req.body, null, 2)}\n\`\`\``);
        } catch (e) {
          parts.push(`**Body:** (Não serializável)`);
        }
      }
      
      if (req.query && Object.keys(req.query).length > 0) {
        parts.push(`**Query:** \`\`\`json\n${JSON.stringify(req.query, null, 2)}\n\`\`\``);
      }
      
      if (req.params && Object.keys(req.params).length > 0) {
        parts.push(`**Params:** \`\`\`json\n${JSON.stringify(req.params, null, 2)}\n\`\`\``);
      }
    }
    
    if (error) {
      parts.push(`**Error:** ${error.message || 'N/A'}`);
      if (error.stack) {
        parts.push(`**Stack:** \`\`\`\n${error.stack}\n\`\`\``);
      }
      parts.push(`**Name:** ${error.name || 'N/A'}`);
      parts.push(`**Status Code:** ${error.statusCode || 'N/A'}`);
    }
    
    if (res && res.statusCode) {
      parts.push(`**Response Status:** ${res.statusCode}`);
    }
    
    parts.push(`**Timestamp:** ${new Date().toISOString()}`);
    parts.push(`**Process ID:** ${process.pid}`);
    
    return parts.join('\n\n');
  }
  
  // Buscar primeiro status "visível para IA"
  async getFirstVisibleStatus() {
    try {
      // Primeiro tentar encontrar status com "visível para IA" no nome
      const statuses = await prisma.status.findMany({
        orderBy: { order: 'asc' }
      });
      
      const visibleStatus = statuses.find(s => 
        s.name && s.name.toLowerCase().includes('visível para ia')
      );
      
      if (visibleStatus) {
        return visibleStatus;
      }
      
      // Fallback: buscar primeiro status disponível
      if (statuses.length > 0) {
        return statuses[0];
      }
      
      console.error('Nenhum status encontrado no banco de dados');
      return null;
    } catch (error) {
      console.error(`Erro ao buscar status: ${error.message}`);
      return null;
    }
  }
  
  // Buscar ID de prioridade padrão
  async getDefaultPriorityId() {
    try {
      const priorities = await prisma.priority.findMany();
      if (priorities.length > 0) {
        return priorities[0].id;
      }
      console.error('Nenhuma prioridade encontrada no banco de dados');
      return null;
    } catch (error) {
      console.error(`Erro ao buscar prioridade: ${error.message}`);
      return null;
    }
  }
  
  // Buscar ID de usuário sistema
  async getSystemUserId() {
    try {
      const users = await prisma.user.findMany();
      // Primeiro tentar encontrar usuário 'system'
      let user = users.find(u => u.name && u.name.toLowerCase().includes('system'));
      
      if (!user && users.length > 0) {
        // Fallback: primeiro usuário disponível
        user = users[0];
      }
      
      if (user) {
        return user.id;
      }
      
      console.error('Nenhum usuário encontrado no banco de dados');
      return null;
    } catch (error) {
      console.error(`Erro ao buscar usuário: ${error.message}`);
      return null;
    }
  }
  
  // Criar tarefa automática
  async createAutoTask(error, req, res) {
    try {
      // 1. Buscar projeto monitor
      const project = await this.getMonitorProject();
      if (!project) {
        console.error('Não foi possível encontrar o projeto monitor');
        return { success: false, reason: 'projeto_nao_encontrado', task: null };
      }
      
      // 2. Gerar assinatura do erro
      const errorSignature = this.generateErrorSignature(error, req);
      
      // 3. Verificar se já existe tarefa para este erro
      const existingTask = await this.findExistingErrorTask(project.id, errorSignature);
      if (existingTask) {
        console.log(`⚠️  Tarefa JA existe para este erro: ${existingTask.id}`);
        // Registrar duplicata na memória
        this.logDuplicateTask(existingTask.id, error, req, res);
        // Matrar o processo SEM criar nova tarefa
        
        return { 
          success: false, 
          reason: 'duplicate_detected',
          existingTaskId: existingTask.id,
          task: null 
        };
      }
      
      // 4. Buscar status "visível para IA"
      const status = await this.getFirstVisibleStatus();
      if (!status) {
        console.error('Não foi possível encontrar status para a tarefa');
        return { success: false, reason: 'status_nao_encontrado', task: null };
      }
      
      // 5. Buscar prioridade padrão
      const priorityId = await this.getDefaultPriorityId();
      if (!priorityId) {
        console.error('Não foi possível encontrar prioridade para a tarefa');
        return { success: false, reason: 'prioridade_nao_encontrada', task: null };
      }
      
      // 6. Buscar usuário sistema
      const createdById = await this.getSystemUserId();
      if (!createdById) {
        console.error('Não foi possível encontrar usuário para a tarefa');
        return { success: false, reason: 'usuario_nao_encontrado', task: null };
      }
      
      // 7. Gerar descrição detalhada
      const description = this.generateErrorDescription(error, req, res);
      
      
      const newTask = await prisma.task.create({
        data: {
          title: 'Bug automático detectado.',
          description: description,
          projectId: project.id,
          statusId: status.id,
          isCompleted: false,
          priorityId: priorityId,
          createdById: createdById,
          assignedToId: createdById, // Atribuir ao mesmo usuário criador
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias a partir de agora
        }
      });
      
      console.log(`✅ Nova tarefa automática criada: ${newTask.id} (duplicidade detectada automaticamente)`);
      
      return { success: true, task: newTask, wasDuplicate: true };
      
    } catch (error) {
      console.error(`❌ Erro ao criar tarefa automática: ${error.message}`);
      
      return { success: false, reason: 'creation_error', error: error.message, task: null };
    }
  }
  
  // Registrar duplicata em arquivo de memória
  async logDuplicateTask(taskId, error, req, res) {
    const { writeFileSync, existsSync, mkdirSync } = require('fs');
    const { join } = require('path');
    
    const memoryDir = join(__dirname, '../../..', 'memory');
    const duplicatesFile = join(memoryDir, 'error-duplicates.json');
    
    // Criar directory se não existir
    if (!existsSync(memoryDir)) {
      mkdirSync(memoryDir, { recursive: true });
    }
    
    // Ler ou criar arquivo
    let duplicates = [];
    if (existsSync(duplicatesFile)) {
      try {
        duplicates = JSON.parse(readFileSync(duplicatesFile, 'utf8'));
      } catch (e) {
        duplicates = [];
      }
    }
    
    // Adicionar nova entrada
    duplicates.push({
      taskId: taskId,
      timestamp: new Date().toISOString(),
      errorSignature: this.generateErrorSignature(error, req),
      endpoint: req ? `${req.method} ${req.originalUrl}` : 'Unknown endpoint'
    });
    
    // Limitar a 100 entradas mais recentes
    if (duplicates.length > 100) {
      duplicates = duplicates.slice(-100);
    }
    
    // Salvar
    writeFileSync(duplicatesFile, JSON.stringify(duplicates, null, 2));
    console.log(`📝 Duplicidade registrada em memory/error-duplicates.json: ${taskId}`);
  }
}

module.exports = new AutoTaskService();