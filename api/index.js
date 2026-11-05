/**
 * apex OS v2.16.10 — Cloud & Agentic Backend Handler (Vercel Serverless + Local Node)
 *
 * Releitura 1:1 da arquitetura do sistema de referência (26 módulos do processo principal,
 * 9 janelas/renderers, 58 rotas de URL, atalhos Mousetrap e 21 idiomas),
 * rebatizado como "apex OS" com:
 * 1. Emulação oficial da API REST (/1/members/me, /1/boards/:id/lists, POST /1/cards)
 * 2. API v1 completa para Quadros, Listas, Cartões, Checklist, Etiquetas, Anexos, Comentários e Planner
 * 3. Integração nativa Google Sheets & Google Docs (/api/v1/google/proxy)
 * 4. Acesso nativo para Antigravity e OpenAI Codex via MCP (/api/mcp) e REST (/api/v1/agent/command)
 */

const DEFAULT_WORKSPACE = {
  appName: "apex OS",
  version: "2.16.10",
  buildNumber: "1070",
  updatedAt: new Date().toISOString(),
  user: {
    id: "member-apex-1",
    username: "joaonicolas",
    fullName: "João Nicolas",
    initials: "JN",
    email: "joaonicolas@apexos.workspace",
    avatarColor: "#0c66e4"
  },
  members: [
    { id: "JN", fullName: "João Nicolas", username: "joaonicolas", initials: "JN", color: "#0c66e4", role: "Admin" },
    { id: "AG", fullName: "Antigravity Agent", username: "antigravity", initials: "AG", color: "#803fa5", role: "AI Agent" },
    { id: "CX", fullName: "OpenAI Codex", username: "codex", initials: "CX", color: "#1f845a", role: "AI Agent" },
    { id: "GW", fullName: "Google Workspace Bot", username: "gworkspace", initials: "GW", color: "#bd5b00", role: "Integration" }
  ],
  labelCatalog: [
    { id: "lbl-green", name: "Google Sheets", color: "#1f845a" },
    { id: "lbl-yellow", name: "Atenção / Prioridade", color: "#e2b203" },
    { id: "lbl-orange", name: "Google Docs", color: "#bd5b00" },
    { id: "lbl-red", name: "Bloqueado / Urgente", color: "#c9372c" },
    { id: "lbl-purple", name: "Antigravity & Codex", color: "#803fa5" },
    { id: "lbl-blue", name: "Arquitetura apex OS", color: "#0c66e4" },
    { id: "lbl-teal", name: "Vercel & GitHub", color: "#227d9b" },
    { id: "lbl-lime", name: "Automação", color: "#5b7f24" },
    { id: "lbl-pink", name: "Design & Efeitos 1:1", color: "#ae4787" },
    { id: "lbl-black", name: "Core Engine", color: "#44546f" }
  ],
  inbox: {
    id: "inbox-board-1",
    listId: "inbox-list-1",
    cards: [
      {
        id: "inbox-card-1",
        name: "Capturar ideias rápidas com Ctrl+Alt+Space (Quick Card no apex OS)",
        desc: "Criado na Caixa de Entrada (Inbox) do apex OS v2.16.10 com suporte a arrastar e soltar para qualquer quadro ou para o Planner.",
        createdAt: new Date().toISOString(),
        due: "2026-11-08",
        completed: false,
        labels: [{ id: "lbl-blue", name: "Arquitetura apex OS", color: "#0c66e4" }],
        members: ["JN"],
        checklist: [
          { id: "chk-ib-1", text: "Testar atalho global Ctrl+Alt+Space", checked: true },
          { id: "chk-ib-2", text: "Mover item da Inbox para o Quadro ou Planner", checked: false }
        ],
        attachments: [],
        comments: [
          { id: "cmt-1", author: "Antigravity Agent", initials: "AG", color: "#803fa5", text: "Item pronto na Inbox do apex OS para triagem rápida.", createdAt: new Date().toISOString() }
        ],
        cover: "",
        sourceAgent: "system"
      },
      {
        id: "inbox-card-2",
        name: "Sincronizar quadros do apex OS com Google Sheets e gerar especificações no Google Docs",
        desc: "Use o botão Google Workspace no topo do quadro ou em Preferências (Ctrl+,).",
        createdAt: new Date().toISOString(),
        due: "2026-11-09",
        completed: false,
        labels: [{ id: "lbl-green", name: "Google Sheets", color: "#1f845a" }, { id: "lbl-orange", name: "Google Docs", color: "#bd5b00" }],
        members: ["JN", "GW"],
        checklist: [],
        attachments: [],
        comments: [],
        cover: "",
        sourceAgent: "antigravity"
      }
    ]
  },
  plannerEvents: [
    {
      id: "plan-1",
      cardId: "card-101",
      title: "Revisão 1:1 da Arquitetura apex OS",
      dayOffset: 0,
      startHour: 9,
      durationHours: 2,
      color: "#0c66e4"
    },
    {
      id: "plan-2",
      cardId: "card-102",
      title: "Sync Bidirecional Google Sheets & Docs",
      dayOffset: 1,
      startHour: 11,
      durationHours: 2,
      color: "#1f845a"
    },
    {
      id: "plan-3",
      cardId: "card-103",
      title: "Sessão Agêntica Antigravity + OpenAI Codex",
      dayOffset: 2,
      startHour: 14,
      durationHours: 2,
      color: "#803fa5"
    }
  ],
  boards: [
    {
      id: "board-main-1",
      name: "apex OS — Engenharia & Operações",
      background: "linear-gradient(135deg, #0079bf 0%, #002457 100%)",
      color: "#0079bf",
      starred: true,
      pos: 1000,
      url: "https://apexos.workspace/b/board-main-1/apex-os-engenharia-operacoes",
      lists: [
        {
          id: "list-backlog",
          name: "Backlog / Ideias",
          cards: [
            {
              id: "card-101",
              name: "Cópia 1:1 Completa do Sistema de Referência no apex OS v2.16.10",
              desc: "Preservar 100% dos 26 módulos do processo principal, 9 janelas/renderers, 58 rotas de URL, gravador de atalhos Mousetrap, switches Atlaskit, animações CSS e 21 idiomas nativos.",
              labels: [
                { id: "lbl-blue", name: "Arquitetura apex OS", color: "#0c66e4" },
                { id: "lbl-pink", name: "Design & Efeitos 1:1", color: "#ae4787" }
              ],
              due: "2026-11-10",
              completed: true,
              members: ["JN", "AG"],
              cover: "#0c66e4",
              checklist: [
                { id: "chk-1", text: "Desempacotar app.asar e mapear IPCs com REA", checked: true },
                { id: "chk-2", text: "Extrair os 21 dicionários de idiomas e 303 licenças", checked: true },
                { id: "chk-3", text: "Reconstruir Quick Card, Preferences (com gravador de atalhos), Welcome, Downloads e Find in Page", checked: true },
                { id: "chk-4", text: "Adicionar Dock Split-Screen (Inbox + Planner + Quadro + Switcher) e Responsividade Total", checked: true }
              ],
              attachments: [
                { id: "att-1", name: "google-workspace-bridge.gs", url: "/google-workspace-bridge.gs", type: "code", addedAt: new Date().toISOString() }
              ],
              comments: [
                { id: "cmt-101", author: "Antigravity Agent", initials: "AG", color: "#803fa5", text: "Todos os componentes React e folhas de estilo originais foram mapeados 1:1 para o apex OS.", createdAt: new Date().toISOString() }
              ],
              googleDocUrl: "",
              agentStatus: "verified-by-antigravity"
            },
            {
              id: "card-102",
              name: "Integração Nativa Bidirecional Google Sheets (Planilhas)",
              desc: "Sincronizar todos os Quadros, Listas, Cartões e Inbox diretamente com abas do Google Sheets (ApexOS_Boards, ApexOS_Cards, ApexOS_Inbox) ou exportar CSV/TSV instantâneo.",
              labels: [{ id: "lbl-green", name: "Google Sheets", color: "#1f845a" }],
              due: "2026-11-12",
              completed: false,
              members: ["JN", "GW"],
              cover: "#1f845a",
              checklist: [
                { id: "chk-5", text: "Suporte a Web App URL do Google Apps Script", checked: true },
                { id: "chk-6", text: "Exportação e importação em 1 clique", checked: true }
              ],
              attachments: [],
              comments: [],
              googleDocUrl: "",
              agentStatus: "ready"
            }
          ]
        },
        {
          id: "list-agent-queue",
          name: "Fila Antigravity & Codex 🤖",
          cards: [
            {
              id: "card-103",
              name: "Conectar Antigravity e OpenAI Codex via MCP / WebMCP / REST API",
              desc: "Permitir que agentes autônomos (Antigravity IDE e Codex CLI) listem quadros, criem cartões, movam tarefas entre colunas, comentem e anexem links de Google Docs ou PRs.",
              labels: [{ id: "lbl-purple", name: "Antigravity & Codex", color: "#803fa5" }],
              due: "2026-11-15",
              completed: false,
              members: ["AG", "CX"],
              cover: "#803fa5",
              checklist: [
                { id: "chk-7", text: "Servidor MCP JSON-RPC em /api/mcp e mcp-server.js", checked: true },
                { id: "chk-8", text: "Registro WebMCP em navigator.modelContext", checked: true },
                { id: "chk-9", text: "Endpoint REST /api/v1/agent/command e execução no Card Back", checked: true }
              ],
              attachments: [],
              comments: [
                { id: "cmt-103", author: "OpenAI Codex", initials: "CX", color: "#1f845a", text: "Bridge MCP ativo! Pronto para receber prompts em qualquer cartão.", createdAt: new Date().toISOString() }
              ],
              googleDocUrl: "",
              agentStatus: "in-progress"
            }
          ]
        },
        {
          id: "list-doing",
          name: "Em Andamento",
          cards: [
            {
              id: "card-104",
              name: "Geração Nativa de Documentos no Google Docs",
              desc: "Transformar qualquer cartão ou relatório de Sprint do apex OS em um documento estruturado no Google Docs com título, metadados, descrição, checklist e notas do agente.",
              labels: [{ id: "lbl-orange", name: "Google Docs", color: "#bd5b00" }],
              due: "2026-11-14",
              completed: false,
              members: ["JN", "AG", "GW"],
              cover: "#bd5b00",
              checklist: [
                { id: "chk-10", text: "Gerar especificação Markdown/HTML a partir do cartão", checked: true },
                { id: "chk-11", text: "Criar Google Doc real via Apps Script Webhook", checked: true }
              ],
              attachments: [],
              comments: [],
              googleDocUrl: "",
              agentStatus: "active"
            }
          ]
        },
        {
          id: "list-done",
          name: "Concluído 🎉",
          cards: [
            {
              id: "card-105",
              name: "Deploy Contínuo GitHub + Vercel Serverless",
              desc: "Aplicação apex OS pronta para execução em nuvem na Vercel e versionada no GitHub.",
              labels: [{ id: "lbl-teal", name: "Vercel & GitHub", color: "#227d9b" }],
              due: "2026-11-05",
              completed: true,
              members: ["JN"],
              cover: "#227d9b",
              checklist: [
                { id: "chk-12", text: "Repositório GitHub configurado", checked: true },
                { id: "chk-13", text: "Rotas Serverless /api/* configuradas em vercel.json", checked: true }
              ],
              attachments: [],
              comments: [],
              googleDocUrl: "",
              agentStatus: "completed"
            }
          ]
        }
      ]
    },
    {
      id: "board-roadmap-2",
      name: "apex OS — Roadmap IA (Antigravity + Codex)",
      background: "linear-gradient(135deg, #673286 0%, #1c2b42 100%)",
      color: "#673286",
      starred: true,
      pos: 2000,
      url: "https://apexos.workspace/b/board-roadmap-2/roadmap-ia-automacao",
      lists: [
        {
          id: "list-r1",
          name: "Prompts & Specs",
          cards: [
            {
              id: "card-201",
              name: "Pipeline de Triagem Automática da Inbox pelo Codex",
              desc: "O agente lê os cartões da Inbox do apex OS e classifica automaticamente no quadro correto com etiquetas e prazos.",
              labels: [{ id: "lbl-purple", name: "Antigravity & Codex", color: "#803fa5" }],
              due: "2026-11-18",
              completed: false,
              members: ["CX"],
              cover: "#803fa5",
              checklist: [],
              attachments: [],
              comments: [],
              googleDocUrl: "",
              agentStatus: "queued"
            }
          ]
        },
        {
          id: "list-r2",
          name: "Execução Autônoma",
          cards: []
        },
        {
          id: "list-r3",
          name: "Revisão & Docs",
          cards: []
        }
      ]
    },
    {
      id: "board-sheets-3",
      name: "apex OS — Google Workspace Sync",
      background: "linear-gradient(135deg, #1f845a 0%, #0f3d2a 100%)",
      color: "#1f845a",
      starred: false,
      pos: 3000,
      url: "https://apexos.workspace/b/board-sheets-3/operacoes-google-workspace-sync",
      lists: [
        {
          id: "list-s1",
          name: "Entrada de Dados (Sheets)",
          cards: [
            {
              id: "card-301",
              name: "Relatório Semanal sincronizado com Planilha Google",
              desc: "Cada linha da aba ApexOS_Cards reflete um cartão em tempo real.",
              labels: [{ id: "lbl-green", name: "Google Sheets", color: "#1f845a" }],
              due: "2026-11-20",
              completed: false,
              members: ["JN", "GW"],
              cover: "#1f845a",
              checklist: [],
              attachments: [],
              comments: [],
              googleDocUrl: "",
              agentStatus: "synced"
            }
          ]
        },
        {
          id: "list-s2",
          name: "Documentos Gerados (Docs)",
          cards: []
        }
      ]
    }
  ],
  automationRules: [
    {
      id: "rule-1",
      name: "Quando um cartão for movido para 'Concluído 🎉', marcar prazo como completo e notificar Google Sheets",
      enabled: true,
      trigger: "card_moved_to_done",
      action: "mark_due_complete_and_log"
    },
    {
      id: "rule-2",
      name: "Quando um cartão for criado na 'Fila Antigravity & Codex 🤖', atribuir agente AG automaticamente",
      enabled: true,
      trigger: "card_created_in_agent_queue",
      action: "assign_member_AG"
    }
  ],
  agentLogs: [
    {
      id: "log-1",
      timestamp: new Date().toISOString(),
      agent: "Antigravity",
      action: "system.init",
      details: "apex OS v2.16.10 Web + MCP Bridge inicializado com fidelidade 1:1."
    }
  ]
};

