# Sistema Centralizado de Exceções e Logs

## Implementação Concluída

### 1. Model de Log no Prisma Schema
- **Tabela `Log`** adicionada ao schema com os seguintes campos:
  - `id`, `timestamp`, `level`, `endpoint`, `method`, `statusCode`, `message`
  - `errorType`: Tipo de erro (ValidationError, DatabaseError, BusinessError, SystemError, etc.)
  - `stackTrace`: Stack trace completo do erro
  - `requestBody`, `requestQuery`, `requestParams`, `headers`: Dados da requisição
  - `clientIp`, `userId`: Contexto do cliente
  - `correlationId`, `parentLogId`: Rastreamento hierárquico
  - `responseTime`: Tempo de resposta em milissegundos

### 2. Migração do Banco de Dados
- Migração `add_logs_table` aplicada com sucesso
- Tabela `logs` criada com índices otimizados para consultas frequentes

### 3. Módulo de Logging (`src/utils/logger.js`)
- **Classe `Logger`** com métodos estáticos para:
  - `createLog()`: Cria entrada de log no banco de dados
  - `logError()`: Log de erros com contexto completo
  - `logValidationError()`: Log específico para erros de validação
  - `logDatabaseError()`: Log específico para erros de banco de dados
  - `logBusinessError()`: Log específico para erros de negócio
  - `logInfo()`, `logWarning()`: Logs informativos
  - `getLogs()`: Recupera logs com filtros
  - `getLogById()`: Recupera log específico por ID
  - `formatErrorResponse()`: Formata resposta de erro amigável

### 4. Middleware de Erro Global (`src/middlewares/errorMiddleware.js`)
- **Classe `ErrorMiddleware`** com:
  - `handler()`: Middleware global que captura todos os erros
  - `notFoundHandler()`: Tratamento de rotas 404
  - `catchAsync()`: Wrapper para funções async
  - `addCorrelationId()`: Adiciona ID de correlação às requisições
  - `logRequestStart()`: Registra tempo inicial da requisição
  - Métodos auxiliares para identificar tipos de erro e gerar mensagens amigáveis

### 5. Integração nos Controllers Existente
- **Controllers atualizados** (`taskController.js`, `projectController.js`):
  - Uso de `ErrorMiddleware.catchAsync()` para captura automática de erros
  - Erros lançados com contexto apropriado (statusCode, mensagem)
  - Validação Zod integrada com sistema de logs
  - Respostas incluem `correlationId` para rastreamento

### 6. Correção do Erro de Chave Estrangeira
- **Validação prévia** implementada em `taskService.js`:
  - Método `validateReferences()`: Verifica existência de todas as referências antes da criação
  - Método `validateUpdateReferences()`: Valida referências durante atualizações
  - Verificações incluem:
    - Projeto existe
    - Status existe
    - Prioridade existe
    - Criador existe
    - Atribuído existe
    - Tarefa pai existe e pertence ao mesmo projeto
    - Prevenção de referência circular
- **Erros de FK eliminados**: Agora são detectados antes da tentativa de inserção no banco

### 7. Testes Automatizados
- **Testes unitários** implementados:
  - `test/logger.test.js`: Testes do sistema de logging
  - `test/errorMiddleware.test.js`: Testes do middleware de erro
  - Configuração Jest com cobertura de código
  - Mocks para isolamento de testes

### 8. Endpoints de Debug (Desenvolvimento)
- **Rota `/api/logs`**: Lista logs com filtros (disponível apenas em desenvolvimento)
- **Rota `/api/logs/:id`**: Detalhes de log específico

## Funcionalidades Implementadas

### Sistema de Logging
- ✅ Logs estruturados no banco de dados
- ✅ Níveis de log: ERROR, WARN, INFO, DEBUG
- ✅ Tipos de erro: ValidationError, DatabaseError, BusinessError, SystemError, etc.
- ✅ Contexto completo: requisição, resposta, usuário, IP, tempo
- ✅ Rastreamento com correlationId
- ✅ Logs hierárquicos (parent/child)

### Tratamento de Erros
- ✅ Middleware global de erro
- ✅ Captura automática de todos os tipos de erro
- ✅ Mensagens amigáveis para usuários
- ✅ Detalhes técnicos em ambiente de desenvolvimento
- ✅ IDs de log para rastreamento

### Validação de Referências
- ✅ Prevenção de erros de chave estrangeira
- ✅ Validação prévia de todas as referências
- ✅ Mensagens de erro descritivas
- ✅ Verificação de consistência (ex: tarefa pai no mesmo projeto)

### Integração
- ✅ Controllers atualizados com tratamento adequado
- ✅ Servidor configurado com middleware de erro
- ✅ Logging automático de todas as requisições
- ✅ Performance monitoring (tempo de resposta)

## Como Usar

### Logging Manual
```javascript
const { Logger } = require('./src/utils/logger');

// Log de erro
await Logger.logError(error, req, res, 'BusinessError');

// Log informativo
await Logger.logInfo({
  endpoint: '/api/test',
  method: 'GET',
  statusCode: 200,
  message: 'Operação bem-sucedida'
});
```

### Tratamento de Erros em Controllers
```javascript
const ErrorMiddleware = require('./src/middlewares/errorMiddleware');

class MyController {
  myAction = ErrorMiddleware.catchAsync(async (req, res) => {
    // Código que pode lançar erros
    throw new Error('Erro de negócio');
  });
}
```

### Consulta de Logs (Desenvolvimento)
```
GET /api/logs?limit=50&level=ERROR&startDate=2024-01-01
GET /api/logs/:id
```

## Benefícios

1. **Rastreabilidade**: Todos os erros são logados com IDs únicos
2. **Debugging**: Stack traces e contexto completo disponíveis
3. **Performance**: Monitoramento de tempo de resposta
4. **Segurança**: Mensagens amigáveis para usuários, detalhes apenas em dev
5. **Manutenibilidade**: Código centralizado e testável
6. **Confiabilidade**: Prevenção de erros de FK com validação prévia

## Próximos Passos

1. **Monitoramento**: Integração com ferramentas como Sentry
2. **Alertas**: Notificações para erros críticos
3. **Dashboard**: Interface para visualização de logs
4. **Retenção**: Política de retenção e arquivamento de logs
5. **Análise**: Relatórios de erros frequentes e tendências