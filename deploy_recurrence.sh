#!/bin/bash

# Script de deploy para funcionalidade de tarefas recursivas
# Siga as regras do projeto: NUNCA editar produção diretamente

echo "🚀 Iniciando deploy da funcionalidade de tarefas recursivas"
echo "=========================================================="

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Erro: Execute este script do diretório tarefas-server/"
    exit 1
fi

echo "📋 Resumo das alterações:"
echo "-------------------------"
echo "1. Banco de Dados:"
echo "   - Adicionados campos de recorrência ao modelo Task:"
echo "     • isRecurring (boolean)"
echo "     • recurrenceType (daily/weekly/monthly)"
echo "     • recurrenceTimes (JSON array de horários)"
echo "     • recurrenceDays (JSON array de dias da semana)"
echo "     • lastExecutedAt (datetime)"
echo "     • nextExecutionAt (datetime)"
echo ""
echo "2. Backend:"
echo "   - Atualizado TaskService com lógica de recorrência"
echo "   - Criado RecurrenceController e RecurrenceRoutes"
echo "   - Criado CronScheduler para execução automática"
echo "   - Atualizado validadores para incluir campos de recorrência"
echo ""
echo "3. Frontend:"
echo "   - Atualizado tipos TypeScript"
echo "   - Criado componente RecurrenceConfig"
echo "   - Atualizado TaskDetail para mostrar/configurar recorrência"
echo "   - Criado componente RecurrenceManager"
echo "   - Adicionado rota de recorrência no App.tsx"
echo "   - Atualizado serviço API"
echo ""
echo "4. Dependências:"
echo "   - Adicionada dependência: node-cron (para agendamento)"

echo ""
echo "⚠️  IMPACTO NO SISTEMA:"
echo "----------------------"
echo "• Banco de dados: ALTERAÇÃO DE SCHEMA - requer migração"
echo "• Nova funcionalidade: Não afeta tarefas existentes"
echo "• Compatibilidade: Totalmente compatível com versão anterior"
echo "• Performance: Cron roda a cada minuto (configurável)"
echo ""

read -p "📝 Deseja ver os arquivos modificados? (s/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo ""
    echo "📁 Arquivos modificados no backend:"
    echo "-----------------------------------"
    echo "• prisma/schema.prisma"
    echo "• src/services/taskService.js"
    echo "• src/validators/taskValidator.js"
    echo "• src/controllers/recurrenceController.js"
    echo "• src/routes/recurrenceRoutes.js"
    echo "• src/cronScheduler.js"
    echo "• src/server.js"
    echo "• package.json"
    echo ""
    echo "📁 Arquivos modificados no frontend:"
    echo "------------------------------------"
    echo "• src/types/index.ts"
    echo "• src/components/RecurrenceConfig.tsx"
    echo "• src/components/TaskDetail.tsx"
    echo "• src/components/RecurrenceManager.tsx"
    echo "• src/services/api.ts"
    echo "• src/App.tsx"
    echo ""
fi

echo "🔧 Preparando deploy para produção..."
echo ""

# 1. Verificar se o ambiente DEV está funcionando
echo "1. Testando ambiente DEV..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo "   ✅ Backend DEV está rodando"
else
    echo "   ❌ Backend DEV não está respondendo"
    echo "   Execute: npm run dev na pasta tarefas-server/"
    exit 1
fi

if curl -s http://localhost:3000 > /dev/null; then
    echo "   ✅ Frontend DEV está rodando"
else
    echo "   ❌ Frontend DEV não está respondendo"
    echo "   Execute: npm run dev na pasta tarefas-web/"
    exit 1
fi

# 2. Testar funcionalidade de recorrência
echo ""
echo "2. Testando funcionalidade de recorrência..."
TEST_RESULT=$(node test_recurrence.js 2>&1)
if [ $? -eq 0 ]; then
    echo "   ✅ Testes de recorrência passaram"
else
    echo "   ❌ Testes de recorrência falharam"
    echo "   Detalhes:"
    echo "$TEST_RESULT"
    exit 1
fi

# 3. Preparar deploy para produção
echo ""
echo "3. Preparando deploy para produção..."
echo ""
echo "📋 Para completar o deploy em produção, execute:"
echo ""
echo "A) BACKEND (tarefas-server-prod/):"
echo "   1. Copiar arquivos modificados:"
echo "      cp prisma/schema.prisma ../tarefas-server-prod/prisma/"
echo "      cp -r src/ ../tarefas-server-prod/"
echo "      cp package.json ../tarefas-server-prod/"
echo "      cp package-lock.json ../tarefas-server-prod/"
echo ""
echo "   2. Aplicar migração no banco de dados PROD:"
echo "      cd ../tarefas-server-prod"
echo "      npx prisma db push"
echo "      npm install"
echo ""
echo "   3. Reiniciar serviço:"
echo "      pm2 restart tarefas-server-prod"
echo ""
echo "B) FRONTEND (tarefas-web-prod/):"
echo "   1. Copiar arquivos modificados:"
echo "      cp -r src/ ../tarefas-web-prod/"
echo "      cp package.json ../tarefas-web-prod/"
echo ""
echo "   2. Rebuild do frontend:"
echo "      cd ../tarefas-web-prod"
echo "      npm run build"
echo ""
echo "⚠️  ATENÇÃO:"
echo "• Certifique-se de fazer backup do banco de dados PROD antes da migração"
echo "• Teste a funcionalidade em produção após o deploy"
echo "• Configure ENABLE_CRON_SCHEDULER=true no .env de produção se desejar agendamento automático"

echo ""
echo "✅ Script de preparação concluído!"
echo "📞 Aguarde confirmação explícita do usuário antes de prosseguir com o deploy em produção."