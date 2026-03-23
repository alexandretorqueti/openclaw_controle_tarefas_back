// src/utils/promptFactory.js
class PromptFactory {
    /**
     * Gera o prompt para a análise inicial de escopo da tarefa.
     */
    static buildTaskAnalysisPrompt(task, project, preAnalysisFile = null) {
        return `
      Você é um arquiteto de software. Analise a tarefa abaixo e defina o escopo de execução.
      
      PROJETO:
      - Base: ${project === null || project === void 0 ? void 0 : project.pastaBase}
      - Frontend Path: ${(project === null || project === void 0 ? void 0 : project.frontendPath) || 'N/A'}
      - Backend Path: ${(project === null || project === void 0 ? void 0 : project.backendPath) || 'N/A'}

      TAREFA:
      - Título: ${task.title}
      - Descrição: ${task.description}

      REGRAS DE CLASSIFICAÇÃO:
      1. Se a tarefa pede para criar/alterar/corrigir código, ou alterar layout, o tipo é 'development'.
      2. Se a tarefa mencionar BUG, ERRO, CORRIGIR, AJUSTAR, MELHORAR, ou palavras similares, é 'development'.
      3. [REGRA DE ANÁLISE]: Se a tarefa pede APENAS para VERIFICAR, CHECAR, INSPECIONAR, DESCOBRIR, LER ou EXPLICAR algo (ex: "ver em qual porta roda", "analisar log"), o tipo é OBRIGATORIAMENTE 'analysis'. Tarefas de 'analysis' NÃO exigem modificação de arquivos, apenas leitura e relatório!
      4. Se é uma tarefa de script/limpeza/execução repetitiva, é 'automation'.
      5. Se requer um relatório detalhado ou passo a passo, marque "requiresReport" como true.
      6. [REGRA DE CAMADAS]: Tarefas focadas em "layout", "tela", "protótipo", "componentes", "visual", "CSS" ou "design" NÃO DEVEM exigir o backend. SÓ inclua "backend" em "requiredModifiedLayers" se a tarefa pedir explicitamente para criar banco de dados, rotas de API ou lógica de servidor.
      
      REGRAS DE EXECUÇÃO:
      1. Tarefas 'analysis' serão EXECUTADAS IMEDIATAMENTE pelo arquiteto (sem passar para o desenvolvedor).
      2. Tarefas 'automation' simples serão executadas pelo arquiteto; complexas passarão para o desenvolvedor.
      3. Tarefas 'development' sempre passarão para o desenvolvedor após planejamento.
      
      7. Escreva no arquivo ${preAnalysisFile} o motivo que você classificou a tarefa daquela forma.
      Responda EXCLUSIVAMENTE em JSON com este formato (adapte as arrays conforme a real necessidade da tarefa):
      {
        "taskType": "development" | "analysis" | "automation",
        "requiresReport": true | false,
        "expectedLayers": ["frontend"],
        "requiredModifiedLayers": [],
        "mandatoryChecks": ["Verificar configurações", "Gerar relatório de descoberta"],
        "risks": ["Risco de não encontrar o arquivo de configuração"]
      }
    `.trim();
    }
    static buildArchitectPrompt(task, project, fileList, planFilePath, commentsSection = '', taskType = 'development') {
        const path = require('path');
        const truncatedFiles = fileList.slice(0, 500).join('\n');
        const frontDir = (project === null || project === void 0 ? void 0 : project.frontendPath) ? path.join(project.pastaBase || '', project.frontendPath) : 'N/A';
        const backDir = (project === null || project === void 0 ? void 0 : project.backendPath) ? path.join(project.pastaBase || '', project.backendPath) : 'N/A';
        let portasCtx = '';
        if ((project === null || project === void 0 ? void 0 : project.frontendPort) || (project === null || project === void 0 ? void 0 : project.backendPort)) {
            portasCtx = `\n[INFRAESTRUTURA DE PORTAS]\n`;
            if (project === null || project === void 0 ? void 0 : project.frontendPort)
                portasCtx += `- Frontend roda na porta: ${project.frontendPort}\n`;
            if (project === null || project === void 0 ? void 0 : project.backendPort)
                portasCtx += `- Backend roda na porta: ${project.backendPort}\n`;
            portasCtx += `(Garanta que o código ou as instruções de ambiente .env respeitem estas portas)`;
        }
        // Diferentes instruções baseadas no tipo de tarefa
        const taskTypeInstructions = {
            development: `
=== SEU FLUXO DE TRABALHO OBRIGATÓRIO (DESENVOLVIMENTO) ===
* Apenas analise a tarefa e decida quais arquivos o Desenvolvedor precisará criar ou alterar.
* Formule um passo a passo técnico detalhado (ex: "1. No arquivo X, adicione a rota Y").
* Use a ferramenta 'write' para salvar TODO esse passo a passo EXATAMENTE neste arquivo: ${planFilePath}
* NÃO DÊ MAIS DE UMA OPÇÃO AO DESENVOLVEDOR. SE HOUVER MAIS DE UM CAMINHO ESCOLHA O MELHOR.
* NÃO PEÇA AO DESENVOLVEDOR PARA REALIZAR TESTES. OS TESTES SERÃO FEITOS EM OUTRA ETAPA.
* PROIBIDO criar ou editar arquivos de código-fonte.
* PROIBIDO criar arquivos de status (.done). O seu trabalho é ESTRITAMENTE de planejamento.
* Assim que o plano for salvo com sucesso, responda APENAS com: "Plano salvo. Passando o bastão para o Desenvolvedor."
      `,
            analysis: `
=== SEU FLUXO DE TRABALHO OBRIGATÓRIO (ANÁLISE) ===
1. Esta é uma tarefa EXCLUSIVA de leitura e investigação. NÃO modifique códigos.
2. Use a ferramenta 'read' ou 'exec' (comandos bash como cat, grep) para inspecionar os arquivos solicitados.
3. Use a ferramenta 'write' para gerar um RELATÓRIO COMPLETO com suas descobertas EXATAMENTE neste arquivo: ${planFilePath}
4. Após gerar e salvar o relatório, você DEVE finalizar a tarefa executando o comando \`touch .done\` no diretório da tarefa usando a ferramenta 'exec'.
5. Redija seu relatório e mensagens no PASSADO (ex: "verifiquei", "encontrei", "descobri") para provar que a ação foi concluída.
6. Responda com: "Análise concluída. Tarefa finalizada pelo arquiteto."
      `,
            automation: `
=== SEU FLUXO DE TRABALHO OBRIGATÓRIO (AUTOMAÇÃO) ===
1. Avalie se o script ou comando de automação pode ser rodado por você agora mesmo (ex: comandos shell simples, limpeza, git).
2. Se puder resolver agora, EXECUTE a ação usando a ferramenta 'exec'.
3. Use a ferramenta 'write' para registrar o resultado da execução no arquivo: ${planFilePath}
4. Se você executou com sucesso, finalize criando o marcador de conclusão via ferramenta 'exec' rodando \`touch .done\`.
5. Se for complexo demais e exigir codificação pesada, crie apenas um plano de ação (como em 'development') e NÃO crie o arquivo .done.
      `
        };
        const instructions = taskTypeInstructions[taskType] || taskTypeInstructions.development;
        return `
Você é o Arquiteto de Software Líder do projeto.
Tipo de Tarefa: [${taskType.toUpperCase()}]

[CONTEXTO DO PROJETO]
Frontend: ${frontDir}
Backend: ${backDir}${portasCtx}

[ESTRUTURA DE ARQUIVOS]
${truncatedFiles}

[TAREFA ATUAL]
Título: ${task === null || task === void 0 ? void 0 : task.title}
Descrição: ${task === null || task === void 0 ? void 0 : task.description}${commentsSection}

[REGRAS CRÍTICAS DE SISTEMA]
- Você NÃO PODE interagir de forma conversacional. Você deve AGIR utilizando as ferramentas JSON fornecidas.
- Se a ferramenta 'write' falhar, você DEVE imprimir o plano ou relatório completo no seu output de texto, cercado por tags <PLANO> ... </PLANO>.

${instructions}

Inicie agora o seu fluxo de trabalho estrito.
`.trim();
    }
    static buildAgentSystemPrompt(agentContext) {
        return `
      Você é o Agente Jarbas.
      O seu contexto atual é: ${agentContext}
      // ... outras regras do agente
    `.trim();
    }
    /**
     * Exemplo: Prompt para gerar relatórios
     */
    static buildReportPrompt(taskTitle, executionEvidence) {
        return `
       A tarefa "${taskTitle}" foi concluída. 
       Com base nas evidências: ${JSON.stringify(executionEvidence)}
       Escreva um relatório detalhado.
     `.trim();
    }
    static buildEngineRulesPrompt(files) {
        return `
[REGRA DE OURO]
1. NÃO ADIVINHE CAMINHOS. Use 'find' ou 'ls'.
2. PROIBIDO FAZER BACKUPS: Edite os arquivos originais DIRETAMENTE.
3. SÓ FINALIZE criando o arquivo .done QUANDO TUDO ESTIVER CONCLUÍDO.
4. SE PRECISAR CRIAR ARQUIVOS TEMPORÁRIOS, CRIE NO SEU WORKSPACE, NÃO NO PROJETO.

[REGRAS CRÍTICAS PARA A FERRAMENTA 'EDIT']
1. O campo 'old_text' (ou equivalente) DEVE ser uma cópia EXATA, byte por byte, do arquivo original. Isso inclui todos os espaços em branco, tabs e quebras de linha.
2. NUNCA tente adivinhar a formatação. Sempre use a ferramenta 'read' ou 'exec' (com 'cat') no arquivo ANTES de usar 'edit', e copie o trecho original diretamente do retorno da leitura.
3. Se o 'edit' continuar falhando por causa de espaços, desista do 'edit' e use a ferramenta 'write' para reescrever o arquivo inteiro com a sua modificação.

QUANDO TERMINAR A TAREFA, SIGA ESTES 2 PASSOS EXATOS:

PASSO 1: DOCUMENTAÇÃO
Use a ferramenta "write" para gerar o seu relatório de conclusão.
- Argumento 'file': ${files.relatorioFile}
- Argumento 'content': Escreva um resumo técnico das alterações feitas, arquivos modificados e decisões tomadas. (Garanta que o texto esteja em uma única string JSON válida, usando \n para quebras de linha).

PASSO 2: ENCERRAMENTO
Use a ferramenta "exec" com o comando touch para avisar o sistema que você finalizou.
- Exemplo exato: {"name": "exec", "arguments": {"command": "touch ${files.doneFile}"}}
`.trim();
    }
    static buildArchitectAnalysisPrompt(architectResponse, task, project) {
        const prompt = `
      Você é um analista de respostas de arquitetos de software.
      Analise a resposta abaixo de um arquiteto e determine:

      1. O arquiteto JÁ EXECUTOU a tarefa? (implementou código, alterou arquivos)
      2. O arquiteto apenas GEROU UM PLANO? (descreveu passos, mas não executou)
      3. O arquiteto NÃO CONSEGUIU ANALISAR? (resposta vazia, incompleta, erro)
      4. O arquiteto AFIRMA QUE A TAREFA JÁ FOI EXECUTADA ANTERIORMENTE? (resposta com "hadExecuted": true)

      CONTEXTO:
      - Tarefa: ${task.title}
      - Descrição: ${task.description}
      - Projeto: ${(project === null || project === void 0 ? void 0 : project.name) || 'N/A'}

      RESPOSTA DO ARQUITETO:
      ${architectResponse}

      Analise PALAVRA POR PALAVRA. Procure por TEMPO VERBAL:
      - PASSADO = execução
      - IMPERATIVO/FUTURO = plano
      
      Se houver DÚVIDA, considere como PLANO (hasPlan: true, hasExecuted: false).

      Responda EXCLUSIVAMENTE em JSON:
      {
        "hasExecuted": true/false,
        "hasPlan": true/false,
        "confidence": 0-100,
        "executionDetails": "Descrição do que foi executado, se aplicável",
        "planDetails": "Descrição do plano gerado, se aplicável",
        "analysisFailed": true/false,
        "hadExecuted": true/false // A tarefa já estava pronta?
      }

      CRITÉRIOS CLAROS E EXCLUSIVOS:
      1. "hasExecuted": true APENAS SE o arquiteto DESCREVE TER FEITO alterações reais.
         - Palavras-chave de EXECUÇÃO (PASSADO): "modifiquei", "alterei", "implementei", "adicionei", "removi", "testei e funcionou", "arquivo atualizado", "código executado", "fiz", "concluí", "finalizei"
         - Evidência de AÇÃO CONCLUÍDA, não de intenção.
         - EXEMPLO DE EXECUÇÃO: "Já alterei o arquivo X e adicionei o código Y"
         
      2. "hasPlan": true SE o arquiteto descreve passos FUTUROS, instruções, ou plano de ação.
         - Palavras-chave de PLANO (FUTURO/IMPERATIVO): "deve", "precisa", "siga", "passo a passo", "modifique", "adicione", "localize", "teste", "faça", "execute", "crie"
         - Descreve O QUE FAZER, não O QUE FOI FEITO.
         - EXEMPLO DE PLANO: "Você deve modificar o arquivo X e adicionar o código Y"
         
      3. "analysisFailed": true SE a resposta for vazia, incompreensível, ou não relacionada.

      REGRA DE OURO CRÍTICA: 
      - Se o arquiteto usa verbos no IMPERATIVO ou FUTURO ("faça", "modifique", "adicione") → É PLANO (hasPlan: true)
      - Se o arquiteto usa verbos no PASSADO ("fiz", "modifiquei", "alterei") → É EXECUÇÃO (hasExecuted: true)
      - Plano detalhado NÃO é execução! Um plano com 100 passos ainda é apenas um plano.
    `.trim();
        return prompt;
    }
    /**
     * Gera o prompt para o Arquiteto decompor uma Tarefa Mãe em micro-tarefas de Front e Back.
     */
    static buildDecompositionPrompt(task) {
        return `# ROLE
Você é um Arquiteto de Software focado em automação de workflow. Sua função é avaliar e, se estritamente necessário, descompor uma tarefa complexa em formato JSON.

# TAREFA MÃE
Título: ${task.title}
Descrição: ${task.description}

# REGRAS DE AVALIAÇÃO E DIVISÃO (CRÍTICO)
1. AVALIAÇÃO DE COMPLEXIDADE: Verifique se esta tarefa é muito complexa. Se for uma tarefa razoavelmente simples, direta ou até indivisível (atômica), VOCÊ NÃO DEVE DIVIDI-LA.
2. REGRA DE MUTAÇÃO DE CÓDIGO: Toda subtarefa gerada DEVE, obrigatoriamente, resultar na criação ou alteração física de arquivos de código.
3. PROIBIDO TAREFAS EXPLORATÓRIAS: É estritamente proibido criar tarefas de "leitura", "análise", "verificação" ou "planejamento" (ex: "verifique se a pasta X existe" ou "estude a estrutura"). O sistema de validação quebrará se uma tarefa não gerar alterações de arquivos.
4. ISOLAMENTO DE DOMÍNIO: Uma subtarefa deve ser inteiramente de um único domínio (BACKEND ou FRONTEND).
5. NUNCA DIVIDA A TAREFA EM APENAS 1 TAREFA. SE FOR FAZER ISSO, NÃO DIVIDA.
6. EVITE DIVIDIR A TAREFA SE PUDER.

# REGRAS DE SAÍDA DE DADOS
1. Retorne EXCLUSIVAMENTE um array JSON puro. 
2. Proibido incluir saudações, explicações, formatação markdown (não use \`\`\`json) ou comentários.
3. Se a tarefa for IDEAL (não precisa ser dividida), retorne EXATAMENTE um array vazio: []
4. Se a tarefa for COMPLEXA, retorne o array contendo os objetos das subtarefas.
5. Sua resposta deve começar obrigatoriamente com o caractere [ e terminar com ]

# FORMATO DO JSON
[
  {
    "title": "[DOMÍNIO] Ação direta (ex: Criar rota X, Alterar componente Y)",
    "description": "Passo a passo técnico detalhando exatamente quais arquivos criar/modificar.",
    "domain": "BACKEND ou FRONTEND"
  }
]`;
    }
    /**
     * Constrói prompt para validação de atomicidade
     * @param {Object} task - Tarefa
     * @param {Object} project - Projeto
     * @returns {string} Prompt formatado
     */
    static buildValidationPrompt(task, project) {
        return `Você é um Juiz de Arquitetura de Software. Sua função é avaliar se uma tarefa tem o "Tamanho Ideal" para ser entregue a um desenvolvedor senior.

O QUE É UMA TAREFA DE TAMANHO IDEAL:
1. É uma unidade coesa de funcionalidade ou correção. Exemplo: "Criar endpoint de login", "Implementar layout da tela de perfil", "Adicionar validação no formulário X".
2. Pode a edição de múltiplos arquivos relacionados (ex: alterar Rota, Controller e Service) para entregar a funcionalidade de ponta a ponta.
3. O desenvolvedor tem inteligência para usar ferramentas de busca (find, grep) e ler o código sozinho. O escopo foca no OBJETIVO (o que construir/corrigir).
4. É uma tarefa que leva de algumas horas até um dia de trabalho.
5. Se uma tarefa é só no front, ou só no back, e ela envolve um módulo, ela deve ser considerada IDEAL.
6. Se uma tarefa envolve apenas um arquivo, ela deve ser considerada IDEAL.
7. Tarefas que mexem em apenas uma arquivo não deve ser dividido.

O QUE **NÃO** É UMA TAREFA DE TAMANHO IDEAL:
1. Micro-gerenciamento microscópico. Tarefas do tipo "Abra a pasta X", "Procure a string Y", "Edite a linha 5" NÃO são tarefas reais, são passos de terminal. Se a tarefa é um passo de terminal, ela DEVE ser considerada IDEAL (pois o dev a fará em segundos), mas o ideal é que a tarefa englobe a feature inteira.
2. Épicos ou Módulos Inteiros. Exemplo: "Fazer o módulo de pagamentos inteiro", "Refatorar todo o sistema", "Criar o painel de admin completo". Isso é muito grande e precisa ser dividido (Não é ideal).
3. Tarefas que mencionam várias telas ou vários menus. Exemplo: "Rever o layout de todas as telas". Isso é muito grande e precisa ser dividido (NÃO é ideal).
REGRA DE OURO: Não seja excessivamente radical. Se a tarefa descreve uma funcionalidade clara ou um bug específico que um dev consegue resolver em um dia, ela deve ser considerada, IDEAL. Reprove (isIdeal: false) APENAS se for um Épico gigante que envolva dezenas de funcionalidades soltas.

INFORMAÇÕES DA TAREFA:
- Título: ${task.title}
- Descrição: ${task.description}
- Projeto: ${project.name}
- Domínio: ${task.domain || 'Não especificado'}

FORMATO DE RESPOSTA OBRIGATÓRIO (APENAS JSON):
{
  "isIdeal": boolean,
  "reason": "Explique brevemente por que a tarefa tem um bom escopo funcional ou por que é um épico grande demais.",
  "confidence": number,
  "inferredDomain": "FRONTEND | BACKEND | UNKNOWN" 
}

REGRA PARA O DOMÍNIO: Se o 'Domínio Atual' for 'Não especificado', deduza se a tarefa pertence ao FRONTEND ou BACKEND baseado na descrição. Se não for possível deduzir, retorne "UNKNOWN". Se já vier preenchido, apenas repita-o.
`;
    }
    static ensureAndValidateBuildPrompt(pkgContent) {
        return `
        Analise este package.json de um projeto Node.js e decida qual o melhor comando para VALIDAR se o código está funcionando (smoke test).
        Regras:
        1. Se houver um script de 'test' real, use 'npm test'.
        2. Se não houver testes, mas houver um script 'start', use um comando que tente iniciar e feche após 5 segundos, ex: "timeout 5s npm start".
        3. Retorne APENAS um JSON no formato: {"command": "string do comando"}.
        
        Conteúdo do package.json:
        ${pkgContent}
    `;
    }
}
module.exports = PromptFactory;
