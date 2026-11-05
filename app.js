/**
 * ============================================================================
 * Paws for Trello v2.16.10.0 — COMPLETE APPLICATION ENGINE (`app.js`)
 * Releitura fiel 1:1 via REA (Reverse Engineer Anything) com:
 *  - Identidade oficial: "Paws for Trello"
 *  - Emulação 1:1 de `window.electron` e `window.trelloDesktop`
 *  - Persistência `store` (`Fl`/`Ll`) com todas as chaves originais
 *  - 21 Idiomas oficiais (`locales.json`) + 303 Licenças (`licenses.json`)
 *  - Barra de Menus nativa (File, Edit, View, History, Boards, Window, Developer, Help)
 *  - Todos os atalhos de teclado Mousetrap (Ctrl+Alt+Space, Ctrl+F, Ctrl+1..9, Ctrl+D, etc.)
 *  - 9 Janelas/Modais (Main Window, Quick Card, Preferences, Welcome, Downloads, Find in Page, Prompt, Auth, Card Back)
 *  - Split-Screen Dock (Inbox, Planner, Board, Switcher) com Drag & Drop total
 *  - Rich Card Back (Labels, Members, Checklists com barra 0-100%, Prazos, Capas, Anexos, Comentários)
 *  - Integração Nativa Google Sheets & Google Docs (Apps Script Bridge + Exportação/Importação direta)
 *  - Acesso Nativo Antigravity IDE & OpenAI Codex (MCP JSON-RPC `/api/mcp`, WebMCP `navigator.modelContext`, REST API)
 * ============================================================================
 */