let globalWorkspace = JSON.parse(JSON.stringify(DEFAULT_WORKSPACE));

const MCP_TOOLS = [
  {
    name: "list_boards",
    description: "Lista todos os quadros (boards), listas e contagem de cartões do apex OS.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_board",
    description: "Retorna todas as listas e cartões detalhados de um quadro específico do apex OS pelo ID ou nome.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string", description: "ID ou nome parcial do quadro" }
      },
      required: ["boardId"]
    }
  },
  {
    name: "create_card",
    description: "Cria um novo cartão no apex OS (em uma lista específica de um quadro ou na Inbox).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título do cartão" },
        description: { type: "string", description: "Descrição detalhada em Markdown" },
        destination: { type: "string", enum: ["board", "inbox"], description: "Destino: 'board' ou 'inbox'" },
        boardId: { type: "string", description: "ID do quadro (se destination='board')" },
        listId: { type: "string", description: "ID da lista (se destination='board')" },
        due: { type: "string", description: "Data de entrega YYYY-MM-DD opcional" },
        agentName: { type: "string", description: "Nome do agente criador (ex: 'Antigravity' ou 'Codex')" }
      },
      required: ["title"]
    }
  },
  {
    name: "move_card",
    description: "Move um cartão existente para outra lista ou quadro e atualiza seu status de agente.",
    inputSchema: {
      type: "object",
      properties: {
        cardId: { type: "string", description: "ID do cartão" },
        targetListId: { type: "string", description: "ID ou nome da lista de destino" },
        agentStatus: { type: "string", description: "Novo status do agente (ex: 'in-progress', 'completed')" },
        agentName: { type: "string", description: "Nome do agente ('Antigravity' ou 'Codex')" }
      },
      required: ["cardId", "targetListId"]
    }
  },
  {
    name: "search_cards",
    description: "Pesquisa cartões em todos os quadros e na Inbox do apex OS por texto, etiqueta ou status.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termo de busca" }
      },
      required: ["query"]
    }
  },
  {
    name: "generate_google_doc_spec",
    description: "Converte um cartão ou quadro do apex OS em uma especificação formatada para o Google Docs.",
    inputSchema: {
      type: "object",
      properties: {
        cardId: { type: "string", description: "ID do cartão para gerar especificação" },
        webhookUrl: { type: "string", description: "URL opcional do Google Apps Script Web App para criar o Google Doc real na conta Google" }
      },
      required: ["cardId"]
    }
  },
  {
    name: "sync_google_sheets",
    description: "Sincroniza o estado completo do apex OS com uma Planilha Google via Apps Script Web App URL ou gera payload tabular.",
    inputSchema: {
      type: "object",
      properties: {
        webhookUrl: { type: "string", description: "URL do Google Apps Script Web App (opcional)" }
      }
    }
  }
];

