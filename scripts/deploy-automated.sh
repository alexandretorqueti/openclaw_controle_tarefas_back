#!/bin/bash
# Script de deploy automatizado para o sistema Tarefas - Versão 2.2 (Sem GIT - Cópia Manual)

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
FRONTEND_REPO_DIR="$PROJECTS_DIR/tarefas-web"
BACKEND_PROD_DIR="$PROJECTS_DIR/tarefas-server-prod"
FRONTEND_PROD_DIR="$PROJECTS_DIR/tarefas-web-prod"

DEPLOY_LOG="$PROJECTS_DIR/deploy-automated.log"

# Função para registrar deploy
log_deploy() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$DEPLOY_LOG"
}

# Função para verificar se um serviço está rodando
check_service() {
    local port=$1
    local service=$2
    
    if curl -s -f "http://localhost:$port" > /dev/null 2>&1; then
        log_info "$service está rodando na porta $port"
        return 0
    else
        log_error "$service NÃO está respondendo na porta $port"
        return 1
    fi
}

# Função para parar serviços
stop_services() {
    log_info "🛑 Parando serviços..."
    
    if [ -f "$PROJECTS_DIR/stop-tarefas-production.sh" ]; then
        "$PROJECTS_DIR/stop-tarefas-production.sh"
    else
        # Parar manualmente
        pkill -f "node src/server.js" 2>/dev/null || true
        pkill -f "node server.js" 2>/dev/null || true
        sleep 2
    fi
    
    log_deploy "Serviços parados"
}

# Função para atualizar código (SEM GIT - cópia manual)
update_code() {
    local repo_dir=$1
    local repo_name=$2
    
    log_info "🔄 Verificando $repo_name (sem GIT)..."
    
    # Verificar se o diretório existe
    if [ ! -d "$repo_dir" ]; then
        log_error "❌ Diretório $repo_name não encontrado: $repo_dir"
        return 1
    fi
    
    # Para desenvolvimento, assumimos que o código já está atualizado
    # (o usuário deve garantir que o código está correto antes do deploy)
    log_info "📦 Usando código atual em $repo_name"
    log_deploy "Usando código atual de $repo_name (sem GIT)"
    
    # Verificar se há arquivos importantes
    if [ "$repo_name" = "Backend" ]; then
        if [ ! -f "$repo_dir/package.json" ]; then
            log_error "❌ Arquivo package.json não encontrado no backend"
            return 1
        fi
    elif [ "$repo_name" = "Frontend" ]; then
        if [ ! -f "$repo_dir/package.json" ]; then
            log_error "❌ Arquivo package.json não encontrado no frontend"
            return 1
        fi
    fi
    
    return 0
}

# Função para gerar build do frontend
build_frontend() {
    log_info "🏗️  Gerando build de produção do Frontend..."
    cd "$FRONTEND_REPO_DIR"
    
    # Verificar se estamos no diretório correto
    if [ ! -f "package.json" ]; then
        log_error "❌ Diretório do frontend incorreto: $FRONTEND_REPO_DIR"
        log_error "   Não encontrado: package.json"
        return 1
    fi
    
    # Instalar dependências de dev se necessário para o build
    npm install
    
    # Executar build
    if npm run build; then
        log_info "✅ Build do frontend concluído com sucesso"
        log_deploy "Build do frontend gerado na pasta dist/"
        return 0
    else
        log_error "❌ Falha ao gerar build do frontend"
        log_deploy "FALHA NO BUILD: Erro durante npm run build"
        return 1
    fi
}

