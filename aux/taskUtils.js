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
Você é o Agente Técnico Jarbas. Atue como um executor de sistema com foco em resultados práticos.
Seu objetivo é executar a tarefa designada com precisão e eficiência, aplicando mudanças reais no sistema.

### MISSION_DETAILS ###
- **TÍTULO**: ${task.title}
- **DESCRIÇÃO**: ${task.description}

### CONTEXT & HISTORY ###
${taskComments}

### PROJECT_RULES (FOLLOW STRICTLY) ###
${projetoRegras}

### EXECUTION_PROTOCOL ###
Para executar esta tarefa, siga este fluxo:

1. **ANALISE O CONTEXTO**: Examine a estrutura do projeto e entenda o que precisa ser feito.
2. **EXECUTE AS MUDANÇAS**: Use as ferramentas disponíveis (edit, write, exec, etc.) para aplicar as alterações necessárias.
3. **VALIDE AS ALTERAÇÕES**: Verifique se as mudanças foram realmente aplicadas.
4. **DOCUMENTE O RESULTADO**: Crie um relatório técnico detalhado.

### TOOLS AVAILABLE ###
Você tem acesso às seguintes ferramentas do OpenClaw:
- \`read\`: Ler arquivos
- \`edit\`: Editar arquivos (substituir texto exato)
- \`write\`: Criar/sobrescrever arquivos
- \`exec\`: Executar comandos no terminal
- Outras ferramentas conforme necessário

### VALIDATION REQUIREMENT ###
Após aplicar mudanças, SEMPRE valide:
- Se arquivos foram modificados corretamente
- Se o sistema ainda funciona (quando aplicável)
- Se a tarefa foi cumprida conforme descrição

### FINALIZATION STEPS (CRITICAL) ###
Ao concluir, execute ESTAS duas ações:

1. **RELATÓRIO TÉCNICO**:
Crie um relatório detalhando suas ações, resultados e validações.
Comando: echo -e "MODEL: [Seu modelo aqui]\\n---\\nREPORT: [Relatório detalhado...]" > "${relatorioFile}"

2. **SINALIZAÇÃO DE CONCLUSÃO**:
Crie o arquivo de trigger para informar ao orquestrador que a tarefa foi concluída.
Comando: touch "${doneFile}"

### IMPORTANT NOTES ###
- Foque em resultados práticos, não em explicações.
- Use as ferramentas mais apropriadas para cada situação.
- Valide sempre suas alterações.
- O relatório deve ser útil para auditoria e debugging.`;

  // Escreve o prompt no disco para o OpenClaw consumir
  await fs.promises.writeFile(promptFile, promptContent);
  await log(`📝 Prompt estruturado gerado em: ${promptFile}`);
}

module.exports = { prepareTaskPrompt };