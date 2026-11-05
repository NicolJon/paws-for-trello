# 🐾 Paws for Trello — v2.16.10 (Web + Cloud + Google Workspace + Antigravity/Codex Edition)

Releitura Web/Cloud completa e fiel (1:1) do aplicativo **Paws for Trello (Trello Desktop v2.16.10.0 x64)** extraída e reconstruída via **REA (`reverse-engineer-anything`)**, pronta para execução na **Vercel** e versionada no **GitHub**, com integração nativa ao **Google Sheets** e **Google Docs**, além de acesso direto para agentes **Antigravity IDE** e **OpenAI Codex** via **MCP (Model Context Protocol)**, **WebMCP** e **REST API**.

---

## 🏗️ Arquitetura Reconstruída (100% dos Módulos Originais)

A análise via REA do pacote `45273LiamForsyth.PawsforTrello_2.16.10.0_x64__7pb5ddty8z1pa` (`app.asar`) mapeou e preservou:

1. **`@atlassian/electron-frame` (`window-frame`)**: Barra de título customizada (`#002457` focada / `#2D4260` desfocada) com menu hambúrguer, seletor de múltiplas janelas (`New Window` / `Restore Window`) e controles nativos de janela.
2. **8 Menus de Aplicação Completos (`menus-win` / `menus-osx`)**:
   - **Arquivo (`File`)**: Nova Janela (`Ctrl+Shift+N`), Restaurar Janela (`Ctrl+Alt+N`), Cartão Rápido (`Ctrl+Alt+Space`), Compartilhar (`Ctrl+Alt+C`), Exportar JSON/CSV, Imprimir (`Ctrl+P`), Preferências (`Ctrl+,`).
   - **Editar (`Edit`)**: Encontrar na Página (`Ctrl+F`), Copiar URL Atual (`Ctrl+Alt+C`), Colar URL e Acessar (`Ctrl+Alt+V`).
   - **Visualizar (`View`)**: Recarregar (`Ctrl+R`), Tela Cheia (`F11`), Tamanho Real (`Ctrl+0`), Aproximar (`Ctrl+=`), Afastar (`Ctrl+-`), Alternar Tema Claro/Escuro.
   - **Histórico (`History`)**: Voltar (`Ctrl+[`), Avançar (`Ctrl+]`).
   - **Quadros (`Boards`)**: Abrir Página de Quadros (`Ctrl+Shift+B`), Meus Cartões (`Ctrl+Shift+M`), Ir para Quadro Padrão (`Ctrl+D`), Definir Atual como Padrão (`Ctrl+Shift+D`), Redefinir Padrão e atalhos rápidos para Quadros com Estrela `1..9` (`Ctrl+1` a `Ctrl+9`).
   - **Janela (`Window`)**: Alternar Caixa de Entrada (Inbox Split View), Visão de Tabela (Sheets), Visão de Calendário/Planner, Autenticação e Tela de Boas-Vindas.
   - **Developer & IA**: Console Antigravity & Codex (MCP), Google Workspace Sync e seletor rápido para os **21 idiomas nativos**.
   - **Ajuda (`Help`)**: Atalhos de Teclado, Laboratórios, **Exportar Logs (`.zip`)** (`trello-exported-logs-YYYY-M-D.zip`), Redefinir Dados Locais (`Ctrl+Shift+R`) e Sobre.
3. **As 9 Janelas / Renderers Originais**:
   - `main_window` (Workspace Kanban + Inbox Split Dock + Table + Calendar)
   - `newcard` (Modal "Quick Add to Trello" com abas **Quadro** vs **Caixa de entrada**, persistência de rascunho `newcardDraft` e gerador de ícones em Canvas `sendGeneratedIcons`)
   - `preferences` (Janela de Preferências com Configurações, Google Workspace, Antigravity & Codex, **303 Licenças de Terceiros** originais e Sobre)
   - `welcome` (Tela de Boas-Vindas com os assets originais de Hero e Background)
   - `downloads` (Barra inferior de 56px exibindo arquivos exportados)
   - `find_in_page` (Barra flutuante de busca `554x52px` com contador `1/N`)
   - `prompt` (Modal de prompt nativo invocado via `window.electron.ipc.invoke('prompt')`)
   - `auth` (Modal de autenticação / credenciais)
   - `switch_account` / `manage_account`

