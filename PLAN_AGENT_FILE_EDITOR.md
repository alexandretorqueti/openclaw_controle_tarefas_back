# 🔧 Plano Técnico - Feature Editor de Arquivos nos Agentes

**Agente:** Baltazar  
**Criado:** 2025-12-23  
**Prioridade:** Alta

---

## 🎯 Objetivo

Adicionar funcionalidade de edição de arquivos (IDENTITY.md e SOUL.md) diretamente na interface de gestão de agentes, permitindo que usuários visualizem e editem o conteúdo desses arquivos com feedback visual (syntax highlighting, diff preview, linha de comando executada).

---

## 📋 Análise da Solução Atual

### Backend (✓ Pronto)

**APIs disponíveis:**

1. **GET** `/api/agents/:id/files/:filename`
   - Lê arquivo de workspace do agente
   - Retorna: `{ success: true, data: "<conteúdo do arquivo>" }`
   - Tratamento: Se arquivo não existir, retorna data: "" (não erro)

2. **PUT** `/api/agents/:id/files/:filename`
   - Escreve/atualiza arquivo
   - Body requerido: `{ content: string }`
   - Retorna: `{ success: true, data: { filePath, agentId, workspace } }`

**Restrições de Segurança:**
- Arquivos permitidos: apenas `IDENTITY.md` e `SOUL.md`
- Validação no controller: rejeita outros arquivos HTTP 400

**Serviços:**
- Local: `/home/alexandrebragatorqueti/projetos/monitor-tarefas/tarefas-server/src/services/agentService.js`
- Métodos: `readAgentFile()`, `writeAgentFile()`
- Validação: Verifica se agente existe, retorna "" se arquivo não existe

---

## 🛠️ Especificação Técnica

### Componentes Frontend a Criar/Modificar

#### 1. **Novo Componente: `AgentFileEditor.tsx`**

**Local:** `/home/alexandrebragatorqueti/projetos/monitor-tarefas/tarefas-web/src/components/agents/AgentFileEditor.tsx`

**Props:**
```typescript
interface AgentFileEditorProps {
  agentId: string;
  filename: 'IDENTITY.md' | 'SOUL.md';
  initialValue?: string;
  onClose: () => void;
  onSaveSuccess?: () => void;
}
```

**Funcionalidades:**
- Auto-save após 3s desde última digitação (debounce)
- Visual diff (highlight changes) quando conteúdo muda
- Botão "Show Command" exibe: `openclaw agents edit --agent <id> --file <filename>`
- Feedback visual de sucesso/erro

---

#### 2. **Modificação: `AgentDetailModal.tsx`**

Adicionar na seção "Identity Files":
- Botão "Visualizar" para ver conteúdo
- Botão "Editar" para abrir editor

---

#### 3. **API Integration**

Adicionar em `/home/alexandrebragatorqueti/projetos/monitor-tarefas/tarefas-web/src/services/api.ts`:

```typescript
export const agentsApi = {
  readAgentFile: async (agentId: string, filename: string): Promise<string> => {
    const response = await apiRequest('GET', `/agents/${agentId}/files/${filename}`);
    return response.data;
  },
  writeAgentFile: async (agentId: string, filename: string, content: string): Promise<any> => {
    const response = await apiRequest('PUT', `/agents/${agentId}/files/${filename}`, { content });
    return response.data;
  }
};
```

---

## 📝 Passos de Implementação

1. **Adicionar métodos API** em `services/api.ts`
2. **Criar componente** `AgentFileEditor.tsx` com:
   - Editor de markdown com syntax highlighting
   - Auto-save com debounce de 3s
   - Visualização de diff
   - Feedback visual de status
3. **Atualizar** `AgentDetailModal.tsx` com botões de ação
4. **Estilizar** editor
5. **Testar** todas as funcionalidades
6. **Commit e push**

---

## 📝 Notas

**Backend já está pronto - NÃO precisa modificar!**

**Arquivo completo:** `/home/alexandrebragatorqueti/agentes/analistamonitortarefas/PLAN.md`
