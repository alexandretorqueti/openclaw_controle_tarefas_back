/**
 * Service locator básico para o projeto
 */

class ServiceLocator {
  private static instance: ServiceLocator;
  private services: Map<string, any> = new Map();

  private constructor() {}

  public static getInstance(): ServiceLocator {
    if (!ServiceLocator.instance) {
      ServiceLocator.instance = new ServiceLocator();
    }
    return ServiceLocator.instance;
  }

  public register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  public get<T>(name: string): T | null {
    return (this.services.get(name) as T) || null;
  }

  public has(name: string): boolean {
    return this.services.has(name);
  }
}

export default ServiceLocator.getInstance();
export { ServiceLocator };
