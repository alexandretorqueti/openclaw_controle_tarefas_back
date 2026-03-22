
// Extensão do objeto Error para suportar statusCode
interface Error {
  statusCode?: number;
  errors?: any;
}

// Extensão do objeto Process para variáveis de ambiente
namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: string;
    PORT?: string;
    DATABASE_URL?: string;
    API_URL?: string;
    TASKS_DIR?: string;
    ERROR_DIR?: string;
    PROCESSED_DIR?: string;
    LOCK_FILE?: string;
    [key: string]: string | undefined;
  }
}