# Função para copiar para produção (SEM GIT)
copy_to_production() {
    local src_dir=$1
    local dest_dir=$2
    local service_name=$3
    local is_frontend=$4
    
    log_info "📋 Sincronizando $service_name com produção (sem GIT)..."
    
    # Garantir que diretório de destino existe
    mkdir -p "$dest_dir"
    
    if [ "$is_frontend" = true ]; then
        # Para FRONTEND: Copia apenas a pasta dist/
        log_info "✨ Copiando arquivos estáticos (dist/) para $dest_dir"
        
        # Limpa pasta dist de produção antiga
        rm -rf "$dest_dir/dist"
        
        # Copia a nova dist
        if [ -d "$src_dir/dist" ]; then
            cp -r "$src_dir/dist" "$dest_dir/"
            log_deploy "Arquivos estáticos do frontend sincronizados"
        else
            log_error "❌ Pasta dist/ não encontrada no frontend"
            return 1
        fi
        
        # Garante que o server.js de produção permaneça (se existir)
        if [ -f "$dest_dir/server.js" ]; then
            log_info "✅ Preservando server.js de produção"
        fi
    else
        # Para BACKEND: Copia código fonte manualmente (excluindo .git e arquivos sensíveis)
        log_info "📦 Copiando arquivos do backend (excluindo .env e arquivos de banco)..."
        
        # Usar find + cp para copiar arquivos manualmente
        cd "$src_dir"
        
        # Primeiro, listar arquivos protegidos no destino
        log_info "🔍 Identificando arquivos protegidos em produção..."
        local protected_files=()
        while IFS= read -r -d $'\0' file; do
            protected_files+=("$file")
            log_info "🔒 Preservando: $(basename "$file")"
        done < <(find "$dest_dir" -type f \( -name "*.db" -o -name "*.sqlite" -o -name ".env" \) -print0)
        
        # Limpar diretório de destino (exceto arquivos protegidos)
        log_info "🧹 Limpando diretório de destino..."
        find "$dest_dir" -mindepth 1 -maxdepth 1 -type f ! \( -name "*.db" -o -name "*.sqlite" -o -name ".env" \) -exec rm -f {} \;
        
        # Limpar subdiretórios (preservando prisma se tiver arquivos protegidos)
        for dir in "$dest_dir"/*/; do
            if [ -d "$dir" ]; then
                dirname=$(basename "$dir")
                if [[ "$dirname" != "prisma" ]] || ! find "$dir" -maxdepth 1 -type f -name "*.db" -o -name "*.sqlite" | grep -q .; then
                    log_info "🗑️  Removendo diretório: $dirname"
                    rm -rf "$dir"
                else
                    log_info "📁 Preservando diretório (tem arquivos protegidos): $dirname"
                    # Limpar apenas arquivos não protegidos dentro de prisma
                    find "$dir" -maxdepth 1 -type f ! \( -name "*.db" -o -name "*.sqlite" \) -exec rm -f {} \;
                fi
            fi
        done
        
        # Copiar arquivos do source para destino (EXCLUINDO .env e arquivos de banco)
        log_info "📤 Copiando arquivos do backend (excluindo sensíveis)..."
        
        # Padrão de arquivos a copiar
        local copy_patterns=(
            "*.js"
            "*.json" 
            "*.prisma"
            "*.sql"
            "*.md"
            "*.txt"
            "*.sh"
        )
        
        # Construir comando find para copiar
        local find_cmd="find . -type f \( "
        for pattern in "${copy_patterns[@]}"; do
            find_cmd+=" -name '$pattern' -o"
        done
        find_cmd="${find_cmd% -o} \)"
        
        # Adicionar exclusões
        find_cmd+=" ! -path './node_modules/*'"
        find_cmd+=" ! -path './.git/*'"
        find_cmd+=" ! -name '.env'"
        find_cmd+=" ! -name '*.db'"
        find_cmd+=" ! -name '*.sqlite'"
        find_cmd+=" ! -name '.gitignore'"
        find_cmd+=" ! -name '.github'"
        
        # Executar cópia
        eval "$find_cmd -exec cp --parents {} \"$dest_dir/\" \;"
        
        # Verificação final de segurança
        log_info "🔐 Verificação final de segurança..."
        
        # Garantir que .env de produção NÃO foi sobrescrito
        if [ -f "$dest_dir/.env" ]; then
            log_info "   ✅ .env de produção preservado"
        else
            log_info "   ℹ️  .env não existe em produção (será criado manualmente se necessário)"
        fi
        
        # Garantir que arquivos de banco NÃO foram copiados
        local db_files=$(find "$dest_dir" -type f -name "*.db" -o -name "*.sqlite" | wc -l)
        if [ "$db_files" -eq 0 ]; then
            log_info "   ✅ Nenhum arquivo de banco copiado"
        else
            log_warn "   ⚠️  $db_files arquivo(s) de banco encontrado(s) - VERIFICAR!"
            find "$dest_dir" -type f -name "*.db" -o -name "*.sqlite" -exec echo "      {}" \;
        fi
        
        # Verificar se arquivos importantes foram copiados
        log_info "✅ Verificando arquivos copiados..."
        for check_file in "package.json" "src/server.js" "prisma/schema.prisma"; do
            if [ -f "$dest_dir/$check_file" ]; then
                log_info "   ✓ $check_file"
            else
                log_warn "   ⚠️  $check_file não encontrado após cópia"
            fi
        done
        
        log_deploy "Backend sincronizado com produção (sem GIT, .env ou arquivos de banco)"
    fi
    
    return 0
}

# Função para instalar dependências
install_dependencies() {
    local dir=$1
    local service=$2
    
    log_info "📦 Instalando dependências do $service..."
    
    cd "$dir"
    npm install --production
    
    log_deploy "Dependências do $service instaladas"
}

# Função para iniciar serviços
start_services() {
    log_info "🚀 Iniciando serviços..."
    
    if [ -f "$PROJECTS_DIR/start-tarefas-production.sh" ]; then
        if "$PROJECTS_DIR/start-tarefas-production.sh"; then
            log_info "✅ Serviços iniciados com script"
            log_deploy "Serviços iniciados via script"
            return 0
        else
            log_error "❌ Falha ao iniciar serviços com script"
            return 1
        fi
    else
        log_error "❌ Script de início não encontrado"
        return 1
    fi
}

# Função para fazer backup do banco de dados de desenvolvimento
backup_dev_database() {
    local backup_dir="$HOME/backups"
    local dev_db_path="$BACKEND_REPO_DIR/prisma/dev.db"
    
    log_info "💾 Fazendo backup do banco de dados de desenvolvimento..."
    
    # Criar diretório de backups se não existir
    mkdir -p "$backup_dir"
    
    if [ -f "$dev_db_path" ]; then
        local timestamp=$(date +%Y%m%d-%H%M%S)
        local backup_file="$backup_dir/dev.db.$timestamp.backup"
        
        cp "$dev_db_path" "$backup_file"
        
        if [ $? -eq 0 ]; then
            log_info "✅ Backup criado: $backup_file"
            log_deploy "Backup do dev.db criado: $(basename $backup_file)"
            
            # Manter apenas os últimos 10 backups
            ls -t "$backup_dir"/dev.db.*.backup 2>/dev/null | tail -n +11 | xargs -r rm -f
            log_info "📦 Mantendo apenas os últimos 10 backups"
        else
            log_error "❌ Falha ao criar backup do dev.db"
            log_deploy "FALHA NO BACKUP: não foi possível copiar dev.db"
        fi
    else
        log_warn "⚠️  Arquivo dev.db não encontrado em $dev_db_path"
        log_deploy "AVISO: dev.db não encontrado para backup"
    fi
}

# Função para verificar deploy
verify_deploy() {
    log_info "🔍 Verificando deploy..."
    
    local all_ok=true
    
    # Verificar backend
    if ! check_service 8091 "Backend"; then
        all_ok=false
    fi
    
    # Verificar frontend
    if ! check_service 8090 "Frontend"; then
        all_ok=false
    fi
    
    if [ "$all_ok" = true ]; then
        log_info "🎉 Deploy verificado com sucesso!"
        log_deploy "Deploy verificado: TODOS os serviços OK"
        return 0
    else
        log_error "⚠️  Problemas encontrados na verificação"
        log_deploy "Deploy verificado: ALGUNS serviços com problemas"
        return 1
    fi
}

# --- MAIN DEPLOY PROCESS ---

main() {
    log_info "🚀 Iniciando deploy OTIMIZADO (com Build) do sistema Tarefas"
    log_deploy "=== INÍCIO DO DEPLOY OTIMIZADO ==="
    
    # 0. Backup do banco de dados de desenvolvimento
    backup_dev_database
    
    # 1. Parar serviços
    stop_services
    
    # 2. Verificar código fonte (sem GIT)
    update_code "$BACKEND_REPO_DIR" "Backend"
    update_code "$FRONTEND_REPO_DIR" "Frontend"
    
    # 3. Gerar Build do Frontend (NOVO)
    if ! build_frontend; then
        log_error "❌ Abortando deploy devido a erro no build do frontend"
        exit 1
    fi
    
    # 4. Copiar para produção
    # Backend mantém o fluxo normal
    copy_to_production "$BACKEND_REPO_DIR" "$BACKEND_PROD_DIR" "Backend" false
    
    # Frontend agora usa modo de build estático
    copy_to_production "$FRONTEND_REPO_DIR" "$FRONTEND_PROD_DIR" "Frontend" true
    
    # 5. Instalar dependências (apenas prod no backend e servidor estático)
    install_dependencies "$BACKEND_PROD_DIR" "Backend"
    install_dependencies "$FRONTEND_PROD_DIR" "Frontend (Static Server)"
    
    # 6. Iniciar serviços
    if ! start_services; then
        log_error "❌ Falha crítica ao iniciar serviços"
        log_deploy "FALHA CRÍTICA: serviços não iniciaram"
        exit 1
    fi
    
    # 7. Verificar deploy
    if ! verify_deploy; then
        log_error "❌ Problemas na verificação do deploy"
        log_deploy "FALHA NA VERIFICAÇÃO: problemas nos serviços"
        exit 1
    fi
    
    log_info "✅ Deploy concluído com sucesso e build gerado!"
    log_deploy "=== DEPLOY CONCLUÍDO COM SUCESSO ==="
    
    # 8. Status final
    echo ""
    log_info "📊 Status Final:"
    log_info "  Frontend: http://localhost:8090 (Static Build)"
    log_info "  Backend:  http://localhost:8091"
    echo ""
}

# Executar main
main "$@"
