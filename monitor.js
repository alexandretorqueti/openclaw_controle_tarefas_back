const { tr } = require('zod/v4/locales');

// monitor.js (Arquitetura Híbrida Definitiva)
async function main() {
  const axios = require('axios');
  const fs = require('fs');
  const path = require('path');
  const { spawn } = require('child_process');
  
  axios.defaults.timeout = 10000; 

  const { API_URL, STATUS, TASKS_DIR, LOCK_FILE, MY_USER_ID, TASK_TIMEOUT_MS } = require('./aux/config');
  const { log } = require('./aux/logger');
  const { prepareTaskPrompt } = require('./aux/taskUtils');
  
  const fileExists = async (pathToCheck) => fs.promises.access(pathToCheck, fs.constants.F_OK).then(() => true).catch(() => false);

  async function incrementTaskTimerandReturnValue() {
    const stateFilePath = path.join(TASKS_DIR, 'monitor-state.json');
    if (await fileExists(stateFilePath)) {
      const stateContent = await fs.promises.readFile(stateFilePath, 'utf8');
      let state = {};
      try {
        state = JSON.parse(stateContent);
      } catch (e) {
        console.error(`Erro ao ler o arquivo de estado: ${e.message}`);
        return;
      }
      const now = Date.now();
      /*
      Exemplo de estrutura do monitor-state.json:
        {
          "active_tasks": {
            "24e14185-b154-4fc4-ad86-2f02072a6f62": {
              "startTime": 1772413792725
            }
          }
        }
      */
      try {
        // Preciso primeiro pegar o id da task, que é o nome da chave de active_tasks, e depois acessar o startTime para calcular o tempo decorrido
        if (state.active_tasks) {
          const taskIds = Object.keys(state.active_tasks);
          if (taskIds.length > 0) {
            const taskId = taskIds[0];
            const startTime = state.active_tasks[taskId].startTime;
            const elapsed = now - startTime;
            await log(`⏱️ Tarefa ${taskId} em execução por ${(elapsed / 1000).toFixed(2)} segundos.`);
          }
        }
    } catch (e) {
      await log(`❌ Erro ao incrementar o tempo da tarefa: ${e.message}`);
    }
  } 

  

  async function run() {
    console.error('🚀 Iniciando Orquestrador Node.js para o Jarbas...');

    // 1. Controle de Concorrência (Lock)
    if (await fileExists(LOCK_FILE)) {
      await incrementTaskTimerandReturnValue();
      await log('⏳ Outra instância já está rodando. Omitindo execução.');
      return; 
    }
    await fs.promises.writeFile(LOCK_FILE, process.pid.toString());
    await log(`🔓 Lock trancado com sucesso.`);

    try {
      // 2. Busca nova tarefa
      const response = await axios.get(`${API_URL}/api/tasks/next/Jarbas`);
      
      if (!response.data.success || !response.data.task) {
        console.error("😴 Nenhuma tarefa nova na fila.");
        return; 
      }

      const task = response.data.task;
      await log(`🎯 Tarefa capturada: [${task.id}] ${task.title}. Assumindo o controle...`);
      
      // Atualiza painel para "Em Andamento"
      await axios.put(`${API_URL}/api/tasks/${task.id}`, { statusId: STATUS.IN_PROGRESS });

      // 3. Prepara os caminhos do Contrato Físico
      const promptFile = path.join(TASKS_DIR, `prompt-${task.id}.txt`);
      const relatorioFile = path.join(TASKS_DIR, `relatorio-${task.id}.txt`);
      const doneFile = path.join(TASKS_DIR, `done-${task.id}.done`);

      // (Aqui você chama sua função que monta o texto que te passei acima e salva em promptFile)
      await prepareTaskPrompt(task, promptFile, relatorioFile, doneFile);

      // 1. Lemos o conteúdo do prompt para injetar na CLI
      const promptContent = await fs.promises.readFile(promptFile, 'utf8');

      // 4. O Coração da Solução Híbrida: Spawn aguardando o Close
      await log(`🤖 Invocando OpenClaw via CLI (openclaw agent)...`);

      await new Promise((resolve) => {
        const terminalLogPath = path.join(TASKS_DIR, `terminal-${task.id}.log`);
        const outLog = fs.openSync(terminalLogPath, 'w'); // 'w' garante um log limpo por execução

        // Sintaxe exata baseada no seu --help
        const childArgs = [
          'agent', 
          '--session-id', task.id, // Isola o contexto de memória da IA para esta tarefa
          '-m', promptContent      // Entrega o texto completo do prompt
          // '--local'             // Descomente esta linha se você roda o agente embutido sem o Gateway
        ];

        const child = spawn('openclaw', childArgs, {
          cwd: TASKS_DIR,
          // O OpenClaw lerá a variável OPENCLAW_MODEL já que não possui a flag --model
          env: { ...process.env, OPENCLAW_MODEL: task.model }, 
          shell: false, // CRÍTICO: Mantém o prompt seguro contra injeção de comandos
          stdio: ['ignore', outLog, outLog]
        });

        child.on('error', (err) => {
          log(`❌ Erro ao invocar a CLI do OpenClaw: ${err.message}`);
          if (err.code === 'ENOENT') {
            log(`💡 Dica: O Linux não encontrou o executável 'openclaw'. Tente usar 'npx' como primeiro argumento.`);
          }
          fs.closeSync(outLog);
          resolve(); 
        });
        const timeoutTimer = setTimeout(() => {
          log(`⏰ TIMEOUT ALCANÇADO: A IA demorou mais de ${TEMPO_MAXIMO_MS / 60000} minutos. Abortando processo à força!`);
          
          // Envia um sinal de morte bruta para o processo filho
          child.kill('SIGKILL'); 
        }, TASK_TIMEOUT_MS);
        child.on('close', (code) => {
          clearTimeout(timeoutTimer);
          fs.closeSync(outLog);
          log(`🛑 Processo do OpenClaw encerrado com código de saída ${code}.`);
          resolve(); 
        });

        
      });

      // 5. Verificação do Contrato (Marker File)
      await log(`🔍 Verificando contrato de entrega para a tarefa ${task.id}...`);
      
      if (await fileExists(doneFile)) {
        // Sucesso Absoluto!
        let executionNotes = "Concluído. Relatório vazio ou não gerado.";
        if (await fileExists(relatorioFile)) {
          executionNotes = await fs.promises.readFile(relatorioFile, 'utf8');
        }

        await log(`✅ IA cumpriu o contrato! Atualizando banco de dados...`);
        
        // Substitui a API call pelo seu endpoint real
        await axios.patch(`${API_URL}/api/tasks/${task.id}/finalize`, {
          userId: MY_USER_ID,
          executionNotes: executionNotes
        });

        // Limpeza dos arquivos da tarefa concluída
        await fs.promises.unlink(doneFile);
        if (await fileExists(relatorioFile)) await fs.promises.unlink(relatorioFile);
        if (await fileExists(promptFile)) await fs.promises.unlink(promptFile);

      } else {
        // Falha! A IA morreu, abortou ou se perdeu antes de criar o .done
        await log(`⚠️ ALERTA: Arquivo .done não encontrado. A IA falhou na execução.`);
        
        // Verificamos se a ia criou o arquivo de log
        const terminalLogPath = path.join(TASKS_DIR, `terminal-${task.id}.log`);
        let terminalOutput = "";
        if (await fileExists(terminalLogPath)) {
          terminalOutput = await fs.promises.readFile(terminalLogPath, 'utf8');
          await log(`📜 Saída do Terminal da IA:\n${terminalOutput}`);
        }

        await axios.post(`${API_URL}/api/comments`, {
          taskId: task.id,
          userId: MY_USER_ID,
          content: `⚠️ **FALHA DE EXECUÇÃO LOCAL**\nA IA não conseguiu finalizar a tarefa ou não assinou o contrato de entrega.\n\nSaída do Terminal:\n${terminalOutput}`
        });
        
        // --- LÓGICA DE REATRIBUIÇÃO (Fallback para o Alexandre) ---
        try {
          let devId = null;
          const usersRes = await axios.get(`${API_URL}/api/users`);
          
          // Busca dinamicamente o ID do usuário alexandre
          const dev = (usersRes.data.users || []).find(u => u.nickname === 'alexandre');
          
          if (dev) {
            devId = dev.id;
            await log(`👤 Reatribuindo tarefa ${task.id} para o usuário alexandre.`);
            
            // Enviamos apenas assignedToId. Como não mandamos o statusId, 
            // a API mantém a tarefa na mesma coluna do Kanban.
            await axios.put(`${API_URL}/api/tasks/${task.id}`, { assignedToId: devId });
          } else {
            await log(`⚠️ Usuário 'alexandre' não encontrado na API. Tarefa mantida com a atribuição atual.`);
          }
        } catch (assignError) {
          await log(`❌ Erro de rede ao tentar reatribuir a tarefa: ${assignError.message}`);
        }
      }

    } catch (error) {
      // Extrai o payload de erro real da API, se existir
      const detail = error.response?.data 
        ? JSON.stringify(error.response.data) 
        : (error.stack || error.message);
        
      // Se for um erro do Axios, loga também qual URL e Método falharam
      const requestInfo = error.config 
        ? `[${error.config.method.toUpperCase()} ${error.config.url}]` 
        : '';

      await log(`💥 Erro Fatal no Orquestrador ${requestInfo}: ${detail}`);
      process.exitCode = 1;
    } finally {
      // 6. Limpeza sagrada do Lock (Libera para o próximo ciclo do cron)
      try {
        if (await fileExists(LOCK_FILE)) {
          await fs.promises.unlink(LOCK_FILE);
          await log(`🔓 Lock liberado com sucesso.`);
        }
      } catch (e) {
        console.error(`Erro ao remover lock file: ${e.message}`);
      }
    }
  }

  await run();
}

main();