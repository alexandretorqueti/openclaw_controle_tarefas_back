#!/bin/bash
# Script de verificação de saúde do sistema Tarefas (versão corrigida)

LOG_DIR="/home/alexandrebragatorqueti/projetos"
HEALTH_LOG="$LOG_DIR/health-check.log"

# Função para log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$HEALTH_LOG"
}

# Função para verificar serviço
check_service() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}
    
    local start_time=$(date +%s%N)
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 )) # ms
    
    if [ "$http_code" = "$expected_code" ]; then
        log "✅ $name: HTTP $http_code (${response_time}ms)"
        return 0
    else
        log "⚠️  $name: HTTP $http_code (esperado $expected_code) (${response_time}ms)"
        return 1
    fi
}

# Função para verificar processo
check_process() {
    local name=$1
    local port=$2
    
    if lsof -ti :$port > /dev/null 2>&1; then
        local pid=$(lsof -ti :$port | head -1)
        log "✅ $name: Processo rodando (PID: $pid, Porta: $port)"
        return 0
    else
        log "❌ $name: Nenhum processo na porta $port"
        return 1
    fi
}

# Função para verificar recursos do sistema (versão segura)
check_system_resources() {
    # Uso de CPU
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 2>/dev/null || echo "0")
    
    # Uso de memória (com verificação de segurança)
    local mem_info=$(free -m 2>/dev/null || echo "Mem: 0 0 0 0 0 0")
    local mem_total=$(echo "$mem_info" | awk '/^Mem:/{print $2}')
    local mem_used=$(echo "$mem_info" | awk '/^Mem:/{print $3}')
    
    # Evitar divisão por zero
    if [ -z "$mem_total" ] || [ "$mem_total" -eq 0 ]; then
        mem_total=1
    fi
    
    local mem_percent=$(( mem_used * 100 / mem_total ))
    
    # Uso de disco
    local disk_usage=$(df -h / 2>/dev/null | awk 'NR==2 {print $5}' | tr -d '%' || echo "0")
    
    log "📊 Recursos: CPU=${cpu_usage}% | Mem=${mem_percent}% (${mem_used}M/${mem_total}M) | Disco=${disk_usage}%"
    
    # Alertas (apenas se valores são numéricos)
    if [[ "$cpu_usage" =~ ^[0-9]+$ ]] && [ "$cpu_usage" -gt 80 ]; then
        log "⚠️  ALERTA: Uso de CPU alto (${cpu_usage}%)"
    fi
    
    if [[ "$mem_percent" =~ ^[0-9]+$ ]] && [ "$mem_percent" -gt 80 ]; then
        log "⚠️  ALERTA: Uso de memória alto (${mem_percent}%)"
    fi
    
    if [[ "$disk_usage" =~ ^[0-9]+$ ]] && [ "$disk_usage" -gt 80 ]; then
        log "⚠️  ALERTA: Uso de disco alto (${disk_usage}%)"
    fi
}

# Função principal
main() {
    log "========================================"
    log "🩺 VERIFICAÇÃO DE SAÚDE DO SISTEMA TAREFAS"
    log "========================================"
    
    local all_ok=true
    
    # 1. Verificar processos
    log "🔍 Verificando processos..."
    check_process "Backend (8091)" 8091 || all_ok=false
    check_process "Frontend (8090)" 8090 || all_ok=false
    
    # 2. Verificar serviços HTTP (aceita qualquer código 2xx para auth)
    log "🔍 Verificando serviços HTTP..."
    check_service "Frontend" "http://localhost:8090" 200 || all_ok=false
    check_service "Backend Health" "http://localhost:8091/health" 200 || all_ok=false
    
    # Para auth check, aceitamos qualquer resposta (pode não existir em todas as versões)
    local auth_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:8091/auth/check" 2>/dev/null || echo "000")
    if [[ "$auth_code" =~ ^2[0-9][0-9]$ ]]; then
        log "✅ Backend Auth: HTTP $auth_code"
    else
        log "⚠️  Backend Auth: HTTP $auth_code (pode não estar implementado)"
        # Não falhamos o check por isso
    fi
    
    # 3. Verificar recursos do sistema
    log "🔍 Verificando recursos do sistema..."
    check_system_resources
    
    # 4. Verificar logs recentes
    log "🔍 Verificando logs..."
    
    # Backend log
    if [ -f "$LOG_DIR/backend.log" ]; then
        local backend_errors=$(tail -20 "$LOG_DIR/backend.log" | grep -i "error\|fail\|exception" | wc -l)
        if [ "$backend_errors" -gt 0 ]; then
            log "⚠️  Backend tem $backend_errors erros recentes"
            # Não falhamos por erros no log, apenas alertamos
        else
            log "✅ Backend log limpo"
        fi
    else
        log "⚠️  Backend log não encontrado"
    fi
    
    # Frontend log
    if [ -f "$LOG_DIR/frontend.log" ]; then
        local frontend_errors=$(tail -20 "$LOG_DIR/frontend.log" | grep -i "error\|fail\|exception" | wc -l)
        if [ "$frontend_errors" -gt 0 ]; then
            log "⚠️  Frontend tem $frontend_errors erros recentes"
            # Não falhamos por erros no log, apenas alertamos
        else
            log "✅ Frontend log limpo"
        fi
    else
        log "⚠️  Frontend log não encontrado"
    fi
    
    # 5. Verificar serviço systemd
    log "🔍 Verificando serviço systemd..."
    if systemctl --user is-active tarefas-definitivo.service > /dev/null 2>&1; then
        log "✅ Serviço systemd ativo"
    else
        log "❌ Serviço systemd inativo"
        all_ok=false
    fi
    
    # 6. Resumo
    log "========================================"
    if [ "$all_ok" = true ]; then
        log "🎉 SISTEMA SAUDÁVEL - Serviços principais funcionando"
        exit 0
    else
        log "⚠️  SISTEMA COM PROBLEMAS - Alguns checks falharam"
        
        # Sugestões de correção
        log ""
        log "🔧 SUGESTÕES DE CORREÇÃO:"
        log "1. Reiniciar serviços: systemctl --user restart tarefas-definitivo.service"
        log "2. Verificar logs: journalctl --user -u tarefas-definitivo.service -n 20"
        log "3. Verificar portas: netstat -tln | grep -E ':(8090|8091)'"
        log "4. Iniciar manualmente: cd /home/alexandrebragatorqueti/projetos && ./start-tarefas-definitivo.sh"
        
        exit 1
    fi
}

# Executar
main