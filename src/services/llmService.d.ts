declare const axios: any;
declare const extractJsonObjects: any;
declare class LlmService {
    constructor(model?: string, endpoint?: string);
    analyze(prompt: any): Promise<any>;
}
