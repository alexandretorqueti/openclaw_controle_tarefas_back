    // 14. Buscar status "Em Andamento (IA)" para atualizar
    let inProgressIAStatusId = null;
    try {
      const statusesRes = await axios.get(`${API_URL}/api/statuses`);
      const allStatuses = statusesRes.data.statuses || [];
      const inProgressIA = allStatuses.find(s => s.name === 'Em Andamento');
      
      if (inProgressIA) {
        inProgressIAStatusId = inProgressIA.id;
        
        // Atualizar status da tarefa
        await axios.put(`${API_URL}/api/tasks/${task.id}`, {
          statusId: inProgressIAStatusId
        });
        log(`✅ Status da tarefa atualizado para "Em Andamento"`);
      } else {
        log(`❌ Status "Em Andamento" não encontrado na API`);
      }
    } catch (error) {
      log(`❌ Erro ao atualizar status: ${error.message}`);
      
      // Tentar recuperação
      await checkAndRecoverEndpoints();
    }
    
    // 15. Preparar prompt para o agente
    const branchInfo = branches.length > 0 
      ? `\n\n📁 **BRANCHES CRIADAS:**\n${branches.map(b => `- ${b.type}: ${b.branch} (${b.path})`).join('\n')}\n\n⚠️ **TRABALHE NAS BRANCHES ACIMA!**`
      : '';
    
    const prompt = `=== TASK_DATA_START ===
TAREFA: ${task.title}
ID: ${task.id}
DESCRIÇÃO: ${task.description}

REGRAS DO PROJETO (OBRIGATÓRIAS):
${projetoRegras}
${branchInfo}

HISTÓRICO DE COMENTÁRIOS:
${comentariosTexto}

INSTRUÇÕES PARA O AGENTE:

1. ANALISE a tarefa acima com atenção
2. LEIA as regras do projeto - são OBRIGATÓRIAS
3. VERIFIQUE o histórico de comentários para contexto
4. EXECUTE a tarefa conforme solicitado${branches.length > 0 ? '\n5. TRABALHE EXCLUSIVAMENTE NAS BRANCHES CRIADAS ACIMA' : ''}

5. APÓS CONCLUIR, você DEVE finalizar a tarefa no sistema via API:
   - URL: ${API_URL}/api/tasks/${task.id}
   - Método: PUT
   - Corpo: {"statusId": "ID_DO_STATUS_CONCLUIDO"} (busque o ID do status "Concluído")
   - Em seguida, adicione um comentário com o relatório de execução via POST ${API_URL}/api/comments
   - Use o userId: ${MY_USER_ID} (Jarbas)

IMPORTANTE: Não altere o campo "isCompleted" - apenas Alexandre pode fazer isso.

=== TASK_DATA_END ===`;
    
    // 16. Chamar agente
    log(`📤 Chamando agente para tarefa: ${task.title}`);
    
    try {
      // Usar OpenClaw para spawnar sub-agente
      const { exec: openclawExec } = require('child_process');
      const { promisify } = require('util');
      const exec = promisify(openclawExec);
      
      const label = `task-${task.id.substring(0, 8)}-${task.title.substring(0, 20)}`;
      
      const result = await exec(`openclaw sessions spawn --task "${prompt.replace(/"/g, '\\"')}" --label "${label}" --agent-id main --mode run`);
      
      log(`✅ Agente spawnado: ${result.stdout.trim()}`);
      
      // Atualizar estado
      processorState.currentTask = task.id;
      processorState.taskStartedAt = new Date().toISOString();
      saveState();
      
    } catch (error) {
      log(`❌ Erro ao spawnar agente: ${error.message}`);
      
      // Não reverter status - manter como "Em Andamento" para análise manual
      log(`⚠️ Tarefa ${task.id} mantida como "Em Andamento" para análise manual devido a erro no agente`);
    }
    
  } catch (error) {
    log(`❌ Erro no processNextTask: ${error.message}`);
    console.error(error);
    
    // Tentar recuperação
    await checkAndRecoverEndpoints();
  }
}

// ========== FUNÇÃO PRINCIPAL ==========
async function main() {
  try {
    log('🚀 Iniciando Task Processor com verificação de portas e recuperação automática');
    
    // Carregar estado
    loadState();
    
    // Verificar portas antes de iniciar
    const initialCheck = await checkProjectPorts();
    if (!initialCheck.allPortsOk) {
      log(`⚠️ Problemas detectados nas portas do projeto na inicialização`);
      
      // Tentar recuperação automática
      const recovered = await checkAndRecoverEndpoints();
      if (!recovered) {
        log(`❌ Não foi possível recuperar os endpoints na inicialização`);
      }
    }
    
    // Processar próxima tarefa
    await processNextTask();
    
    log('✅ Ciclo completo do Task Processor');
    
  } catch (error) {
    log(`❌ Erro fatal no Task Processor: ${error.message}`);
    console.error(error);
    
    // Tentar uma última recuperação antes de sair
    try {
      await checkAndRecoverEndpoints();
    } catch (recoveryError) {
      log(`❌ Falha na recuperação final: ${recoveryError.message}`);
    }
    
    process.exit(1);
  }
}

// Executar
if (require.main === module) {
  main();
}

module.exports = {
  main,
  log,
  checkProjectPorts,
  checkAndRecoverEndpoints,
  restartBackendService,
  fetchUserIds,
  getAIVisibleStatuses,
  checkActiveTask,
  checkActiveAgent,
  createBranchesForTask,
  getModifiedFiles,
  commitAndPushChanges,
  processCompletedTask,
  checkTimeout,
  handleTimeout,
  processNextTask
};