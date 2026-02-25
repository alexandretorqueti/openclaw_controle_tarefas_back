#!/bin/bash

# Script para processar tarefas pendentes
# Executa os agentes IA para cada tarefa encontrada

TASKS_DIR="/home/alexandrebragatorqueti/projetos/pending-tasks"
PROCESSED_DIR="${TASKS_DIR}/processed"
LOG_FILE="/home/alexandrebragatorqueti/projetos/task-processor.log"
MAX_CONCURRENT=2

# Cria diretórios
mkdir -p "$TASKS_DIR"
mkdir -p "$PROCESSED_DIR"

# Função para log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Função para processar uma tarefa
process_task() {
    local task_file="$1"
    local task_id=$(basename "$task_file" | sed 's/task-\(.*\)\.json/\1/')
    local execute_script="${TASKS_DIR}/execute-${task_id}.sh"
    
    if [ ! -f "$execute_script" ]; then
        log "ERRO: Script de execução não encontrado para tarefa $task_id"
        return 1
    fi
    
    log "Processando tarefa: $task_id"
    
    # Executa o script
    "$execute_script" >> "$LOG_FILE" 2>&1
    
    if [ $? -eq 0 ]; then
        log "✅ Tarefa $task_id processada com sucesso"
        return 0
    else
        log "❌ Falha ao processar tarefa $task_id"
        return 1
    fi
}

# Função principal
main() {
    log "=== INÍCIO DO PROCESSAMENTO ==="
    
    # Encontra arquivos de tarefa
    task_files=("${TASKS_DIR}"/task-*.json)
    
    if [ ${#task_files[@]} -eq 0 ] || [ ! -f "${task_files[0]}" ]; then
        log "Nenhuma tarefa pendente para processar"
        return 0
    fi
    
    log "Encontradas ${#task_files[@]} tarefa(s) pendente(s)"
    
    # Processa tarefas (limitando concorrência)
    processed=0
    failed=0
    
    for task_file in "${task_files[@]}"; do
        if [ ! -f "$task_file" ]; then
            continue
        fi
        
        # Processa a tarefa
        process_task "$task_file" &
        
        # Controla concorrência
        processed=$((processed + 1))
        if [ $((processed % MAX_CONCURRENT)) -eq 0 ]; then
            wait
        fi
    done
    
    # Espera processos restantes
    wait
    
    log "Processamento concluído"
    log "Tarefas processadas: $processed"
    log "Tarefas com falha: $failed"
    
    # Limpa arquivos antigos (mais de 7 dias)
    find "$PROCESSED_DIR" -type f -mtime +7 -delete 2>/dev/null || true
    
    log "=== FIM DO PROCESSAMENTO ==="
    echo "" >> "$LOG_FILE"
}

# Executa a função principal
main "$@"