#!/bin/bash
# Script para executar deploy após conclusão de tarefa
# Este script é chamado pelo cron job "Gerenciador de Tarefas Jarbas" quando uma tarefa é concluída

set -e

PROJECTS_DIR="/home/alexandrebragatorqueti/projetos"
DEPLOY_LOG="$PROJECTS_DIR/deploy-after-task.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$DEPLOY_LOG"
    echo "$1"
}

log "🚀 Iniciando deploy automático pós-tarefa"

# Verificar se o script de deploy principal existe
if [ ! -f "$PROJECTS_DIR/deploy-automated.sh" ]; then
    log "❌ ERRO: Script deploy-automated.sh não encontrado em $PROJECTS_DIR"
    exit 1
fi

# Executar deploy automatizado
log "🔄 Executando deploy automatizado..."
cd "$PROJECTS_DIR"

if ./deploy-automated.sh; then
    log "✅ Deploy concluído com sucesso após tarefa"
    log "📊 Status:"
    log "  Frontend: http://localhost:8090"
    log "  Backend:  http://localhost:8091"
else
    log "❌ Falha no deploy após tarefa"
    exit 1
fi

log "🎉 Processo de deploy pós-tarefa finalizado"