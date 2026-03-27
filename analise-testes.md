# Análise de Testes - Decisões de Organização

## Testes Temporários/Debug (raiz do projeto)

### PARA DELETAR (testes de debug específicos):
1. `test-architect-analysis-manual.js` - Debug específico
2. `test-architect-analysis-simple.js` - Debug específico  
3. `test-architect-completo.js` - Debug específico
4. `test-bypass-arquiteto.js` - Debug específico
5. `test-bypass-simples.js` - Debug específico
6. `test-com-debug.js` - Debug específico
7. `test-com-fix.js` - Debug específico
8. `test-com-metodo-correto.js` - Debug específico
9. `test-desenvolvedor-catch.js` - Debug específico
10. `test-desenvolvedor-completo.js` - Debug específico
11. `test-desenvolvedor-corrigido.js` - Debug específico
12. `test-desenvolvedor-debug.js` - Debug específico
13. `test-desenvolvedor-detailed.js` - Debug específico
14. `test-desenvolvedor-fluxo.js` - Debug específico
15. `test-desenvolvedor-real.js` - Debug específico
16. `test-erro-detalhado.js` - Debug específico
17. `test-execute-debug.js` - Debug específico
18. `test-final-corrigido.js` - Debug específico
19. `test-final-simples.js` - Debug específico
20. `test-fluxo-completo.js` - Debug específico
21. `test-injecao-container.js` - Debug específico
22. `test-injecao-corrigido.js` - Debug específico
23. `test-injecao-dependencia.js` - Debug específico
24. `test-injecao-final.js` - Debug específico
25. `test-require-debug.js` - Debug específico
26. `test-terminal-sse.js` - Debug específico
27. `test-verificar-erro.js` - Debug específico
28. `debug-architect.js` - Debug específico

### PARA MANTER/MOVER:
1. `test-minimal.test.js` - Teste válido (mover para `test/unit/`)
2. `test-simple.js` - Teste válido (mover para `test/unit/`)
3. `test-simple.test.js` - Teste válido (já em `test/`)

## Testes na pasta `test/`

### Testes de Unidade (`test/unit/`):
1. `test/unit/steps/AddCommentStep.test.js` - ✅ Mantém
2. `test/unit/steps/AnalystStep.test.js` - ✅ Mantém  
3. `test/unit/steps/ArchitectPlanningStep.test.js` - ❌ Duplicado (tem versão melhor)
4. `test/unit/steps/ArchitectPlanningStep-verifica-architectAnalysis.test.js` - ❌ Debug específico
5. `test/unit/steps/ContractVerificationStep.test.js` - ✅ Mantém
6. `test/unit/steps/DeveloperLoopOrchestrator.test.js` - ✅ Mantém
7. `test/unit/steps/DeveloperTurnStep.test.js` - ✅ Mantém
8. `test/unit/steps/GetNextTaskStep.test.js` - ✅ Mantém
9. `test/unit/steps/SetupContextStep.test.js` - ✅ Mantém
10. `test/unit/steps/TaskFailureStep.test.js` - ✅ Mantém
11. `test/unit/steps/TaskSuccessStep.test.js` - ✅ Mantém
12. `test/unit/steps/TaskTimeoutCheckStep.test.js` - ✅ Mantém

### Testes de Integração (`test/integration/`):
1. `test/integration/container-integration.test.js` - ✅ Mantém
2. `test/integration/legacyAddComment.integration.test.js` - ✅ Mantém
3. `test/integration/legacyCallAnalyst.integration.test.js` - ✅ Mantém
4. `test/integration/legacyExecuteTask.integration.test.js` - ✅ Mantém
5. `test/integration/legacyGetNextTask.integration.test.js` - ✅ Mantém
6. `test/integration/legacyTaskFailure.integration.test.js` - ✅ Mantém
7. `test/integration/legacyTaskSuccess.integration.test.js` - ✅ Mantém
8. `test/integration/legacyTaskTimeoutCheck.integration.test.js` - ✅ Mantém
9. `test/integration/monitorE2E.integration.test.js` - ✅ Mantém

### Testes E2E (`test/e2e/`):
1. `test/e2e/step-execution.test.js` - ✅ Mantém

### Testes Gerais (raiz `test/`):
1. `test/ArchitectPlanningStep-simple.test.js` - ❌ Debug específico
2. `test/ArchitectPlanningStep.test.js` - ❌ Debug específico
3. `test/ArchitectPlanningStep.working.test.js` - ❌ Debug específico
4. `test/contract/service-contract.test.js` - ✅ Mantém (mover para `test/unit/contract/`)
5. `test/integration-completa.test.js` - ❌ Muito grande, simplificar ou deletar
6. `test/integration-fluxo.test.js` - ✅ Mantém (mover para `test/integration/`)
7. `test/integration-simple.test.js` - ✅ Mantém (mover para `test/integration/`)
8. `test/setup.js` - ✅ Mantém (configuração do Jest)
9. `test/simple.test.js` - ✅ Mantém (teste básico)

### Mocks (`test/mocks/`):
Todos os mocks em `test/mocks/` - ✅ Mantém

## Ações:
1. Deletar testes temporários/debug
2. Mover testes válidos para estrutura organizada
3. Remover duplicações
4. Manter apenas testes que fazem sentido