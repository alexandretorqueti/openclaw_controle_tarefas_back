const fs = require('fs');
const axios = require('axios');
const { log } = require('./logger');
const { API_URL } = require('./config');

/**
 * Monta o arquivo físico com as instruções estruturadas para o Agente Jarbas.
 * Organizado por hierarquia de importância e regras de identificação.
 */
async function prepareTaskPrompt(task, promptFile, relatorioFile, doneFile) {
  let projetoRegras = "Nenhuma regra específica definida para este projeto.";
  try {
    const projRes = await axios.get(`${API_URL}/api/projects/${task.projectId}`);
    const projData = projRes.data.project || projRes.data;
    if (projData?.regras) projetoRegras = projData.regras;
  } catch (e) { 
    await log(`Aviso: Sem regras do projeto para a tarefa ${task.id}.`); 
  }

  let taskComments = "Nenhum histórico de comentários disponível.";
  try {
    const commentsRes = await axios.get(`${API_URL}/api/comments/task/${task.id}`);
    const commentsArray = commentsRes.data.comments || commentsRes.data || []; 
    
    if (commentsArray.length > 0) {
      taskComments = commentsArray.map(c => 
        `- [${c.user?.name || 'Sistema'}]: ${c.content}`
      ).join('\n');
    }
  } catch (e) { 
    await log(`Aviso: Falha ao buscar comentários para a tarefa ${task.id}.`); 
  }

  // === MONTAGEM DO PROMPT ESTRUTURADO (MARKDOWN HIERÁRQUICO) ===
  const promptContent = `### IDENTITY ###
Você é o Agente Técnico Jarbas. Atue como um Engenheiro de Software Sênior. 
Seu objetivo é a execução técnica de alta precisão com foco em eficiência e estabilidade do sistema.

### MISSION_DETAILS ###
- **TÍTULO**: ${task.title}
- **DESCRIÇÃO**: ${task.description}

### TECHNICAL_CONTEXT & HISTORY ###
${taskComments}

### MANDATORY_PROJECT_RULES ###
${projetoRegras}

### EXECUTION_PROTOCOL (CRITICAL) ###
Ao concluir a análise ou modificação, você DEVE obrigatoriamente realizar estes dois passos via terminal:

1. **RELATÓRIO TÉCNICO**:
Crie ou sobrescreva o arquivo de log. A PRIMEIRA LINHA deve conter a identificação do seu modelo.
Comando: echo -e "IDENTIFICAÇÃO DO MODELO: [Nome do seu modelo aqui]\\n---\\nRelatório: [Descreva suas ações...]" > ${relatorioFile}

2. **CONTRATO DE ENTREGA (TRIGGER)**:
Crie o arquivo vazio para sinalizar ao orquestrador a liberação da GPU e encerramento da tarefa.
Comando: touch ${doneFile}

### CONSTRAINTS ###
- Não utilize o chat para conversação. 
- Sua única interface de saída deve ser o Relatório Técnico e o arquivo de trigger.
- Encerre sua execução imediatamente após o comando 'touch'.`;

  // Escreve o prompt no disco para o OpenClaw consumir
  await fs.promises.writeFile(promptFile, promptContent);
  await log(`📝 Prompt estruturado gerado em: ${promptFile}`);
}

module.exports = { prepareTaskPrompt };