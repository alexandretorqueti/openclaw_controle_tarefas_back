# Estrutura de Testes

## Organização

```
test/
├── unit/                    # Testes de unidade
│   ├── steps/              # Testes de steps individuais
│   │   ├── AddCommentStep.test.js
│   │   ├── AnalystStep.test.js
│   │   ├── ArchitectPlanningStep.test.js
│   │   ├── ContractVerificationStep.test.js
│   │   ├── DeveloperLoopOrchestrator.test.js
│   │   ├── DeveloperTurnStep.test.js
│   │   ├── GetNextTaskStep.test.js
│   │   ├── SetupContextStep.test.js
│   │   ├── TaskFailureStep.test.js
│   │   ├── TaskSuccessStep.test.js
│   │   └── TaskTimeoutCheckStep.test.js
│   ├── contract/           # Testes de contrato
│   │   └── service-contract.test.js
│   └── minimal.test.js     # Teste mínimo de verificação
├── integration/            # Testes de integração
│   ├── container-integration.test.js
│   ├── fluxo-completo.test.js      # Fluxo: Arquiteto → Loop → Desenvolvedor
│   ├── simple-integration.test.js  # Testes de integração simples
│   ├── legacyAddComment.integration.test.js
│   ├── legacyCallAnalyst.integration.test.js
│   ├── legacyExecuteTask.integration.test.js
│   ├── legacyGetNextTask.integration.test.js
│   ├── legacyTaskFailure.integration.test.js
│   ├── legacyTaskSuccess.integration.test.js
│   ├── legacyTaskTimeoutCheck.integration.test.js
│   └── monitorE2E.integration.test.js
├── e2e/                    # Testes end-to-end
│   └── step-execution.test.js
├── mocks/                  # Factories de mocks
│   ├── agentService.mock.js
│   ├── axios.mock.js
│   ├── commentService.mock.js
│   ├── contractVerificationService.mock.js
│   ├── decompositionService.mock.js
│   ├── evidenceService.mock.js
│   ├── fileSystem.mock.js
│   ├── fileUtils.mock.js
│   ├── jsonUtils.mock.js
│   ├── llmService.mock.js
│   ├── lockService.mock.js
│   ├── logger.mock.js
│   ├── monitorStateService.mock.js
│   ├── openClawService.mock.js
│   ├── prismaService.mock.js
│   ├── projectService.mock.js
│   ├── promptFactory.mock.js
│   ├── sessionChainUtils.mock.js
│   ├── smartFileFinder.mock.js
│   ├── taskAnalysisService.mock.js
│   ├── taskExecutionService.mock.js
│   ├── taskFileService.mock.js
│   ├── taskService.mock.js
│   ├── timeUtils.mock.js
│   └── workspaceSnapshotService.mock.js
├── setup.js               # Configuração global do Jest
└── simple.test.js         # Teste simples de verificação
```

## Como Executar Testes

### Todos os testes:
```bash
npm test
# ou
npx jest
```

### Testes específicos:
```bash
# Testes de unidade
npx jest test/unit/

# Testes de integração  
npx jest test/integration/

# Testes E2E
npx jest test/e2e/

# Teste específico
npx jest test/unit/steps/ArchitectPlanningStep.test.js
```

### Com coverage:
```bash
npm run test:coverage
```

## Padrões de Teste

### Testes de Unidade:
- Testam componentes isolados
- Usam mocks para dependências externas
- Focam em comportamento específico

### Testes de Integração:
- Testam interação entre componentes
- Usam mocks controlados
- Validam fluxos completos

### Testes E2E:
- Testam o sistema como um todo
- Usam ambiente o mais real possível
- Validam cenários completos

## Mocks

Os mocks estão organizados em `test/mocks/` como factories que retornam objetos mockados. Exemplo:

```javascript
const { createOpenClawServiceMock } = require('../mocks/openClawService.mock');
const mockService = createOpenClawServiceMock();
```

## Configuração do Jest

- `jest.config.js` - Configuração principal
- `test/setup.js` - Configurações globais para testes

## Notas

1. **Testes legacy**: Os testes `legacy*.integration.test.js` são para funcionalidades legadas
2. **Fluxo completo**: `fluxo-completo.test.js` testa o fluxo Arquiteto → Loop Orchestrator → Desenvolvedor
3. **Container**: Testes de integração do container validam injeção de dependência

## Problemas Conhecidos

Alguns testes de unidade podem falhar devido a:
- Dependências não mockadas completamente
- Configuração do container necessária antes de instanciar classes
- Expectativas de campos de retorno específicos

Para testes de integração, usar a abordagem de configurar o container antes de carregar as classes.