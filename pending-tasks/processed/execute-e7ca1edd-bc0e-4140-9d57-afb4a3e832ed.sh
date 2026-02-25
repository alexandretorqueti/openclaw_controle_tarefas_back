#!/bin/bash
# Script para executar tarefa: História sobre gatos
# Gerado automaticamente pelo monitor-jarbas-tasks-v5.sh

echo "Executando tarefa: História sobre gatos"
echo "=============================================="
echo "Início: $(date '+%Y-%m-%d %H:%M:%S')"

# Extrai informações do prompt
TASK_DESCRIPTION="crie uma pequena historinha para crianças que tenha gatos."
PROJECT_RULES="Pasta de Trabalho /home/alexandrebragatorqueti/projetos/configuracao_openclaw"

echo "Descrição da tarefa: $TASK_DESCRIPTION"
echo "Regras do projeto: $PROJECT_RULES"
echo ""

# ANALISA O TIPO DE TAREFA E EXECUTA AÇÕES ESPECÍFICAS

# Caso 1: Tarefas de criação de arquivos/conteúdo
if [[ "$TASK_DESCRIPTION" == *"Crie um txt com um pequeno poema sobre gatos"* ]] ||    [[ "$TASK_DESCRIPTION" == *"Crie um arquivo"* ]] ||    [[ "$TASK_DESCRIPTION" == *"Criar arquivo"* ]] ||    [[ "$TASK_DESCRIPTION" == *"crie uma pequena historinha"* ]] ||    [[ "$TASK_DESCRIPTION" == *"escreva uma"* ]] ||    [[ "$TASK_DESCRIPTION" == *"criar história"* ]]; then
    echo "📝 Detectada tarefa de criação de arquivo"
    
    # Analisa a descrição para extrair detalhes
    if [[ "$TASK_DESCRIPTION" == *"poema sobre gatos"* ]]; then
        # Tarefa específica: poema sobre gatos
        echo "📖 Criando poema sobre gatos"
        
        # Extrai pasta do projeto das regras
        PROJECT_DIR="$(echo "$PROJECT_RULES" | grep -o '/home/[^ ]*' | head -1)"
        
        if [ -z "$PROJECT_DIR" ]; then
            PROJECT_DIR="/home/alexandrebragatorqueti/projetos/configuracao_openclaw"
        fi
        
        echo "📁 Pasta do projeto: $PROJECT_DIR"
        
        # Cria pasta se não existir
        mkdir -p "$PROJECT_DIR"
        
        # Navega para pasta
        cd "$PROJECT_DIR" || { echo "❌ Erro ao acessar pasta $PROJECT_DIR"; exit 1; }
        
        # Cria arquivo com poema
        cat > poema_gatos.txt << 'POEMA_EOF'
Gatos, seres de mistério e luz,
Com seus olhos que tudo refletem,
Pelas ruas, silêncios cruz,
Em seus passos, segredos secretam.

Pelos macios como seda fina,
Ronronam baixo, música suave,
Na janela, a tarde declina,
Eles observam, sábios e graves.

Com suas patas de veludo,
Pulam alto, tocam o céu,
No seu mundo, tudo é mudo,
Menos o amor, fiel e réu.

Gatos, donos de si e do lar,
Ensinam-nos a liberdade,
Sem precisar de explicar,
A verdadeira felicidade.
POEMA_EOF
        
        echo "✅ Arquivo criado: poema_gatos.txt"
        echo ""
        echo "📄 Conteúdo do arquivo:"
        echo "========================"
        cat poema_gatos.txt
        echo "========================"
        
    elif [[ "$TASK_DESCRIPTION" == *"/tmp"* ]] || [[ "$TASK_DESCRIPTION" == *"teste.txt"* ]]; then
        # Tarefa: criar arquivo teste.txt no /tmp
        echo "📄 Criando arquivo teste.txt no /tmp"
        
        # Extrai conteúdo da descrição
        CONTENT="$(echo "$TASK_DESCRIPTION" | grep -o 'conteúdo: [^.]*' | cut -d: -f2 | sed 's/^ //')"
        
        if [ -z "$CONTENT" ]; then
            CONTENT="Sistema funcionando!"
        fi
        
        echo "📝 Conteúdo a ser escrito: $CONTENT"
        
        # Cria arquivo no /tmp
        echo "$CONTENT" > /tmp/teste.txt
        
        echo "✅ Arquivo criado: /tmp/teste.txt"
        echo ""
        echo "📄 Conteúdo do arquivo:"
        echo "========================"
        cat /tmp/teste.txt
        echo "========================"
        
    elif [[ "$TASK_DESCRIPTION" == *"historinha"* ]] || [[ "$TASK_DESCRIPTION" == *"história"* ]] && [[ "$TASK_DESCRIPTION" == *"gatos"* ]]; then
        # Tarefa: criar história sobre gatos para crianças
        echo "📖 Criando história sobre gatos para crianças"
        
        # Extrai pasta do projeto das regras
        PROJECT_DIR="$(echo "$PROJECT_RULES" | grep -o '/home/[^ ]*' | head -1)"
        
        if [ -z "$PROJECT_DIR" ]; then
            PROJECT_DIR="/home/alexandrebragatorqueti/projetos/configuracao_openclaw"
        fi
        
        echo "📁 Pasta do projeto: $PROJECT_DIR"
        
        # Cria pasta se não existir
        mkdir -p "$PROJECT_DIR"
        
        # Navega para pasta
        cd "$PROJECT_DIR" || { echo "❌ Erro ao acessar pasta $PROJECT_DIR"; exit 1; }
        
        # Cria arquivo com história
        cat > historia_gatos_criancas.txt << 'HISTORIA_EOF'
