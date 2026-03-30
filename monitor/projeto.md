🏗️ 1. Arquitetura do Motor e Fluxo
1.1. Orquestrador Imperativo (Orchestration Pattern)
O que é: Em vez de usar um array de configurações ou um mapa estático (Máquina de Estados) para dizer qual passo rodar em seguida, usamos o próprio TypeScript (if, while, try/catch) dentro de uma classe central para ditar o fluxo.

Nomes no mercado: Imperative Orchestration, Workflow Engine (usado por ferramentas como Temporal.io e Netflix Conductor).

Por que usar: Porque fluxos com IA são imprevisíveis. Precisamos de loops de repetição complexos (ex: "tente 3 vezes se a sintaxe falhar"). Fazer isso no código nativo é infinitamente mais legível do que criar rotas mirabolantes em um array de configurações.

Exemplo:

TypeScript
async executarTarefa(tarefa) {
    let loops = 0;
    let sucesso = false;
    
    // O fluxo é legível de cima para baixo
    while (!sucesso && loops < 3) {
        const resultado = await passoIA.execute(tarefa);
        if (resultado.valido) sucesso = true;
        else loops++;
    }
}
1.2. Contrato Estrito de Passos (Template Method Pattern)
O que é: O uso de uma Classe Abstrata combinada com Generics (<TInput, TOutput>) para forçar que todo passo do sistema tenha o mesmo formato de entrada e saída, além de padronizar logs e tratamento de erros.

Nomes no mercado: Template Method Pattern, Pipeline Step Interface.

Por que usar: Impede que desenvolvedores criem passos que fogem do padrão, elimina o "God Object" (onde o passo altera variáveis globais aleatórias) e garante que o passo receba apenas o que precisa e devolva estritamente o que produziu.

Exemplo:

TypeScript
export abstract class PassoBase<TInput, TOutput> {
    // O esqueleto é trancado aqui. O filho só implementa o "processar"
    public async execute(input: TInput): Promise<TOutput> {
        console.log(`Iniciando ${this.nome}`);
        return await this.processar(input); 
    }
    protected abstract processar(input: TInput): Promise<TOutput>;
}
1.3. Passos em Camadas (Composite Pattern & Task-Based Architecture)
O que é: Quebrar passos monolíticos em Passos Atômicos (fazem só uma coisa, ex: ExtrairJSON) e agrupá-los dentro de Macro-Passos (gerentes de fase, ex: FaseDeArquitetura).

Nomes no mercado: Composite Pattern, Sub-workflows, Single Responsibility Principle (SRP).

Por que usar: Reutilização extrema. Você escreve a extração de JSON ou a chamada de LLM uma única vez e as utiliza no Arquiteto, no Programador e no Revisor.

Exemplo:

TypeScript
class MacroPassoArquitetura extends PassoBase {
    protected async processar(input) {
        // O Macro-Passo orquestra os Atômicos
        const resposta = await new PassoChamarIA().execute(input);
        const json = await new PassoExtrairJSON().execute(resposta.texto);
        return json;
    }
}
1.4. Injeção de Dependências Estrita (Strict DI)
O que é: Separar o que é Ferramenta (banco de dados, FileSystem, Axios) do que é Estado/Dados (ID da tarefa, prompt).

Nomes no mercado: Dependency Injection (DI), Inversion of Control (IoC).

Por que usar: Permite testar os passos sem que eles toquem no disco ou no banco real. As ferramentas entram no construtor, os dados entram no execute.

Exemplo:

TypeScript
// As ferramentas são injetadas ao nascer
const passo = new PassoDecomposicao({ db: mockDb, ia: mockIA });
// Os dados entram na hora do trabalho
const resultado = await passo.execute({ titulo: 'Criar Login' });
🧪 2. Engenharia de Qualidade e Testes (Jest)
2.1. Fila de Comportamento Simulada (Mocking Behavior)
O que é: Usar .mockResolvedValueOnce() para programar o mock para retornar respostas diferentes em sequência durante o mesmo teste.

Nomes no mercado: Sequential Mocking, State-based Mocking.

Por que usar: É a única forma de testar loops de autocorreção (resiliência). Você simula a IA errando na primeira chamada e acertando na segunda, verificando se o motor sobrevive ao tropeço.

Exemplo:

TypeScript
mockOpenClaw.execute
    .mockResolvedValueOnce({ rawOutput: '{"erro de json"' }) // 1ª vez falha
    .mockResolvedValueOnce({ rawOutput: '{"acao":"ok"}' });  // 2ª vez acerta
2.2. Fábrica de Mocks (Test Fixtures)
O que é: Um arquivo centralizado que gera os objetos falsos (mocks) das ferramentas do sistema para serem importados nos testes.

Nomes no mercado: Test Fixtures, Object Mothers, Mock Factories.

Por que usar: Limpa os arquivos de teste. Você para de copiar e colar 20 linhas de configuração do jest.fn() em cada arquivo novo.

Exemplo:

TypeScript
// fixtures.ts
export const criarDepsMock = () => ({ log: jest.fn(), db: { salvar: jest.fn() } });

// No teste:
const dependencias = criarDepsMock();
2.3. Testes Parametrizados (Data-Driven Testing)
O que é: O uso do test.each do Jest para criar matrizes (tabelas verdade) de entradas e saídas esperadas. O framework gera múltiplos testes rodando o mesmo bloco de código.

Nomes no mercado: Data-Driven Testing (DDT), Parameterized Tests.

Por que usar: Garante cobertura exaustiva de regras de negócio complexas sem escrever dezenas de blocos it() repetitivos.

Exemplo:

TypeScript
test.each([
    // [isAtomic, isCompleted, resultadoEsperado]
    [true,  true,  'Finalizar'],
    [false, false, 'Decompor'],
])('Se atomic=%s e complete=%s, deve %s', async (atomic, comp, esperado) => {
    const res = await passo.execute({ isAtomic: atomic, isCompleted: comp });
    expect(res.acao).toBe(esperado);
});
Este é o mapa completo do que construímos. Com isso em mãos, você tem a fundação para o Jarbas crescer sem limites.