---

## 📊 Integração Nativa Google Sheets & Google Docs

1. **Modo Zero-Config (Google Apps Script Bridge)**:
   - Copie o código de [`public/google-workspace-bridge.gs`](./public/google-workspace-bridge.gs) para o editor `Extensões > Apps Script` de qualquer Planilha Google e implante como **App da Web**.
   - Cole a URL gerada em **Preferências (`Ctrl+,`) > Google Sheets & Docs**.
   - Sincronize bidirecionalmente todos os quadros, listas, cartões e a Inbox com as abas `Paws_Boards`, `Paws_Cards`, `Paws_Inbox` e `Paws_AgentLogs`, e gere documentos reais no **Google Docs** com 1 clique.
2. **Modo Direto (Instantâneo)**:
   - Exporte qualquer quadro ou todo o workspace para `.CSV` compatível com Google Sheets ou gere especificações e relatórios executivos em `.DOC` compatíveis com Google Docs.

---

## 🤖 Acesso Nativo Antigravity IDE & OpenAI Codex (MCP + WebMCP + REST)

### 1. Servidor MCP (HTTP JSON-RPC em `/api/mcp` e Stdio em `mcp-server.js`)
Adicione ao seu `mcp_config.json` do **Antigravity** ou configuração do **Codex CLI**:

```json
{
  "mcpServers": {
    "paws-for-trello": {
      "command": "node",
      "args": ["mcp-server.js"]
    }
  }
}
```
Ou via HTTP remoto (após deploy na Vercel):
```json
{
  "mcpServers": {
    "paws-for-trello": {
      "url": "https://SEU-DOMINIO.vercel.app/api/mcp",
      "transport": "http"
    }
  }
}
```

**Ferramentas MCP Disponíveis (`tools/list` / `tools/call`)**:
- `list_boards`: Lista todos os quadros, listas e cartões.
- `get_board`: Retorna dados completos de um quadro específico.
- `create_card`: Cria cartões na Inbox ou em listas de qualquer quadro.
- `update_card`: Atualiza título, descrição, prazo, status ou checklist.
- `move_card`: Move cartões entre listas ou quadros.
- `add_comment`: Adiciona comentários e registros de atividade aos cartões.
- `triage_inbox`: Faz triagem automática de itens da Inbox para quadros.
- `search_cards`: Busca textual global em cartões e etiquetas.
- `generate_google_doc_spec`: Gera especificações prontas para o Google Docs.
- `sync_google_sheets`: Sincroniza dados com o Google Sheets via bridge.

### 2. Endpoints REST API (`/api/v1/...`)
- `GET /api/v1/workspace` & `POST /api/v1/workspace`
- `GET /api/v1/boards` & `POST /api/v1/boards`
- `POST /api/v1/cards`
- `POST /api/v1/agent/command` (executa instruções em linguagem natural ou chamadas estruturadas de ferramentas do Antigravity/Codex)
- `GET /api/trello/1/members/me`, `GET /api/trello/1/boards/:id/lists`, `POST /api/trello/1/cards` (emulação 1:1 da Trello REST API original)

---

## 🚀 Como Executar Localmente, Deploy no GitHub e na Vercel

### 1. Execução Local
```bash
npm start
# Acesse http://localhost:3000
```

### 2. Versionamento e Push no GitHub
```bash
git add .
git commit -m "feat(paws-for-trello): clone 1:1 exato com integração Sheets/Docs e Antigravity/Codex"
git push -u origin main
```

### 3. Deploy na Vercel
```bash
# Opção 1: Via Vercel CLI
npx vercel --prod

# Opção 2: Conectar o repositório GitHub diretamente no painel da Vercel
# O arquivo vercel.json já está configurado com rewrites e CORS.
```
