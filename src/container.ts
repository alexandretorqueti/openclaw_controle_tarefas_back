/**
 * Container de dependências simples (Service Locator).
 */
class Container {
  private registry: Map<string, any>;

  constructor() {
    (this as any).registry = new Map();
  }

  /** Registra uma dependência pelo nome */
  register(name: string, value: any): void {
    this.registry.set(name, value);
  }

  /** Resolve (retorna) a dependência registrada */
  resolve(name: string): any {
    if (!this.registry.has(name)) {
      throw new Error(`Dependência não registrada no container: ${name}`);
    }
    return this.registry.get(name);
  }

  /** Limpa todas as dependências (útil nos testes) */
  clear(): void {
    this.registry.clear();
  }
}

// Exporta um singleton para ser usado em todo o código
const container = new Container();
export default container;
export { Container };