function executeMcpTool(name, args = {}) {
  const agent = args.agentName || "Antigravity/Codex";

  if (name === "list_boards") {
    return {
      appName: "apex OS",
      inboxCount: globalWorkspace.inbox.cards.length,
      boards: globalWorkspace.boards.map(b => ({
        id: b.id,
        name: b.name,
        starred: b.starred,
        lists: b.lists.map(l => ({ id: l.id, name: l.name, cardCount: l.cards.length }))
      }))
    };
  }

  if (name === "get_board") {
    const q = String(args.boardId || "").toLowerCase();
    const board = globalWorkspace.boards.find(b => b.id.toLowerCase() === q || b.name.toLowerCase().includes(q)) || globalWorkspace.boards[0];
    return board;
  }

  if (name === "create_card") {
    const newId = "card-" + Date.now();
    if (args.destination === "inbox") {
      const card = {
        id: newId,
        name: args.title || "Sem título",
        desc: args.description || "",
        createdAt: new Date().toISOString(),
        due: args.due || "",
        completed: false,
        labels: [],
        members: ["JN"],
        checklist: [],
        attachments: [],
        comments: [],
        cover: "",
        sourceAgent: agent
      };
      globalWorkspace.inbox.cards.unshift(card);
      logAgentAction(agent, "create_card (inbox)", newId, card.name);
      return { success: true, destination: "inbox", card };
    } else {
      const board = globalWorkspace.boards.find(b => b.id === args.boardId) || globalWorkspace.boards[0];
      const list = board.lists.find(l => l.id === args.listId) || board.lists[0];
      const card = {
        id: newId,
        name: args.title || "Sem título",
        desc: args.description || "",
        labels: [{ id: "lbl-purple", name: agent, color: "#803fa5" }],
        due: args.due || "",
        completed: false,
        members: ["AG"],
        checklist: [],
        attachments: [],
        comments: [],
        cover: "",
        googleDocUrl: "",
        agentStatus: "created-by-" + agent.toLowerCase()
      };
      list.cards.push(card);
      logAgentAction(agent, `create_card (${board.name} -> ${list.name})`, newId, card.name);
      return { success: true, boardId: board.id, listId: list.id, card };
    }
  }

  if (name === "move_card") {
    let foundCard = null;
    let sourceList = null;
    for (const b of globalWorkspace.boards) {
      for (const l of b.lists) {
        const idx = l.cards.findIndex(c => c.id === args.cardId);
        if (idx !== -1) {
          foundCard = l.cards.splice(idx, 1)[0];
          sourceList = l;
          break;
        }
      }
      if (foundCard) break;
    }
    if (!foundCard) {
      const ibIdx = globalWorkspace.inbox.cards.findIndex(c => c.id === args.cardId);
      if (ibIdx !== -1) {
        foundCard = globalWorkspace.inbox.cards.splice(ibIdx, 1)[0];
        sourceList = globalWorkspace.inbox;
      }
    }
    if (!foundCard) {
      return { success: false, error: `Cartão ${args.cardId} não encontrado.` };
    }
    let targetList = null;
    for (const b of globalWorkspace.boards) {
      const l = b.lists.find(x => x.id === args.targetListId || x.name.toLowerCase().includes(String(args.targetListId).toLowerCase()));
      if (l) {
        targetList = l;
        break;
      }
    }
    if (!targetList) {
      if (sourceList && Array.isArray(sourceList.cards)) sourceList.cards.push(foundCard);
      return { success: false, error: `Lista de destino ${args.targetListId} não encontrada.` };
    }
    if (args.agentStatus) foundCard.agentStatus = args.agentStatus;
    if (targetList.name.toLowerCase().includes("conclu")) {
      foundCard.completed = true;
    }
    targetList.cards.push(foundCard);
    logAgentAction(agent, `move_card -> ${targetList.name}`, foundCard.id, foundCard.name);
    return { success: true, card: foundCard, targetList: targetList.name };
  }

  if (name === "search_cards") {
    const q = String(args.query || "").toLowerCase();
    const results = [];
    globalWorkspace.inbox.cards.forEach(c => {
      if (c.name.toLowerCase().includes(q) || (c.desc || "").toLowerCase().includes(q)) {
        results.push({ location: "Inbox", card: c });
      }
    });
    globalWorkspace.boards.forEach(b => {
      b.lists.forEach(l => {
        l.cards.forEach(c => {
          if (c.name.toLowerCase().includes(q) || (c.desc || "").toLowerCase().includes(q)) {
            results.push({ location: `${b.name} / ${l.name}`, boardId: b.id, listId: l.id, card: c });
          }
        });
      });
    });
    return { query: args.query, count: results.length, results };
  }

  if (name === "generate_google_doc_spec") {
    let targetCard = null, boardName = "", listName = "";
    for (const b of globalWorkspace.boards) {
      for (const l of b.lists) {
        const c = l.cards.find(x => x.id === args.cardId);
        if (c) {
          targetCard = c;
          boardName = b.name;
          listName = l.name;
          break;
        }
      }
    }
    if (!targetCard) {
      targetCard = globalWorkspace.inbox.cards.find(x => x.id === args.cardId) || {
        id: args.cardId,
        name: "Especificação Técnica — apex OS",
        desc: "Documento gerado via Agente no apex OS."
      };
      boardName = "Inbox";
      listName = "Caixa de Entrada";
    }
    const markdownSpec = [
      `# ${targetCard.name}`,
      `**Sistema:** apex OS v2.16.10 | **Quadro:** ${boardName} | **Lista:** ${listName} | **ID:** \`${targetCard.id}\``,
      targetCard.due ? `**Prazo:** ${targetCard.due} (${targetCard.completed ? "Concluído" : "Em aberto"})` : "",
      "",
      "## Descrição e Contexto",
      targetCard.desc || "_Sem descrição cadastrada._",
      "",
      "## Checklist de Execução",
      ...(targetCard.checklist && targetCard.checklist.length
        ? targetCard.checklist.map(i => `- [${i.checked ? "x" : " "}] ${i.text}`)
        : ["- [ ] Escopo validado pelo Agente"]),
      "",
      ...(targetCard.comments && targetCard.comments.length
        ? ["## Comentários e Atividade", ...targetCard.comments.map(cm => `- **${cm.author}**: ${cm.text}`), ""]
        : []),
      `---`,
      `_Gerado automaticamente por apex OS v2.16.10 (Google Docs & Antigravity/Codex Bridge) em ${new Date().toISOString()}_`
    ].filter(Boolean).join("\n");

    logAgentAction(agent, "generate_google_doc_spec", targetCard.id, targetCard.name);
    return {
      success: true,
      cardId: targetCard.id,
      title: `[apex OS Spec] ${targetCard.name}`,
      boardName,
      listName,
      markdownSpec
    };
  }

  if (name === "sync_google_sheets") {
    const rows = [];
    globalWorkspace.boards.forEach(b => {
      b.lists.forEach(l => {
        l.cards.forEach(c => {
          rows.push({
            CardID: c.id,
            BoardName: b.name,
            ListName: l.name,
            Title: c.name,
            Description: c.desc || "",
            DueDate: c.due || "",
            Completed: Boolean(c.completed),
            AgentStatus: c.agentStatus || ""
          });
        });
      });
    });
    logAgentAction(agent, "sync_google_sheets", "workspace", `${rows.length} cartões preparados no apex OS`);
    return {
      success: true,
      totalCards: rows.length,
      rows
    };
  }

  throw new Error(`Ferramenta MCP desconhecida: ${name}`);
}

