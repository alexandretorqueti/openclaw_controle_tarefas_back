#!/bin/bash
# Script de deploy COMPLETO com migrações de banco de dados

set -e

COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[1;33m'
COLOR_NC='\033[0m'

log_info() {
    echo -e "${COLOR_GREEN}[INFO]${COLOR_NC} $1"
}

log_error() {
    echo -e "${COLOR_RED}[ERROR]${COLOR_NC} $1"
}

log_warn() {
    echo -e "${COLOR_YELLOW}[WARN]${COLOR_NC} $1"
}

# Configurações
PROJECTS_DIR="/home/alexandrebragatorqueti/projetos"
BACKEND_REPO_DIR="$PROJECTS_DIR/tarefas-server"
BACKEND_PROD_DIR="$PROJECTS_DIR/tarefas-server-prod"

# Função para fazer backup do banco de produção
backup_production_database() {
    log_info "💾 Fazendo backup do banco de dados de PRODUÇÃO..."
    
    local backup_dir="$PROJECTS_DIR/backups/production"
    local prod_db_path="$BACKEND_PROD_DIR/prisma/prod.db"
    
    mkdir -p "$backup_dir"
    
    if [ -f "$prod_db_path" ]; then
        local timestamp=$(date +%Y%m%d-%H%M%S)
        local backup_file="$backup_dir/prod.db.$timestamp.backup"
        
        cp "$prod_db_path" "$backup_file"
        
        if [ $? -eq 0 ]; then
            log_info "✅ Backup de produção criado: $backup_file"
            
            # Manter apenas os últimos 5 backups
            ls -t "$backup_dir"/prod.db.*.backup 2>/dev/null | tail -n +6 | xargs -r rm -f
            log_info "📦 Mantendo apenas os últimos 5 backups de produção"
        else
            log_error "❌ Falha ao criar backup do banco de produção"
            return 1
        fi
    else
        log_error "❌ Arquivo prod.db não encontrado em $prod_db_path"
        return 1
    fi
}

# Função para aplicar migrações no banco de produção
apply_migrations() {
    log_info "🔄 Aplicando migrações no banco de produção..."
    
    cd "$BACKEND_PROD_DIR"
    
    # Verificar se há migrações pendentes
    log_info "🔍 Verificando migrações pendentes..."
    
    # Usar Prisma para verificar status
    if DATABASE_URL="file:./prisma/prod.db" npx prisma migrate status 2>/dev/null; then
        log_info "✅ Prisma migrate status disponível"
    else
        log_warn "⚠️  Prisma migrate status não disponível, usando db push"
    fi
    
    # Backup antes de aplicar mudanças
    backup_production_database
    
    # Aplicar mudanças no schema (db push para desenvolvimento/prototipagem)
    # OU usar migrate deploy para migrações versionadas
    log_info "📝 Aplicando mudanças no schema..."
    
    if DATABASE_URL="file:./prisma/prod.db" npx prisma db push --accept-data-loss; then
        log_info "✅ Mudanças no schema aplicadas com sucesso"
        
        # Gerar cliente Prisma atualizado
        log_info "🏗️  Gerando cliente Prisma..."
        npx prisma generate
        log_info "✅ Cliente Prisma gerado"
        
        return 0
    else
        log_error "❌ Falha ao aplicar mudanças no schema"
        return 1
    fi
}

# Função para verificar integridade do banco
verify_database_integrity() {
    log_info "🔍 Verificando integridade do banco de dados..."
    
    cd "$BACKEND_PROD_DIR"
    
    # Verificar se todas as tabelas existem
    local tables=$(sqlite3 ./prisma/prod.db ".tables" 2>/dev/null | wc -w)
    log_info "📊 Banco possui $tables tabelas"
    
    # Verificar tabelas críticas
    local critical_tables=("tasks" "users" "projects" "statuses")
    local missing_tables=()
    
    for table in "${critical_tables[@]}"; do
        if ! sqlite3 ./prisma/prod.db ".tables" 2>/dev/null | grep -q "\b$table\b"; then
            missing_tables+=("$table")
        fi
    done
    
    if [ ${#missing_tables[@]} -eq 0 ]; then
        log_info "✅ Todas as tabelas críticas existem"
        return 0
    else
        log_error "❌ Tabelas críticas faltando: ${missing_tables[*]}"
        return 1
    fi
}

# Função para testar conexão com banco
test_database_connection() {
    log_info "🧪 Testando conexão com banco de dados..."
    
    cd "$BACKEND_PROD_DIR"
    
    # Teste simples: contar tarefas
    local task_count=$(sqlite3 ./prisma/prod.db "SELECT COUNT(*) FROM tasks;" 2>/dev/null || echo "ERROR")
    
    if [[ "$task_count" =~ ^[0-9]+$ ]]; then
        log_info "✅ Conexão com banco OK - $task_count tarefas no sistema"
        return 0
    else
        log_error "❌ Falha na conexão com banco"
        return 1
    fi
}

# Função principal de deploy com migrações
deploy_with_migrations() {
    log_info "🚀 Iniciando deploy COMPLETO com migrações de banco"
    
    # 1. Parar serviços
    log_info "1. Parando serviços..."
    cd "$PROJECTS_DIR"
    if [ -f "./stop-tarefas-8090-8091.sh" ]; then
        ./stop-tarefas-8090-8091.sh
    fi
    
    # 2. Copiar código (usando deploy existente)
    log_info "2. Copiando código para produção..."
    if [ -f "./deploy-automated.sh" ]; then
        # Executar até a parte de cópia
        ./deploy-automated.sh | grep -A100 "Sincronizando"
    else
        log_error "❌ Script deploy-automated.sh não encontrado"
        return 1
    fi
    
    # 3. Aplicar migrações
    log_info "3. Aplicando migrações de banco de dados..."
    if ! apply_migrations; then
        log_error "❌ Falha nas migrações - RESTAURANDO BACKUP"
        
        # Tentar restaurar backup mais recente
        local backup_dir="$PROJECTS_DIR/backups/production"
        local latest_backup=$(ls -t "$backup_dir"/prod.db.*.backup 2>/dev/null | head -1)
        
        if [ -f "$latest_backup" ]; then
            log_info "🔄 Restaurando backup: $latest_backup"
            cp "$latest_backup" "$BACKEND_PROD_DIR/prisma/prod.db"
            log_info "✅ Backup restaurado"
        fi
        
        return 1
    fi
    
    # 4. Verificar integridade
    log_info "4. Verificando integridade do banco..."
    if ! verify_database_integrity; then
        log_error "❌ Problemas de integridade no banco"
        return 1
    fi
    
    # 5. Testar conexão
    log_info "5. Testando conexão com banco..."
    if ! test_database_connection; then
        log_error "❌ Falha na conexão com banco"
        return 1
    fi
    
    # 6. Iniciar serviços
    log_info "6. Iniciando serviços..."
    if [ -f "./start-tarefas-8090-8091.sh" ]; then
        ./start-tarefas-8090-8091.sh
    else
        log_error "❌ Script de início não encontrado"
        return 1
    fi
    
    log_info "🎉 Deploy com migrações concluído com sucesso!"
    return 0
}

# Menu interativo
show_menu() {
    echo ""
    echo "========================================"
    echo "   DEPLOY COM MIGRAÇÕES - TAREFAS"
    echo "========================================"
    echo ""
    echo "1. Deploy completo com migrações"
    echo "2. Apenas backup do banco de produção"
    echo "3. Apenas aplicar migrações"
    echo "4. Verificar integridade do banco"
    echo "5. Testar conexão com banco"
    echo "6. Sair"
    echo ""
    read -p "Escolha uma opção (1-6): " choice
    
    case $choice in
        1)
            deploy_with_migrations
            ;;
        2)
            backup_production_database
            ;;
        3)
            apply_migrations
            ;;
        4)
            verify_database_integrity
            ;;
        5)
            test_database_connection
            ;;
        6)
            echo "Saindo..."
            exit 0
            ;;
        *)
            echo "Opção inválida"
            ;;
    esac
}

# Executar
if [ "$1" = "--auto" ]; then
    deploy_with_migrations
else
    show_menu
fi