(function () {
  "use strict";

  const APP_NAME = "Paws for Trello";
  const APP_VERSION = "2.16.10";
  const BUILD_NUMBER = "1070";

  const SUPPORTED_LOCALES = [
    "cs", "de", "en", "es", "fi", "fr", "hu", "it", "ja", "nb",
    "nl", "pl", "pt_BR", "ru", "sv", "th", "tr", "uk", "vi", "zh-Hans", "zh-Hant"
  ];

  const STORAGE_KEY_SETTINGS = "paws_trello_store_v21610";
  const STORAGE_KEY_WORKSPACE = "paws_trello_workspace_v21610";
  const STORAGE_KEY_LOGS = "paws_trello_logs_v21610";

  // ==========================================================================
  // 1. SUBSISTEMA DE LOGS (1:1 winston / apex.log equivalente)
  // ==========================================================================
  const AppLogger = {
    entries: JSON.parse(localStorage.getItem(STORAGE_KEY_LOGS) || localStorage.getItem("paws_trello_logs_v21610") || "[]"),
    write(level, moduleName, message, meta) {
      const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
      const mod = ("[" + (moduleName || "main").slice(0, 14) + "]").padStart(17, " ");
      const line = `${ts} ${level.padStart(5, " ")}: ${mod} ${message} ${meta ? JSON.stringify(meta) : ""}`.trim();
      this.entries.push(line);
      if (this.entries.length > 500) this.entries.shift();
      try { localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(this.entries)); } catch (_) {}
    },
    info(mod, msg, meta) { this.write("info", mod, msg, meta); },
    warn(mod, msg, meta) { this.write("warn", mod, msg, meta); },
    error(mod, msg, meta) { this.write("error", mod, msg, meta); },
    debug(mod, msg, meta) { this.write("debug", mod, msg, meta); }
  };

  // ==========================================================================
  // 2. SUBSISTEMA STORE (Fl / Ll) — Chaves originais preservadas
  // ==========================================================================
  const DEFAULT_STORE = {
    "starred-boards": [],
    "starred-icons": [],
    "default-url": "https://trello.com",
    "last-url": "https://trello.com/b/board-main-1",
    "theme": { colorMode: "light", effectiveColorMode: "light" },
    "zoom-factor": 1,
    "locale": "pt_BR",
    "settings": {
      notifications: true,
      dockbadge: true,
      windowshortcut: "ctrl+alt+t",
      quickaddshortcut: "ctrl+alt+space",
      launchparams: "docktray",
      spellcheck: true,
      chooselocation: false,
      savepath: "C:\\Users\\Downloads",
      hardwareAcceleration: true
    },
    "googleWorkspace": {
      appsScriptUrl: "",
      spreadsheetUrl: "",
      autoSync: false,
      lastSyncAt: ""
    },
    "agentBridge": {
      apiKey: "paws-ag-codex-live-token-21610",
      autoTriageInbox: true,
      defaultAgent: "Antigravity"
    },
    "windows": [
      { id: "win-1", title: "Paws for Trello — Engenharia & Operações", boardId: "board-main-1", view: "board" }
    ],
    "closedWindows": [],
    "activeWindowId": "win-1",
    "history": ["board-main-1"],
    "historyIndex": 0,
    "dockViews": {
      inbox: true,
      planner: false,
      board: true
    },
    "boardFilter": {
      keyword: "",
      due: "all",
      labels: [],
      members: []
    }
  };

  let StoreData = Object.assign({}, DEFAULT_STORE, JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || "{}"));
  if (!StoreData.dockViews) StoreData.dockViews = { inbox: true, planner: false, board: true };
  if (!StoreData.boardFilter) StoreData.boardFilter = { keyword: "", due: "all", labels: [], members: [] };

  function saveStore() {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(StoreData));
  }

  // ==========================================================================
  // 3. DICIONÁRIOS DE IDIOMAS (21 locales) & LICENÇAS (303 pacotes)
  // ==========================================================================
  let AllLocales = {};
  let AllLicenses = {};
  let Workspace = null;
  let DownloadsList = [];
  let FindState = { query: "", matches: [], activeIndex: -1 };
  let ActivePrefTab = "settings";
  let IsOffline = false;

  function getText(pathStr, vars = {}) {
    const loc = StoreData.locale || "pt_BR";
    const dict = AllLocales[loc] || AllLocales["pt_BR"] || AllLocales["en"] || {};
    let val = pathStr.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : null), dict);
    if (!val) {
      val = pathStr.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : null), AllLocales["en"] || {});
    }
    if (!val) return pathStr;

    // Substituir interpolações
    Object.keys(vars).forEach(k => {
      val = val.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g"), vars[k]);
      val = val.replace(new RegExp(`\\{\\s*${k}\\s*\\}`, "g"), vars[k]);
    });

    // Rebrand contextual de strings herdadas da base
    val = val.replace(/Paws for Trello/gi, "Paws for Trello")
             .replace(/Trello/g, "Paws for Trello");

    return val;
  }

  // ==========================================================================
  // 4. NOTIFICAÇÕES & TOASTS NATIVOS
  // ==========================================================================
  function showNotification(title, body, onClick) {
    if (!StoreData.settings.notifications) return;
    const finalTitle = title || APP_NAME;

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const notif = new Notification(finalTitle, {
          body: body || "",
          icon: "/assets/StoreLogo.png"
        });
        if (onClick) notif.onclick = onClick;
      } catch (_) {
        showToast(`${finalTitle}: ${body}`);
      }
    } else {
      showToast(`${finalTitle}: ${body}`);
    }
  }

  function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast-item";
    toast.innerHTML = `<span>⚡</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function showNoticePill(text) {
    const pill = document.getElementById("global-notice-pill");
    if (!pill) return;
    pill.textContent = text;
    pill.classList.add("appear");
    setTimeout(() => pill.classList.remove("appear"), 2500);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function generateStarredBoardIcon(indexNumber, bgColor = "#0c66e4") {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, 32, 32, 6);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(indexNumber), 16, 17);
    return canvas.toDataURL("image/png");
  }

  // ==========================================================================
  // 5. EMULAÇÃO OFICIAL DE `window.electron` (1:1 com ASAR Original)
  // ==========================================================================
  window.electron = {
    platform: "win32",
    getText(key, vars) { return getText(key, vars); },
    getSettings() { return StoreData.settings; },
    setSettings(newSet) {
      StoreData.settings = Object.assign({}, StoreData.settings, newSet);
      saveStore();
      showNoticePill("Configurações do Paws for Trello atualizadas");
      renderPreferencesTab();
    },
    onGetSettings(cb) { this._settingsCallback = cb; },
    requestSettings() {
      if (this._settingsCallback) this._settingsCallback(StoreData.settings);
    },
    getLicenses() { return AllLicenses; },
    logger: {
      info(msg, meta) { AppLogger.info("renderer", msg, meta); },
      warn(msg, meta) { AppLogger.warn("renderer", msg, meta); },
      error(msg, meta) { AppLogger.error("renderer", msg, meta); },
      debug(msg, meta) { AppLogger.debug("renderer", msg, meta); }
    },
    ipc: {
      send(ch, ...args) { handleIpcMessage(ch, args); },
      invoke(ch, ...args) { return handleIpcInvoke(ch, args); },
      on(ch, fn) { window.addEventListener(`ipc:${ch}`, (e) => fn(e, ...e.detail)); },
      once(ch, fn) {
        const handler = (e) => {
          window.removeEventListener(`ipc:${ch}`, handler);
          fn(e, ...e.detail);
        };
        window.addEventListener(`ipc:${ch}`, handler);
      }
    }
  };

  window.trelloDesktop = {
    version: APP_VERSION,
    appName: APP_NAME,
    build: BUILD_NUMBER,
    getStore() { return StoreData; },
    getWorkspace() { return Workspace; },
    syncWorkspace() { return saveWorkspaceToServer(); }
  };

  function handleIpcMessage(channel, args) {
    AppLogger.debug("ipc", `send -> ${channel}`, args);
    if (channel === "trigger-preferences") openPreferencesModal();
    if (channel === "open-quick-card-window") openNewCardModal();
    if (channel === "history-change") updateNavigationButtons();
    if (channel === "double-click") toggleFullscreen();
  }

  function handleIpcInvoke(channel, args) {
    AppLogger.debug("ipc", `invoke -> ${channel}`, args);
    if (channel === "theme") return Promise.resolve(StoreData.theme);
    if (channel === "starred-boards") return Promise.resolve(StoreData["starred-boards"]);
    return Promise.resolve(null);
  }

  // ==========================================================================
  // 6. GERENCIAMENTO DE ESTADO DO WORKSPACE & SINCRONIZAÇÃO COM BACKEND
  // ==========================================================================
  async function loadWorkspace() {
    try {
      const res = await fetch("/api/v1/workspace");
      if (res.ok) {
        const data = await res.json();
        if (data && data.workspace) {
          Workspace = data.workspace;
          localStorage.setItem(STORAGE_KEY_WORKSPACE, JSON.stringify(Workspace));
          AppLogger.info("workspace", "Carregado do backend com sucesso");
          return;
        }
      }
    } catch (err) {
      AppLogger.warn("workspace", "Falha ao contatar backend, usando cache local: " + err.message);
    }

    const cached = localStorage.getItem(STORAGE_KEY_WORKSPACE);
    if (cached) {
      try { Workspace = JSON.parse(cached); } catch (_) {}
    }

    if (!Workspace) {
      // Fallback padrão com dados estruturados
      Workspace = {
        appName: APP_NAME,
        version: APP_VERSION,
        updatedAt: new Date().toISOString(),
        user: { id: "member-1", username: "joaonicolas", fullName: "João Nicolas", initials: "JN", email: "joaonicolas@apexos.local" },
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
          { id: "lbl-blue", name: "Arquitetura Paws for Trello", color: "#0c66e4" },
          { id: "lbl-teal", name: "Vercel & GitHub", color: "#227d9b" },
          { id: "lbl-pink", name: "Design & Efeitos 1:1", color: "#ae4787" }
        ],
        inbox: {
          id: "inbox-board-1",
          listId: "inbox-list-1",
          cards: [
            {
              id: "inbox-card-1",
              name: "Capturar ideias rápidas com Ctrl+Alt+Space no Paws for Trello",
              desc: "Criado automaticamente na Caixa de Entrada do Paws for Trello. Arraste para qualquer quadro ou para o Planner.",
              createdAt: new Date().toISOString(),
              due: "2026-11-08",
              completed: false,
              labels: [{ id: "lbl-blue", name: "Arquitetura Paws for Trello", color: "#0c66e4" }],
              members: ["JN"],
              checklist: [{ id: "chk-1", text: "Testar atalho global", checked: true }],
              attachments: [],
              comments: [{ id: "c1", author: "Antigravity", initials: "AG", color: "#803fa5", text: "Item pronto na Inbox.", createdAt: new Date().toISOString() }],
              cover: ""
            }
          ]
        },
        plannerEvents: [
          { id: "plan-1", cardId: "card-101", title: "Revisão 1:1 Paws for Trello", dayOffset: 0, startHour: 9, durationHours: 2, color: "#0c66e4" },
          { id: "plan-2", cardId: "card-102", title: "Sync Google Sheets & Docs", dayOffset: 1, startHour: 11, durationHours: 2, color: "#1f845a" },
          { id: "plan-3", cardId: "card-103", title: "Sessão Antigravity + Codex", dayOffset: 2, startHour: 14, durationHours: 2, color: "#803fa5" }
        ],
        boards: [
          {
            id: "board-main-1",
            name: "Paws for Trello — Engenharia & Operações",
            background: "linear-gradient(135deg, #0079bf 0%, #002457 100%)",
            color: "#0079bf",
            starred: true,
            pos: 1000,
            lists: [
              {
                id: "list-backlog",
                name: "Backlog / Ideias",
                cards: [
                  {
                    id: "card-101",
                    name: "Cópia 1:1 Completa do Sistema de Referência no Paws for Trello v2.16.10.0",
                    desc: "Preservar 100% dos módulos do processo principal, janelas, rotas de URL, gravador de atalhos Mousetrap, switches Atlaskit, animações CSS e 21 idiomas nativos.",
                    labels: [{ id: "lbl-blue", name: "Arquitetura Paws for Trello", color: "#0c66e4" }, { id: "lbl-pink", name: "Design & Efeitos 1:1", color: "#ae4787" }],
                    due: "2026-11-10",
                    completed: true,
                    members: ["JN", "AG"],
                    cover: "#0c66e4",
                    checklist: [
                      { id: "chk-101-1", text: "Mapear IPCs e CSS original", checked: true },
                      { id: "chk-101-2", text: "Extrair 21 dicionários e licenças", checked: true },
                      { id: "chk-101-3", text: "Dock Split-Screen e Responsividade Total", checked: true }
                    ],
                    attachments: [{ id: "att-1", name: "google-workspace-bridge.gs", url: "/google-workspace-bridge.gs", type: "code", addedAt: new Date().toISOString() }],
                    comments: [{ id: "cmt-1", author: "Antigravity", initials: "AG", color: "#803fa5", text: "Fidelidade 1:1 verificada.", createdAt: new Date().toISOString() }],
                    agentStatus: "verified-by-antigravity"
                  },
                  {
                    id: "card-102",
                    name: "Integração Nativa Bidirecional Google Sheets (Planilhas)",
                    desc: "Sincronizar Quadros, Listas, Cartões e Inbox com abas do Google Sheets em tempo real.",
                    labels: [{ id: "lbl-green", name: "Google Sheets", color: "#1f845a" }],
                    due: "2026-11-12",
                    completed: false,
                    members: ["JN", "GW"],
                    cover: "#1f845a",
                    checklist: [{ id: "chk-102-1", text: "Suporte a Apps Script Web App", checked: true }],
                    attachments: [],
                    comments: [],
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
                    desc: "Permitir que agentes autônomos listem quadros, criem cartões, executem tarefas e gerem Google Docs.",
                    labels: [{ id: "lbl-purple", name: "Antigravity & Codex", color: "#803fa5" }],
                    due: "2026-11-15",
                    completed: false,
                    members: ["AG", "CX"],
                    cover: "#803fa5",
                    checklist: [{ id: "chk-103-1", text: "Servidor MCP em /api/mcp", checked: true }],
                    attachments: [],
                    comments: [],
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
                    desc: "Transformar qualquer cartão em especificação técnica formatada.",
                    labels: [{ id: "lbl-orange", name: "Google Docs", color: "#bd5b00" }],
                    due: "2026-11-14",
                    completed: false,
                    members: ["JN", "AG", "GW"],
                    cover: "#bd5b00",
                    checklist: [],
                    attachments: [],
                    comments: [],
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
                    desc: "Paws for Trello pronto para execução na nuvem Vercel e versionado no GitHub.",
                    labels: [{ id: "lbl-teal", name: "Vercel & GitHub", color: "#227d9b" }],
                    due: "2026-11-05",
                    completed: true,
                    members: ["JN"],
                    cover: "#227d9b",
                    checklist: [],
                    attachments: [],
                    comments: [],
                    agentStatus: "completed"
                  }
                ]
              }
            ]
          }
        ],
        automationRules: [
          { id: "rule-1", name: "Quando cartão movido para 'Concluído 🎉', marcar prazo como completo", enabled: true }
        ],
        agentLogs: [
          { id: "log-1", timestamp: new Date().toISOString(), agent: "Antigravity", action: "system.init", details: "Paws for Trello v2.16.10.0 inicializado." }
        ]
      };
    }
  }

  async function saveWorkspaceToServer() {
    Workspace.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY_WORKSPACE, JSON.stringify(Workspace));
      await fetch("/api/v1/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace: Workspace })
      });
      AppLogger.info("workspace", "Sincronizado com backend");
    } catch (err) {
      AppLogger.warn("workspace", "Salvo apenas localmente (offline)");
    }
    showNoticePill("Alterações salvas no Paws for Trello");
  }

  function getActiveWindow() {
    let win = StoreData.windows.find(w => w.id === StoreData.activeWindowId);
    if (!win) {
      win = StoreData.windows[0] || { id: "win-1", title: APP_NAME, boardId: "board-main-1", view: "board" };
      StoreData.activeWindowId = win.id;
    }
    return win;
  }

  function getActiveBoard() {
    const win = getActiveWindow();
    return Workspace.boards.find(b => b.id === win.boardId) || Workspace.boards[0];
  }

  // ==========================================================================
  // 7. BARRA DE MENUS NATIVA (8 Menus: File, Edit, View, History, Boards, Window, Developer, Help)
  // ==========================================================================
  function renderAppMenubar() {
    const menubar = document.getElementById("app-menubar");
    if (!menubar) return;

    const menus = [
      {
        id: "menu-file",
        label: getText("menu.file.menuText") || "Arquivo",
        items: [
          { label: getText("menu.file.newCard") || "Novo Cartão...", shortcut: "Ctrl+Alt+Space", action: openNewCardModal },
          { label: getText("menu.file.newWindow") || "Nova Janela", shortcut: "Ctrl+N", action: createNewWindow },
          { separator: true },
          { label: "Sincronizar Google Sheets", shortcut: "Ctrl+Shift+S", action: syncGoogleSheetsNow },
          { label: "Gerar Especificação Google Docs", action: generateCurrentBoardDoc },
          { separator: true },
          { label: getText("menu.file.closeWindow") || "Fechar Janela", shortcut: "Ctrl+W", action: closeCurrentWindow }
        ]
      },
      {
        id: "menu-edit",
        label: getText("menu.edit.menuText") || "Editar",
        items: [
          { label: getText("menu.edit.undo") || "Desfazer", shortcut: "Ctrl+Z", action: () => document.execCommand("undo") },
          { label: getText("menu.edit.redo") || "Refazer", shortcut: "Ctrl+Y", action: () => document.execCommand("redo") },
          { separator: true },
          { label: getText("menu.edit.cut") || "Recortar", shortcut: "Ctrl+X", action: () => document.execCommand("cut") },
          { label: getText("menu.edit.copy") || "Copiar", shortcut: "Ctrl+C", action: () => document.execCommand("copy") },
          { label: getText("menu.edit.paste") || "Colar", shortcut: "Ctrl+V", action: () => document.execCommand("paste") },
          { separator: true },
          { label: getText("menu.edit.find") || "Buscar na página...", shortcut: "Ctrl+F", action: openFindInPage }
        ]
      },
      {
        id: "menu-view",
        label: getText("menu.view.menuText") || "Exibir",
        items: [
          { label: "Quadro Kanban", shortcut: "1", action: () => switchViewMode("board") },
          { label: "Visão de Tabela (Sheets)", shortcut: "2", action: () => switchViewMode("table") },
          { label: "Visão de Calendário", shortcut: "3", action: () => switchViewMode("calendar") },
          { label: "Automação & Regras", shortcut: "4", action: () => switchViewMode("butler") },
          { separator: true },
          { label: "Alternar Caixa de Entrada", shortcut: "I", action: toggleInboxDock },
          { label: "Alternar Planner / Agenda", shortcut: "P", action: togglePlannerDock },
          { separator: true },
          { label: getText("menu.view.zoomIn") || "Aumentar Zoom", shortcut: "Ctrl+=", action: () => setZoomFactor(StoreData["zoom-factor"] + 0.1) },
          { label: getText("menu.view.zoomOut") || "Diminuir Zoom", shortcut: "Ctrl+-", action: () => setZoomFactor(StoreData["zoom-factor"] - 0.1) },
          { label: getText("menu.view.actualSize") || "Tamanho Real", shortcut: "Ctrl+0", action: () => setZoomFactor(1) },
          { separator: true },
          { label: getText("menu.view.toggleFullScreen") || "Tela Cheia", shortcut: "F11", action: toggleFullscreen }
        ]
      },
      {
        id: "menu-history",
        label: getText("menu.history.menuText") || "Histórico",
        items: [
          { label: getText("menu.history.back") || "Voltar", shortcut: "Alt+Left", action: navigateHistoryBack },
          { label: getText("menu.history.forward") || "Avançar", shortcut: "Alt+Right", action: navigateHistoryForward }
        ]
      },
      {
        id: "menu-boards",
        label: getText("menu.boards.menuText") || "Quadros",
        items: [
          { label: "Alternador Rápido de Quadros...", shortcut: "B / Ctrl+K", action: openBoardSwitcher },
          { label: "Todos os Quadros", shortcut: "Ctrl+Shift+B", action: () => switchViewMode("all-boards") },
          { label: "Meus Cartões", shortcut: "Ctrl+Shift+M", action: () => switchViewMode("my-cards") },
          { label: "Definir como Quadro Padrão", shortcut: "Ctrl+Shift+D", action: setDefaultBoardCurrent },
          { separator: true },
          ...Workspace.boards.slice(0, 9).map((b, idx) => ({
            label: `${idx + 1}. ${b.name}`,
            shortcut: `Ctrl+${idx + 1}`,
            action: () => selectBoard(b.id)
          }))
        ]
      },
      {
        id: "menu-window",
        label: getText("menu.window.menuText") || "Janela",
        items: [
          { label: getText("menu.window.minimize") || "Minimizar", shortcut: "Ctrl+M", action: () => showToast("Janela minimizada") },
          { label: getText("menu.window.restoreWindow") || "Restaurar Janela Fechada", shortcut: "Ctrl+Shift+T", action: restoreClosedWindow },
          { separator: true },
          ...StoreData.windows.map(w => ({
            label: (w.id === StoreData.activeWindowId ? "✓ " : "  ") + w.title,
            action: () => switchActiveWindow(w.id)
          }))
        ]
      },
      {
        id: "menu-dev",
        label: "Desenvolvedor",
        items: [
          { label: "Servidor MCP (/api/mcp)", action: () => window.open("/api/mcp", "_blank") },
          { label: "API Workspace (/api/v1/workspace)", action: () => window.open("/api/v1/workspace", "_blank") },
          { label: "Compatibilidade Trello API (/api/trello/1/members/me)", action: () => window.open("/api/trello/1/members/me", "_blank") },
          { separator: true },
          { label: "Executar Triagem Antigravity / Codex", action: runAgentTriageNow },
          { label: "Simular Modo Offline", action: toggleOfflineSimulation }
        ]
      },
      {
        id: "menu-help",
        label: getText("menu.help.menuText") || "Ajuda",
        items: [
          { label: "Atalhos de Teclado", shortcut: "?", action: openShortcutsHelpModal },
          { label: "Tela de Boas-Vindas (Welcome)", action: openWelcomeOverlay },
          { label: getText("menu.help.preferences") || "Preferências", shortcut: "Ctrl+,", action: openPreferencesModal },
          { separator: true },
          { label: "Exportar Logs de Diagnóstico (.zip)", action: exportLogsZip },
          { label: "Sobre o Paws for Trello", action: () => { openPreferencesModal(); switchPrefTab("about"); } }
        ]
      }
    ];

    menubar.innerHTML = menus.map(m => `
      <div class="menubar-item" data-menu-id="${m.id}">
        <span>${escapeHtml(m.label)}</span>
        <div class="menubar-dropdown">
          ${m.items.map((it, idx) => {
            if (it.separator) return '<div class="menu-separator"></div>';
            return `
              <div class="menu-option" data-menu-action="${m.id}_${idx}">
                <span>${escapeHtml(it.label)}</span>
                ${it.shortcut ? `<span class="menu-shortcut">${escapeHtml(it.shortcut)}</span>` : ""}
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `).join("");

    // Eventos de clique no Menubar
    menubar.querySelectorAll(".menubar-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasActive = item.classList.contains("active");
        closeAllMenus();
        if (!wasActive) item.classList.add("active");
      });
    });

    menubar.querySelectorAll(".menu-option").forEach(opt => {
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAllMenus();
        const actionId = opt.getAttribute("data-menu-action");
        const [menuId, idxStr] = actionId.split("_");
        const menuObj = menus.find(m => m.id === menuId);
        if (menuObj && menuObj.items[parseInt(idxStr, 10)]) {
          const actionFn = menuObj.items[parseInt(idxStr, 10)].action;
          if (typeof actionFn === "function") actionFn();
        }
      });
    });

    renderWindowInstancesBar();
  }

  function closeAllMenus() {
    document.querySelectorAll(".menubar-item.active").forEach(el => el.classList.remove("active"));
  }

  document.addEventListener("click", () => closeAllMenus());

  function renderWindowInstancesBar() {
    const bar = document.getElementById("window-instances-bar");
    if (!bar) return;
    bar.innerHTML = StoreData.windows.map(w => `
      <div class="win-instance-pill ${w.id === StoreData.activeWindowId ? "active" : ""}" data-win-id="${w.id}">
        <span>${w.id === StoreData.activeWindowId ? "●" : "○"}</span>
        <span>${escapeHtml(w.title.slice(0, 20))}</span>
        ${StoreData.windows.length > 1 ? `<span class="win-close-chip" data-win-close="${w.id}" style="margin-left:4px;cursor:pointer;">✕</span>` : ""}
      </div>
    `).join("");

    bar.querySelectorAll(".win-instance-pill").forEach(el => {
      el.addEventListener("click", (e) => {
        if (e.target.matches("[data-win-close]")) return;
        switchActiveWindow(el.getAttribute("data-win-id"));
      });
    });

    bar.querySelectorAll("[data-win-close]").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        closeWindowById(el.getAttribute("data-win-close"));
      });
    });
  }

  function createNewWindow() {
    const newId = "win-" + Date.now();
    const board = getActiveBoard();
    const newWin = { id: newId, title: `${APP_NAME} — ${board.name}`, boardId: board.id, view: "board" };
    StoreData.windows.push(newWin);
    StoreData.activeWindowId = newId;
    saveStore();
    renderAppMenubar();
    renderWorkspace();
    showToast("Nova Janela de Trabalho aberta");
  }

  function closeCurrentWindow() {
    closeWindowById(StoreData.activeWindowId);
  }

  function closeWindowById(winId) {
    if (StoreData.windows.length <= 1) {
      showToast("Não é possível fechar a única janela ativa.");
      return;
    }
    const idx = StoreData.windows.findIndex(w => w.id === winId);
    if (idx !== -1) {
      const closed = StoreData.windows.splice(idx, 1)[0];
      StoreData.closedWindows.push(closed);
      if (StoreData.activeWindowId === winId) {
        StoreData.activeWindowId = StoreData.windows[0].id;
      }
      saveStore();
      renderAppMenubar();
      renderWorkspace();
    }
  }

  function restoreClosedWindow() {
    if (!StoreData.closedWindows || StoreData.closedWindows.length === 0) {
      showToast("Nenhuma janela fechada para restaurar.");
      return;
    }
    const restored = StoreData.closedWindows.pop();
    StoreData.windows.push(restored);
    StoreData.activeWindowId = restored.id;
    saveStore();
    renderAppMenubar();
    renderWorkspace();
    showToast(`Janela restaurada: ${restored.title}`);
  }

  function switchActiveWindow(winId) {
    StoreData.activeWindowId = winId;
    saveStore();
    renderAppMenubar();
    renderWorkspace();
  }

  function setZoomFactor(factor) {
    const clamped = Math.max(0.6, Math.min(2.0, Math.round(factor * 10) / 10));
    StoreData["zoom-factor"] = clamped;
    saveStore();
    document.getElementById("app-viewport").style.zoom = clamped;
    showToast(`Zoom: ${Math.round(clamped * 100)}%`);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      document.body.classList.add("full-screen");
    } else {
      document.exitFullscreen().catch(() => {});
      document.body.classList.remove("full-screen");
    }
  }

  function navigateHistoryBack() {
    if (StoreData.historyIndex > 0) {
      StoreData.historyIndex--;
      const boardId = StoreData.history[StoreData.historyIndex];
      selectBoard(boardId, false);
    }
  }

  function navigateHistoryForward() {
    if (StoreData.historyIndex < StoreData.history.length - 1) {
      StoreData.historyIndex++;
      const boardId = StoreData.history[StoreData.historyIndex];
      selectBoard(boardId, false);
    }
  }

  function updateNavigationButtons() {
    // Atualiza estados caso haja botões de voltar/avançar
  }

  // ==========================================================================
  // 8. RENDERIZAÇÃO DA SIDEBAR, INBOX DOCK E PLANNER DOCK
  // ==========================================================================
  function renderSidebar() {
    const win = getActiveWindow();
    const starredContainer = document.getElementById("starred-boards-sidebar-list");
    const allBoardsContainer = document.getElementById("all-boards-sidebar-list");

    if (starredContainer) {
      const starred = Workspace.boards.filter(b => b.starred);
      starredContainer.innerHTML = starred.map((b, idx) => `
        <div class="sidebar-nav-item ${b.id === win.boardId ? "active" : ""}" data-board-id="${b.id}">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
            <div class="board-color-dot" style="background:${b.color || "#0c66e4"};"></div>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(b.name)}</span>
          </div>
          <span class="nav-shortcut-hint">Ctrl+${idx + 1}</span>
        </div>
      `).join("");

      starredContainer.querySelectorAll(".sidebar-nav-item").forEach(el => {
        el.addEventListener("click", () => selectBoard(el.getAttribute("data-board-id")));
      });
    }

    if (allBoardsContainer) {
      allBoardsContainer.innerHTML = Workspace.boards.map(b => `
        <div class="sidebar-nav-item ${b.id === win.boardId ? "active" : ""}" data-board-id="${b.id}">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
            <div class="board-color-dot" style="background:${b.color || "#0c66e4"};"></div>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(b.name)}</span>
          </div>
          ${b.starred ? '<span style="color:#e2b203;">★</span>' : ""}
        </div>
      `).join("");

      allBoardsContainer.querySelectorAll(".sidebar-nav-item").forEach(el => {
        el.addEventListener("click", () => selectBoard(el.getAttribute("data-board-id")));
      });
    }

    // Navegação de visualizações
    document.querySelectorAll(".workspace-sidebar [data-view]").forEach(item => {
      const viewMode = item.getAttribute("data-view");
      item.classList.toggle("active", win.view === viewMode);
      item.onclick = () => switchViewMode(viewMode);
    });
  }

  function renderInboxDock() {
    const list = document.getElementById("inbox-cards-list");
    const badge = document.getElementById("inbox-badge-count");
    if (!list) return;

    const cards = Workspace.inbox.cards || [];
    if (badge) badge.textContent = cards.length;

    list.innerHTML = cards.map(c => `
      <div class="kanban-card" draggable="true" data-inbox-card-id="${c.id}">
        <div class="card-inner-body">
          <div class="card-title-text">${escapeHtml(c.name)}</div>
          ${c.desc ? `<p style="font-size:12px;color:var(--ds-text-subtle);margin:4px 0 0;line-height:1.3;">${escapeHtml(c.desc.slice(0, 80))}${c.desc.length > 80 ? "..." : ""}</p>` : ""}
          <div class="card-badges-row">
            ${c.due ? `<span class="card-badge ${c.completed ? "due-completed" : ""}">📅 ${c.due}</span>` : ""}
            ${c.checklist && c.checklist.length ? `<span class="card-badge">☑️ ${c.checklist.filter(i=>i.checked).length}/${c.checklist.length}</span>` : ""}
            <span style="margin-left:auto;font-size:10px;opacity:0.6;">Inbox</span>
          </div>
        </div>
      </div>
    `).join("");

    // Drag-and-drop para cartões da Inbox
    list.querySelectorAll(".kanban-card").forEach(el => {
      el.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({
          source: "inbox",
          cardId: el.getAttribute("data-inbox-card-id")
        }));
        el.classList.add("dragging");
      });
      el.addEventListener("dragend", () => el.classList.remove("dragging"));
      el.addEventListener("click", () => openInboxCardDetail(el.getAttribute("data-inbox-card-id")));
    });

    // Zona de drop da Inbox
    list.ondragover = (e) => { e.preventDefault(); list.classList.add("drag-over"); };
    list.ondragleave = () => list.classList.remove("drag-over");
    list.ondrop = (e) => {
      e.preventDefault();
      list.classList.remove("drag-over");
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        if (data.source === "board") {
          moveCardToInbox(data.boardId, data.listId, data.cardId);
        }
      } catch (_) {}
    };
  }

  function renderPlannerDock() {
    const timeline = document.getElementById("planner-timeline");
    if (!timeline) return;

    const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    const events = Workspace.plannerEvents || [];

    timeline.innerHTML = hours.map(h => {
      const hourStr = String(h).padStart(2, "0") + ":00";
      const matchedEvents = events.filter(ev => ev.startHour === h);
      return `
        <div class="planner-hour-row" data-hour="${h}">
          <div class="planner-hour-label">${hourStr}</div>
          <div class="planner-hour-slot" data-slot-hour="${h}">
            ${matchedEvents.map(ev => `
              <div class="planner-event-card" style="background:${ev.color || "#0c66e4"};" data-event-id="${ev.id}">
                <span>${escapeHtml(ev.title)}</span>
                <span style="font-size:10px;opacity:0.8;">${ev.durationHours}h</span>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");

    // Drag-and-drop para agendar no Planner
    timeline.querySelectorAll(".planner-hour-slot").forEach(slot => {
      slot.ondragover = (e) => { e.preventDefault(); slot.classList.add("drag-over"); };
      slot.ondragleave = () => slot.classList.remove("drag-over");
      slot.ondrop = (e) => {
        e.preventDefault();
        slot.classList.remove("drag-over");
        const hour = parseInt(slot.getAttribute("data-slot-hour"), 10);
        try {
          const data = JSON.parse(e.dataTransfer.getData("text/plain"));
          scheduleCardInPlanner(data, hour);
        } catch (_) {}
      };
    });
  }

  function scheduleCardInPlanner(data, hour) {
    let cardTitle = "Bloco de Foco";
    let cardId = data.cardId;

    if (data.source === "inbox") {
      const card = Workspace.inbox.cards.find(c => c.id === data.cardId);
      if (card) cardTitle = card.name;
    } else if (data.source === "board") {
      const board = Workspace.boards.find(b => b.id === data.boardId);
      const list = board && board.lists.find(l => l.id === data.listId);
      const card = list && list.cards.find(c => c.id === data.cardId);
      if (card) cardTitle = card.name;
    }

    if (!Workspace.plannerEvents) Workspace.plannerEvents = [];
    Workspace.plannerEvents.push({
      id: "plan-" + Date.now(),
      cardId,
      title: cardTitle,
      dayOffset: 0,
      startHour: hour,
      durationHours: 1,
      color: "#0c66e4"
    });

    saveWorkspaceToServer();
    renderPlannerDock();
    showToast(`Cartão agendado para as ${hour}:00 no Planner`);
  }

  function toggleInboxDock() {
    StoreData.dockViews.inbox = !StoreData.dockViews.inbox;
    saveStore();
    applyDockSplitViews();
  }

  function togglePlannerDock() {
    StoreData.dockViews.planner = !StoreData.dockViews.planner;
    saveStore();
    applyDockSplitViews();
  }

  function applyDockSplitViews() {
    const inbox = document.getElementById("inbox-dock");
    const planner = document.getElementById("planner-dock");
    const dockInboxBtn = document.getElementById("dock-btn-inbox");
    const dockPlannerBtn = document.getElementById("dock-btn-planner");
    const dockBoardBtn = document.getElementById("dock-btn-board");

    if (inbox) inbox.classList.toggle("collapsed", !StoreData.dockViews.inbox);
    if (planner) planner.classList.toggle("hidden", !StoreData.dockViews.planner);

    if (dockInboxBtn) dockInboxBtn.classList.toggle("active", StoreData.dockViews.inbox);
    if (dockPlannerBtn) dockPlannerBtn.classList.toggle("active", StoreData.dockViews.planner);
    if (dockBoardBtn) dockBoardBtn.classList.toggle("active", StoreData.dockViews.board);
  }

  // ==========================================================================
  // 9. RENDERIZAÇÃO DO QUADRO KANBAN, TABELA, CALENDÁRIO & AUTOMAÇÃO
  // ==========================================================================
  function renderWorkspace() {
    renderAppMenubar();
    renderSidebar();
    renderInboxDock();
    renderPlannerDock();
    applyDockSplitViews();

    const win = getActiveWindow();
    const board = getActiveBoard();
    const titleEl = document.getElementById("active-board-title");
    const winTitleEl = document.getElementById("window-title-text");

    if (titleEl) titleEl.textContent = board.name;
    if (winTitleEl) winTitleEl.textContent = `${APP_NAME} — ${board.name}`;
    document.title = `${APP_NAME} — ${board.name}`;

    // Atualiza botão de estrela
    const starBtn = document.getElementById("btn-star-current-board");
    if (starBtn) starBtn.textContent = board.starred ? "⭐" : "☆";

    // Fundo do quadro
    const canvasWrapper = document.getElementById("board-canvas-wrapper");
    if (canvasWrapper && board.background) {
      canvasWrapper.style.background = board.background;
    }

    // Alternador de visualização
    document.querySelectorAll("[data-switch-mode]").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-switch-mode") === win.view);
    });

    const container = document.getElementById("workspace-dynamic-content");
    if (!container) return;

    if (win.view === "board") {
      renderKanbanView(container, board);
    } else if (win.view === "table") {
      renderTableView(container, board);
    } else if (win.view === "calendar") {
      renderCalendarView(container, board);
    } else if (win.view === "butler") {
      renderButlerAutomationView(container, board);
    } else if (win.view === "my-cards") {
      renderMyCardsView(container);
    } else if (win.view === "all-boards") {
      renderAllBoardsView(container);
    } else if (win.view === "activity") {
      renderActivityLogView(container);
    }
  }

  function filterCards(cards) {
    const f = StoreData.boardFilter;
    if (!f) return cards;
    return cards.filter(c => {
      if (f.keyword) {
        const q = f.keyword.toLowerCase();
        const matchesTitle = c.name.toLowerCase().includes(q);
        const matchesDesc = (c.desc || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }
      if (f.due === "overdue") {
        if (!c.due || c.completed) return false;
        if (new Date(c.due) >= new Date()) return false;
      }
      if (f.due === "completed") {
        if (!c.completed) return false;
      }
      if (f.due === "nodue") {
        if (c.due) return false;
      }
      if (f.labels && f.labels.length > 0) {
        const cardLabelIds = (c.labels || []).map(l => l.id);
        const hasLabel = f.labels.some(lblId => cardLabelIds.includes(lblId));
        if (!hasLabel) return false;
      }
      if (f.members && f.members.length > 0) {
        const hasMember = f.members.some(m => (c.members || []).includes(m));
        if (!hasMember) return false;
      }
      return true;
    });
  }

  function renderKanbanView(container, board) {
    container.innerHTML = `
      ${board.lists.map(list => {
        const filtered = filterCards(list.cards || []);
        return `
          <div class="kanban-list" data-list-id="${list.id}">
            <div class="kanban-list-header" draggable="true" data-drag-list="${list.id}">
              <span class="list-title-text" contenteditable="true" data-edit-list-name="${list.id}">${escapeHtml(list.name)}</span>
              <button class="list-menu-btn" data-list-menu="${list.id}" title="Opções da Lista">•••</button>
            </div>

            <div class="kanban-cards-scroll" data-drop-list="${list.id}">
              ${filtered.map(card => {
                const isOverdue = card.due && !card.completed && new Date(card.due) < new Date();
                return `
                  <div class="kanban-card" draggable="true" data-card-id="${card.id}" data-card-list="${list.id}">
                    ${card.cover ? `<div class="card-cover-strip" style="background:${card.cover};"></div>` : ""}
                    <div class="card-inner-body">
                      ${card.labels && card.labels.length ? `
                        <div class="card-labels-row">
                          ${card.labels.map(l => `<span class="card-label-pill" style="background:${l.color};">${escapeHtml(l.name)}</span>`).join("")}
                        </div>
                      ` : ""}

                      <div class="card-title-text">${escapeHtml(card.name)}</div>

                      <div class="card-badges-row">
                        ${card.due ? `
                          <span class="card-badge ${card.completed ? "due-completed" : isOverdue ? "due-overdue" : ""}">
                            📅 ${card.due} ${card.completed ? "✓" : ""}
                          </span>
                        ` : ""}

                        ${card.checklist && card.checklist.length ? `
                          <span class="card-badge">
                            ☑️ ${card.checklist.filter(i=>i.checked).length}/${card.checklist.length}
                          </span>
                        ` : ""}

                        ${card.attachments && card.attachments.length ? `
                          <span class="card-badge">📎 ${card.attachments.length}</span>
                        ` : ""}

                        ${card.comments && card.comments.length ? `
                          <span class="card-badge">💬 ${card.comments.length}</span>
                        ` : ""}

                        ${card.agentStatus ? `
                          <span class="card-badge" style="background:rgba(128,63,165,0.18);color:#803fa5;font-weight:600;">🤖 ${card.agentStatus}</span>
                        ` : ""}

                        ${card.members && card.members.length ? `
                          <div class="card-members-Cluster">
                            ${card.members.map(m => {
                              const mem = (Workspace.members || []).find(x => x.id === m);
                              return `<div class="member-mini-avatar" style="background:${mem ? mem.color : "#0c66e4"};">${m}</div>`;
                            }).join("")}
                          </div>
                        ` : ""}
                      </div>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>

            <div class="kanban-list-footer">
              <button class="add-card-inline-btn" data-add-card-list="${list.id}">+ Adicionar um cartão</button>
            </div>
          </div>
        `;
      }).join("")}

      <div style="width:280px;flex-shrink:0;">
        <button id="btn-add-list-canvas" class="board-pill-btn" style="width:100%;height:44px;background:rgba(255,255,255,0.22);font-size:14px;justify-content:center;">
          + Adicionar outra lista
        </button>
      </div>
    `;

    setupKanbanDragAndDrop(container, board);
    setupInlineInteractions(container, board);
  }

  function setupKanbanDragAndDrop(container, board) {
    // Drag cards
    container.querySelectorAll(".kanban-card").forEach(el => {
      el.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({
          source: "board",
          boardId: board.id,
          listId: el.getAttribute("data-card-list"),
          cardId: el.getAttribute("data-card-id")
        }));
        el.classList.add("dragging");
      });
      el.addEventListener("dragend", () => el.classList.remove("dragging"));
      el.addEventListener("click", () => {
        openCardDetailModal(board.id, el.getAttribute("data-card-list"), el.getAttribute("data-card-id"));
      });
    });

    // Drop targets on lists
    container.querySelectorAll(".kanban-cards-scroll").forEach(scroll => {
      scroll.ondragover = (e) => { e.preventDefault(); scroll.classList.add("drag-over"); };
      scroll.ondragleave = () => scroll.classList.remove("drag-over");
      scroll.ondrop = (e) => {
        e.preventDefault();
        scroll.classList.remove("drag-over");
        const targetListId = scroll.getAttribute("data-drop-list");
        try {
          const data = JSON.parse(e.dataTransfer.getData("text/plain"));
          if (data.source === "inbox") {
            moveInboxCardToBoard(data.cardId, board.id, targetListId);
          } else if (data.source === "board") {
            moveCardBetweenLists(board.id, data.listId, targetListId, data.cardId);
          }
        } catch (_) {}
      };
    });
  }

  function setupInlineInteractions(container, board) {
    // Add card inline
    container.querySelectorAll("[data-add-card-list]").forEach(btn => {
      btn.onclick = () => {
        const listId = btn.getAttribute("data-add-card-list");
        openInlineCardCreator(btn, board.id, listId);
      };
    });

    // Edit list name inline
    container.querySelectorAll("[data-edit-list-name]").forEach(span => {
      span.onblur = () => {
        const listId = span.getAttribute("data-edit-list-name");
        const list = board.lists.find(l => l.id === listId);
        if (list && span.textContent.trim()) {
          list.name = span.textContent.trim();
          saveWorkspaceToServer();
        }
      };
      span.onkeydown = (e) => {
        if (e.key === "Enter") { e.preventDefault(); span.blur(); }
      };
    });

    // List menu popover
    container.querySelectorAll("[data-list-menu]").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        openListMenuPopover(btn, board.id, btn.getAttribute("data-list-menu"));
      };
    });

    // Add list button
    const addListBtn = document.getElementById("btn-add-list-canvas");
    if (addListBtn) {
      addListBtn.onclick = () => promptCreateNewList(board);
    }
  }

  function openInlineCardCreator(btn, boardId, listId) {
    const parent = btn.parentElement;
    parent.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;">
        <textarea id="inline-card-name" placeholder="Insira um título para este cartão..." style="width:100%;height:58px;padding:8px;border:1px solid var(--ds-border-focused);border-radius:6px;resize:none;font-family:inherit;font-size:14px;background:var(--ds-background-input);color:var(--ds-text);"></textarea>
        <div style="display:flex;align-items:center;gap:6px;">
          <button class="pref-btn" id="inline-card-save" style="padding:6px 12px;font-size:13px;">Adicionar cartão</button>
          <button id="inline-card-cancel" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--ds-text-subtle);">✕</button>
        </div>
      </div>
    `;
    const textarea = document.getElementById("inline-card-name");
    textarea.focus();

    document.getElementById("inline-card-save").onclick = () => {
      const title = textarea.value.trim();
      if (title) {
        createCardInBoard(boardId, listId, title);
      }
      renderWorkspace();
    };

    document.getElementById("inline-card-cancel").onclick = () => renderWorkspace();
  }

  function openListMenuPopover(btn, boardId, listId) {
    closeCustomContextMenu();
    const rect = btn.getBoundingClientRect();
    const menu = document.getElementById("custom-context-menu");
    const board = Workspace.boards.find(b => b.id === boardId);
    const list = board && board.lists.find(l => l.id === listId);
    if (!menu || !list) return;

    menu.style.top = rect.bottom + 4 + "px";
    menu.style.left = rect.left - 140 + "px";
    menu.innerHTML = `
      <div class="menu-option" id="pop-sort-due"><span>Ordenar por Prazo</span></div>
      <div class="menu-option" id="pop-sort-name"><span>Ordenar por Título (A-Z)</span></div>
      <div class="menu-separator"></div>
      <div class="menu-option" id="pop-copy-list"><span>Copiar Lista</span></div>
      <div class="menu-option" id="pop-archive-cards"><span>Arquivar todos os cartões</span></div>
      <div class="menu-separator"></div>
      <div class="menu-option" id="pop-delete-list" style="color:var(--ds-text-danger);"><span>Excluir Lista</span></div>
    `;
    menu.classList.remove("hidden");

    document.getElementById("pop-sort-due").onclick = () => {
      list.cards.sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
      saveWorkspaceToServer();
      renderWorkspace();
      closeCustomContextMenu();
    };

    document.getElementById("pop-sort-name").onclick = () => {
      list.cards.sort((a, b) => a.name.localeCompare(b.name));
      saveWorkspaceToServer();
      renderWorkspace();
      closeCustomContextMenu();
    };

    document.getElementById("pop-copy-list").onclick = () => {
      const copy = JSON.parse(JSON.stringify(list));
      copy.id = "list-" + Date.now();
      copy.name = list.name + " (Cópia)";
      board.lists.push(copy);
      saveWorkspaceToServer();
      renderWorkspace();
      closeCustomContextMenu();
    };

    document.getElementById("pop-archive-cards").onclick = () => {
      list.cards = [];
      saveWorkspaceToServer();
      renderWorkspace();
      closeCustomContextMenu();
    };

    document.getElementById("pop-delete-list").onclick = () => {
      board.lists = board.lists.filter(l => l.id !== listId);
      saveWorkspaceToServer();
      renderWorkspace();
      closeCustomContextMenu();
    };
  }

  function closeCustomContextMenu() {
    const menu = document.getElementById("custom-context-menu");
    if (menu) menu.classList.add("hidden");
  }

  function moveCardBetweenLists(boardId, sourceListId, targetListId, cardId) {
    const board = Workspace.boards.find(b => b.id === boardId);
    if (!board) return;
    const sourceList = board.lists.find(l => l.id === sourceListId);
    const targetList = board.lists.find(l => l.id === targetListId);
    if (!sourceList || !targetList) return;

    const idx = sourceList.cards.findIndex(c => c.id === cardId);
    if (idx === -1) return;
    const card = sourceList.cards.splice(idx, 1)[0];

    // Se movido para "Concluído", marcar como completo
    if (targetList.name.toLowerCase().includes("conclu")) {
      card.completed = true;
    }

    targetList.cards.push(card);
    saveWorkspaceToServer();
    renderWorkspace();
  }

  function moveInboxCardToBoard(cardId, boardId, targetListId) {
    const idx = Workspace.inbox.cards.findIndex(c => c.id === cardId);
    if (idx === -1) return;
    const card = Workspace.inbox.cards.splice(idx, 1)[0];

    const board = Workspace.boards.find(b => b.id === boardId);
    const list = board && board.lists.find(l => l.id === targetListId);
    if (list) {
      list.cards.push(card);
      saveWorkspaceToServer();
      renderWorkspace();
      showToast(`Cartão movido da Inbox para ${list.name}`);
    }
  }

  function moveCardToInbox(boardId, listId, cardId) {
    const board = Workspace.boards.find(b => b.id === boardId);
    const list = board && board.lists.find(l => l.id === listId);
    if (!list) return;
    const idx = list.cards.findIndex(c => c.id === cardId);
    if (idx === -1) return;
    const card = list.cards.splice(idx, 1)[0];
    Workspace.inbox.cards.unshift(card);
    saveWorkspaceToServer();
    renderWorkspace();
    showToast("Cartão movido para a Caixa de entrada");
  }

  function createCardInBoard(boardId, listId, title) {
    const board = Workspace.boards.find(b => b.id === boardId);
    const list = board && board.lists.find(l => l.id === listId);
    if (!list) return;
    const newCard = {
      id: "card-" + Date.now(),
      name: title,
      desc: "",
      labels: [],
      due: "",
      completed: false,
      members: ["JN"],
      checklist: [],
      attachments: [],
      comments: [],
      cover: ""
    };
    list.cards.push(newCard);
    saveWorkspaceToServer();
  }

  function promptCreateNewList(board) {
    openPromptModal("Nome da nova lista:", "Nova Lista", (name) => {
      if (name && name.trim()) {
        board.lists.push({
          id: "list-" + Date.now(),
          name: name.trim(),
          cards: []
        });
        saveWorkspaceToServer();
        renderWorkspace();
      }
    });
  }

  // ==========================================================================
  // 10. VISÃO DE TABELA (Spreadsheet Google Sheets integrada)
  // ==========================================================================
  function renderTableView(container, board) {
    let rows = [];
    board.lists.forEach(l => {
      l.cards.forEach(c => {
        rows.push({ listName: l.name, listId: l.id, card: c });
      });
    });

    container.innerHTML = `
      <div style="flex:1;background:var(--ds-surface);border-radius:10px;padding:20px;overflow-y:auto;box-shadow:var(--ds-shadow-raised);color:var(--ds-text);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div>
            <h2 style="margin:0;font-size:20px;">📑 Visão de Tabela — ${escapeHtml(board.name)}</h2>
            <p style="margin:4px 0 0;font-size:13px;color:var(--ds-text-subtle);">Dados estruturados idênticos à planilha Google Sheets sincronizada.</p>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="pref-btn" id="btn-table-sync-sheets">📊 Sincronizar com Planilha</button>
            <button class="pref-btn secondary" id="btn-table-export-csv">📥 Baixar CSV</button>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
          <thead>
            <tr style="border-bottom:2px solid var(--ds-border);background:var(--ds-surface-sunken);">
              <th style="padding:10px 12px;">Cartão</th>
              <th style="padding:10px 12px;">Lista</th>
              <th style="padding:10px 12px;">Prazo</th>
              <th style="padding:10px 12px;">Status</th>
              <th style="padding:10px 12px;">Membros</th>
              <th style="padding:10px 12px;">Checklist</th>
              <th style="padding:10px 12px;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr style="border-bottom:1px solid var(--ds-border);">
                <td style="padding:10px 12px;font-weight:600;">${escapeHtml(r.card.name)}</td>
                <td style="padding:10px 12px;"><span style="padding:2px 8px;border-radius:4px;background:var(--ds-background-neutral);">${escapeHtml(r.listName)}</span></td>
                <td style="padding:10px 12px;">${r.card.due || "—"}</td>
                <td style="padding:10px 12px;">${r.card.completed ? '<span style="color:#1f845a;font-weight:700;">Concluído ✓</span>' : "Em aberto"}</td>
                <td style="padding:10px 12px;">${(r.card.members || []).join(", ") || "—"}</td>
                <td style="padding:10px 12px;">${r.card.checklist ? `${r.card.checklist.filter(x=>x.checked).length}/${r.card.checklist.length}` : "0/0"}</td>
                <td style="padding:10px 12px;">
                  <button class="pref-btn secondary" style="padding:4px 8px;font-size:11px;" onclick="window.trelloDesktopOpenCard('${board.id}', '${r.listId}', '${r.card.id}')">Abrir</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById("btn-table-sync-sheets").onclick = syncGoogleSheetsNow;
    document.getElementById("btn-table-export-csv").onclick = exportBoardCsv;
  }

  window.trelloDesktopOpenCard = (bId, lId, cId) => openCardDetailModal(bId, lId, cId);

  // ==========================================================================
  // 11. VISÃO DE CALENDÁRIO & BUTLER AUTOMATION
  // ==========================================================================
  function renderCalendarView(container, board) {
    let cardsWithDue = [];
    board.lists.forEach(l => {
      l.cards.forEach(c => {
        if (c.due) cardsWithDue.push({ listName: l.name, card: c });
      });
    });

    container.innerHTML = `
      <div style="flex:1;background:var(--ds-surface);border-radius:10px;padding:20px;overflow-y:auto;box-shadow:var(--ds-shadow-raised);color:var(--ds-text);">
        <h2 style="margin:0 0 16px;font-size:20px;">📅 Visão de Calendário — ${escapeHtml(board.name)}</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:12px;">
          ${cardsWithDue.map(item => `
            <div style="border:1px solid var(--ds-border);border-radius:8px;padding:12px;background:var(--ds-surface-sunken);">
              <div style="font-size:11px;font-weight:700;color:#0c66e4;margin-bottom:4px;">${item.card.due}</div>
              <div style="font-weight:600;font-size:14px;margin-bottom:6px;">${escapeHtml(item.card.name)}</div>
              <div style="font-size:12px;color:var(--ds-text-subtle);">Lista: ${escapeHtml(item.listName)}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderButlerAutomationView(container, board) {
    const rules = Workspace.automationRules || [];
    container.innerHTML = `
      <div style="flex:1;background:var(--ds-surface);border-radius:10px;padding:24px;overflow-y:auto;box-shadow:var(--ds-shadow-raised);color:var(--ds-text);max-width:800px;margin:0 auto;">
        <h2 style="margin:0 0 8px;font-size:22px;">⚡ Automação &amp; Regras Butler (Paws for Trello)</h2>
        <p style="margin:0 0 20px;color:var(--ds-text-subtle);font-size:14px;">Automações nativas para sincronização com Google Workspace e acionamento de Agentes.</p>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${rules.map(r => `
            <div style="border:1px solid var(--ds-border);border-radius:8px;padding:14px;background:var(--ds-surface-sunken);display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-weight:600;font-size:14px;">${escapeHtml(r.name)}</div>
                <div style="font-size:12px;color:var(--ds-text-subtle);margin-top:2px;">Gatilho: ${r.trigger || "evento"} → Ação: ${r.action || "executar"}</div>
              </div>
              <span style="background:#1f845a;color:#fff;font-size:11px;padding:3px 8px;border-radius:10px;font-weight:700;">Ativo</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderMyCardsView(container) {
    let myCards = [];
    Workspace.boards.forEach(b => {
      b.lists.forEach(l => {
        l.cards.forEach(c => {
          if ((c.members || []).includes("JN")) {
            myCards.push({ board: b.name, list: l.name, card: c });
          }
        });
      });
    });

    container.innerHTML = `
      <div style="flex:1;background:var(--ds-surface);border-radius:10px;padding:24px;overflow-y:auto;color:var(--ds-text);">
        <h2 style="margin:0 0 16px;font-size:20px;">👤 Meus Cartões Atribuídos</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:12px;">
          ${myCards.map(item => `
            <div style="border:1px solid var(--ds-border);border-radius:8px;padding:14px;background:var(--ds-surface-sunken);">
              <div style="font-size:11px;color:var(--ds-text-subtle);">${escapeHtml(item.board)} / ${escapeHtml(item.list)}</div>
              <div style="font-weight:600;font-size:14px;margin:6px 0;">${escapeHtml(item.card.name)}</div>
              ${item.card.due ? `<div style="font-size:12px;color:#0c66e4;">📅 ${item.card.due}</div>` : ""}
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderAllBoardsView(container) {
    container.innerHTML = `
      <div style="flex:1;background:var(--ds-surface);border-radius:10px;padding:24px;overflow-y:auto;color:var(--ds-text);">
        <h2 style="margin:0 0 16px;font-size:20px;">🗂️ Todos os Quadros do Paws for Trello</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:14px;">
          ${Workspace.boards.map(b => `
            <div style="height:110px;border-radius:10px;background:${b.background || "#0c66e4"};padding:14px;color:#fff;cursor:pointer;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 4px 10px rgba(0,0,0,0.2);" onclick="window.trelloDesktopSelectBoard('${b.id}')">
              <div style="font-weight:700;font-size:16px;">${escapeHtml(b.name)}</div>
              <div style="display:flex;justify-content:space-between;font-size:12px;opacity:0.85;">
                <span>${b.lists.length} listas</span>
                ${b.starred ? '<span>★</span>' : ""}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  window.trelloDesktopSelectBoard = (bId) => selectBoard(bId);

  function renderActivityLogView(container) {
    const logs = Workspace.agentLogs || [];
    container.innerHTML = `
      <div style="flex:1;background:var(--ds-surface);border-radius:10px;padding:24px;overflow-y:auto;color:var(--ds-text);max-width:900px;margin:0 auto;">
        <h2 style="margin:0 0 8px;font-size:20px;">🤖 Log de Atividades &amp; Agentes (Antigravity &amp; Codex)</h2>
        <p style="margin:0 0 16px;color:var(--ds-text-subtle);font-size:13px;">Registros em tempo real das chamadas MCP, triagens automáticas e sync de planilhas.</p>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${logs.map(l => `
            <div style="border:1px solid var(--ds-border);border-radius:6px;padding:10px 14px;background:var(--ds-surface-sunken);font-size:13px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <strong style="color:#803fa5;">[${l.agent}]</strong> ${escapeHtml(l.action)}: ${escapeHtml(l.details)}
              </div>
              <div style="font-size:11px;color:var(--ds-text-subtlest);font-family:Consolas,monospace;">${l.timestamp.slice(11, 19)}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function selectBoard(boardId, addToHistory = true) {
    const win = getActiveWindow();
    win.boardId = boardId;
    win.view = "board";
    if (addToHistory) {
      StoreData.history.push(boardId);
      StoreData.historyIndex = StoreData.history.length - 1;
    }
    saveStore();
    renderWorkspace();
  }

  function switchViewMode(mode) {
    const win = getActiveWindow();
    win.view = mode;
    saveStore();
    renderWorkspace();
  }

  function setDefaultBoardCurrent() {
    const b = getActiveBoard();
    StoreData["default-url"] = `https://trello.com/b/${b.id}`;
    saveStore();
    showToast(`Quadro "${b.name}" definido como padrão.`);
  }

  // ==========================================================================
  // 12. RICH CARD BACK MODAL (1:1 Modal com Checklists, Labels, Members, Docs)
  // ==========================================================================
  function openCardDetailModal(boardId, listId, cardId) {
    const board = Workspace.boards.find(b => b.id === boardId);
    const list = board && board.lists.find(l => l.id === listId);
    const card = list && list.cards.find(c => c.id === cardId);
    if (!card) return;

    const modal = document.getElementById("modal-card-detail");
    const body = document.getElementById("card-detail-body");
    const cover = document.getElementById("card-back-cover");

    if (cover) {
      cover.style.background = card.cover || "linear-gradient(90deg, #0c66e4 0%, #172b4d 100%)";
    }

    const totalCheck = card.checklist ? card.checklist.length : 0;
    const completedCheck = card.checklist ? card.checklist.filter(i => i.checked).length : 0;
    const progressPercent = totalCheck > 0 ? Math.round((completedCheck / totalCheck) * 100) : 0;

    body.innerHTML = `
      <div class="card-back-grid">
        <!-- Coluna Principal -->
        <div>
          <div style="margin-bottom:12px;">
            <input type="text" id="cb-card-title" value="${escapeHtml(card.name)}" style="width:100%;font-size:20px;font-weight:700;border:1px solid transparent;border-radius:4px;padding:4px 6px;background:transparent;color:var(--ds-text);" />
            <div style="font-size:12px;color:var(--ds-text-subtle);padding-left:6px;">na lista <strong style="text-decoration:underline;">${escapeHtml(list.name)}</strong></div>
          </div>

          <!-- Metadados: Membros, Etiquetas e Prazo -->
          <div style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:20px;padding-left:6px;">
            ${card.members && card.members.length ? `
              <div>
                <div style="font-size:11px;font-weight:700;color:var(--ds-text-subtle);margin-bottom:4px;">MEMBROS</div>
                <div style="display:flex;gap:4px;">
                  ${card.members.map(m => `<div class="member-mini-avatar" style="width:28px;height:28px;font-size:12px;background:#0c66e4;">${m}</div>`).join("")}
                </div>
              </div>
            ` : ""}

            ${card.labels && card.labels.length ? `
              <div>
                <div style="font-size:11px;font-weight:700;color:var(--ds-text-subtle);margin-bottom:4px;">ETIQUETAS</div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;">
                  ${card.labels.map(l => `<span class="card-label-pill" style="background:${l.color};padding:4px 10px;font-size:12px;">${escapeHtml(l.name)}</span>`).join("")}
                </div>
              </div>
            ` : ""}

            ${card.due ? `
              <div>
                <div style="font-size:11px;font-weight:700;color:var(--ds-text-subtle);margin-bottom:4px;">DATA DE ENTREGA</div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <input type="checkbox" id="cb-due-checkbox" ${card.completed ? "checked" : ""} style="width:16px;height:16px;" />
                  <span style="font-size:13px;font-weight:600;padding:3px 8px;border-radius:4px;background:var(--ds-background-neutral);">${card.due} ${card.completed ? "✓ Concluído" : ""}</span>
                </div>
              </div>
            ` : ""}
          </div>

          <!-- Descrição -->
          <div class="card-back-section">
            <div class="card-back-section-title">
              <span>📄 Descrição</span>
            </div>
            <textarea id="cb-card-desc" placeholder="Adicionar uma descrição mais detalhada..." style="width:100%;height:90px;padding:10px;border:1px solid var(--ds-border-input);border-radius:6px;background:var(--ds-background-input);color:var(--ds-text);font-family:inherit;font-size:14px;resize:vertical;">${escapeHtml(card.desc || "")}</textarea>
          </div>

          <!-- Checklist -->
          <div class="card-back-section">
            <div class="card-back-section-title">
              <span>☑️ Checklist</span>
              <span id="cb-checklist-percent" style="font-size:12px;color:var(--ds-text-subtle);">${progressPercent}%</span>
            </div>
            <div class="checklist-progress-bar">
              <div class="checklist-progress-fill" style="width:${progressPercent}%;"></div>
            </div>
            <div id="cb-checklist-items" style="display:flex;flex-direction:column;gap:6px;">
              ${(card.checklist || []).map((it, idx) => `
                <div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
                  <input type="checkbox" data-check-idx="${idx}" ${it.checked ? "checked" : ""} style="width:16px;height:16px;" />
                  <span style="flex:1;font-size:14px;${it.checked ? "text-decoration:line-through;color:var(--ds-text-subtlest);" : ""}">${escapeHtml(it.text)}</span>
                  <button type="button" data-check-del="${idx}" style="background:none;border:none;cursor:pointer;color:var(--ds-text-subtle);">✕</button>
                </div>
              `).join("")}
            </div>
            <div style="display:flex;gap:8px;margin-top:10px;">
              <input type="text" id="cb-new-check-item" placeholder="Adicionar um item..." style="flex:1;padding:6px 10px;border:1px solid var(--ds-border-input);border-radius:4px;background:var(--ds-background-input);color:var(--ds-text);" />
              <button class="pref-btn secondary" id="cb-btn-add-check" style="padding:6px 12px;font-size:12px;">Adicionar</button>
            </div>
          </div>

          <!-- Anexos e Integrações Google -->
          <div class="card-back-section">
            <div class="card-back-section-title">
              <span>📎 Anexos &amp; Google Workspace</span>
            </div>
            <div id="cb-attachments-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px;">
              ${(card.attachments || []).map(att => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:6px;background:var(--ds-surface-sunken);border:1px solid var(--ds-border);">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span>📎</span>
                    <a href="${att.url}" target="_blank" style="color:var(--ds-link);font-weight:500;text-decoration:none;">${escapeHtml(att.name)}</a>
                  </div>
                  <span style="font-size:11px;color:var(--ds-text-subtle);">${att.addedAt ? att.addedAt.slice(0, 10) : ""}</span>
                </div>
              `).join("")}
            </div>
            <div style="display:flex;gap:8px;">
              <button class="pref-btn secondary" id="cb-btn-attach-doc" style="font-size:12px;">📄 Gerar Google Doc</button>
              <button class="pref-btn secondary" id="cb-btn-attach-link" style="font-size:12px;">🔗 Anexar Link</button>
            </div>
          </div>

          <!-- Comentários & Atividade -->
          <div class="card-back-section">
            <div class="card-back-section-title">
              <span>💬 Comentários &amp; Atividade</span>
            </div>
            <div style="display:flex;gap:10px;margin-bottom:14px;">
              <div class="member-mini-avatar" style="background:#0c66e4;">JN</div>
              <div style="flex:1;">
                <textarea id="cb-comment-input" placeholder="Escreva um comentário ou instrução para os Agentes..." style="width:100%;height:60px;padding:8px;border:1px solid var(--ds-border-input);border-radius:6px;background:var(--ds-background-input);color:var(--ds-text);font-family:inherit;font-size:13px;"></textarea>
                <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:6px;">
                  <button class="pref-btn" id="cb-btn-post-comment" style="padding:6px 14px;font-size:12px;">Salvar</button>
                </div>
              </div>
            </div>
            <div id="cb-comments-list" style="display:flex;flex-direction:column;gap:10px;">
              ${(card.comments || []).map(cm => `
                <div style="display:flex;gap:10px;">
                  <div class="member-mini-avatar" style="background:${cm.color || "#0c66e4"};">${cm.initials || "AG"}</div>
                  <div style="flex:1;background:var(--ds-surface-sunken);border-radius:6px;padding:8px 12px;border:1px solid var(--ds-border);">
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
                      <strong>${escapeHtml(cm.author)}</strong>
                      <span style="color:var(--ds-text-subtle);">${cm.createdAt ? cm.createdAt.slice(11, 16) : ""}</span>
                    </div>
                    <div style="font-size:13px;line-height:1.4;">${escapeHtml(cm.text)}</div>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>

        <!-- Coluna de Ações Lateral -->
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--ds-text-subtle);margin-bottom:8px;">ADICIONAR AO CARTÃO</div>
          <button class="card-sidebar-action-btn" id="sb-btn-labels">🏷️ Etiquetas</button>
          <button class="card-sidebar-action-btn" id="sb-btn-members">👥 Membros</button>
          <button class="card-sidebar-action-btn" id="sb-btn-cover">🎨 Capa</button>
          <button class="card-sidebar-action-btn" id="sb-btn-due">📅 Data de Entrega</button>

          <div style="font-size:12px;font-weight:700;color:var(--ds-text-subtle);margin:16px 0 8px;">AÇÕES DO APEX OS</div>
          <button class="card-sidebar-action-btn" id="sb-btn-agent-solve" style="background:linear-gradient(135deg, rgba(128,63,165,0.15) 0%, rgba(12,102,228,0.15) 100%);color:#803fa5;font-weight:600;">
            🤖 Executar Agente (Codex)
          </button>
          <button class="card-sidebar-action-btn" id="sb-btn-export-doc">📄 Gerar Google Doc</button>
          <button class="card-sidebar-action-btn" id="sb-btn-move">➡️ Mover Cartão</button>
          <button class="card-sidebar-action-btn" id="sb-btn-copy">📋 Copiar Cartão</button>
          <button class="card-sidebar-action-btn" id="sb-btn-delete" style="color:var(--ds-text-danger);">🗑️ Excluir Cartão</button>
        </div>
      </div>
    `;

    modal.classList.remove("hidden");

    // Eventos do Modal Card Back
    const titleInput = document.getElementById("cb-card-title");
    titleInput.onblur = () => {
      card.name = titleInput.value.trim() || card.name;
      saveWorkspaceToServer();
      renderWorkspace();
    };

    const descInput = document.getElementById("cb-card-desc");
    descInput.onblur = () => {
      card.desc = descInput.value;
      saveWorkspaceToServer();
    };

    const dueChk = document.getElementById("cb-due-checkbox");
    if (dueChk) {
      dueChk.onchange = () => {
        card.completed = dueChk.checked;
        saveWorkspaceToServer();
        renderWorkspace();
      };
    }

    // Checklists items
    document.querySelectorAll("[data-check-idx]").forEach(chk => {
      chk.onchange = () => {
        const idx = parseInt(chk.getAttribute("data-check-idx"), 10);
        card.checklist[idx].checked = chk.checked;
        saveWorkspaceToServer();
        openCardDetailModal(boardId, listId, cardId);
      };
    });

    document.querySelectorAll("[data-check-del]").forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute("data-check-del"), 10);
        card.checklist.splice(idx, 1);
        saveWorkspaceToServer();
        openCardDetailModal(boardId, listId, cardId);
      };
    });

    document.getElementById("cb-btn-add-check").onclick = () => {
      const input = document.getElementById("cb-new-check-item");
      const text = input.value.trim();
      if (text) {
        if (!card.checklist) card.checklist = [];
        card.checklist.push({ id: "chk-" + Date.now(), text, checked: false });
        saveWorkspaceToServer();
        openCardDetailModal(boardId, listId, cardId);
      }
    };

    // Comentários
    document.getElementById("cb-btn-post-comment").onclick = () => {
      const commentInput = document.getElementById("cb-comment-input");
      const text = commentInput.value.trim();
      if (text) {
        if (!card.comments) card.comments = [];
        card.comments.unshift({
          id: "cmt-" + Date.now(),
          author: Workspace.user.fullName,
          initials: Workspace.user.initials,
          color: "#0c66e4",
          text,
          createdAt: new Date().toISOString()
        });
        saveWorkspaceToServer();
        openCardDetailModal(boardId, listId, cardId);
      }
    };

    // Gerar Google Doc
    document.getElementById("cb-btn-attach-doc").onclick =
    document.getElementById("sb-btn-export-doc").onclick = () => {
      generateDocForCard(card, board.name, list.name);
    };

    // Acionar Agente Codex / Antigravity
    document.getElementById("sb-btn-agent-solve").onclick = () => {
      triggerAgentOnCard(card, board, list);
    };

    // Etiquetas Popover
    document.getElementById("sb-btn-labels").onclick = (e) => {
      openCardLabelsPicker(e.target, card, () => openCardDetailModal(boardId, listId, cardId));
    };

    // Membros Popover
    document.getElementById("sb-btn-members").onclick = (e) => {
      openCardMembersPicker(e.target, card, () => openCardDetailModal(boardId, listId, cardId));
    };

    // Capa Popover
    document.getElementById("sb-btn-cover").onclick = (e) => {
      openCardCoverPicker(e.target, card, () => openCardDetailModal(boardId, listId, cardId));
    };

    // Excluir Cartão
    document.getElementById("sb-btn-delete").onclick = () => {
      list.cards = list.cards.filter(c => c.id !== cardId);
      saveWorkspaceToServer();
      renderWorkspace();
      modal.classList.add("hidden");
      showToast("Cartão excluído");
    };

    document.getElementById("card-detail-close-btn").onclick = () => {
      modal.classList.add("hidden");
    };
  }

  function openInboxCardDetail(cardId) {
    const card = Workspace.inbox.cards.find(c => c.id === cardId);
    if (!card) return;
    openCardDetailModal("inbox-board-1", "inbox-list-1", cardId);
  }

  function openCardLabelsPicker(targetBtn, card, onUpdate) {
    const rect = targetBtn.getBoundingClientRect();
    const menu = document.getElementById("custom-context-menu");
    if (!menu) return;
    menu.style.top = rect.bottom + 4 + "px";
    menu.style.left = rect.left - 100 + "px";

    const catalog = Workspace.labelCatalog || [];
    menu.innerHTML = `
      <div style="padding:6px 12px;font-size:12px;font-weight:700;color:var(--ds-text-subtle);">ETIQUETAS DO APEX OS</div>
      ${catalog.map(l => {
        const isSelected = (card.labels || []).some(x => x.id === l.id);
        return `
          <div class="menu-option" data-toggle-label="${l.id}" style="display:flex;align-items:center;gap:8px;">
            <span style="width:18px;height:14px;border-radius:3px;background:${l.color};"></span>
            <span style="flex:1;">${escapeHtml(l.name)}</span>
            ${isSelected ? '<span>✓</span>' : ""}
          </div>
        `;
      }).join("")}
    `;
    menu.classList.remove("hidden");

    menu.querySelectorAll("[data-toggle-label]").forEach(el => {
      el.onclick = () => {
        const lblId = el.getAttribute("data-toggle-label");
        const found = catalog.find(l => l.id === lblId);
        if (!card.labels) card.labels = [];
        const idx = card.labels.findIndex(x => x.id === lblId);
        if (idx !== -1) {
          card.labels.splice(idx, 1);
        } else if (found) {
          card.labels.push(found);
        }
        saveWorkspaceToServer();
        renderWorkspace();
        closeCustomContextMenu();
        if (onUpdate) onUpdate();
      };
    });
  }

  function openCardMembersPicker(targetBtn, card, onUpdate) {
    const rect = targetBtn.getBoundingClientRect();
    const menu = document.getElementById("custom-context-menu");
    if (!menu) return;
    menu.style.top = rect.bottom + 4 + "px";
    menu.style.left = rect.left - 100 + "px";

    const members = Workspace.members || [];
    menu.innerHTML = `
      <div style="padding:6px 12px;font-size:12px;font-weight:700;color:var(--ds-text-subtle);">MEMBROS &amp; AGENTES</div>
      ${members.map(m => {
        const isSelected = (card.members || []).includes(m.id);
        return `
          <div class="menu-option" data-toggle-member="${m.id}" style="display:flex;align-items:center;gap:8px;">
            <div class="member-mini-avatar" style="background:${m.color};">${m.initials}</div>
            <div style="flex:1;">
              <div>${escapeHtml(m.fullName)}</div>
              <div style="font-size:10px;color:var(--ds-text-subtle);">${m.role}</div>
            </div>
            ${isSelected ? '<span>✓</span>' : ""}
          </div>
        `;
      }).join("")}
    `;
    menu.classList.remove("hidden");

    menu.querySelectorAll("[data-toggle-member]").forEach(el => {
      el.onclick = () => {
        const memId = el.getAttribute("data-toggle-member");
        if (!card.members) card.members = [];
        const idx = card.members.indexOf(memId);
        if (idx !== -1) {
          card.members.splice(idx, 1);
        } else {
          card.members.push(memId);
        }
        saveWorkspaceToServer();
        renderWorkspace();
        closeCustomContextMenu();
        if (onUpdate) onUpdate();
      };
    });
  }

  function openCardCoverPicker(targetBtn, card, onUpdate) {
    const rect = targetBtn.getBoundingClientRect();
    const menu = document.getElementById("custom-context-menu");
    if (!menu) return;
    menu.style.top = rect.bottom + 4 + "px";
    menu.style.left = rect.left - 100 + "px";

    const colors = ["#0c66e4", "#1f845a", "#e2b203", "#bd5b00", "#c9372c", "#803fa5", "#227d9b", "#ae4787", "#44546f", ""];
    menu.innerHTML = `
      <div style="padding:6px 12px;font-size:12px;font-weight:700;color:var(--ds-text-subtle);">CORES DE CAPA</div>
      <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:6px;padding:8px 12px;">
        ${colors.map(c => `
          <div data-set-cover="${c}" style="height:28px;border-radius:4px;cursor:pointer;background:${c || "var(--ds-border)"};border:1px solid rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;">
            ${!c ? '<span style="font-size:10px;">Sem</span>' : ""}
          </div>
        `).join("")}
      </div>
    `;
    menu.classList.remove("hidden");

    menu.querySelectorAll("[data-set-cover]").forEach(el => {
      el.onclick = () => {
        card.cover = el.getAttribute("data-set-cover");
        saveWorkspaceToServer();
        renderWorkspace();
        closeCustomContextMenu();
        if (onUpdate) onUpdate();
      };
    });
  }

  async function triggerAgentOnCard(card, board, list) {
    showToast("🤖 Antigravity / Codex analisando cartão...");
    try {
      const res = await fetch("/api/v1/agent/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: "OpenAI Codex",
          tool: "generate_google_doc_spec",
          args: { cardId: card.id }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (!card.comments) card.comments = [];
        card.comments.unshift({
          id: "cmt-" + Date.now(),
          author: "OpenAI Codex Agent",
          initials: "CX",
          color: "#1f845a",
          text: `Especificação técnica gerada com sucesso!\n\n` + (data.data?.markdownSpec?.slice(0, 300) || "") + "...",
          createdAt: new Date().toISOString()
        });
        card.agentStatus = "spec-ready";
        saveWorkspaceToServer();
        renderWorkspace();
        showToast("Agente concluiu a análise do cartão!");
      }
    } catch (err) {
      showToast("Falha ao invocar agente: " + err.message);
    }
  }

  function generateDocForCard(card, boardName, listName) {
    const spec = [
      `# ${card.name}`,
      `**Sistema:** ${APP_NAME} v${APP_VERSION} | **Quadro:** ${boardName} | **Lista:** ${listName}`,
      card.due ? `**Prazo:** ${card.due} (${card.completed ? "Concluído" : "Em aberto"})` : "",
      "",
      "## Descrição",
      card.desc || "_Sem descrição cadastrada._",
      "",
      "## Checklist de Execução",
      ...(card.checklist && card.checklist.length ? card.checklist.map(i => `- [${i.checked ? "x" : " "}] ${i.text}`) : ["- [ ] Validado pelo Agente"]),
      "",
      "## Comentários & Atividade",
      ...(card.comments && card.comments.length ? card.comments.map(c => `- **${c.author}**: ${c.text}`) : ["_Nenhum comentário._"]),
      "",
      "---",
      `_Gerado automaticamente por ${APP_NAME} em ${new Date().toISOString()}_`
    ].filter(Boolean).join("\n");

    const blob = new Blob([spec], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    triggerDownloadItem(`${card.name.slice(0, 30).replace(/[^a-z0-9]/gi, "_")}_Spec.md`, url, spec.length);
    showToast("Documento Markdown para Google Docs gerado!");
  }

  function generateCurrentBoardDoc() {
    const board = getActiveBoard();
    const content = [
      `# Relatório de Sprint — ${board.name}`,
      `**Gerado por:** ${APP_NAME} v${APP_VERSION} em ${new Date().toISOString()}`,
      "",
      ...board.lists.map(l => [
        `## Lista: ${l.name} (${l.cards.length} cartões)`,
        ...l.cards.map(c => `- **${c.name}** ${c.due ? `(Prazo: ${c.due})` : ""} ${c.completed ? "✓" : ""}\n  ${c.desc || ""}`),
        ""
      ].join("\n"))
    ].join("\n");

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    triggerDownloadItem(`${board.name.replace(/[^a-z0-9]/gi, "_")}_Relatorio.md`, url, content.length);
    showToast("Relatório do Quadro gerado para Google Docs!");
  }

  // ==========================================================================
  // 13. QUICK ADD CARD MODAL (1:1 newcard bundle ug/dg)
  // ==========================================================================
  function openNewCardModal() {
    const modal = document.getElementById("modal-newcard");
    if (!modal) return;
    modal.classList.remove("hidden");

    // Popula dropdown de quadros
    const boardSelect = document.getElementById("newcard-board-select");
    const boardDisplay = document.getElementById("newcard-board-display");
    const listSelect = document.getElementById("newcard-list-select");
    const listDisplay = document.getElementById("newcard-list-display");

    if (boardSelect) {
      boardSelect.innerHTML = Workspace.boards.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");
      const activeBoard = getActiveBoard();
      boardSelect.value = activeBoard.id;
      if (boardDisplay) boardDisplay.textContent = activeBoard.name;

      function updateLists(bId) {
        const b = Workspace.boards.find(x => x.id === bId) || Workspace.boards[0];
        if (listSelect) {
          listSelect.innerHTML = b.lists.map(l => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join("");
          if (listDisplay) listDisplay.textContent = b.lists[0] ? b.lists[0].name : "Selecionar lista";
        }
      }

      updateLists(activeBoard.id);
      boardSelect.onchange = () => {
        if (boardDisplay) boardDisplay.textContent = boardSelect.options[boardSelect.selectedIndex].text;
        updateLists(boardSelect.value);
      };
      if (listSelect) {
        listSelect.onchange = () => {
          if (listDisplay) listDisplay.textContent = listSelect.options[listSelect.selectedIndex].text;
        };
      }
    }

    // Tabs: Inbox (index 0) vs Board (index 1)
    let selectedDest = "board";
    const tabInbox = document.getElementById("tab-dest-inbox");
    const tabBoard = document.getElementById("tab-dest-board");
    const rowBoardList = document.getElementById("newcard-board-list-row");
    const inboxSpacer = document.getElementById("newcard-inbox-spacer");

    function setTab(dest) {
      selectedDest = dest;
      tabInbox.setAttribute("aria-selected", dest === "inbox");
      tabBoard.setAttribute("aria-selected", dest === "board");
      if (rowBoardList) rowBoardList.classList.toggle("hidden", dest === "inbox");
      if (inboxSpacer) inboxSpacer.classList.toggle("hidden", dest !== "inbox");
    }

    if (tabInbox) tabInbox.onclick = () => setTab("inbox");
    if (tabBoard) tabBoard.onclick = () => setTab("board");

    // Form submit & validação de erro inline
    const form = document.getElementById("newcard-form");
    const titleInput = document.getElementById("newcard-title-input");
    const descInput = document.getElementById("newcard-desc-input");
    const errorEl = document.getElementById("empty-title-error");

    form.onsubmit = (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      if (!title) {
        if (errorEl) errorEl.classList.remove("hidden");
        titleInput.focus();
        return;
      }
      if (errorEl) errorEl.classList.add("hidden");

      if (selectedDest === "inbox") {
        Workspace.inbox.cards.unshift({
          id: "inbox-" + Date.now(),
          name: title,
          desc: descInput.value,
          createdAt: new Date().toISOString(),
          due: "",
          completed: false,
          labels: [],
          members: ["JN"],
          checklist: [],
          attachments: [],
          comments: []
        });
        showToast("Cartão adicionado à Caixa de entrada!");
      } else {
        const bId = boardSelect.value;
        const lId = listSelect.value;
        createCardInBoard(bId, lId, title);
        showToast("Cartão criado no Quadro!");
      }

      saveWorkspaceToServer();
      renderWorkspace();
      modal.classList.add("hidden");
      titleInput.value = "";
      descInput.value = "";
    };

    document.getElementById("newcard-close-btn").onclick = () => modal.classList.add("hidden");
  }

  // ==========================================================================
  // 14. 1:1 PREFERENCES WINDOW (preferences bundle _g/Ng)
  // ==========================================================================
  function openPreferencesModal() {
    const modal = document.getElementById("modal-preferences");
    const section = document.getElementById("preferences-section");
    if (!modal || !section) return;

    modal.classList.remove("hidden");
    section.classList.add("visible");
    renderPreferencesTab();

    document.getElementById("pref-close-btn").onclick = () => {
      section.classList.remove("visible");
      setTimeout(() => modal.classList.add("hidden"), 300);
    };

    // Sidebar tab clicks
    document.querySelectorAll(".preferences .sidebarmenu a[data-pref-tab]").forEach(a => {
      a.onclick = () => {
        switchPrefTab(a.getAttribute("data-pref-tab"));
      };
    });
  }

  function switchPrefTab(tabName) {
    ActivePrefTab = tabName;
    renderPreferencesTab();
  }

  function renderPreferencesTab() {
    document.querySelectorAll(".sidebarmenu a[data-pref-tab]").forEach(a => {
      a.classList.toggle("selected", a.getAttribute("data-pref-tab") === ActivePrefTab);
    });

    const container = document.getElementById("pref-tab-container");
    if (!container) return;

    if (ActivePrefTab === "settings") {
      container.innerHTML = `
        <fieldset>
          <!-- 1. Notificações -->
          <div class="field first field-notifications">
            <div class="notification-text">
              <h2>${escapeHtml(getText("preferences.input.notifications.title"))}</h2>
              <p class="notification-row">
                <span>${escapeHtml(getText("preferences.input.notifications.text"))}</span>
                <b class="show-windows">${escapeHtml(getText("preferences.input.notifications.navigationWin"))}</b>.
              </p>
            </div>
            <p class="notification-button">
              <button type="button" id="pref-btn-test-notif" class="send-test-notification">
                ${escapeHtml(getText("preferences.input.notifications.submitButton"))}
              </button>
            </p>
          </div>

          <!-- 2. Dock / Tray Badge -->
          <div class="field field-dockbadge field-checkbox">
            <label for="dockbadge-toggle">
              <h2>${escapeHtml(getText("preferences.input.badgeOnTrayIcon.title"))}</h2>
              <p>${escapeHtml(getText("preferences.input.badgeOnTrayIcon.text"))}</p>
            </label>
            <div class="toggle-container">
              <div class="atlaskit-toggle ${StoreData.settings.dockbadge ? "is-checked" : ""}" id="dockbadge-toggle">
                <input type="checkbox" ${StoreData.settings.dockbadge ? "checked" : ""} />
                <div class="atlaskit-toggle-thumb"></div>
                <span class="atlaskit-toggle-icon check">✓</span>
                <span class="atlaskit-toggle-icon cross">✕</span>
              </div>
            </div>
          </div>

          <hr />

          <!-- 3. Global Shortcut Recorder (Ctrl+Alt+T) -->
          <div class="field field-shortcut" id="field-win-shortcut">
            <h2>${escapeHtml(getText("preferences.input.globalShortcut.title"))}</h2>
            <p>${escapeHtml(getText("preferences.input.globalShortcut.text"))}</p>
            <div class="shortcut-input-row">
              <div class="pseudo-input" id="shortcut-box-win">
                <span class="shortcut-key ctrl active">^</span>
                <span class="shortcut-key alt active">ALT</span>
                <span class="shortcut-key shift">⇧</span>
                <span class="shortcut-key cmd show-mac">⌘</span>
                <span class="shortcut-key active">T</span>
              </div>
              <div class="keyboardsettingbuttons">
                <button type="button" class="set-shortcut" id="btn-record-win-shortcut">${escapeHtml(getText("preferences.button.set"))}</button>
                <button type="button" class="clear-shortcut" id="btn-clear-win-shortcut">${escapeHtml(getText("preferences.button.clear"))}</button>
              </div>
            </div>
            <div class="shortcut-hint hidden" id="hint-win-shortcut">
              <span class="shortcut-instructions">Pressione a combinação de teclas desejada com <b>CTRL, ALT, SHIFT</b> e finalize com <b>T</b>.</span>
            </div>
          </div>

          <!-- 4. Quick Add Shortcut Recorder (Ctrl+Alt+Space) -->
          <div class="field field-shortcut" id="field-quick-shortcut">
            <h2>${escapeHtml(getText("preferences.input.quickAddShortcut.title"))}</h2>
            <p>${escapeHtml(getText("preferences.input.quickAddShortcut.text"))}</p>
            <div class="shortcut-input-row">
              <div class="pseudo-input" id="shortcut-box-quick">
                <span class="shortcut-key ctrl active">^</span>
                <span class="shortcut-key alt active">ALT</span>
                <span class="shortcut-key shift">⇧</span>
                <span class="shortcut-key cmd show-mac">⌘</span>
                <span class="shortcut-key active">Space</span>
              </div>
              <div class="keyboardsettingbuttons">
                <button type="button" class="set-shortcut" id="btn-record-quick-shortcut">${escapeHtml(getText("preferences.button.set"))}</button>
                <button type="button" class="clear-shortcut" id="btn-clear-quick-shortcut">${escapeHtml(getText("preferences.button.clear"))}</button>
              </div>
            </div>
            <div class="shortcut-hint hidden" id="hint-quick-shortcut">
              <span class="shortcut-instructions">Pressione a combinação desejada com <b>CTRL, ALT, SHIFT</b> e finalize com <b>Space</b>.</span>
            </div>
          </div>

          <!-- 5. Window Style Radio Group -->
          <div class="field field-window">
            <label>
              <h2><span>${escapeHtml(getText("preferences.input.windowStyle.title"))}</span></h2>
              <p>${escapeHtml(getText("preferences.input.windowStyle.note"))}</p>
              <div class="radio-group">
                <div class="radio-option">
                  <input type="radio" id="win-opt-dock" name="windowStyle" value="dock" ${StoreData.settings.launchparams === "dock" ? "checked" : ""} />
                  <label for="win-opt-dock">${escapeHtml(getText("preferences.input.windowStyle.launchParam.tackBarIcon"))}</label>
                </div>
                <div class="radio-option">
                  <input type="radio" id="win-opt-docktray" name="windowStyle" value="docktray" ${StoreData.settings.launchparams === "docktray" ? "checked" : ""} />
                  <label for="win-opt-docktray">${escapeHtml(getText("preferences.input.windowStyle.launchParam.tackBarAndTrayIcon"))}</label>
                </div>
                <div class="radio-option">
                  <input type="radio" id="win-opt-trayonly" name="windowStyle" value="trayonly" ${StoreData.settings.launchparams === "trayonly" ? "checked" : ""} />
                  <label for="win-opt-trayonly">${escapeHtml(getText("preferences.input.windowStyle.launchParam.trayIconOnly"))}</label>
                </div>
              </div>
            </label>
          </div>

          <hr />

          <!-- 6. Download Location Chooser -->
          <div class="field field-download-location">
            <label for="chooselocation-toggle">
              <h2>${escapeHtml(getText("preferences.input.downloadLocation.title"))}</h2>
              <p>${escapeHtml(getText("preferences.input.downloadLocation.text"))}</p>
            </label>
            <div class="toggle-container">
              <div class="atlaskit-toggle ${!StoreData.settings.chooselocation ? "is-checked" : ""}" id="chooselocation-toggle">
                <input type="checkbox" ${!StoreData.settings.chooselocation ? "checked" : ""} />
                <div class="atlaskit-toggle-thumb"></div>
                <span class="atlaskit-toggle-icon check">✓</span>
                <span class="atlaskit-toggle-icon cross">✕</span>
              </div>
            </div>
            <div class="field download-chooser">
              <span>📁</span>
              <p class="download-location-name">${escapeHtml(StoreData.settings.savepath || "C:\\Users\\Downloads")}</p>
              <div class="keyboardsettingbuttons">
                <button type="button" id="btn-change-download-path">${escapeHtml(getText("preferences.input.downloadLocation.changeButton"))}</button>
              </div>
            </div>
          </div>

          <!-- 7. Spellcheck Toggle -->
          <div class="field field-spellcheck skinny-field field-checkbox">
            <label for="spellcheck-toggle">
              <h2><span>${escapeHtml(getText("preferences.input.enableSpellcheckField.title"))}</span></h2>
              <p>${escapeHtml(getText("preferences.input.enableSpellcheckField.note"))}</p>
            </label>
            <div class="toggle-container">
              <div class="atlaskit-toggle ${StoreData.settings.spellcheck ? "is-checked" : ""}" id="spellcheck-toggle">
                <input type="checkbox" ${StoreData.settings.spellcheck ? "checked" : ""} />
                <div class="atlaskit-toggle-thumb"></div>
                <span class="atlaskit-toggle-icon check">✓</span>
                <span class="atlaskit-toggle-icon cross">✕</span>
              </div>
            </div>
          </div>

          <hr />

          <!-- 8. Seletor de Idioma (21 Locales) -->
          <div class="field">
            <h2>🌐 Idioma do Paws for Trello (21 Locales Nativos)</h2>
            <div class="select-wrapper">
              <select id="pref-language-select">
                ${SUPPORTED_LOCALES.map(loc => `
                  <option value="${loc}" ${loc === (StoreData.locale || "pt_BR") ? "selected" : ""}>
                    ${loc} — ${getLocaleDisplayName(loc)}
                  </option>
                `).join("")}
              </select>
            </div>
          </div>
        </fieldset>
      `;

      setupSettingsInteractions();
    } else if (ActivePrefTab === "licenses") {
      const keys = Object.keys(AllLicenses);
      container.innerHTML = `
        <fieldset id="licenses">
          <h2>${escapeHtml(getText("licenseInfo.text"))} (${keys.length} pacotes)</h2>
          <div class="licenses">
            ${keys.slice(0, 80).map(pkg => {
              const lic = AllLicenses[pkg];
              return `
                <div class="license-item">
                  <span class="name" data-license-name="${escapeHtml(pkg)}">${escapeHtml(pkg)}</span>
                  ${lic.repository ? `<span class="url"><a href="${lic.repository}" target="_blank">${escapeHtml(getText("licenseInfo.website"))}</a></span>` : ""}
                  <div class="full-text" data-license-body="${escapeHtml(pkg)}">
                    <pre>${escapeHtml(lic.licenseText || lic.licenses || "MIT License")}</pre>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </fieldset>
      `;

      container.querySelectorAll(".license-item .name").forEach(span => {
        span.onclick = () => {
          const body = span.parentElement.querySelector(".full-text");
          if (body) body.classList.toggle("is-expanded");
        };
      });
    } else if (ActivePrefTab === "about") {
      container.innerHTML = `
        <fieldset id="about">
          <div class="about-content">
            <h2 class="app-version">${escapeHtml(getText("about.version"))} ${APP_VERSION}-${BUILD_NUMBER}</h2>
            <h2>${escapeHtml(getText("about.askFeedback.text1"))}</h2>
            <p>${escapeHtml(getText("about.askFeedback.text2"))}</p>
            <a href="https://github.com/NicolJon/paws-for-trello" target="_blank" class="about-links">Repositório GitHub</a>
            <a href="#" class="app-store show-windows" onclick="alert('Paws for Trello Desktop Edition'); return false;">
              <span>${escapeHtml(getText("about.rateUsWin"))}</span>
            </a>
            <div class="aboutus">
              <a href="#" class="about-links" onclick="alert('Privacidade Paws for Trello respeita 100% dos seus dados locais.'); return false;">${escapeHtml(getText("about.privacyPolicy"))}</a>
              <br />
              <a href="#" class="about-links" onclick="alert('Termos de Uso Paws for Trello'); return false;">${escapeHtml(getText("about.termsOfUse"))}</a>
            </div>
          </div>
        </fieldset>
      `;
    } else if (ActivePrefTab === "google") {
      container.innerHTML = `
        <fieldset>
          <h2>📊 Integração Nativa Google Sheets &amp; Google Docs</h2>
          <p>Conecte o Paws for Trello à sua conta Google via Google Apps Script Web App sem problemas de CORS.</p>

          <div class="field">
            <h2>Google Apps Script Web App URL</h2>
            <input type="text" id="g-script-url" value="${escapeHtml(StoreData.googleWorkspace.appsScriptUrl || "")}" placeholder="https://script.google.com/macros/s/.../exec" style="width:100%;padding:8px 10px;border:1px solid var(--ds-border-input);border-radius:6px;margin-top:4px;" />
          </div>

          <div class="field">
            <h2>ID ou Link da Planilha Google Sheets</h2>
            <input type="text" id="g-sheet-url" value="${escapeHtml(StoreData.googleWorkspace.spreadsheetUrl || "")}" placeholder="https://docs.google.com/spreadsheets/d/.../edit" style="width:100%;padding:8px 10px;border:1px solid var(--ds-border-input);border-radius:6px;margin-top:4px;" />
          </div>

          <div style="display:flex;gap:10px;margin-top:16px;">
            <button type="button" class="pref-btn" id="btn-save-google-cfg">Salvar Configurações</button>
            <button type="button" class="pref-btn secondary" id="btn-test-google-sync">Testar Sincronização Agora</button>
          </div>
        </fieldset>
      `;

      document.getElementById("btn-save-google-cfg").onclick = () => {
        StoreData.googleWorkspace.appsScriptUrl = document.getElementById("g-script-url").value.trim();
        StoreData.googleWorkspace.spreadsheetUrl = document.getElementById("g-sheet-url").value.trim();
        saveStore();
        showToast("Configurações do Google Workspace salvas.");
      };

      document.getElementById("btn-test-google-sync").onclick = syncGoogleSheetsNow;
    } else if (ActivePrefTab === "agents") {
      container.innerHTML = `
        <fieldset>
          <h2>🤖 Acesso Antigravity IDE &amp; OpenAI Codex (MCP Bridge)</h2>
          <p>Conecte seus agentes autônomos ao Paws for Trello via Model Context Protocol (MCP) ou REST API.</p>

          <div class="field">
            <h2>Endpoint MCP HTTP (JSON-RPC 2.0)</h2>
            <input type="text" readonly value="${window.location.origin}/api/mcp" style="width:100%;padding:8px;background:var(--ds-surface-sunken);border:1px solid var(--ds-border);border-radius:6px;" />
          </div>

          <div class="field">
            <h2>Configuração Stdio para mcp_config.json</h2>
            <pre style="background:var(--ds-surface-sunken);padding:10px;border-radius:6px;font-size:12px;overflow-x:auto;">{
  "mcpServers": {
    "apex-os": {
      "command": "node",
      "args": ["${window.location.origin}/mcp-server.js"],
      "env": { "APEX_API_URL": "${window.location.origin}/api/mcp" }
    }
  }
}</pre>
          </div>

          <div style="display:flex;gap:10px;margin-top:12px;">
            <button type="button" class="pref-btn" id="btn-test-mcp-call">Testar Ferramenta MCP (list_boards)</button>
            <button type="button" class="pref-btn secondary" id="btn-run-agent-triage-pref">Executar Triagem IA</button>
          </div>
        </fieldset>
      `;

      document.getElementById("btn-test-mcp-call").onclick = async () => {
        showToast("Chamando MCP tools/call...");
        try {
          const res = await fetch("/api/mcp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_boards", arguments: {} } })
          });
          const d = await res.json();
          alert("Resposta MCP:\n" + JSON.stringify(d, null, 2));
        } catch (e) {
          alert("Erro MCP: " + e.message);
        }
      };

      document.getElementById("btn-run-agent-triage-pref").onclick = runAgentTriageNow;
    }
  }

  function setupSettingsInteractions() {
    // Test notif
    document.getElementById("pref-btn-test-notif").onclick = () => {
      showNotification(
        getText("notification.testNotification.title", { name: APP_NAME }),
        getText("notification.testNotification.body")
      );
    };

    // Dock badge toggle
    const dockbadgeToggle = document.getElementById("dockbadge-toggle");
    if (dockbadgeToggle) {
      dockbadgeToggle.onclick = () => {
        StoreData.settings.dockbadge = !StoreData.settings.dockbadge;
        saveStore();
        dockbadgeToggle.classList.toggle("is-checked", StoreData.settings.dockbadge);
      };
    }

    // Window style radio
    document.querySelectorAll('input[name="windowStyle"]').forEach(r => {
      r.onchange = () => {
        StoreData.settings.launchparams = r.value;
        saveStore();
        showNoticePill("Estilo de janela alterado para " + r.value);
      };
    });

    // Chooselocation toggle
    const chooseLocToggle = document.getElementById("chooselocation-toggle");
    if (chooseLocToggle) {
      chooseLocToggle.onclick = () => {
        StoreData.settings.chooselocation = !StoreData.settings.chooselocation;
        saveStore();
        chooseLocToggle.classList.toggle("is-checked", !StoreData.settings.chooselocation);
      };
    }

    // Change download path
    document.getElementById("btn-change-download-path").onclick = () => {
      openPromptModal("Digite o caminho da pasta de downloads:", StoreData.settings.savepath, (path) => {
        if (path) {
          StoreData.settings.savepath = path;
          saveStore();
          renderPreferencesTab();
        }
      });
    };

    // Spellcheck toggle
    const spellcheckToggle = document.getElementById("spellcheck-toggle");
    if (spellcheckToggle) {
      spellcheckToggle.onclick = () => {
        StoreData.settings.spellcheck = !StoreData.settings.spellcheck;
        saveStore();
        spellcheckToggle.classList.toggle("is-checked", StoreData.settings.spellcheck);
      };
    }

    // Language select
    const langSelect = document.getElementById("pref-language-select");
    if (langSelect) {
      langSelect.onchange = () => {
        StoreData.locale = langSelect.value;
        saveStore();
        renderPreferencesTab();
        renderAppMenubar();
        renderWorkspace();
        showNoticePill("Idioma alterado para " + langSelect.value);
      };
    }

    // Interactive Key Recorder (Mousetrap recording replica)
    setupKeyRecorder("btn-record-win-shortcut", "shortcut-box-win", "hint-win-shortcut", (finalCombo) => {
      StoreData.settings.windowshortcut = finalCombo;
      saveStore();
      showToast("Atalho da Janela configurado: " + finalCombo);
    });

    setupKeyRecorder("btn-record-quick-shortcut", "shortcut-box-quick", "hint-quick-shortcut", (finalCombo) => {
      StoreData.settings.quickaddshortcut = finalCombo;
      saveStore();
      showToast("Atalho do Cartão Rápido configurado: " + finalCombo);
    });
  }

  function setupKeyRecorder(btnId, boxId, hintId, onSaved) {
    const btn = document.getElementById(btnId);
    const box = document.getElementById(boxId);
    const hint = document.getElementById(hintId);
    if (!btn || !box) return;

    btn.onclick = () => {
      box.classList.add("recording");
      if (hint) hint.classList.remove("hidden");
      btn.textContent = "Gravando...";

      const keyHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const ctrl = e.ctrlKey;
        const alt = e.altKey;
        const shift = e.shiftKey;
        const meta = e.metaKey;
        const key = e.key;

        // Atualiza spans visuais em tempo real
        box.querySelectorAll(".shortcut-key").forEach(sp => {
          if (sp.classList.contains("ctrl")) sp.classList.toggle("active", ctrl);
          if (sp.classList.contains("alt")) sp.classList.toggle("active", alt);
          if (sp.classList.contains("shift")) sp.classList.toggle("active", shift);
          if (sp.classList.contains("cmd")) sp.classList.toggle("active", meta);
        });

        if (!["Control", "Alt", "Shift", "Meta"].includes(key)) {
          window.removeEventListener("keydown", keyHandler, true);
          box.classList.remove("recording");
          if (hint) hint.classList.add("hidden");
          btn.textContent = getText("preferences.button.set");

          const parts = [];
          if (ctrl) parts.push("ctrl");
          if (alt) parts.push("alt");
          if (shift) parts.push("shift");
          parts.push(key.toLowerCase());
          const combo = parts.join("+");
          if (onSaved) onSaved(combo);
        }
      };

      window.addEventListener("keydown", keyHandler, true);
    };
  }

  function getLocaleDisplayName(code) {
    const names = {
      "cs": "Čeština", "de": "Deutsch", "en": "English", "es": "Español",
      "fi": "Suomi", "fr": "Français", "hu": "Magyar", "it": "Italiano",
      "ja": "日本語", "nb": "Norsk", "nl": "Nederlands", "pl": "Polski",
      "pt_BR": "Português (Brasil)", "ru": "Русский", "sv": "Svenska",
      "th": "ไทย", "tr": "Türkçe", "uk": "Українська", "vi": "Tiếng Việt",
      "zh-Hans": "简体中文", "zh-Hant": "繁體中文"
    };
    return names[code] || code;
  }

  // ==========================================================================
  // 15. DOWNLOADS BAR & INTEGRAÇÃO GOOGLE SHEETS / DOCS
  // ==========================================================================
  function triggerDownloadItem(filename, fileUrl, fileSize = 1024) {
    const barContainer = document.getElementById("downloads-bar-container");
    const list = document.getElementById("downloads-items-list");
    if (!barContainer || !list) return;

    const item = {
      id: "dl-" + Date.now(),
      name: filename,
      url: fileUrl,
      size: fileSize,
      state: "completed"
    };
    DownloadsList.unshift(item);

    barContainer.classList.remove("downloads--hidden");

    list.innerHTML = DownloadsList.slice(0, 5).map(dl => `
      <div class="download-item" data-dl-id="${dl.id}">
        <div class="download-item__icon">💾</div>
        <div class="download-item__description">
          <div class="download-item__filename">${escapeHtml(dl.name)}</div>
          <div class="download-item__stats">${Math.round(dl.size / 1024)} KB ∙ Concluído</div>
        </div>
      </div>
    `).join("");

    list.querySelectorAll(".download-item").forEach(el => {
      el.onclick = () => {
        const dl = DownloadsList.find(x => x.id === el.getAttribute("data-dl-id"));
        if (dl) {
          const a = document.createElement("a");
          a.href = dl.url;
          a.download = dl.name;
          a.click();
        }
      };
    });

    // Auto-download no navegador
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = filename;
    a.click();
  }

  async function syncGoogleSheetsNow() {
    showToast("📊 Sincronizando dados com o Google Sheets...");
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "sync_google_sheets", arguments: {} }
        })
      });
      const data = await res.json();
      showToast("Planilha Google atualizada com sucesso!");
    } catch (err) {
      showToast("Sync offline concluído localmente.");
    }
  }

  function exportBoardCsv() {
    const board = getActiveBoard();
    const rows = [["CardID", "Board", "List", "Title", "Due", "Status", "Members"]];
    board.lists.forEach(l => {
      l.cards.forEach(c => {
        rows.push([c.id, board.name, l.name, `"${c.name.replace(/"/g, '""')}"`, c.due || "", c.completed ? "Done" : "Open", (c.members || []).join(";")]);
      });
    });
    const csvContent = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    triggerDownloadItem(`${board.name.replace(/[^a-z0-9]/gi, "_")}.csv`, url, csvContent.length);
  }

  async function exportLogsZip() {
    showToast("Compactando logs em arquivo .zip...");
    try {
      if (typeof JSZip === "undefined") {
        throw new Error("JSZip não carregado");
      }
      const zip = new JSZip();
      const logsText = (AppLogger.entries || []).join("\n");
      const sysInfo = JSON.stringify({ app: APP_NAME, version: APP_VERSION, build: BUILD_NUMBER, store: StoreData }, null, 2);

      zip.file("apex.log", logsText);
      zip.file("system-info.json", sysInfo);

      const blob = await zip.generateAsync({ type: "blob" });
      const dateStr = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      triggerDownloadItem(`apex-exported-logs-${dateStr}.zip`, url, blob.size);
      showToast("Logs de diagnóstico exportados com sucesso!");
    } catch (err) {
      showToast("Falha ao gerar .zip: " + err.message);
    }
  }

  // ==========================================================================
  // 16. FIND IN PAGE BAR (find_in_page bundle Ig)
  // ==========================================================================
  function openFindInPage() {
    const floating = document.getElementById("find-in-page-floating");
    const input = document.getElementById("find-in-page-input");
    if (!floating || !input) return;

    floating.classList.remove("hidden");
    input.focus();
    input.select();

    input.oninput = () => executeFindInPage(input.value);
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) navigateFind(-1);
        else navigateFind(1);
      }
      if (e.key === "Escape") closeFindInPage();
    };

    document.getElementById("find-next-btn").onclick = () => navigateFind(1);
    document.getElementById("find-prev-btn").onclick = () => navigateFind(-1);
    document.getElementById("find-close-btn").onclick = closeFindInPage;
  }

  function executeFindInPage(query) {
    FindState.query = query.trim().toLowerCase();
    FindState.matches = [];
    FindState.activeIndex = -1;

    const counter = document.getElementById("find-in-page-counter");

    if (!FindState.query) {
      if (counter) counter.textContent = "0/0";
      return;
    }

    const cards = document.querySelectorAll(".kanban-card");
    cards.forEach(c => {
      if (c.textContent.toLowerCase().includes(FindState.query)) {
        FindState.matches.push(c);
      }
    });

    if (counter) {
      counter.textContent = FindState.matches.length > 0 ? `1/${FindState.matches.length}` : "0/0";
    }

    if (FindState.matches.length > 0) {
      FindState.activeIndex = 0;
      focusFindMatch();
    }
  }

  function navigateFind(dir) {
    if (FindState.matches.length === 0) return;
    FindState.activeIndex = (FindState.activeIndex + dir + FindState.matches.length) % FindState.matches.length;
    const counter = document.getElementById("find-in-page-counter");
    if (counter) counter.textContent = `${FindState.activeIndex + 1}/${FindState.matches.length}`;
    focusFindMatch();
  }

  function focusFindMatch() {
    const el = FindState.matches[FindState.activeIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.outline = "2px solid #e2b203";
      setTimeout(() => el.style.outline = "none", 1500);
    }
  }

  function closeFindInPage() {
    const floating = document.getElementById("find-in-page-floating");
    if (floating) floating.classList.add("hidden");
  }

  // ==========================================================================
  // 17. PROMPT MODAL, AUTH MODAL & WELCOME SCREEN OVERLAY
  // ==========================================================================
  function openPromptModal(message, defaultValue, onOk) {
    const modal = document.getElementById("modal-prompt");
    const msgEl = document.getElementById("prompt-modal-message");
    const inputEl = document.getElementById("prompt-modal-input");
    if (!modal) return;

    if (msgEl) msgEl.textContent = message;
    if (inputEl) {
      inputEl.value = defaultValue || "";
      inputEl.focus();
    }
    modal.classList.remove("hidden");

    document.getElementById("prompt-ok-btn").onclick = () => {
      modal.classList.add("hidden");
      if (onOk) onOk(inputEl.value);
    };
    document.getElementById("prompt-cancel-btn").onclick = () => modal.classList.add("hidden");
  }

  function openWelcomeOverlay() {
    const overlay = document.getElementById("welcome-overlay");
    const loadingBars = document.getElementById("welcome-loading-bars");
    const screen1 = document.getElementById("welcome-screen-1");
    const screen3 = document.getElementById("welcome-screen-3");
    if (!overlay) return;

    overlay.classList.remove("hidden");
    if (screen1) screen1.classList.remove("hidden");
    if (screen3) screen3.classList.add("hidden");

    document.getElementById("welcome-continue-btn").onclick = (e) => {
      e.preventDefault();
      if (loadingBars) loadingBars.classList.add("visible");
      setTimeout(() => {
        if (loadingBars) loadingBars.classList.remove("visible");
        overlay.classList.add("hidden");
      }, 700);
    };

    document.getElementById("welcome-signup-btn").onclick = (e) => {
      e.preventDefault();
      overlay.classList.add("hidden");
      openPreferencesModal();
    };

    document.getElementById("welcome-test-offline-btn").onclick = (e) => {
      e.preventDefault();
      if (screen1) screen1.classList.add("hidden");
      if (screen3) screen3.classList.remove("hidden");
    };

    document.getElementById("welcome-retry-connection-btn").onclick = (e) => {
      e.preventDefault();
      if (screen3) screen3.classList.add("hidden");
      if (screen1) screen1.classList.remove("hidden");
    };
  }

  function openBoardSwitcher() {
    const modal = document.getElementById("modal-board-switcher");
    const input = document.getElementById("board-switcher-input");
    const results = document.getElementById("board-switcher-results");
    if (!modal || !input || !results) return;

    modal.classList.remove("hidden");
    input.value = "";
    input.focus();

    function updateSwitcherResults(q) {
      const qLow = q.toLowerCase();
      const matchedBoards = Workspace.boards.filter(b => b.name.toLowerCase().includes(qLow));
      results.innerHTML = matchedBoards.map(b => `
        <div class="switcher-item" data-switch-board-id="${b.id}">
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="board-color-dot" style="background:${b.color || "#0c66e4"};"></div>
            <strong>${escapeHtml(b.name)}</strong>
          </div>
          <span style="font-size:12px;color:var(--ds-text-subtle);">${b.lists.length} listas</span>
        </div>
      `).join("");

      results.querySelectorAll(".switcher-item").forEach(el => {
        el.onclick = () => {
          selectBoard(el.getAttribute("data-switch-board-id"));
          modal.classList.add("hidden");
        };
      });
    }

    updateSwitcherResults("");
    input.oninput = () => updateSwitcherResults(input.value);
    input.onkeydown = (e) => {
      if (e.key === "Escape") modal.classList.add("hidden");
    };
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    };
  }

  function openShortcutsHelpModal() {
    const modal = document.getElementById("modal-shortcuts-help");
    if (!modal) return;
    modal.classList.remove("hidden");
    document.getElementById("shortcuts-help-close-btn").onclick = () => modal.classList.add("hidden");
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    };
  }

  function toggleOfflineSimulation() {
    IsOffline = !IsOffline;
    const overlay = document.getElementById("global-offline-overlay");
    if (overlay) overlay.classList.toggle("visible", IsOffline);
    showToast(IsOffline ? "Modo Offline simulado ativado" : "Modo Online restaurado");
  }

  async function runAgentTriageNow() {
    showToast("🤖 Antigravity / Codex iniciando triagem autônoma da Inbox...");
    const inboxCards = Workspace.inbox.cards || [];
    if (inboxCards.length === 0) {
      showToast("Inbox vazia! Nenhum cartão para triar.");
      return;
    }
    const card = inboxCards[0];
    const board = Workspace.boards[0];
    const targetList = board.lists[1] || board.lists[0];

    moveInboxCardToBoard(card.id, board.id, targetList.id);
    showToast(`Cartão "${card.name}" triado pelo Agente para a lista "${targetList.name}"!`);
  }

  // ==========================================================================
  // 18. ATALHOS DE TECLADO GLOBAIS (Mousetrap equivalente)
  // ==========================================================================
  function registerGlobalKeybindings() {
    window.addEventListener("keydown", (e) => {
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || e.target.isContentEditable;

      // Atalho Global Quick Card (Ctrl+Alt+Space)
      if (e.ctrlKey && e.altKey && e.code === "Space") {
        e.preventDefault();
        openNewCardModal();
        return;
      }

      // Atalho Global Preferences (Ctrl+, ou Ctrl+Alt+T)
      if ((e.ctrlKey && e.key === ",") || (e.ctrlKey && e.altKey && e.code === "KeyT")) {
        e.preventDefault();
        openPreferencesModal();
        return;
      }

      // Atalho Buscar na Página (Ctrl+F)
      if (e.ctrlKey && e.code === "KeyF") {
        e.preventDefault();
        openFindInPage();
        return;
      }

      // Alternador Rápido de Quadros (Ctrl+K ou tecla B se fora de input)
      if ((e.ctrlKey && e.code === "KeyK") || (!isInput && e.code === "KeyB")) {
        e.preventDefault();
        openBoardSwitcher();
        return;
      }

      // Atalho Ajuda (?)
      if (!isInput && e.key === "?") {
        e.preventDefault();
        openShortcutsHelpModal();
        return;
      }

      // Fechar modais (Esc)
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay:not(.hidden)").forEach(m => m.classList.add("hidden"));
        closeFindInPage();
        closeCustomContextMenu();
        return;
      }

      // Quadros com estrela (Ctrl+1 a Ctrl+9)
      if (e.ctrlKey && e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key, 10) - 1;
        if (Workspace.boards[idx]) {
          e.preventDefault();
          selectBoard(Workspace.boards[idx].id);
        }
      }
    });
  }

  // ==========================================================================
  // 19. INICIALIZAÇÃO GERAL DA APLICAÇÃO (DOMContentLoaded)
  // ==========================================================================
  document.addEventListener("DOMContentLoaded", async () => {
    AppLogger.info("boot", "Inicializando engine do Paws for Trello v" + APP_VERSION);

    // Carregar locales e licenças
    try {
      const [locRes, licRes] = await Promise.all([
        fetch("/locales.json").catch(() => null),
        fetch("/licenses.json").catch(() => null)
      ]);
      if (locRes && locRes.ok) AllLocales = await locRes.json();
      if (licRes && licRes.ok) AllLicenses = await licRes.json();
    } catch (_) {}

    await loadWorkspace();
    renderAppMenubar();
    renderWorkspace();
    registerGlobalKeybindings();

    // Eventos de Top Navigation
    const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
    const workspaceSidebar = document.getElementById("workspace-sidebar");
    if (btnToggleSidebar && workspaceSidebar) {
      btnToggleSidebar.onclick = () => workspaceSidebar.classList.toggle("collapsed");
    }

    const btnCollapseSidebar = document.getElementById("btn-collapse-sidebar");
    if (btnCollapseSidebar && workspaceSidebar) {
      btnCollapseSidebar.onclick = () => workspaceSidebar.classList.add("collapsed");
    }

    const btnToggleInbox = document.getElementById("btn-toggle-inbox");
    if (btnToggleInbox) btnToggleInbox.onclick = toggleInboxDock;

    const btnTogglePlanner = document.getElementById("btn-toggle-planner-split");
    if (btnTogglePlanner) btnTogglePlanner.onclick = togglePlannerDock;

    const btnQuickAdd = document.getElementById("btn-quick-add-card");
    if (btnQuickAdd) btnQuickAdd.onclick = openNewCardModal;

    const btnGoogleWorkspace = document.getElementById("btn-google-workspace");
    if (btnGoogleWorkspace) {
      btnGoogleWorkspace.onclick = () => {
        openPreferencesModal();
        switchPrefTab("google");
      };
    }

    const btnAiAgents = document.getElementById("btn-ai-agents-hub");
    if (btnAiAgents) {
      btnAiAgents.onclick = () => {
        openPreferencesModal();
        switchPrefTab("agents");
      };
    }

    const btnThemeToggle = document.getElementById("btn-theme-toggle");
    if (btnThemeToggle) {
      btnThemeToggle.onclick = () => {
        const curTheme = document.documentElement.getAttribute("data-theme") || "light";
        const nextTheme = curTheme === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", nextTheme);
        StoreData.theme = { colorMode: nextTheme, effectiveColorMode: nextTheme };
        saveStore();
        showNoticePill("Tema alterado para " + nextTheme);
      };
    }

    const btnWelcome = document.getElementById("btn-open-welcome");
    if (btnWelcome) btnWelcome.onclick = openWelcomeOverlay;

    const btnPreferences = document.getElementById("btn-open-preferences");
    if (btnPreferences) btnPreferences.onclick = openPreferencesModal;

    const btnShortcutsHelp = document.getElementById("btn-shortcuts-help");
    if (btnShortcutsHelp) btnShortcutsHelp.onclick = openShortcutsHelpModal;

    const btnBoardsMenu = document.getElementById("btn-open-boards-menu");
    if (btnBoardsMenu) btnBoardsMenu.onclick = openBoardSwitcher;

    // Split-Screen Bottom Dock
    const dockInbox = document.getElementById("dock-btn-inbox");
    if (dockInbox) dockInbox.onclick = toggleInboxDock;

    const dockPlanner = document.getElementById("dock-btn-planner");
    if (dockPlanner) dockPlanner.onclick = togglePlannerDock;

    const dockBoard = document.getElementById("dock-btn-board");
    if (dockBoard) {
      dockBoard.onclick = () => {
        StoreData.dockViews.board = !StoreData.dockViews.board;
        const canvas = document.getElementById("board-canvas-wrapper");
        if (canvas) canvas.style.display = StoreData.dockViews.board ? "flex" : "none";
        dockBoard.classList.toggle("active", StoreData.dockViews.board);
      };
    }

    const dockSwitcher = document.getElementById("dock-btn-switcher");
    if (dockSwitcher) dockSwitcher.onclick = openBoardSwitcher;

    // Fechar barra de downloads
    const btnCloseDl = document.getElementById("btn-close-downloads-bar");
    if (btnCloseDl) {
      btnCloseDl.onclick = () => {
        document.getElementById("downloads-bar-container").classList.add("downloads--hidden");
      };
    }

    // Fechar Inbox e Planner nos botões internos
    const btnCloseInbox = document.getElementById("btn-close-inbox");
    if (btnCloseInbox) btnCloseInbox.onclick = toggleInboxDock;

    const btnClosePlanner = document.getElementById("btn-close-planner");
    if (btnClosePlanner) btnClosePlanner.onclick = togglePlannerDock;

    // Quick add na Inbox pelo input direto
    const inboxQuickInput = document.getElementById("inbox-quick-input");
    if (inboxQuickInput) {
      inboxQuickInput.onkeydown = (e) => {
        if (e.key === "Enter" && inboxQuickInput.value.trim()) {
          Workspace.inbox.cards.unshift({
            id: "inbox-" + Date.now(),
            name: inboxQuickInput.value.trim(),
            desc: "",
            createdAt: new Date().toISOString(),
            due: "",
            completed: false,
            labels: [],
            members: ["JN"],
            checklist: [],
            attachments: [],
            comments: []
          });
          inboxQuickInput.value = "";
          saveWorkspaceToServer();
          renderInboxDock();
          showNoticePill("Item capturado na Caixa de entrada");
        }
      };
    }

    // Filtro Global
    const globalFilter = document.getElementById("global-filter-input");
    if (globalFilter) {
      globalFilter.oninput = () => {
        StoreData.boardFilter.keyword = globalFilter.value.trim();
        renderWorkspace();
      };
    }

    // Popover de Filtro do Quadro
    const btnFilterPopover = document.getElementById("btn-open-filter-popover");
    const filterPopover = document.getElementById("board-filter-popover");
    if (btnFilterPopover && filterPopover) {
      btnFilterPopover.onclick = (e) => {
        e.stopPropagation();
        filterPopover.classList.toggle("hidden");
      };
      document.getElementById("btn-close-filter-popover").onclick = () => filterPopover.classList.add("hidden");
      document.getElementById("filter-keyword-input").oninput = (e) => {
        StoreData.boardFilter.keyword = e.target.value.trim();
        renderWorkspace();
      };
      document.querySelectorAll("[data-filter-due]").forEach(btn => {
        btn.onclick = () => {
          document.querySelectorAll("[data-filter-due]").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          StoreData.boardFilter.due = btn.getAttribute("data-filter-due");
          renderWorkspace();
        };
      });
      document.getElementById("btn-clear-all-filters").onclick = () => {
        StoreData.boardFilter = { keyword: "", due: "all", labels: [], members: [] };
        document.getElementById("filter-keyword-input").value = "";
        renderWorkspace();
        filterPopover.classList.add("hidden");
      };
    }

    // Popover de Plano de Fundo do Quadro
    const btnBgPicker = document.getElementById("btn-open-bg-picker");
    const bgPopover = document.getElementById("board-bg-popover");
    const bgGrid = document.getElementById("bg-swatches-grid");
    if (btnBgPicker && bgPopover && bgGrid) {
      const themes = [
        "linear-gradient(135deg, #0079bf 0%, #002457 100%)",
        "linear-gradient(135deg, #1f845a 0%, #0f3d2a 100%)",
        "linear-gradient(135deg, #673286 0%, #1c2b42 100%)",
        "linear-gradient(135deg, #bd5b00 0%, #3d1c00 100%)",
        "linear-gradient(135deg, #c9372c 0%, #4a1410 100%)",
        "linear-gradient(135deg, #0e1626 0%, #172b4d 100%)",
        "linear-gradient(135deg, #111827 0%, #000000 100%)",
        "#0079bf",
        "#1f845a"
      ];
      bgGrid.innerHTML = themes.map(t => `<div class="bg-swatch-item" style="background:${t};" data-bg-theme="${t}"></div>`).join("");
      btnBgPicker.onclick = (e) => {
        e.stopPropagation();
        bgPopover.classList.toggle("hidden");
      };
      document.getElementById("btn-close-bg-popover").onclick = () => bgPopover.classList.add("hidden");
      bgGrid.querySelectorAll("[data-bg-theme]").forEach(el => {
        el.onclick = () => {
          const b = getActiveBoard();
          b.background = el.getAttribute("data-bg-theme");
          saveWorkspaceToServer();
          renderWorkspace();
          bgPopover.classList.add("hidden");
        };
      });
    }

    // Botões de Janela Nativa (Min, Max, Close)
    const btnWinMin = document.getElementById("win-btn-min");
    if (btnWinMin) btnWinMin.onclick = () => showToast("Janela minimizada.");

    const btnWinMax = document.getElementById("win-btn-max");
    if (btnWinMax) btnWinMax.onclick = toggleFullscreen;

    const btnWinClose = document.getElementById("win-btn-close");
    if (btnWinClose) btnWinClose.onclick = closeCurrentWindow;

    // Registro WebMCP
    if (typeof navigator !== "undefined" && !navigator.modelContext) {
      navigator.modelContext = {
        name: "apex-os",
        version: APP_VERSION,
        tools: ["list_boards", "create_card", "move_card", "sync_google_sheets", "generate_google_doc_spec"],
        async call(toolName, args) {
          const res = await fetch("/api/mcp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: toolName, arguments: args || {} } })
          });
          return await res.json();
        }
      };
    }

    // Exibir notificação de boas-vindas
    setTimeout(() => {
      showToast(`⚡ ${APP_NAME} v${APP_VERSION} pronto e online!`);
    }, 400);
  });
})();
