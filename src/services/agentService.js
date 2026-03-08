const { spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

/**
 * Executa um comando OpenClaw e retorna a saída JSON
 * @param {string} command - Comando OpenClaw (ex: 'agents', 'list')
 * @param {Array} args - Argumentos do comando
 * @returns {Promise<Object>} - Resultado parseado do JSON
 */
exports.execOpenClawCommand = async (command, args = []) => {
  return new Promise((resolve, reject) => {
    const fullArgs = [command, ...args, '--json'];
    console.log('Executando openclaw:', fullArgs.join(' '));
    
    const child = spawn('openclaw', fullArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code !== 0) {
        const error = new Error(`Comando openclaw falhou com código ${code}: ${stderr}`);
        error.stderr = stderr;
        error.code = code;
        return reject(error);
      }
      
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (parseError) {
        // Se não for JSON válido, retorna a saída bruta
        resolve({ raw: stdout.trim() });
      }
    });
    
    child.on('error', (error) => {
      reject(new Error(`Falha ao executar openclaw: ${error.message}`));
    });
  });
};

/**
 * Lista todos os agentes
 * @returns {Promise<Array>} - Lista de agentes
 */
exports.listAgents = async () => {
  try {
    const result = await exports.execOpenClawCommand('agents', ['list']);
    // O comando retorna um array de agentes
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('Erro ao listar agentes:', error.message);
    throw error;
  }
};

/**
 * Adiciona um novo agente
 * @param {string} name - Nome do agente
 * @param {string} workspace - Caminho do workspace
 * @returns {Promise<Object>} - Agente criado
 */
exports.addAgent = async (name, workspace) => {
  try {
    const args = ['add', name];
    if (workspace) {
      args.push('--workspace', workspace);
    }
    
    const result = await exports.execOpenClawCommand('agents', args);
    return result;
  } catch (error) {
    console.error('Erro ao adicionar agente:', error.message);
    throw error;
  }
};

/**
 * Atualiza a identidade de um agente
 * @param {string} agentId - ID do agente
 * @param {Object} identity - Dados da identidade
 * @returns {Promise<Object>} - Resultado da operação
 */
exports.setAgentIdentity = async (agentId, identity) => {
  try {
    const args = ['set-identity', '--agent', agentId];
    
    if (identity.name) {
      args.push('--name', `"${identity.name}"`);
    }
    
    if (identity.emoji) {
      args.push('--emoji', `"${identity.emoji}"`);
    }
    
    if (identity.avatar) {
      args.push('--avatar', `"${identity.avatar}"`);
    }
    
    const result = await exports.execOpenClawCommand('agents', args);
    return result;
  } catch (error) {
    console.error('Erro ao atualizar identidade do agente:', error.message);
    throw error;
  }
};

/**
 * Adiciona um binding a um agente
 * @param {string} agentId - ID do agente
 * @param {string} binding - Binding no formato canal:conta
 * @returns {Promise<Object>} - Resultado da operação
 */
exports.bindAgent = async (agentId, binding) => {
  try {
    const result = await exports.execOpenClawCommand('agents', [
      'bind',
      '--agent', agentId,
      '--bind', binding
    ]);
    return result;
  } catch (error) {
    console.error('Erro ao adicionar binding:', error.message);
    throw error;
  }
};

/**
 * Remove um binding de um agente
 * @param {string} agentId - ID do agente
 * @param {string} binding - Binding no formato canal:conta
 * @returns {Promise<Object>} - Resultado da operação
 */
exports.unbindAgent = async (agentId, binding) => {
  try {
    const result = await exports.execOpenClawCommand('agents', [
      'unbind',
      '--agent', agentId,
      '--bind', binding
    ]);
    return result;
  } catch (error) {
    console.error('Erro ao remover binding:', error.message);
    throw error;
  }
};

/**
 * Exclui um agente
 * @param {string} agentId - ID do agente
 * @returns {Promise<Object>} - Resultado da operação
 */
exports.deleteAgent = async (agentId) => {
  try {
    const result = await exports.execOpenClawCommand('agents', ['delete', agentId]);
    return result;
  } catch (error) {
    console.error('Erro ao excluir agente:', error.message);
    throw error;
  }
};

/**
 * Obtém informações detalhadas de um agente
 * @param {string} agentId - ID do agente
 * @returns {Promise<Object>} - Informações do agente
 */
exports.getAgentDetails = async (agentId) => {
  try {
    // Primeiro listamos todos os agentes
    const agents = await exports.listAgents();
    const agent = agents.find(a => a.id === agentId);
    
    if (!agent) {
      throw new Error(`Agente com ID ${agentId} não encontrado`);
    }
    
    return agent;
  } catch (error) {
    console.error('Erro ao obter detalhes do agente:', error.message);
    throw error;
  }
};