O Gatinho Curioso

Era uma vez um gatinho chamado Tomás que vivia em uma casa aconchegante.
Tomás era muito curioso e adorava explorar todos os cantinhos.

Um dia, ele descobriu uma caixa de papelão no sótão.
Dentro da caixa, encontrou um novelo de lã colorido.
"Que divertido!" pensou Tomás, e começou a brincar.

Rolou, pulou, e fez bolinhas com a lã.
Mas cuidado, Tomás! A lã se embaraçou em suas patinhas!

Sua dona, a pequena Sofia, ouviu o miado e correu para ajudar.
Com cuidado, desembaraçou as patinhas do gatinho.
"Vamos brincar juntos, Tomás!" disse Sofia.

E assim, Tomás aprendeu que brincar é mais divertido com amigos.

Fim.
HISTORIA_EOF
        
        echo "✅ Arquivo criado: historia_gatos_criancas.txt"
        echo ""
        echo "📄 Conteúdo do arquivo:"
        echo "========================"
        cat historia_gatos_criancas.txt
        echo "========================"
        
    else
        # Tarefa genérica de criação de arquivo
        echo "📄 Criando arquivo genérico"
        
        # Tenta extrair nome do arquivo da descrição
        FILENAME="$(echo "$TASK_DESCRIPTION" | grep -o '[a-zA-Z0-9_-]*\.txt' | head -1)"
        
        if [ -z "$FILENAME" ]; then
            FILENAME="arquivo_tarefa.txt"
        fi
        
        # Extrai pasta do projeto das regras
        PROJECT_DIR="$(echo "$PROJECT_RULES" | grep -o '/home/[^ ]*' | head -1)"
        
        if [ -z "$PROJECT_DIR" ]; then
            PROJECT_DIR="/tmp"
        fi
        
        echo "📁 Pasta: $PROJECT_DIR"
        echo "📄 Nome do arquivo: $FILENAME"
        
        # Cria pasta se não existir
        mkdir -p "$PROJECT_DIR"
        
        # Cria arquivo básico
        echo "Arquivo criado automaticamente para tarefa: História sobre gatos" > "$PROJECT_DIR/$FILENAME"
        echo "Data: $(date)" >> "$PROJECT_DIR/$FILENAME"
        echo "Descrição: $TASK_DESCRIPTION" >> "$PROJECT_DIR/$FILENAME"
        
        echo "✅ Arquivo criado: $PROJECT_DIR/$FILENAME"
    fi
    
    EXIT_CODE=0
    
else
    # Caso genérico: Tarefa complexa que requer análise E execução
    echo "🔧 Tarefa complexa detectada: História sobre gatos"
    echo "📋 Descrição: $TASK_DESCRIPTION"
    echo ""
    
    # Lê o prompt completo
    PROMPT=$(cat "/home/alexandrebragatorqueti/projetos/pending-tasks/prompt-e7ca1edd-bc0e-4140-9d57-afb4a3e832ed.txt")
    
    # MODIFICAÇÃO CRÍTICA: Adiciona instruções EXPLÍCITAS de execução
    ENHANCED_PROMPT="${PROMPT}

## 🚀 INSTRUÇÕES DE EXECUÇÃO OBRIGATÓRIAS:

Você DEVE EXECUTAR esta tarefa, não apenas analisar. Siga estes passos:

1. **ANALISE o problema** identificando a causa raiz
2. **EXECUTE ações concretas** para resolver o problema
3. **USE as ferramentas disponíveis** (read, write, exec, edit, etc.)
4. **VERIFIQUE** que a solução funciona
5. **DOCUMENTE** o que foi feito

Para a tarefa específica '$TASK_DESCRIPTION':
- Se for um BUG: Encontre o código problemático e corrija
- Se for DESENVOLVIMENTO: Escreva o código necessário
- Se for CONFIGURAÇÃO: Execute os comandos necessários

**NÃO APENAS ANALISE - EXECUTE!**"

    echo "🚀 Iniciando EXECUÇÃO da tarefa (não apenas análise)..."
    
    # Executa o agente OpenClaw com prompt ENHANCED
    /home/alexandrebragatorqueti/.nvm/versions/node/v24.11.0/bin/openclaw agent \
        --message "$ENHANCED_PROMPT" \
        --thinking minimal \
        --agent main
    
    EXIT_CODE=$?
    
    echo ""
    echo "📊 Resultado da execução:"
    if [ $EXIT_CODE -eq 0 ]; then
        echo "✅ Tarefa executada com sucesso"
    else
        echo "⚠️  Tarefa encontrou problemas (código: $EXIT_CODE)"
    fi
fi

echo ""
echo "Fim: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Código de saída: $EXIT_CODE"

# NOTA: O status será atualizado pelo script principal (check_completed_tasks)
# quando detectar que este agente terminou

echo "=============================================="