function logAgentAction(agent, action, targetId, details) {
  globalWorkspace.agentLogs.unshift({
    id: "log-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    agent,
    action,
    targetId,
    details
  });
  if (globalWorkspace.agentLogs.length > 100) {
    globalWorkspace.agentLogs.length = 100;
  }
  globalWorkspace.updatedAt = new Date().toISOString();
}

function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === "object") {
      return resolve(req.body);
    }
    if (typeof req.body === "string") {
      try { return resolve(JSON.parse(req.body)); } catch (_) { return resolve({}); }
    }
    let data = "";
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (_) { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Agent-Name");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = urlObj.pathname;

  // =========================================================================
  // 1. EMULAÇÃO NATIVA DO CLIENTE `trello-api` (Vh / xh)
  // =========================================================================
  if (pathname === "/api/trello/1/members/me" || pathname === "/1/members/me") {
    return sendJson(res, 200, {
      id: globalWorkspace.user.id,
      username: globalWorkspace.user.username,
      fullName: globalWorkspace.user.fullName,
      inbox: {
        idBoard: globalWorkspace.inbox.id,
        idList: globalWorkspace.inbox.listId
      },
      boards: globalWorkspace.boards.map(b => ({
        id: b.id,
        name: b.name,
        starred: b.starred,
        pos: b.pos,
        url: b.url,
        prefs: { backgroundColor: b.color || "#0079bf" }
      }))
    });
  }

  const boardListsMatch = pathname.match(/\/(?:api\/trello\/)?1\/boards\/([^/]+)\/lists$/);
  if (boardListsMatch && req.method === "GET") {
    const boardId = boardListsMatch[1];
    const board = globalWorkspace.boards.find(b => b.id === boardId) || globalWorkspace.boards[0];
    return sendJson(res, 200, (board ? board.lists : []).map((l, idx) => ({
      id: l.id,
      name: l.name,
      pos: (idx + 1) * 1000
    })));
  }

  if ((pathname === "/api/trello/1/cards" || pathname === "/1/cards") && req.method === "POST") {
    const body = await parseBody(req);
    const isInbox = body.idList === globalWorkspace.inbox.listId;
    const result = executeMcpTool("create_card", {
      title: body.name,
      description: body.desc,
      destination: isInbox ? "inbox" : "board",
      listId: body.idList,
      agentName: req.headers["x-agent-name"] || "QuickCard"
    });
    return sendJson(res, 200, {
      id: result.card.id,
      name: result.card.name,
      desc: result.card.desc,
      idBoard: result.boardId || globalWorkspace.inbox.id,
      idList: result.listId || globalWorkspace.inbox.listId,
      url: `https://apexos.workspace/c/${result.card.id}`
    });
  }

  // =========================================================================
  // 2. ENDPOINT MCP SERVER (JSON-RPC 2.0) PARA ANTIGRAVITY & OPENAI CODEX
  // =========================================================================
  if (pathname === "/api/mcp") {
    if (req.method === "GET") {
      return sendJson(res, 200, {
        protocol: "model-context-protocol",
        version: "2024-11-05",
        serverInfo: {
          name: "apex-os-mcp",
          version: "2.16.10",
          description: "MCP Bridge oficial do apex OS para Antigravity IDE e OpenAI Codex"
        },
        tools: MCP_TOOLS
      });
    }

    const rpc = await parseBody(req);
    const id = rpc.id !== undefined ? rpc.id : 1;

    if (rpc.method === "initialize") {
      return sendJson(res, 200, {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "apex-os-mcp", version: "2.16.10" }
        }
      });
    }

    if (rpc.method === "tools/list") {
      return sendJson(res, 200, {
        jsonrpc: "2.0",
        id,
        result: { tools: MCP_TOOLS }
      });
    }

    if (rpc.method === "tools/call") {
      try {
        const toolName = rpc.params && rpc.params.name;
        const toolArgs = (rpc.params && rpc.params.arguments) || {};
        const data = executeMcpTool(toolName, toolArgs);
        return sendJson(res, 200, {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
          }
        });
      } catch (err) {
        return sendJson(res, 200, {
          jsonrpc: "2.0",
          id,
          error: { code: -32000, message: err.message }
        });
      }
    }

    return sendJson(res, 200, {
      jsonrpc: "2.0",
      id,
      result: { tools: MCP_TOOLS }
    });
  }

  // =========================================================================
  // 3. API REST V1 (WORKSPACE, AGENTES ANTIGRAVITY/CODEX, GOOGLE WORKSPACE)
  // =========================================================================
  if (pathname === "/api/v1/workspace") {
    if (req.method === "GET") {
      return sendJson(res, 200, { success: true, workspace: globalWorkspace });
    }
    if (req.method === "POST" || req.method === "PUT") {
      const body = await parseBody(req);
      if (body.workspace) {
        globalWorkspace = { ...globalWorkspace, ...body.workspace, updatedAt: new Date().toISOString() };
      }
      return sendJson(res, 200, { success: true, workspace: globalWorkspace });
    }
  }

  if (pathname === "/api/v1/boards") {
    if (req.method === "GET") {
      return sendJson(res, 200, { success: true, boards: globalWorkspace.boards, inbox: globalWorkspace.inbox });
    }
    if (req.method === "POST") {
      const body = await parseBody(req);
      const newBoard = {
        id: "board-" + Date.now(),
        name: body.name || "Novo Quadro — apex OS",
        background: body.background || "linear-gradient(135deg, #0079bf 0%, #002457 100%)",
        color: body.color || "#0079bf",
        starred: Boolean(body.starred),
        pos: (globalWorkspace.boards.length + 1) * 1000,
        url: `https://apexos.workspace/b/board-${Date.now()}`,
        lists: body.lists || [
          { id: "list-todo-" + Date.now(), name: "A Fazer", cards: [] },
          { id: "list-doing-" + Date.now(), name: "Em Andamento", cards: [] },
          { id: "list-done-" + Date.now(), name: "Concluído", cards: [] }
        ]
      };
      globalWorkspace.boards.push(newBoard);
      logAgentAction(body.agentName || "User", "create_board", newBoard.id, newBoard.name);
      return sendJson(res, 201, { success: true, board: newBoard });
    }
  }

  if (pathname === "/api/v1/cards" && req.method === "POST") {
    const body = await parseBody(req);
    const out = executeMcpTool("create_card", body);
    return sendJson(res, 201, out);
  }

  if (pathname === "/api/v1/agent/command" && req.method === "POST") {
    const body = await parseBody(req);
    const agent = body.agent || req.headers["x-agent-name"] || "Antigravity";
    const tool = body.tool || body.action;
    if (tool && MCP_TOOLS.some(t => t.name === tool)) {
      const resData = executeMcpTool(tool, { ...(body.args || body), agentName: agent });
      return sendJson(res, 200, { success: true, agent, tool, data: resData });
    }
    const prompt = String(body.command || body.prompt || "").trim();
    if (!prompt) {
      return sendJson(res, 400, { success: false, error: "Informe 'command' ou 'tool' no payload." });
    }
    const created = executeMcpTool("create_card", {
      title: prompt.slice(0, 100),
      description: `Tarefa enviada via comando de agente (${agent}) no apex OS:\n\n${prompt}`,
      destination: body.destination || "board",
      boardId: body.boardId || "board-main-1",
      listId: body.listId || "list-agent-queue",
      agentName: agent
    });
    return sendJson(res, 200, {
      success: true,
      agent,
      interpretedAction: "create_card_in_agent_queue",
      result: created
    });
  }

  if (pathname === "/api/v1/google/proxy" && req.method === "POST") {
    const body = await parseBody(req);
    const webhookUrl = body.webhookUrl;
    if (!webhookUrl) {
      return sendJson(res, 400, { success: false, error: "webhookUrl do Google Apps Script é obrigatório." });
    }
    try {
      const fetchOpts = {
        method: body.method || "POST",
        headers: { "Content-Type": "application/json" }
      };
      if (fetchOpts.method !== "GET") {
        fetchOpts.body = JSON.stringify(body.payload || {});
      }
      const response = await fetch(webhookUrl, fetchOpts);
      const text = await response.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch (_) { parsed = { raw: text }; }
      logAgentAction("GoogleWorkspace", body.payload?.action || "proxy_sync", "sheets/docs", "Sincronizado via Apps Script Web App");
      return sendJson(res, 200, { success: true, googleResponse: parsed });
    } catch (err) {
      return sendJson(res, 502, { success: false, error: "Falha ao contatar Google Apps Script: " + err.message });
    }
  }

  return sendJson(res, 200, {
    app: "apex OS v2.16.10",
    version: "2.16.10",
    status: "online",
    endpoints: {
      workspace: "/api/v1/workspace",
      boards: "/api/v1/boards",
      cards: "/api/v1/cards",
      agentCommand: "/api/v1/agent/command",
      googleWorkspaceProxy: "/api/v1/google/proxy",
      mcpServer: "/api/mcp",
      trelloApiCompat: "/api/trello/1/members/me"
    },
    mcpTools: MCP_TOOLS.map(t => t.name)
  });
};
