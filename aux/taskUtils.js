// aux/taskUtils.js
const fs = require('fs');
const axios = require('axios');
const { log } = require('./logger');
const { API_URL } = require('./config');

/**
 * Monta o arquivo físico com as instruções rigorosas para a IA
 * e injeta os caminhos absolutos para o contrato de entrega.
 */
async function prepareTaskPrompt(task, promptFile, relatorioFile, doneFile) {
  let projetoRegras = "Nenhuma regra específica definida.";
  try {
    const projRes = await axios.get(`${API_URL}/api/projects/${task.projectId}`);
    const projData = projRes.data.project || projRes.data;
    if (projData?.regras) projetoRegras = projData.regras;
  } catch (e) { 
    await log(`Aviso: Sem regras do projeto para a tarefa ${task.id}.`); 
  }

  let taskComments = "";
  try {
    const commentsRes = await axios.get(`${API_URL}/api/comments/task/${task.id}`);
    const commentsArray = commentsRes.data.comments || commentsRes.data || []; 
    
    if (commentsArray.length > 0) {
      taskComments = commentsArray.map(c => 
        `[${c.user?.name || 'Usuário'} comentou]: ${c.content}`
      ).join('\n\n');
    }
  } catch (e) { 
    await log(`Aviso: Falha ao buscar comentários para a tarefa ${task.id}.`); 
  }

  // === MONTAGEM DO PROMPT DEFINITIVO ===
  const promptContent = `Você é o Agente Técnico Jarbas. Seu único objetivo é executar a tarefa técnica designada abaixo com foco, precisão e eficiência de máquina.

### CONTEXTO DA TAREFA ###
TÍTULO: ${task.title}
DESCRIÇÃO: ${task.description}

### COMENTÁRIOS E HISTÓRICO DA TAREFA ###
${taskComments}

### REGRAS DO PROJETO (OBRIGATÓRIAS) ###
${projetoRegras}

### PROTOCOLO DE CONCLUSÃO (CRÍTICO E OBRIGATÓRIO) ###
Assim que você finalizar as alterações e testes necessários no código, você DEVE executar os dois passos abaixo usando suas ferramentas de terminal, exatamente nesta ordem:

1. Gere o relatório de execução:
Crie ou sobrescreva o arquivo abaixo detalhando as ações tomadas, os arquivos modificados e as eventuais pendências.
Escreva o nome do seu modelo no início do relatório para fins de rastreabilidade, no formato: "Modelo utilizado: [NOME_DO_MODELO]" + "\n\n" + Relatório detalhado.
Comando esperado: echo "Seu relatorio técnico aqui..." > ${relatorioFile} 

2. Assine o contrato de finalização:
Crie um arquivo vazio no caminho abaixo. ISSO É VITAL. O orquestrador do sistema está aguardando a existência deste arquivo para liberar a GPU e marcar a tarefa como concluída.
Comando esperado: touch ${doneFile}

Restrições:
Não explique suas ações no chat. Apenas execute a tarefa, crie os dois arquivos usando a ferramenta de terminal e encerre sua execução imediatamente.`;

  // Escreve o prompt no disco para o OpenClaw consumir
  await fs.promises.writeFile(promptFile, promptContent);
  await log(`📝 Arquivo de prompt gerado com sucesso: ${promptFile}`);
}

module.exports = { prepareTaskPrompt };