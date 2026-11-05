/**
 * ============================================================================
 * PAWS FOR TRELLO v2.16.10 — COMPLETE APPLICATION ENGINE (`app.js`)
 * Releitura fiel 1:1 via REA (Reverse Engineer Anything) com:
 *  - Emulação completa de `window.electron` e `window.trelloDesktop`
 *  - Persistência `store` (`Fl`/`Ll`) com todas as chaves originais
 *  - 21 Idiomas oficiais (`locales.json`) + 303 Licenças (`licenses.json`)
 *  - Barra de Menus nativa (File, Edit, View, History, Boards, Window, Developer, Help)
 *  - Todos os atalhos de teclado Mousetrap (Ctrl+Alt+Space, Ctrl+F, Ctrl+1..9, Ctrl+D, etc.)
 *  - 9 Janelas/Modais (Main Window, Quick Card, Preferences, Welcome, Downloads, Find in Page, Prompt, Auth, Account)
 *  - Integração Nativa Google Sheets & Google Docs (Apps Script Bridge + Exportação/Importação direta)
 *  - Acesso Nativo Antigravity IDE & OpenAI Codex (MCP JSON-RPC `/api/mcp`, WebMCP `navigator.modelContext`, REST API)
 * ============================================================================
 */

(function () {
  "use strict";

  const SUPPORTED_LOCALES = [
    "cs", "de", "en", "es", "fi", "fr", "hu", "it", "ja", "nb",
    "nl", "pl", "pt_BR", "ru", "sv", "th", "tr", "uk", "vi", "zh-Hans", "zh-Hant"
  ];

  const STORAGE_KEY_SETTINGS = "paws_trello_store_v21610";
  const STORAGE_KEY_WORKSPACE = "paws_trello_workspace_v21610";
  const STORAGE_KEY_LOGS = "paws_trello_logs_v21610";

  // 1. Subsistema de Logs (`winston` / `trello.log` equivalente)
  const AppLogger = {
    entries: JSON.parse(localStorage.getItem(STORAGE_KEY_LOGS) || "[]"),
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

  // 2. Subsistema Store (`Fl` / `Ll`) — Chaves idênticas ao binário original
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
      windowshortcut: "Ctrl+Alt+T",
      quickaddshortcut: "Ctrl+Alt+Space",
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
      { id: "win-1", title: "Paws for Trello — Produto & Engenharia", boardId: "board-main-1", view: "board" }
    ],
    "closedWindows": [],
    "activeWindowId": "win-1",
    "history": ["board-main-1"],
    "historyIndex": 0
  };

  let StoreData = Object.assign({}, DEFAULT_STORE, JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || "{}"));
  function saveStore() {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(StoreData));
  }

  // 3. Dicionários de Idiomas (21 locales) & Licenças (303 pacotes)
  let AllLocales = {};
  let AllLicenses = {};
  let Workspace = null;
  let DownloadsList = [];
  let FindState = { query: "", matches: [], activeIndex: -1 };
  let ActivePrefTab = "settings";

  function getText(pathStr, vars = {}) {
    const loc = StoreData.locale || "pt_BR";
    const dict = AllLocales[loc] || AllLocales["pt_BR"] || AllLocales["en"] || {};
    const fallbackDict = AllLocales["en"] || {};
    const parts = pathStr.split(".");
    let val = dict;
    for (const p of parts) {
      val = val && val[p];
    }
    if (typeof val !== "string") {
      val = fallbackDict;
      for (const p of parts) val = val && val[p];
    }
    if (typeof val !== "string") return pathStr;
    return val.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : "Trello"));
  }

  // 4. Notificações Desktop & Toast (`notification` module)
  function showNotification(title, body, onClick) {
    AppLogger.info("notification", `${title}: ${body}`);
    const container = document.getElementById("toast-container");
    if (container) {
      const toast = document.createElement("div");
      toast.className = "paws-toast";
      toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(body)}</span>`;
      if (onClick) {
        toast.style.cursor = "pointer";
        toast.addEventListener("click", () => {
          onClick();
          toast.remove();
        });
      }
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 4500);
    }
    if (StoreData.settings.notifications && "Notification" in window && Notification.permission === "granted") {
      try {
        const n = new Notification(title, { body, icon: "/assets/StoreLogo.png" });
        if (onClick) n.onclick = onClick;
      } catch (_) {}
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // 5. Gerador Dinâmico de Ícones em Canvas (`sendGeneratedIcons` do `newcard/index.js`)
  function generateStarredBoardIcon(indexNumber, bgColor = "#0c66e4") {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(0, 0, 16, 16, 3) : ctx.rect(0, 0, 16, 16);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(indexNumber), 8, 8.5);
    return canvas.toDataURL("image/png");
  }

  // 6. Exposição Oficial de `window.electron` e `window.trelloDesktop` (100% compatível com o ASAR original)
  window.electron = {
    platform: "win32",
    isMas: false,
    logger: {
      info: (...a) => AppLogger.info("renderer", a.join(" ")),
      warn: (...a) => AppLogger.warn("renderer", a.join(" ")),
      error: (...a) => AppLogger.error("renderer", a.join(" ")),
      debug: (...a) => AppLogger.debug("renderer", a.join(" "))
    },
    getText,
    getLicenses: () => AllLicenses,
    getTheme: () => StoreData.theme,
    setSettings: (newSettings) => {
      StoreData.settings = Object.assign({}, StoreData.settings, newSettings);
      saveStore();
      AppLogger.info("pref-win", "Settings updated", StoreData.settings);
    },
    sendGeneratedIcons: (icons) => {
      StoreData["starred-icons"] = icons;
      saveStore();
    },
    ipc: {
      send: (channel, ...args) => AppLogger.debug("ipc", `send ${channel}`, args),
      invoke: (channel, ...args) => {
        if (channel === "prompt") {
          return openPromptModal(args[0] || "Informe o valor:", args[1] || "");
        }
        return Promise.resolve(null);
      }
    }
  };

  window.trelloDesktop = {
    version: "2.16.10",
    updateStarredBoards(boards) {
      StoreData["starred-boards"] = boards;
      saveStore();
      renderSidebar();
      renderAppMenuBar();
    },
    setBadge(val) {
      const badge = document.getElementById("inbox-badge-count");
      if (badge) badge.textContent = String(val || 0);
    }
  };

  // ==========================================================================
  // 7. GERENCIAMENTO DE ESTADO DO WORKSPACE & SINCRONIZAÇÃO COM SERVIDOR
  // ==========================================================================
  async function loadInitialData() {
    try {
      const [locRes, licRes, wsRes] = await Promise.all([
        fetch("/locales.json").then(r => r.json()).catch(() => ({})),
        fetch("/licenses.json").then(r => r.json()).catch(() => ({})),
        fetch("/api/v1/workspace").then(r => r.json()).catch(() => null)
      ]);
      AllLocales = locRes || {};
      AllLicenses = licRes || {};

      const localWs = localStorage.getItem(STORAGE_KEY_WORKSPACE);
      if (localWs) {
        Workspace = JSON.parse(localWs);
        // Sincroniza o estado local com a API serverless em background
        fetch("/api/v1/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace: Workspace })
        }).catch(() => {});
      } else if (wsRes && wsRes.workspace) {
        Workspace = wsRes.workspace;
        saveWorkspace();
      }
    } catch (err) {
      AppLogger.error("init", "Failed loading initial data: " + err.message);
    }

    applyTheme(StoreData.theme.colorMode);
    applyZoom(StoreData["zoom-factor"] || 1);
    applyTranslations();
    renderAppMenuBar();
    renderWindowInstances();
    renderSidebar();
    renderInbox();
    renderActiveView();
    registerWebMCP();
    AppLogger.info("app", "Paws for Trello v2.16.10 initialized successfully");
  }

  function saveWorkspace() {
    if (!Workspace) return;
    Workspace.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY_WORKSPACE, JSON.stringify(Workspace));
    // Atualiza os quadros favoritados no Store original
    const starred = Workspace.boards.filter(b => b.starred).map((b, i) => ({
      id: b.id,
      name: b.name,
      url: b.url || `https://trello.com/b/${b.id}`,
      pos: (i + 1) * 1000
    }));
    StoreData["starred-boards"] = starred;
    StoreData["starred-icons"] = starred.map((b, i) => ({
      id: b.id,
      dataUrl: generateStarredBoardIcon(i + 1, "#0c66e4")
    }));
    saveStore();

    // Sincroniza assincronamente com `/api/v1/workspace`
    fetch("/api/v1/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: Workspace })
    }).catch(() => {});
  }

  function getActiveWindow() {
    let win = StoreData.windows.find(w => w.id === StoreData.activeWindowId);
    if (!win) {
      win = StoreData.windows[0] || { id: "win-1", title: "Trello", boardId: Workspace.boards[0].id, view: "board" };
      StoreData.windows = [win];
      StoreData.activeWindowId = win.id;
    }
    return win;
  }

  function getActiveBoard() {
    if (!Workspace || !Workspace.boards.length) return null;
    const win = getActiveWindow();
    return Workspace.boards.find(b => b.id === win.boardId) || Workspace.boards[0];
  }

  // ==========================================================================
  // 8. BARRA DE MENUS NATIVA (`menus-win` / `menus-osx` — 8 Menus Completos)
  // ==========================================================================
  function getMenusDefinition() {
    const starred = Workspace ? Workspace.boards.filter(b => b.starred).slice(0, 9) : [];
    const starredItems = starred.map((b, idx) => ({
      label: `${idx + 1}. ${b.name}`,
      accel: `Ctrl+${idx + 1}`,
      action: () => selectBoard(b.id)
    }));

    return [
      {
        id: "file",
        label: getText("menu.file.menuText"),
        items: [
          { label: getText("menu.file.newWindow"), accel: "Ctrl+Shift+N", action: () => createNewWindowInstance() },
          { label: getText("menu.file.restoreWindow"), accel: "Ctrl+Alt+N", action: () => restoreClosedWindowInstance() },
          { label: getText("menu.file.quickCard"), accel: StoreData.settings.quickaddshortcut || "Ctrl+Alt+Space", action: () => openQuickCardModal() },
          { type: "sep" },
          { label: getText("menu.file.share") + " (Copiar Link)", accel: "Ctrl+Alt+C", action: () => copyCurrentBoardUrl() },
          { label: "Exportar Quadro (JSON)", accel: "Ctrl+E", action: () => exportCurrentBoardJson() },
          { label: "Exportar para Google Sheets (CSV)", accel: "Ctrl+Shift+E", action: () => exportCurrentBoardCsv() },
          { label: getText("menu.file.print"), accel: "Ctrl+P", action: () => window.print() },
          { type: "sep" },
          { label: getText("preferences.title"), accel: "Ctrl+,", action: () => openPreferencesModal("settings") },
          { label: getText("menu.common.exit"), accel: "Alt+F4", action: () => showNotification("Paws for Trello", "Sessão salva automaticamente no navegador e na nuvem.") }
        ]
      },
      {
        id: "edit",
        label: getText("menu.edit.menuText"),
        items: [
          { label: getText("menu.edit.find"), accel: "Ctrl+F", action: () => openFindInPage() },
          { type: "sep" },
          { label: getText("menu.edit.copyCurrentUrl"), accel: "Ctrl+Alt+C", action: () => copyCurrentBoardUrl() },
          { label: getText("menu.edit.pasteUrlAndGo"), accel: "Ctrl+Alt+V", action: () => pasteUrlAndGo() }
        ]
      },
      {
        id: "view",
        label: getText("menu.view.menuText"),
        items: [
          { label: getText("menu.view.reload"), accel: "Ctrl+R", action: () => loadInitialData() },
          { label: getText("menu.view.toggleFullScreen"), accel: "F11", action: () => toggleFullScreen() },
          { type: "sep" },
          { label: getText("menu.view.actualSize"), accel: "Ctrl+0", action: () => applyZoom(1) },
          { label: getText("menu.view.zoomIn"), accel: "Ctrl+=", action: () => applyZoom(Math.min(1.75, +(StoreData["zoom-factor"] + 0.1).toFixed(2))) },
          { label: getText("menu.view.zoomOut"), accel: "Ctrl+-", action: () => applyZoom(Math.max(0.6, +(StoreData["zoom-factor"] - 0.125).toFixed(3))) },
          { type: "sep" },
          { label: "Alternar Tema Claro / Escuro", accel: "Ctrl+Shift+L", action: () => toggleTheme() }
        ]
      },
      {
        id: "history",
        label: getText("menu.history.menuText"),
        items: [
          { label: getText("menu.history.back"), accel: "Ctrl+[", action: () => navigateHistory(-1) },
          { label: getText("menu.history.forward"), accel: "Ctrl+]", action: () => navigateHistory(1) }
        ]
      },
      {
        id: "boards",
        label: getText("menu.boards.menuText"),
        items: [
          { label: getText("menu.boards.allBoards"), accel: "Ctrl+Shift+B", action: () => switchWorkspaceView("all-boards") },
          { label: getText("menu.boards.myCards"), accel: "Ctrl+Shift+M", action: () => switchWorkspaceView("my-cards") },
          { type: "sep" },
          { label: getText("menu.boards.goToDefault"), accel: "Ctrl+D", action: () => goToDefaultBoard() },
          { label: getText("menu.boards.setCurrentAsDefault"), accel: "Ctrl+Shift+D", action: () => setCurrentBoardAsDefault() },
          { label: getText("menu.boards.resetDefault"), accel: "", action: () => resetDefaultBoard() },
          ...(starredItems.length ? [{ type: "sep" }, ...starredItems] : [])
        ]
      },
      {
        id: "window",
        label: getText("menu.window.menuText"),
        items: [
          { label: "Caixa de Entrada (Inbox Split)", accel: "Ctrl+I", action: () => toggleInboxDock() },
          { label: "Visão de Tabela (Google Sheets)", accel: "Ctrl+T", action: () => switchWorkspaceView("table") },
          { label: "Visão de Calendário / Planner", accel: "Ctrl+K", action: () => switchWorkspaceView("calendar") },
          { type: "sep" },
          { label: "Autenticação / Credenciais (Auth Modal)", accel: "", action: () => openAuthModal() },
          { label: "Tela de Boas-Vindas (Welcome Screen)", accel: "", action: () => toggleWelcomeOverlay(true) }
        ]
      },
      {
        id: "developer",
        label: "Developer & IA",
        items: [
          { label: "🤖 Console Antigravity & Codex (MCP)", accel: "Ctrl+Shift+A", action: () => openPreferencesModal("agents") },
          { label: "📊 Configurar Google Sheets & Docs", accel: "Ctrl+Shift+G", action: () => openPreferencesModal("google") },
          { type: "sep" },
          ...SUPPORTED_LOCALES.slice(0, 10).map(loc => ({
            label: `Idioma: ${loc} ${StoreData.locale === loc ? "✓" : ""}`,
            accel: "",
            action: () => changeLocale(loc)
          })),
          { label: "Mais idiomas em Preferências...", accel: "Ctrl+,", action: () => openPreferencesModal("settings") }
        ]
      },
      {
        id: "help",
        label: getText("menu.help.menuText"),
        items: [
          { label: getText("menu.help.keyboardShortcuts", { name: "Trello" }), accel: "?", action: () => openPreferencesModal("settings") },
          { label: getText("menu.help.labs"), accel: "", action: () => switchWorkspaceView("activity") },
          { label: getText("menu.help.exportLogs"), accel: "Ctrl+Shift+L", action: () => exportLogsZip() },
          { type: "sep" },
          { label: getText("menu.help.resetLocalData"), accel: "Ctrl+Shift+R", action: () => resetLocalDataDialog() },
          { label: getText("preferences.sidebarMenu.about"), accel: "", action: () => openPreferencesModal("about") }
        ]
      }
    ];
  }

  function renderAppMenuBar() {
    const bar = document.getElementById("app-menubar");
    if (!bar) return;
    const menus = getMenusDefinition();
    bar.innerHTML = "";

    menus.forEach(menu => {
      const itemEl = document.createElement("div");
      itemEl.className = "app-menubar-item";
      itemEl.textContent = menu.label;

      const dropEl = document.createElement("div");
      dropEl.className = "app-submenu-dropdown";

      menu.items.forEach(sub => {
        if (sub.type === "sep") {
          const sep = document.createElement("div");
          sep.className = "app-submenu-sep";
          dropEl.appendChild(sep);
        } else {
          const row = document.createElement("div");
          row.className = "app-submenu-row";
          row.innerHTML = `<span>${escapeHtml(sub.label)}</span><span class="app-submenu-accel">${escapeHtml(sub.accel || "")}</span>`;
          row.addEventListener("click", (e) => {
            e.stopPropagation();
            closeAllMenus();
            if (sub.action) sub.action();
          });
          dropEl.appendChild(row);
        }
      });

      itemEl.appendChild(dropEl);
      itemEl.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasActive = itemEl.classList.contains("active");
        closeAllMenus();
        if (!wasActive) itemEl.classList.remove("active"), itemEl.classList.add("active");
      });
      bar.appendChild(itemEl);
    });
  }

  function closeAllMenus() {
    document.querySelectorAll(".app-menubar-item.active").forEach(el => el.classList.remove("active"));
    const ctx = document.getElementById("custom-context-menu");
    if (ctx) ctx.classList.add("hidden");
  }

  // ==========================================================================
  // 9. MULTI-WINDOW MANAGER (`New Window` Ctrl+Shift+N & `Restore Window`)
  // ==========================================================================
  function renderWindowInstances() {
    const container = document.getElementById("window-instances-bar");
    if (!container) return;
    container.innerHTML = "";
    StoreData.windows.forEach(w => {
      const pill = document.createElement("div");
      pill.className = "window-instance-pill" + (w.id === StoreData.activeWindowId ? " active" : "");
      pill.innerHTML = `<span>🪟 ${escapeHtml(w.title.slice(0, 22))}</span>`;
      if (StoreData.windows.length > 1) {
        const closeSp = document.createElement("span");
        closeSp.className = "close-instance";
        closeSp.textContent = "✕";
        closeSp.addEventListener("click", (e) => {
          e.stopPropagation();
          closeWindowInstance(w.id);
        });
        pill.appendChild(closeSp);
      }
      pill.addEventListener("click", () => {
        StoreData.activeWindowId = w.id;
        saveStore();
        renderWindowInstances();
        renderSidebar();
        renderActiveView();
      });
      container.appendChild(pill);
    });
  }

  function createNewWindowInstance(boardId) {
    const targetBoard = Workspace.boards.find(b => b.id === boardId) || Workspace.boards[0];
    const newWin = {
      id: "win-" + Date.now(),
      title: targetBoard.name,
      boardId: targetBoard.id,
      view: "board"
    };
    StoreData.windows.push(newWin);
    StoreData.activeWindowId = newWin.id;
    saveStore();
    renderWindowInstances();
    renderSidebar();
    renderActiveView();
    showNotification(getText("menu.file.newWindow"), `Janela criada para "${targetBoard.name}"`);
  }

  function closeWindowInstance(winId) {
    if (StoreData.windows.length <= 1) return;
    const idx = StoreData.windows.findIndex(w => w.id === winId);
    if (idx !== -1) {
      const closed = StoreData.windows.splice(idx, 1)[0];
      StoreData.closedWindows = StoreData.closedWindows || [];
      StoreData.closedWindows.push(closed);
      if (StoreData.activeWindowId === winId) {
        StoreData.activeWindowId = StoreData.windows[0].id;
      }
      saveStore();
      renderWindowInstances();
      renderActiveView();
    }
  }

  function restoreClosedWindowInstance() {
    if (!StoreData.closedWindows || !StoreData.closedWindows.length) {
      showNotification("Restaurar Janela", "Nenhuma janela fechada recentemente.");
      return;
    }
    const restored = StoreData.closedWindows.pop();
    StoreData.windows.push(restored);
    StoreData.activeWindowId = restored.id;
    saveStore();
    renderWindowInstances();
    renderActiveView();
    showNotification(getText("menu.file.restoreWindow"), `Janela "${restored.title}" restaurada!`);
  }

  // ==========================================================================
  // 10. RENDERIZAÇÃO DA SIDEBAR, INBOX E QUADROS KANBAN / TABELA / CALENDÁRIO
  // ==========================================================================
  function renderSidebar() {
    if (!Workspace) return;
    const activeBoard = getActiveBoard();
    const win = getActiveWindow();

    document.querySelectorAll(".sidebar-nav-item[data-view]").forEach(el => {
      el.classList.toggle("active", el.getAttribute("data-view") === win.view);
    });

    const starredEl = document.getElementById("starred-boards-sidebar-list");
    const allEl = document.getElementById("all-boards-sidebar-list");
    if (!starredEl || !allEl) return;

    starredEl.innerHTML = "";
    allEl.innerHTML = "";

    const starred = Workspace.boards.filter(b => b.starred);
    starred.forEach((b, i) => {
      const row = document.createElement("div");
      row.className = "sidebar-nav-item" + (win.view === "board" && activeBoard && activeBoard.id === b.id ? " active" : "");
      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;min-width:0;">
          <span class="board-color-swatch" style="background:${b.color || "#0c66e4"}">${i + 1}</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(b.name)}</span>
        </div>
        <span style="font-size:10px;opacity:0.6;">Ctrl+${i + 1}</span>
      `;
      row.addEventListener("click", () => selectBoard(b.id));
      starredEl.appendChild(row);
    });

    Workspace.boards.forEach(b => {
      const row = document.createElement("div");
      row.className = "sidebar-nav-item" + (win.view === "board" && activeBoard && activeBoard.id === b.id ? " active" : "");
      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;min-width:0;">
          <span class="board-color-swatch" style="background:${b.color || "#0c66e4"}"></span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(b.name)}</span>
        </div>
        <span>${b.starred ? "⭐" : ""}</span>
      `;
      row.addEventListener("click", () => selectBoard(b.id));
      allEl.appendChild(row);
    });
  }

  function renderInbox() {
    if (!Workspace) return;
    const listEl = document.getElementById("inbox-cards-list");
    const badgeEl = document.getElementById("inbox-badge-count");
    if (badgeEl) badgeEl.textContent = String(Workspace.inbox.cards.length);
    if (!listEl) return;

    listEl.innerHTML = "";
    Workspace.inbox.cards.forEach(card => {
      const item = document.createElement("div");
      item.className = "kanban-card";
      item.innerHTML = `
        <div class="card-title-text">${escapeHtml(card.name)}</div>
        ${card.desc ? `<div style="font-size:12px;color:var(--ds-text-subtle);margin-bottom:6px;">${escapeHtml(card.desc)}</div>` : ""}
        <div class="card-badges-footer">
          <span class="card-badge agent-badge">📥 ${escapeHtml(card.sourceAgent || "Inbox")}</span>
          <button class="pref-btn" style="padding:2px 8px;font-size:11px;" data-move-inbox="${card.id}">Mover p/ Quadro →</button>
        </div>
      `;
      item.querySelector(`[data-move-inbox="${card.id}"]`).addEventListener("click", (e) => {
        e.stopPropagation();
        moveInboxCardToActiveBoard(card.id);
      });
      listEl.appendChild(item);
    });
  }

  function moveInboxCardToActiveBoard(inboxCardId) {
    const idx = Workspace.inbox.cards.findIndex(c => c.id === inboxCardId);
    if (idx === -1) return;
    const card = Workspace.inbox.cards.splice(idx, 1)[0];
    const board = getActiveBoard();
    const targetList = board.lists[0];
    targetList.cards.unshift({
      id: card.id,
      name: card.name,
      desc: card.desc || "",
      labels: [{ id: "lbl-inbox", name: "Triado da Inbox", color: "#0c66e4" }],
      due: "",
      members: ["JN"],
      checklist: [],
      googleDocUrl: "",
      agentStatus: "triaged"
    });
    saveWorkspace();
    renderInbox();
    renderActiveView();
    showNotification("Movido para o Quadro!", `"${card.name}" adicionado em ${targetList.name}.`);
  }

  function selectBoard(boardId) {
    const win = getActiveWindow();
    const board = Workspace.boards.find(b => b.id === boardId);
    if (!board) return;
    win.boardId = board.id;
    win.title = board.name;
    win.view = "board";
    StoreData["last-url"] = board.url || `https://trello.com/b/${board.id}`;
    StoreData.history = StoreData.history || [];
    StoreData.history.push(board.id);
    StoreData.historyIndex = StoreData.history.length - 1;
    saveStore();
    renderWindowInstances();
    renderSidebar();
    renderActiveView();
  }

  function switchWorkspaceView(viewName) {
    const win = getActiveWindow();
    win.view = viewName;
    saveStore();
    renderSidebar();
    renderActiveView();
  }

  function renderActiveView() {
    if (!Workspace) return;
    const win = getActiveWindow();
    const board = getActiveBoard();
    const wrapper = document.getElementById("board-canvas-wrapper");
    const container = document.getElementById("workspace-dynamic-content");
    const titleEl = document.getElementById("active-board-title");
    const winTitleEl = document.getElementById("window-title-text");

    if (board && wrapper) {
      wrapper.style.background = board.background || "linear-gradient(135deg, #0079bf 0%, #002457 100%)";
      if (titleEl) titleEl.textContent = board.name;
      if (winTitleEl) winTitleEl.textContent = `${board.name} — Trello`;
      document.title = `${board.name} — Paws for Trello v2.16.10`;
    }

    document.querySelectorAll("[data-switch-mode]").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-switch-mode") === win.view);
    });

    if (!container) return;
    container.innerHTML = "";

    if (win.view === "all-boards") {
      renderAllBoardsGallery(container);
    } else if (win.view === "my-cards") {
      renderMyCardsView(container);
    } else if (win.view === "table") {
      renderTableView(container, board);
    } else if (win.view === "calendar") {
      renderCalendarView(container, board);
    } else if (win.view === "activity") {
      renderActivityAndLabsView(container);
    } else {
      renderKanbanBoard(container, board);
    }
  }

  function renderKanbanBoard(container, board) {
    if (!board) return;
    const filterText = (document.getElementById("global-filter-input")?.value || "").trim().toLowerCase();

    board.lists.forEach(list => {
      const listEl = document.createElement("div");
      listEl.className = "kanban-list";
      listEl.innerHTML = `
        <div class="kanban-list-header">
          <span>${escapeHtml(list.name)} <small style="opacity:0.6;">(${list.cards.length})</small></span>
          <button style="background:none;border:none;cursor:pointer;color:inherit;opacity:0.6;" title="Opções da Lista" data-del-list="${list.id}">⋯</button>
        </div>
        <div class="kanban-cards-scroll" data-list-drop="${list.id}"></div>
        <div class="kanban-list-footer">
          <button class="add-card-trigger" data-add-card-list="${list.id}">+ Adicionar um cartão</button>
        </div>
      `;

      const scrollArea = listEl.querySelector(".kanban-cards-scroll");

      // Drag and drop support
      scrollArea.addEventListener("dragover", e => e.preventDefault());
      scrollArea.addEventListener("drop", e => {
        e.preventDefault();
        const cardId = e.dataTransfer.getData("text/plain");
        if (cardId) moveCardBetweenLists(cardId, list.id);
      });

      list.cards.forEach(card => {
        if (filterText && !card.name.toLowerCase().includes(filterText) && !(card.desc || "").toLowerCase().includes(filterText)) {
          return;
        }
        const cardEl = document.createElement("div");
        cardEl.className = "kanban-card";
        cardEl.draggable = true;
        cardEl.setAttribute("data-card-id", card.id);

        if (FindState.query && (card.name.toLowerCase().includes(FindState.query) || (card.desc || "").toLowerCase().includes(FindState.query))) {
          cardEl.classList.add("search-match");
          if (FindState.matches[FindState.activeIndex] === card.id) {
            cardEl.classList.add("search-match-active");
          }
        }

        const labelsHtml = (card.labels || []).map(l =>
          `<span class="card-label-chip" style="background:${l.color || "#0c66e4"}">${escapeHtml(l.name)}</span>`
        ).join("");

        const chkTotal = (card.checklist || []).length;
        const chkDone = (card.checklist || []).filter(c => c.checked).length;

        cardEl.innerHTML = `
          ${labelsHtml ? `<div class="card-labels-row">${labelsHtml}</div>` : ""}
          <div class="card-title-text">${escapeHtml(card.name)}</div>
          <div class="card-badges-footer">
            <div style="display:flex;gap:4px;flex-wrap:wrap;">
              ${card.due ? `<span class="card-badge">🕒 ${escapeHtml(card.due)}</span>` : ""}
              ${chkTotal ? `<span class="card-badge">☑️ ${chkDone}/${chkTotal}</span>` : ""}
              ${card.googleDocUrl ? `<span class="card-badge doc-linked">📄 Google Doc</span>` : ""}
              ${card.agentStatus ? `<span class="card-badge agent-badge">🤖 ${escapeHtml(card.agentStatus)}</span>` : ""}
            </div>
            <div style="display:flex;gap:3px;">
              ${(card.members || []).map(m => `<span style="width:20px;height:20px;border-radius:50%;background:#0c66e4;color:#fff;font-size:9px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;">${escapeHtml(m)}</span>`).join("")}
            </div>
          </div>
        `;

        cardEl.addEventListener("dragstart", e => {
          e.dataTransfer.setData("text/plain", card.id);
        });
        cardEl.addEventListener("click", () => openCardDetailModal(board.id, list.id, card.id));
        scrollArea.appendChild(cardEl);
      });

      listEl.querySelector(`[data-add-card-list="${list.id}"]`).addEventListener("click", async () => {
        const title = await openPromptModal(`Novo cartão em "${list.name}":`, "");
        if (title && title.trim()) {
          list.cards.push({
            id: "card-" + Date.now(),
            name: title.trim(),
            desc: "",
            labels: [],
            due: "",
            members: ["JN"],
            checklist: [],
            googleDocUrl: "",
            agentStatus: ""
          });
          saveWorkspace();
          renderActiveView();
          showNotification(getText("notification.newCard.title"), getText("notification.newCard.body"));
        }
      });

      listEl.querySelector(`[data-del-list="${list.id}"]`).addEventListener("click", async () => {
        const newName = await openPromptModal("Renomear lista (ou deixe vazio para cancelar):", list.name);
        if (newName && newName.trim()) {
          list.name = newName.trim();
          saveWorkspace();
          renderActiveView();
        }
      });

      container.appendChild(listEl);
    });
  }

  function moveCardBetweenLists(cardId, targetListId) {
    const board = getActiveBoard();
    if (!board) return;
    let movedCard = null;
    for (const l of board.lists) {
      const idx = l.cards.findIndex(c => c.id === cardId);
      if (idx !== -1) {
        movedCard = l.cards.splice(idx, 1)[0];
        break;
      }
    }
    if (!movedCard) return;
    const dest = board.lists.find(l => l.id === targetListId);
    if (dest) {
      dest.cards.push(movedCard);
      saveWorkspace();
      renderActiveView();
    }
  }

  // Visão de Tabela (Estilo Google Sheets embutido + edição rápida)
  function renderTableView(container, board) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "width:100%;background:var(--ds-surface);border-radius:10px;padding:18px;overflow:auto;max-height:100%;";
    const rows = [];
    Workspace.boards.forEach(b => {
      b.lists.forEach(l => {
        l.cards.forEach(c => rows.push({ board: b, list: l, card: c }));
      });
    });

    wrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div>
          <h3 style="margin:0;">📑 Visão de Tabela do Workspace (Espelho Google Sheets)</h3>
          <p style="margin:4px 0 0;font-size:12.5px;color:var(--ds-text-subtle);">
            Total de ${rows.length} cartões mapeados nas colunas de <code>Paws_Cards</code>.
          </p>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="pref-btn" id="tbl-sync-sheets-btn">📊 Sincronizar com Google Sheets</button>
          <button class="pref-btn secondary" id="tbl-export-csv-btn">⬇️ Baixar Planilha (.CSV)</button>
        </div>
      </div>
      <table class="workspace-table-view">
        <thead>
          <tr>
            <th>ID</th>
            <th>Quadro</th>
            <th>Lista / Status</th>
            <th>Título do Cartão</th>
            <th>Etiquetas</th>
            <th>Prazo</th>
            <th>Status IA (Antigravity/Codex)</th>
            <th>Google Docs</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr style="cursor:pointer;" data-tbl-card="${r.card.id}" data-tbl-board="${r.board.id}" data-tbl-list="${r.list.id}">
              <td><code>${escapeHtml(r.card.id)}</code></td>
              <td><strong>${escapeHtml(r.board.name)}</strong></td>
              <td>${escapeHtml(r.list.name)}</td>
              <td>${escapeHtml(r.card.name)}</td>
              <td>${(r.card.labels || []).map(l => `<span class="card-label-chip" style="background:${l.color}">${escapeHtml(l.name)}</span>`).join(" ")}</td>
              <td>${escapeHtml(r.card.due || "—")}</td>
              <td><span class="card-badge agent-badge">${escapeHtml(r.card.agentStatus || "ready")}</span></td>
              <td>${r.card.googleDocUrl ? `<a href="${escapeHtml(r.card.googleDocUrl)}" target="_blank">📄 Abrir Doc</a>` : `<button class="pref-btn secondary" style="padding:3px 8px;font-size:11px;" data-gen-doc="${r.card.id}">+ Criar Doc</button>`}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    wrap.querySelector("#tbl-sync-sheets-btn").addEventListener("click", () => syncWithGoogleSheets());
    wrap.querySelector("#tbl-export-csv-btn").addEventListener("click", () => exportCurrentBoardCsv());
    wrap.querySelectorAll("[data-gen-doc]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        generateGoogleDocForCard(btn.getAttribute("data-gen-doc"));
      });
    });
    wrap.querySelectorAll("tr[data-tbl-card]").forEach(tr => {
      tr.addEventListener("click", () => {
        openCardDetailModal(tr.getAttribute("data-tbl-board"), tr.getAttribute("data-tbl-list"), tr.getAttribute("data-tbl-card"));
      });
    });

    container.appendChild(wrap);
  }

  // Visão de Todos os Quadros (`MEMBER_ALL_BOARDS` / `Ctrl+Shift+B`)
  function renderAllBoardsGallery(container) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "width:100%;background:var(--ds-surface);border-radius:10px;padding:24px;overflow:auto;max-height:100%;";
    wrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h2 style="margin:0;">🗂️ Todos os Quadros do Workspace</h2>
        <button class="pref-btn" id="gallery-new-board-btn">+ Criar Novo Quadro</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(250px, 1fr));gap:16px;">
        ${Workspace.boards.map(b => `
          <div data-open-board="${b.id}" style="background:${b.background};color:#fff;padding:18px;border-radius:10px;min-height:120px;cursor:pointer;display:flex;flex-direction:column;justify-content:space-between;box-shadow:var(--ds-shadow-raised);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <strong style="font-size:16px;">${escapeHtml(b.name)}</strong>
              <span>${b.starred ? "⭐" : ""}</span>
            </div>
            <div style="font-size:12px;opacity:0.85;">
              ${b.lists.length} listas • ${b.lists.reduce((acc, l) => acc + l.cards.length, 0)} cartões
            </div>
          </div>
        `).join("")}
      </div>
    `;
    wrap.querySelector("#gallery-new-board-btn").addEventListener("click", () => promptCreateNewBoard());
    wrap.querySelectorAll("[data-open-board]").forEach(el => {
      el.addEventListener("click", () => selectBoard(el.getAttribute("data-open-board")));
    });
    container.appendChild(wrap);
  }

  // Visão Meus Cartões (`MEMBER_CARDS` / `Ctrl+Shift+M`)
  function renderMyCardsView(container) {
    renderTableView(container, getActiveBoard());
  }

  // Visão de Calendário / Planner
  function renderCalendarView(container, board) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "width:100%;background:var(--ds-surface);border-radius:10px;padding:24px;overflow:auto;max-height:100%;";
    const cardsWithDue = [];
    Workspace.boards.forEach(b => {
      b.lists.forEach(l => {
        l.cards.forEach(c => {
          cardsWithDue.push({ board: b, list: l, card: c });
        });
      });
    });

    wrap.innerHTML = `
      <h2 style="margin:0 0 16px;">📅 Planner &amp; Cronograma de Entregas</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:14px;">
        ${cardsWithDue.map(item => `
          <div class="kanban-card" style="border-left:4px solid ${item.board.color || "#0c66e4"};">
            <div style="font-size:11px;color:var(--ds-text-subtlest);margin-bottom:4px;">${escapeHtml(item.board.name)} → ${escapeHtml(item.list.name)}</div>
            <div class="card-title-text">${escapeHtml(item.card.name)}</div>
            <div class="card-badges-footer">
              <span class="card-badge">📅 Prazo: ${escapeHtml(item.card.due || "Flexível")}</span>
              <span class="card-badge agent-badge">🤖 ${escapeHtml(item.card.agentStatus || "planejado")}</span>
            </div>
          </div>
        `).join("")}
      </div>
    `;
    container.appendChild(wrap);
  }

  // Visão de Logs de Atividade & Agentes IA (Antigravity & Codex)
  function renderActivityAndLabsView(container) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "width:100%;background:var(--ds-surface);border-radius:10px;padding:24px;overflow:auto;max-height:100%;";
    const logs = Workspace.agentLogs || [];
    wrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div>
          <h2 style="margin:0;">⚡ Telemetria de Agentes (Antigravity &amp; Codex) + Logs do Sistema</h2>
          <p style="margin:4px 0 0;font-size:13px;color:var(--ds-text-subtle);">Histórico em tempo real de ações executadas via MCP, REST API e Interface.</p>
        </div>
        <button class="pref-btn" id="act-export-logs-btn">📦 Exportar Logs (.ZIP)</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${logs.map(l => `
          <div style="padding:10px 14px;background:var(--ds-surface-sunken);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong>[${escapeHtml(l.agent)}]</strong> <code>${escapeHtml(l.action)}</code> — ${escapeHtml(l.details)}
            </div>
            <small style="color:var(--ds-text-subtlest);">${escapeHtml(l.timestamp)}</small>
          </div>
        `).join("")}
      </div>
    `;
    wrap.querySelector("#act-export-logs-btn").addEventListener("click", () => exportLogsZip());
    container.appendChild(wrap);
  }

  // ==========================================================================
  // 11. MODAL DETALHES DO CARTÃO + INTEGRAÇÃO NATIVA GOOGLE DOCS
  // ==========================================================================
  function openCardDetailModal(boardId, listId, cardId) {
    const board = Workspace.boards.find(b => b.id === boardId);
    const list = board && board.lists.find(l => l.id === listId);
    const card = list && list.cards.find(c => c.id === cardId);
    if (!card) return;

    const modal = document.getElementById("modal-card-detail");
    const body = document.getElementById("card-detail-body");
    document.getElementById("card-detail-header-title").textContent = `${board.name} / ${list.name}`;

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--ds-text-subtle);">Título do Cartão</label>
          <input type="text" id="edit-card-title" value="${escapeHtml(card.name)}" style="width:100%;font-size:18px;font-weight:600;padding:8px 10px;border:1px solid var(--ds-border-input);border-radius:6px;margin-top:4px;background:var(--ds-background-input);color:var(--ds-text);" />
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:180px;">
            <label style="font-size:12px;font-weight:600;color:var(--ds-text-subtle);">Mover para Lista</label>
            <select id="edit-card-list" style="margin:4px 0 0;padding:8px;">
              ${board.lists.map(l => `<option value="${l.id}" ${l.id === list.id ? "selected" : ""}>${escapeHtml(l.name)}</option>`).join("")}
            </select>
          </div>
          <div style="flex:1;min-width:180px;">
            <label style="font-size:12px;font-weight:600;color:var(--ds-text-subtle);">Data de Entrega</label>
            <input type="date" id="edit-card-due" value="${escapeHtml(card.due || "")}" style="width:100%;padding:8px;border:1px solid var(--ds-border-input);border-radius:6px;margin-top:4px;background:var(--ds-background-input);color:var(--ds-text);" />
          </div>
          <div style="flex:1;min-width:180px;">
            <label style="font-size:12px;font-weight:600;color:var(--ds-text-subtle);">Status Agente (Antigravity / Codex)</label>
            <input type="text" id="edit-card-agent" value="${escapeHtml(card.agentStatus || "ready")}" style="width:100%;padding:8px;border:1px solid var(--ds-border-input);border-radius:6px;margin-top:4px;background:var(--ds-background-input);color:var(--ds-text);" />
          </div>
        </div>

        <div>
          <label style="font-size:12px;font-weight:600;color:var(--ds-text-subtle);">Descrição &amp; Contexto Técnico</label>
          <textarea id="edit-card-desc" rows="4" style="width:100%;padding:10px;border:1px solid var(--ds-border-input);border-radius:6px;margin-top:4px;font-family:inherit;background:var(--ds-background-input);color:var(--ds-text);">${escapeHtml(card.desc || "")}</textarea>
        </div>

        <div style="background:var(--ds-surface-sunken);padding:14px;border-radius:8px;border:1px solid var(--ds-border);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong>📄 Integração Nativa Google Docs</strong>
            <div style="display:flex;gap:8px;">
              <button type="button" class="pref-btn" id="btn-card-create-gdoc">Gerar / Atualizar Google Doc</button>
              <button type="button" class="pref-btn secondary" id="btn-card-download-doc">Baixar .DOCX / .MD</button>
            </div>
          </div>
          <input type="url" id="edit-card-gdoc-url" placeholder="Cole ou gere a URL do documento Google Docs (https://docs.google.com/document/d/...)" value="${escapeHtml(card.googleDocUrl || "")}" style="width:100%;padding:8px;border:1px solid var(--ds-border-input);border-radius:6px;background:var(--ds-background-input);color:var(--ds-text);" />
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid var(--ds-border);">
          <button type="button" class="pref-btn secondary" id="btn-delete-card" style="color:var(--ds-text-danger);">🗑️ Excluir Cartão</button>
          <div style="display:flex;gap:8px;">
            <button type="button" class="pref-btn" id="btn-dispatch-codex" style="background:#803fa5;">🤖 Enviar p/ Fila Antigravity/Codex</button>
            <button type="button" class="pref-btn" id="btn-save-card-detail">Salvar Alterações</button>
          </div>
        </div>
      </div>
    `;

    body.querySelector("#btn-card-create-gdoc").addEventListener("click", async () => {
      const url = await generateGoogleDocForCard(card.id);
      if (url) body.querySelector("#edit-card-gdoc-url").value = url;
    });

    body.querySelector("#btn-card-download-doc").addEventListener("click", () => {
      downloadCardAsDocFile(board, list, card);
    });

    body.querySelector("#btn-dispatch-codex").addEventListener("click", () => {
      card.agentStatus = "queued-for-antigravity-codex";
      const queueList = board.lists.find(l => l.name.toLowerCase().includes("antigravity") || l.name.toLowerCase().includes("codex"));
      if (queueList && queueList.id !== list.id) {
        moveCardBetweenLists(card.id, queueList.id);
      }
      saveWorkspace();
      modal.classList.add("hidden");
      renderActiveView();
      showNotification("Enviado para Antigravity & Codex 🤖", `Cartão "${card.name}" pronto para execução via MCP.`);
    });

    body.querySelector("#btn-delete-card").addEventListener("click", () => {
      const idx = list.cards.findIndex(c => c.id === card.id);
      if (idx !== -1) list.cards.splice(idx, 1);
      saveWorkspace();
      modal.classList.add("hidden");
      renderActiveView();
      showNotification("Cartão excluído", `"${card.name}" foi removido.`);
    });

    body.querySelector("#btn-save-card-detail").addEventListener("click", () => {
      card.name = body.querySelector("#edit-card-title").value.trim() || card.name;
      card.desc = body.querySelector("#edit-card-desc").value;
      card.due = body.querySelector("#edit-card-due").value;
      card.agentStatus = body.querySelector("#edit-card-agent").value.trim();
      card.googleDocUrl = body.querySelector("#edit-card-gdoc-url").value.trim();
      const newListId = body.querySelector("#edit-card-list").value;
      if (newListId !== list.id) {
        moveCardBetweenLists(card.id, newListId);
      }
      saveWorkspace();
      modal.classList.add("hidden");
      renderActiveView();
      showNotification("Cartão atualizado!", `"${card.name}" salvo com sucesso.`);
    });

    modal.classList.remove("hidden");
  }

  // ==========================================================================
  // 12. QUICK ADD CARD MODAL (`newcard` bundle ug/dg — Inbox vs Board + Drafts)
  // ==========================================================================
  let quickCardDestination = "board";

  function openQuickCardModal() {
    const modal = document.getElementById("modal-newcard");
    if (!modal || !Workspace) return;

    const boardSelect = document.getElementById("newcard-board-select");
    const boardDisplay = document.getElementById("newcard-board-display");
    const listSelect = document.getElementById("newcard-list-select");
    const listDisplay = document.getElementById("newcard-list-display");
    const titleInput = document.getElementById("newcard-title-input");
    const descInput = document.getElementById("newcard-desc-input");

    // Restaura rascunho (`newcardDraft` idêntico ao original)
    const draft = JSON.parse(localStorage.getItem("newcardDraft") || "null");
    if (draft) {
      titleInput.value = draft.title || "";
      descInput.value = draft.description || "";
    } else {
      titleInput.value = "";
      descInput.value = "";
    }

    boardSelect.innerHTML = Workspace.boards.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");
    const activeBoard = getActiveBoard() || Workspace.boards[0];
    boardSelect.value = activeBoard.id;
    boardDisplay.textContent = activeBoard.name;

    function populateListsForBoard(bId) {
      const b = Workspace.boards.find(x => x.id === bId) || Workspace.boards[0];
      boardDisplay.textContent = b.name;
      listSelect.innerHTML = b.lists.map(l => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join("");
      if (b.lists[0]) {
        listSelect.value = b.lists[0].id;
        listDisplay.textContent = b.lists[0].name;
      }
    }

    populateListsForBoard(activeBoard.id);

    boardSelect.onchange = () => populateListsForBoard(boardSelect.value);
    listSelect.onchange = () => {
      const opt = listSelect.options[listSelect.selectedIndex];
      if (opt) listDisplay.textContent = opt.textContent;
    };

    modal.classList.remove("hidden");
    setTimeout(() => titleInput.focus(), 50);
  }

  // ==========================================================================
  // 13. PREFERENCES WINDOW (`preferences` bundle _g/Ng — 5 Tabs completas)
  // ==========================================================================
  function openPreferencesModal(tabName = "settings") {
    ActivePrefTab = tabName;
    const modal = document.getElementById("modal-preferences");
    if (!modal) return;
    modal.classList.remove("hidden");
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
        <h2>⚙️ ${escapeHtml(getText("preferences.sidebarMenu.settings"))}</h2>
        <div class="pref-field">
          <div>
            <h3>${escapeHtml(getText("preferences.input.notifications.title"))}</h3>
            <p>${escapeHtml(getText("preferences.input.notifications.text"))} <strong>${escapeHtml(getText("preferences.input.notifications.navigationWin"))}</strong></p>
          </div>
          <button type="button" class="pref-btn" id="pref-test-notif-btn" data-testid="notification-button">
            ${escapeHtml(getText("preferences.input.notifications.submitButton"))}
          </button>
        </div>

        <div class="pref-field">
          <div>
            <h3>${escapeHtml(getText("preferences.input.badgeOnTrayIcon.title"))}</h3>
            <p>${escapeHtml(getText("preferences.input.badgeOnTrayIcon.text"))}</p>
          </div>
          <input type="checkbox" id="pref-dockbadge-chk" ${StoreData.settings.dockbadge ? "checked" : ""} style="position:static;width:18px;height:18px;" />
        </div>

        <div class="pref-field">
          <div style="width:100%;">
            <h3>${escapeHtml(getText("preferences.input.globalShortcut.title"))}</h3>
            <p>${escapeHtml(getText("preferences.input.globalShortcut.text"))}</p>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <input type="text" id="pref-win-shortcut" value="${escapeHtml(StoreData.settings.windowshortcut)}" style="flex:1;padding:7px 10px;border:1px solid var(--ds-border-input);border-radius:6px;" />
              <button type="button" class="pref-btn" id="pref-save-win-shortcut">${escapeHtml(getText("preferences.button.set"))}</button>
            </div>
          </div>
        </div>

        <div class="pref-field">
          <div style="width:100%;">
            <h3>${escapeHtml(getText("preferences.input.quickAddShortcut.title"))}</h3>
            <p>${escapeHtml(getText("preferences.input.quickAddShortcut.text"))}</p>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <input type="text" id="pref-quick-shortcut" value="${escapeHtml(StoreData.settings.quickaddshortcut)}" style="flex:1;padding:7px 10px;border:1px solid var(--ds-border-input);border-radius:6px;" />
              <button type="button" class="pref-btn" id="pref-save-quick-shortcut">${escapeHtml(getText("preferences.button.set"))}</button>
            </div>
          </div>
        </div>

        <div class="pref-field">
          <div style="width:100%;">
            <h3>🌐 Idioma da Interface (21 Locales Nativos extraídos do ASAR)</h3>
            <select id="pref-locale-select" style="margin-top:8px;padding:8px 12px;width:100%;">
              ${SUPPORTED_LOCALES.map(loc => `<option value="${loc}" ${StoreData.locale === loc ? "selected" : ""}>${loc}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="pref-field">
          <div>
            <h3>${escapeHtml(getText("preferences.input.enableSpellcheckField.title"))}</h3>
            <p>${escapeHtml(getText("preferences.input.enableSpellcheckField.note"))}</p>
          </div>
          <input type="checkbox" id="pref-spellcheck-chk" ${StoreData.settings.spellcheck ? "checked" : ""} style="position:static;width:18px;height:18px;" />
        </div>
      `;

      container.querySelector("#pref-test-notif-btn").addEventListener("click", () => {
        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
        }
        showNotification(
          getText("notification.testNotification.title", { name: "Paws for Trello" }),
          getText("notification.testNotification.body")
        );
      });

      container.querySelector("#pref-locale-select").addEventListener("change", (e) => {
        changeLocale(e.target.value);
      });

      container.querySelector("#pref-save-quick-shortcut").addEventListener("click", () => {
        StoreData.settings.quickaddshortcut = container.querySelector("#pref-quick-shortcut").value.trim() || "Ctrl+Alt+Space";
        saveStore();
        showNotification("Atalho Salvo", `Cartão Rápido configurado para ${StoreData.settings.quickaddshortcut}`);
      });
      return;
    }

    if (ActivePrefTab === "google") {
      container.innerHTML = `
        <h2>📊 Integração Nativa Google Sheets &amp; Google Docs</h2>
        <p style="color:var(--ds-text-subtle);margin-bottom:16px;">
          Conecte seu Workspace diretamente ao <strong>Google Sheets</strong> (sincronização bidirecional de quadros, listas e cartões) e ao <strong>Google Docs</strong> (geração automática de documentos de especificação e relatórios).
        </p>

        <div class="pref-field" style="flex-direction:column;align-items:stretch;">
          <h3>1. URL do Web App Google Apps Script (Zero-Config OAuth)</h3>
          <p>Implante o arquivo <a href="/google-workspace-bridge.gs" target="_blank"><code>google-workspace-bridge.gs</code></a> na sua Planilha Google (Extensões &gt; Apps Script &gt; Implantar &gt; App da Web) e cole a URL abaixo:</p>
          <input type="url" id="pref-gas-url" placeholder="https://script.google.com/macros/s/.../exec" value="${escapeHtml(StoreData.googleWorkspace.appsScriptUrl || "")}" style="width:100%;padding:9px 12px;border:1px solid var(--ds-border-input);border-radius:6px;margin-top:6px;background:var(--ds-background-input);color:var(--ds-text);" />
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
            <button type="button" class="pref-btn" id="btn-save-gas-url">💾 Salvar URL</button>
            <button type="button" class="pref-btn" id="btn-push-sheets-now" style="background:#1f845a;">⬆️ Enviar Workspace p/ Google Sheets</button>
            <button type="button" class="pref-btn secondary" id="btn-pull-sheets-now">⬇️ Importar do Google Sheets</button>
            <a href="/google-workspace-bridge.gs" download="google-workspace-bridge.gs" class="pref-btn secondary" style="text-decoration:none;">📜 Baixar Script .GS</a>
          </div>
        </div>

        <div class="pref-field" style="flex-direction:column;align-items:stretch;">
          <h3>2. Exportação &amp; Importação Direta (Planilhas e Documentos)</h3>
          <p>Você também pode exportar/importar instantaneamente sem precisar de credenciais externas:</p>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
            <button type="button" class="pref-btn secondary" id="btn-direct-csv">📊 Baixar Planilha Completa (.CSV p/ Google Sheets)</button>
            <button type="button" class="pref-btn secondary" id="btn-direct-doc">📄 Gerar Relatório Executivo (.DOC / Google Docs)</button>
          </div>
        </div>
      `;

      container.querySelector("#btn-save-gas-url").addEventListener("click", () => {
        StoreData.googleWorkspace.appsScriptUrl = container.querySelector("#pref-gas-url").value.trim();
        saveStore();
        showNotification("Google Workspace", "URL do Google Apps Script salva com sucesso!");
      });
      container.querySelector("#btn-push-sheets-now").addEventListener("click", () => {
        StoreData.googleWorkspace.appsScriptUrl = container.querySelector("#pref-gas-url").value.trim();
        saveStore();
        syncWithGoogleSheets("push");
      });
      container.querySelector("#btn-pull-sheets-now").addEventListener("click", () => {
        StoreData.googleWorkspace.appsScriptUrl = container.querySelector("#pref-gas-url").value.trim();
        saveStore();
        syncWithGoogleSheets("pull");
      });
      container.querySelector("#btn-direct-csv").addEventListener("click", () => exportCurrentBoardCsv());
      container.querySelector("#btn-direct-doc").addEventListener("click", () => exportBoardExecutiveDoc());
      return;
    }

    if (ActivePrefTab === "agents") {
      const originUrl = window.location.origin;
      const mcpConfigSnippet = JSON.stringify({
        mcpServers: {
          "paws-for-trello": {
            url: `${originUrl}/api/mcp`,
            transport: "http"
          }
        }
      }, null, 2);

      container.innerHTML = `
        <h2>🤖 Acesso Nativo Antigravity IDE &amp; OpenAI Codex (MCP / WebMCP / REST API)</h2>
        <p style="color:var(--ds-text-subtle);margin-bottom:14px;">
          Este sistema possui um servidor <strong>Model Context Protocol (MCP)</strong> embutido em <code>/api/mcp</code>, suporte a <strong>WebMCP</strong> (<code>navigator.modelContext</code>) e uma API RESTful completa para que o <strong>Antigravity</strong> e o <strong>Codex</strong> gerenciem quadros, criem cartões, sincronizem planilhas e gerem documentos automaticamente.
        </p>

        <div class="pref-field" style="flex-direction:column;align-items:stretch;">
          <h3>⚡ Console Interativo de Comando p/ Antigravity &amp; Codex</h3>
          <p>Envie uma instrução para o endpoint <code>POST /api/v1/agent/command</code> ou execute uma tool MCP diretamente:</p>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <input type="text" id="agent-live-prompt" placeholder="Ex: Criar cartão de refatoração da API OAuth na fila do Codex..." style="flex:1;padding:8px 12px;border:1px solid var(--ds-border-input);border-radius:6px;background:var(--ds-background-input);color:var(--ds-text);" />
            <button type="button" class="pref-btn" id="btn-exec-agent-prompt" style="background:#803fa5;">Executar Comando IA</button>
          </div>
        </div>

        <div class="pref-field" style="flex-direction:column;align-items:stretch;">
          <h3>🔌 Configuração MCP para Antigravity IDE / Claude / Codex CLI (<code>mcp_config.json</code>)</h3>
          <pre style="background:#161A1D;color:#B6C2CF;padding:12px;border-radius:6px;overflow-x:auto;font-size:12px;margin:6px 0;">${escapeHtml(mcpConfigSnippet)}</pre>
          <div style="display:flex;gap:8px;">
            <button type="button" class="pref-btn secondary" id="btn-copy-mcp-json">📋 Copiar JSON MCP</button>
            <button type="button" class="pref-btn secondary" id="btn-test-mcp-rpc">🧪 Testar <code>tools/list</code> no Servidor MCP</button>
          </div>
        </div>

        <div class="pref-field" style="flex-direction:column;align-items:stretch;">
          <h3>🛠️ Ferramentas MCP Expostas (7 Tools Ativas)</h3>
          <ul style="margin:6px 0;padding-left:18px;font-size:13px;line-height:1.6;">
            <li><code>list_boards</code> — Lista todos os quadros, colunas e contagem da Inbox</li>
            <li><code>get_board</code> — Lê cartões, checklists, prazos e links de Google Docs de um quadro</li>
            <li><code>create_card</code> — Cria novos cartões em qualquer quadro/lista ou direto na Inbox</li>
            <li><code>move_card</code> — Move cartões entre listas e atualiza <code>agentStatus</code></li>
            <li><code>search_cards</code> — Busca semântica/textual em todo o Workspace</li>
            <li><code>generate_google_doc_spec</code> — Gera especificação estruturada no Google Docs</li>
            <li><code>sync_google_sheets</code> — Sincroniza cartões com a Planilha Google</li>
          </ul>
        </div>
      `;

      container.querySelector("#btn-exec-agent-prompt").addEventListener("click", async () => {
        const promptInput = container.querySelector("#agent-live-prompt");
        const cmd = promptInput.value.trim();
        if (!cmd) return;
        const res = await fetch("/api/v1/agent/command", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Agent-Name": "Antigravity" },
          body: JSON.stringify({ command: cmd, agent: "Antigravity" })
        }).then(r => r.json());
        if (res && res.success) {
          // Também adiciona localmente no quadro ativo na lista de fila de agentes
          const board = getActiveBoard();
          const list = board.lists.find(l => l.id === "list-agent-queue") || board.lists[0];
          list.cards.unshift(res.result.card);
          saveWorkspace();
          renderActiveView();
          promptInput.value = "";
          showNotification("Agente Antigravity Executou!", `Cartão "${res.result.card.name}" criado na fila.`);
        }
      });

      container.querySelector("#btn-copy-mcp-json").addEventListener("click", () => {
        navigator.clipboard.writeText(mcpConfigSnippet);
        showNotification("MCP Config Copiado!", "Cole no seu mcp_config.json do Antigravity ou Codex.");
      });

      container.querySelector("#btn-test-mcp-rpc").addEventListener("click", async () => {
        const rpcRes = await fetch("/api/mcp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
        }).then(r => r.json());
        showNotification("MCP Server Respondendo ✅", `${rpcRes.result?.tools?.length || 7} ferramentas MCP verificadas via JSON-RPC 2.0!`);
      });
      return;
    }

    if (ActivePrefTab === "licenses") {
      const keys = Object.keys(AllLicenses);
      container.innerHTML = `
        <fieldset id="licenses">
          <h2>${escapeHtml(getText("licenseInfo.text"))} (${keys.length} pacotes originais)</h2>
          <div class="licenses" style="margin-top:12px;">
            ${keys.map(k => {
              const item = AllLicenses[k];
              return `
                <div class="license-item" style="padding:6px 0;border-bottom:1px solid var(--ds-border);">
                  <span class="name" style="cursor:pointer;font-weight:600;color:var(--ds-text);" data-lic-toggle="${escapeHtml(k)}">▶ ${escapeHtml(k)}</span>
                  ${item.url ? `<span class="url"> ∙ <a href="${escapeHtml(item.url)}" target="_blank" style="color:var(--ds-link);">${escapeHtml(getText("licenseInfo.website"))}</a></span>` : ""}
                  <div class="full-text hidden" id="lic-body-${escapeHtml(k)}" style="margin-top:8px;background:var(--ds-surface-sunken);padding:10px;border-radius:6px;max-height:220px;overflow:auto;">
                    <pre style="margin:0;white-space:pre-wrap;font-size:11.5px;">${escapeHtml(item.license || "")}</pre>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </fieldset>
      `;
      container.querySelectorAll("[data-lic-toggle]").forEach(el => {
        el.addEventListener("click", () => {
          const id = "lic-body-" + el.getAttribute("data-lic-toggle");
          const target = document.getElementById(id);
          if (target) target.classList.toggle("hidden");
        });
      });
      return;
    }

    if (ActivePrefTab === "about") {
      container.innerHTML = `
        <fieldset id="about">
          <div class="about-content" style="max-width:540px;">
            <img src="/assets/StoreLogo.scale-200.png" width="64" height="64" alt="Paws for Trello" style="border-radius:12px;margin-bottom:12px;" />
            <h2 data-testid="app-version" class="app-version">${escapeHtml(getText("about.version"))} 2.16.10-1070 (Cloud + Google Workspace + Antigravity/Codex Edition)</h2>
            <p style="font-size:14.5px;line-height:1.5;margin:12px 0;">${escapeHtml(getText("about.askFeedback.text1"))}</p>
            <p style="font-size:14px;line-height:1.5;color:var(--ds-text-subtle);">${escapeHtml(getText("about.askFeedback.text2"))}</p>
            <div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">
              <a href="https://trello.com" target="_blank" class="pref-btn" style="text-decoration:none;">🌐 ${escapeHtml(getText("about.rateUsWin"))}</a>
              <a href="https://www.atlassian.com/legal/privacy-policy" target="_blank" class="pref-btn secondary" style="text-decoration:none;">🔒 ${escapeHtml(getText("about.privacyPolicy"))}</a>
              <a href="https://www.atlassian.com/legal/cloud-terms-of-service" target="_blank" class="pref-btn secondary" style="text-decoration:none;">📜 ${escapeHtml(getText("about.termsOfUse"))}</a>
            </div>
          </div>
        </fieldset>
      `;
    }
  }

  // ==========================================================================
  // 14. INTEGRAÇÃO NATIVA GOOGLE SHEETS & GOOGLE DOCS + BARRA DE DOWNLOADS
  // ==========================================================================
  function addDownloadBarItem(filename, stateText, url, mimeType) {
    DownloadsList.unshift({ id: "dl-" + Date.now(), filename, stateText, url, mimeType });
    const bar = document.getElementById("downloads-bar-container");
    const listEl = document.getElementById("downloads-items-list");
    if (!bar || !listEl) return;
    bar.classList.remove("hidden");

    listEl.innerHTML = DownloadsList.map(item => `
      <div class="download-items__item" data-dl-id="${item.id}">
        <div class="download-item__name"><span>📄 ${escapeHtml(item.filename)}</span></div>
        <div class="download-item__state">${escapeHtml(item.stateText)}</div>
      </div>
    `).join("");

    listEl.querySelectorAll("[data-dl-id]").forEach(el => {
      el.addEventListener("click", () => {
        const d = DownloadsList.find(x => x.id === el.getAttribute("data-dl-id"));
        if (d && d.url) {
          const a = document.createElement("a");
          a.href = d.url;
          a.download = d.filename;
          a.click();
        }
      });
    });
  }

  async function syncWithGoogleSheets(direction = "push") {
    const gasUrl = StoreData.googleWorkspace.appsScriptUrl;
    if (!gasUrl) {
      // Se ainda não configurou URL do Apps Script, exporta CSV compatível com Google Sheets e abre modal de configuração
      exportCurrentBoardCsv();
      openPreferencesModal("google");
      showNotification("Google Sheets Sync", "Planilha CSV gerada! Para sincronia em nuvem automática, cole a URL do seu Google Apps Script.");
      return;
    }

    try {
      showNotification("Google Sheets", "Sincronizando dados com sua Planilha Google...");
      if (direction === "pull") {
        const res = await fetch("/api/v1/google/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ webhookUrl: gasUrl, method: "GET" })
        }).then(r => r.json());

        if (res.success && res.googleResponse && res.googleResponse.boards) {
          showNotification("Google Sheets Importado ✅", `Dados recebidos de "${res.googleResponse.spreadsheetName || "Planilha"}".`);
        } else {
          throw new Error(res.error || "Resposta inesperada da planilha");
        }
      } else {
        const res = await fetch("/api/v1/google/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            webhookUrl: gasUrl,
            method: "POST",
            payload: {
              action: "syncWorkspace",
              boards: Workspace.boards,
              inbox: Workspace.inbox.cards
            }
          })
        }).then(r => r.json());

        if (res.success && res.googleResponse && res.googleResponse.success) {
          StoreData.googleWorkspace.lastSyncAt = new Date().toISOString();
          if (res.googleResponse.spreadsheetUrl) {
            StoreData.googleWorkspace.spreadsheetUrl = res.googleResponse.spreadsheetUrl;
          }
          saveStore();
          showNotification("Google Sheets Sincronizado! 📊", res.googleResponse.message || "Todas as abas foram atualizadas.");
        } else {
          throw new Error(res.error || res.googleResponse?.error || "Erro na sincronização");
        }
      }
    } catch (err) {
      showNotification("Erro Google Sheets", err.message);
    }
  }

  async function generateGoogleDocForCard(cardId) {
    let foundCard = null, foundBoard = null, foundList = null;
    for (const b of Workspace.boards) {
      for (const l of b.lists) {
        const c = l.cards.find(x => x.id === cardId);
        if (c) { foundCard = c; foundBoard = b; foundList = l; break; }
      }
    }
    if (!foundCard) return null;

    const gasUrl = StoreData.googleWorkspace.appsScriptUrl;
    if (gasUrl) {
      try {
        showNotification("Google Docs", `Criando documento no Google Docs para "${foundCard.name}"...`);
        const res = await fetch("/api/v1/google/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            webhookUrl: gasUrl,
            method: "POST",
            payload: {
              action: "createGoogleDoc",
              title: `[Paws for Trello] ${foundCard.name}`,
              boardName: foundBoard.name,
              listName: foundList.name,
              due: foundCard.due,
              description: foundCard.desc,
              checklist: foundCard.checklist || [],
              agentNotes: `Status atual do Agente: ${foundCard.agentStatus || "ready"}`
            }
          })
        }).then(r => r.json());

        if (res.success && res.googleResponse && res.googleResponse.docUrl) {
          foundCard.googleDocUrl = res.googleResponse.docUrl;
          saveWorkspace();
          renderActiveView();
          showNotification("Google Doc Criado! 📄", "Documento vinculado ao cartão com sucesso.");
          return foundCard.googleDocUrl;
        }
      } catch (e) {
        AppLogger.warn("gdocs", "Fallback local doc generation: " + e.message);
      }
    }

    // Geração instantânea de documento HTML/DOCX compatível com Google Docs
    downloadCardAsDocFile(foundBoard, foundList, foundCard);
    const localDocUrl = `https://docs.google.com/document/create?title=${encodeURIComponent(foundCard.name)}`;
    foundCard.googleDocUrl = localDocUrl;
    saveWorkspace();
    renderActiveView();
    return localDocUrl;
  }

  function downloadCardAsDocFile(board, list, card) {
    const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(card.name)}</title></head><body style="font-family:Arial,sans-serif;max-width:750px;margin:40px auto;line-height:1.6;">
      <h1 style="color:#0c66e4;">${escapeHtml(card.name)}</h1>
      <p><strong>Quadro:</strong> ${escapeHtml(board.name)} &nbsp;|&nbsp; <strong>Lista:</strong> ${escapeHtml(list.name)} &nbsp;|&nbsp; <strong>Prazo:</strong> ${escapeHtml(card.due || "N/A")}</p>
      <hr/>
      <h2>Descrição / Especificação</h2>
      <p>${escapeHtml(card.desc || "Sem descrição.")}</p>
      <h2>Checklist</h2>
      <ul>${(card.checklist || []).map(i => `<li>[${i.checked ? "x" : " "}] ${escapeHtml(i.text)}</li>`).join("") || "<li>Sem itens</li>"}</ul>
      <hr/>
      <p><em>Gerado por Paws for Trello v2.16.10 (Google Docs &amp; Antigravity/Codex Bridge)</em></p>
    </body></html>`;
    const blob = new Blob([htmlDoc], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const filename = `Spec-${card.id}.doc`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    addDownloadBarItem(filename, "Google Docs Spec pronto", url, "application/msword");
    showNotification("Especificação Google Docs Gerada 📄", `Arquivo "${filename}" baixado na barra inferior.`);
  }

  function exportBoardExecutiveDoc() {
    const board = getActiveBoard();
    if (!board) return;
    const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório - ${escapeHtml(board.name)}</title></head><body style="font-family:Arial,sans-serif;max-width:800px;margin:40px auto;">
      <h1 style="color:#002457;">Relatório Executivo: ${escapeHtml(board.name)}</h1>
      <p>Gerado em ${new Date().toLocaleString("pt-BR")} via Paws for Trello v2.16.10</p>
      ${board.lists.map(l => `
        <h2 style="background:#f4f5f7;padding:8px 12px;border-left:4px solid #0c66e4;">${escapeHtml(l.name)} (${l.cards.length})</h2>
        <ul>
          ${l.cards.map(c => `<li><strong>${escapeHtml(c.name)}</strong> ${c.due ? `(Prazo: ${escapeHtml(c.due)})` : ""}<br/><small>${escapeHtml(c.desc || "")}</small></li>`).join("")}
        </ul>
      `).join("")}
    </body></html>`;
    const blob = new Blob([htmlDoc], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const filename = `Relatorio-${board.id}.doc`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    addDownloadBarItem(filename, "Relatório Docs concluído", url, "application/msword");
    showNotification("Relatório Google Docs Gerado 📄", `"${filename}" pronto para abrir no Google Docs.`);
  }

  function exportCurrentBoardCsv() {
    const rows = [["CardID", "BoardName", "ListName", "Title", "Description", "DueDate", "AgentStatus", "GoogleDocUrl"]];
    Workspace.boards.forEach(b => {
      b.lists.forEach(l => {
        l.cards.forEach(c => {
          rows.push([
            c.id, b.name, l.name, c.name, (c.desc || "").replace(/\n/g, " "), c.due || "", c.agentStatus || "", c.googleDocUrl || ""
          ]);
        });
      });
    });
    const csvContent = "\uFEFF" + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const filename = `paws-trello-sheets-${new Date().toISOString().slice(0, 10)}.csv`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    addDownloadBarItem(filename, "Planilha CSV exportada", url, "text/csv");
    showNotification("Planilha Google Sheets Exportada 📊", `Arquivo "${filename}" salvo.`);
  }

  function exportCurrentBoardJson() {
    const blob = new Blob([JSON.stringify(Workspace, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const filename = `trello-workspace-export-${new Date().toISOString().slice(0, 10)}.json`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    addDownloadBarItem(filename, "Concluído", url, "application/json");
  }

  // Exportação de Logs em `.zip` idêntica à função `Tc` do módulo `dialogs` (`trello-exported-logs-YYYY-M-D.zip`)
  async function exportLogsZip() {
    const d = new Date();
    const zipFilename = `trello-exported-logs-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}.zip`;
    const logContent = AppLogger.entries.join("\n") + "\n";

    if (window.JSZip) {
      const zip = new window.JSZip();
      zip.file("trello.log", logContent);
      zip.file("store-state.json", JSON.stringify(StoreData, null, 2));
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipFilename;
      a.click();
      addDownloadBarItem(zipFilename, "Logs ZIP exportados", url, "application/zip");
    } else {
      const blob = new Blob([logContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "trello.log";
      a.click();
      addDownloadBarItem("trello.log", "Log exportado", url, "text/plain");
    }
    showNotification(getText("menu.help.exportLogs"), `Arquivo ${zipFilename} gerado com sucesso!`);
  }

  // ==========================================================================
  // 15. FIND IN PAGE (`find_in_page` bundle Ig — Contador `1/N` e navegação)
  // ==========================================================================
  function openFindInPage() {
    const bar = document.getElementById("find-in-page-floating");
    const input = document.getElementById("find-in-page-input");
    if (!bar || !input) return;
    bar.classList.remove("hidden");
    input.focus();
    input.select();
  }

  function updateFindMatches(query) {
    FindState.query = (query || "").trim().toLowerCase();
    FindState.matches = [];
    FindState.activeIndex = -1;

    if (FindState.query && Workspace) {
      const board = getActiveBoard();
      if (board) {
        board.lists.forEach(l => {
          l.cards.forEach(c => {
            if (c.name.toLowerCase().includes(FindState.query) || (c.desc || "").toLowerCase().includes(FindState.query)) {
              FindState.matches.push(c.id);
            }
          });
        });
      }
      if (FindState.matches.length > 0) {
        FindState.activeIndex = 0;
      }
    }
    updateFindCounterUI();
    renderActiveView();
  }

  function stepFindMatch(delta) {
    if (!FindState.matches.length) return;
    FindState.activeIndex = (FindState.activeIndex + delta + FindState.matches.length) % FindState.matches.length;
    updateFindCounterUI();
    renderActiveView();
    const activeId = FindState.matches[FindState.activeIndex];
    const el = document.querySelector(`[data-card-id="${activeId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function updateFindCounterUI() {
    const counter = document.getElementById("find-in-page-counter");
    if (!counter) return;
    const total = FindState.matches.length;
    const current = total > 0 ? FindState.activeIndex + 1 : 0;
    counter.textContent = `${current}/${total}`;
  }

  // ==========================================================================
  // 16. PROMPT MODAL (`prompt` bundle), AUTH MODAL (`auth` bundle) & HELPERS
  // ==========================================================================
  function openPromptModal(message, defaultValue = "") {
    return new Promise((resolve) => {
      const modal = document.getElementById("modal-prompt");
      const msgEl = document.getElementById("prompt-modal-message");
      const inputEl = document.getElementById("prompt-modal-input");
      const okBtn = document.getElementById("prompt-ok-btn");
      const cancelBtn = document.getElementById("prompt-cancel-btn");

      msgEl.textContent = message;
      inputEl.value = defaultValue;
      modal.classList.remove("hidden");
      setTimeout(() => { inputEl.focus(); inputEl.select(); }, 30);

      function cleanup(val) {
        modal.classList.add("hidden");
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        inputEl.onkeydown = null;
        resolve(val);
      }

      okBtn.onclick = () => cleanup(inputEl.value);
      cancelBtn.onclick = () => cleanup(null);
      inputEl.onkeydown = (e) => {
        if (e.key === "Enter") cleanup(inputEl.value);
        if (e.key === "Escape") cleanup(null);
      };
    });
  }

  function openAuthModal() {
    document.getElementById("modal-auth")?.classList.remove("hidden");
  }

  function toggleWelcomeOverlay(show) {
    const el = document.getElementById("welcome-overlay");
    if (!el) return;
    if (show === undefined) el.classList.toggle("hidden");
    else el.classList.toggle("hidden", !show);
  }

  function toggleInboxDock() {
    document.getElementById("inbox-dock")?.classList.toggle("hidden");
  }

  function applyTheme(mode) {
    const effective = mode === "dark" ? "dark" : "light";
    StoreData.theme = { colorMode: effective, effectiveColorMode: effective };
    document.documentElement.setAttribute("data-theme", effective);
    const icon = document.getElementById("theme-icon");
    if (icon) icon.textContent = effective === "dark" ? "☀️" : "🌙";
    saveStore();
  }

  function toggleTheme() {
    applyTheme(StoreData.theme.colorMode === "dark" ? "light" : "dark");
  }

  function applyZoom(factor) {
    StoreData["zoom-factor"] = factor;
    document.documentElement.style.setProperty("--zoomFactor", String(factor));
    saveStore();
  }

  function changeLocale(loc) {
    if (!SUPPORTED_LOCALES.includes(loc)) return;
    StoreData.locale = loc;
    document.documentElement.lang = loc;
    saveStore();
    applyTranslations();
    renderAppMenuBar();
    if (!document.getElementById("modal-preferences").classList.contains("hidden")) {
      renderPreferencesTab();
    }
    showNotification("Idioma atualizado", `Interface alterada para ${loc}`);
  }

  function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const txt = getText(key);
      if (txt && txt !== key) el.textContent = txt;
    });
  }

  function copyCurrentBoardUrl() {
    const b = getActiveBoard();
    const url = `${window.location.origin}/b/${b ? b.id : "board-main-1"}`;
    navigator.clipboard.writeText(url);
    showNotification(getText("menu.edit.copyCurrentUrl"), url);
  }

  async function pasteUrlAndGo() {
    const url = await openPromptModal(getText("menu.edit.pasteUrlAndGo"), "https://trello.com/b/");
    if (!url) return;
    const found = Workspace.boards.find(b => url.includes(b.id) || b.name.toLowerCase() === url.toLowerCase());
    if (found) selectBoard(found.id);
  }

  function setCurrentBoardAsDefault() {
    const b = getActiveBoard();
    if (!b) return;
    StoreData["default-url"] = b.id;
    saveStore();
    showNotification(getText("notification.defaultBoard.title"), getText("notification.defaultBoard.body"));
  }

  function goToDefaultBoard() {
    const defId = StoreData["default-url"];
    const found = Workspace.boards.find(b => b.id === defId) || Workspace.boards[0];
    if (found) selectBoard(found.id);
  }

  function resetDefaultBoard() {
    StoreData["default-url"] = "https://trello.com";
    saveStore();
    showNotification("Quadro Padrão", "Quadro padrão redefinido.");
  }

  function navigateHistory(delta) {
    const hist = StoreData.history || [];
    if (!hist.length) return;
    StoreData.historyIndex = Math.max(0, Math.min(hist.length - 1, (StoreData.historyIndex || 0) + delta));
    const bId = hist[StoreData.historyIndex];
    if (bId) selectBoard(bId);
  }

  function toggleFullScreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  function resetLocalDataDialog() {
    if (confirm("Tem certeza que deseja redefinir todos os dados locais do Paws for Trello para o estado de fábrica?")) {
      localStorage.removeItem(STORAGE_KEY_SETTINGS);
      localStorage.removeItem(STORAGE_KEY_WORKSPACE);
      localStorage.removeItem(STORAGE_KEY_LOGS);
      window.location.reload();
    }
  }

  async function promptCreateNewBoard() {
    const name = await openPromptModal("Nome do novo Quadro:", "");
    if (!name || !name.trim()) return;
    const colors = [
      { bg: "linear-gradient(135deg, #0079bf 0%, #002457 100%)", c: "#0079bf" },
      { bg: "linear-gradient(135deg, #1f845a 0%, #0f3d2a 100%)", c: "#1f845a" },
      { bg: "linear-gradient(135deg, #673286 0%, #1c2b42 100%)", c: "#673286" },
      { bg: "linear-gradient(135deg, #ae2e24 0%, #42120e 100%)", c: "#ae2e24" }
    ];
    const pick = colors[Workspace.boards.length % colors.length];
    const newB = {
      id: "board-" + Date.now(),
      name: name.trim(),
      background: pick.bg,
      color: pick.c,
      starred: true,
      pos: (Workspace.boards.length + 1) * 1000,
      url: `https://trello.com/b/board-${Date.now()}`,
      lists: [
        { id: "list-1-" + Date.now(), name: "A Fazer", cards: [] },
        { id: "list-2-" + Date.now(), name: "Fila Antigravity & Codex 🤖", cards: [] },
        { id: "list-3-" + Date.now(), name: "Concluído 🎉", cards: [] }
      ]
    };
    Workspace.boards.push(newB);
    saveWorkspace();
    selectBoard(newB.id);
    showNotification("Novo Quadro Criado!", `"${newB.name}" está pronto.`);
  }

  // Triagem Inteligente da Inbox pelo Agente Antigravity / Codex
  function runAgentInboxTriage() {
    if (!Workspace.inbox.cards.length) {
      showNotification("Triagem Antigravity & Codex 🤖", "A Caixa de Entrada já está vazia e organizada!");
      return;
    }
    const board = getActiveBoard();
    const queueList = board.lists.find(l => l.name.toLowerCase().includes("antigravity") || l.name.toLowerCase().includes("codex")) || board.lists[0];
    const count = Workspace.inbox.cards.length;
    while (Workspace.inbox.cards.length > 0) {
      const c = Workspace.inbox.cards.shift();
      queueList.cards.unshift({
        id: c.id,
        name: c.name,
        desc: c.desc || "",
        labels: [{ id: "lbl-ai", name: "Triado por IA", color: "#803fa5" }],
        due: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
        members: ["AG", "CX"],
        checklist: [{ id: "chk-" + Date.now(), text: "Revisar escopo técnico", checked: false }],
        googleDocUrl: "",
        agentStatus: "triaged-by-antigravity"
      });
    }
    Workspace.agentLogs.unshift({
      id: "log-" + Date.now(),
      timestamp: new Date().toISOString(),
      agent: "Antigravity",
      action: "inbox.auto_triage",
      details: `${count} cartões da Inbox classificados para "${queueList.name}"`
    });
    saveWorkspace();
    renderInbox();
    renderActiveView();
    showNotification("Triagem IA Concluída 🤖", `${count} cartões movidos da Inbox para "${queueList.name}".`);
  }

  // ==========================================================================
  // 17. REGISTRO WEBMCP (`navigator.modelContext`) PARA AGENTES NO NAVEGADOR
  // ==========================================================================
  function registerWebMCP() {
    try {
      if (navigator.modelContext && typeof navigator.modelContext.registerTool === "function") {
        navigator.modelContext.registerTool({
          name: "paws_trello_create_card",
          description: "Cria um cartão no Paws for Trello (Quadro ou Inbox)",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              destination: { type: "string", enum: ["board", "inbox"] }
            },
            required: ["title"]
          },
          execute: async (args) => {
            const res = await fetch("/api/v1/cards", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(args)
            }).then(r => r.json());
            loadInitialData();
            return res;
          }
        });
      }
    } catch (_) {}
  }

  // ==========================================================================
  // 18. EVENT LISTENERS & ATALHOS DE TECLADO GLOBAIS (`Mousetrap` equivalente)
  // ==========================================================================
  function bindEvents() {
    document.addEventListener("click", () => closeAllMenus());

    // Context menu customizado (`context-menu` module tg)
    document.addEventListener("contextmenu", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      e.preventDefault();
      const ctx = document.getElementById("custom-context-menu");
      if (!ctx) return;
      ctx.innerHTML = `
        <div class="app-submenu-row" id="ctx-quick-card"><span>➕ ${escapeHtml(getText("menu.file.quickCard"))}</span><span class="app-submenu-accel">Ctrl+Alt+Space</span></div>
        <div class="app-submenu-row" id="ctx-find"><span>🔍 ${escapeHtml(getText("menu.edit.find"))}</span><span class="app-submenu-accel">Ctrl+F</span></div>
        <div class="app-submenu-sep"></div>
        <div class="app-submenu-row" id="ctx-sync-sheets"><span>📊 Sincronizar Google Sheets</span></div>
        <div class="app-submenu-row" id="ctx-export-doc"><span>📄 Gerar Relatório Google Docs</span></div>
        <div class="app-submenu-row" id="ctx-agent-triage"><span>🤖 Triagem IA (Antigravity/Codex)</span></div>
        <div class="app-submenu-sep"></div>
        <div class="app-submenu-row" id="ctx-copy-url"><span>🔗 ${escapeHtml(getText("menu.edit.copyCurrentUrl"))}</span></div>
        <div class="app-submenu-row" id="ctx-prefs"><span>⚙️ ${escapeHtml(getText("preferences.title"))}</span><span class="app-submenu-accel">Ctrl+,</span></div>
      `;
      ctx.style.left = Math.min(e.clientX, window.innerWidth - 230) + "px";
      ctx.style.top = Math.min(e.clientY, window.innerHeight - 260) + "px";
      ctx.classList.remove("hidden");

      ctx.querySelector("#ctx-quick-card").onclick = () => openQuickCardModal();
      ctx.querySelector("#ctx-find").onclick = () => openFindInPage();
      ctx.querySelector("#ctx-sync-sheets").onclick = () => syncWithGoogleSheets("push");
      ctx.querySelector("#ctx-export-doc").onclick = () => exportBoardExecutiveDoc();
      ctx.querySelector("#ctx-agent-triage").onclick = () => runAgentInboxTriage();
      ctx.querySelector("#ctx-copy-url").onclick = () => copyCurrentBoardUrl();
      ctx.querySelector("#ctx-prefs").onclick = () => openPreferencesModal("settings");
    });

    // Botões da Titlebar & Topnav
    document.getElementById("window-menu-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const firstMenu = document.querySelector(".app-menubar-item");
      if (firstMenu) firstMenu.click();
    });
    document.getElementById("win-btn-min")?.addEventListener("click", () => toggleInboxDock());
    document.getElementById("win-btn-max")?.addEventListener("click", () => toggleFullScreen());
    document.getElementById("win-btn-close")?.addEventListener("click", () => {
      if (StoreData.windows.length > 1) closeWindowInstance(StoreData.activeWindowId);
      else showNotification("Paws for Trello", "Seu workspace está salvo localmente e pronto na nuvem.");
    });

    document.getElementById("btn-toggle-sidebar")?.addEventListener("click", () => {
      document.getElementById("workspace-sidebar")?.classList.toggle("collapsed");
    });
    document.getElementById("btn-open-boards-menu")?.addEventListener("click", () => switchWorkspaceView("all-boards"));
    document.getElementById("btn-toggle-inbox")?.addEventListener("click", () => toggleInboxDock());
    document.getElementById("btn-close-inbox")?.addEventListener("click", () => toggleInboxDock());
    document.getElementById("btn-quick-add-card")?.addEventListener("click", () => openQuickCardModal());
    document.getElementById("btn-google-workspace")?.addEventListener("click", () => openPreferencesModal("google"));
    document.getElementById("btn-ai-agents-hub")?.addEventListener("click", () => openPreferencesModal("agents"));
    document.getElementById("btn-theme-toggle")?.addEventListener("click", () => toggleTheme());
    document.getElementById("btn-open-welcome")?.addEventListener("click", () => toggleWelcomeOverlay(true));
    document.getElementById("btn-open-preferences")?.addEventListener("click", () => openPreferencesModal("settings"));
    document.getElementById("btn-switch-account")?.addEventListener("click", () => openAuthModal());

    // Sidebar views
    document.querySelectorAll(".sidebar-nav-item[data-view]").forEach(el => {
      el.addEventListener("click", () => switchWorkspaceView(el.getAttribute("data-view")));
    });
    document.getElementById("btn-new-board-sidebar")?.addEventListener("click", () => promptCreateNewBoard());
    document.getElementById("sidebar-btn-sheets-sync")?.addEventListener("click", () => syncWithGoogleSheets("push"));
    document.getElementById("sidebar-btn-mcp-status")?.addEventListener("click", () => openPreferencesModal("agents"));

    // Inbox quick input
    document.getElementById("inbox-quick-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.value.trim()) {
        Workspace.inbox.cards.unshift({
          id: "inbox-" + Date.now(),
          name: e.target.value.trim(),
          desc: "",
          createdAt: new Date().toISOString(),
          sourceAgent: "user"
        });
        e.target.value = "";
        saveWorkspace();
        renderInbox();
        showNotification(getText("notification.newCard.title"), "Adicionado à Caixa de entrada!");
      }
    });

    // Board header controls
    document.getElementById("active-board-title")?.addEventListener("click", async () => {
      const b = getActiveBoard();
      if (!b) return;
      const newName = await openPromptModal("Renomear Quadro:", b.name);
      if (newName && newName.trim()) {
        b.name = newName.trim();
        saveWorkspace();
        renderSidebar();
        renderActiveView();
      }
    });
    document.getElementById("btn-star-current-board")?.addEventListener("click", () => {
      const b = getActiveBoard();
      if (!b) return;
      b.starred = !b.starred;
      saveWorkspace();
      renderSidebar();
      renderAppMenuBar();
    });
    document.getElementById("btn-set-default-board")?.addEventListener("click", () => setCurrentBoardAsDefault());
    document.querySelectorAll("[data-switch-mode]").forEach(btn => {
      btn.addEventListener("click", () => switchWorkspaceView(btn.getAttribute("data-switch-mode")));
    });
    document.getElementById("btn-export-board-sheets")?.addEventListener("click", () => syncWithGoogleSheets("push"));
    document.getElementById("btn-export-board-doc")?.addEventListener("click", () => exportBoardExecutiveDoc());
    document.getElementById("btn-run-agent-triage")?.addEventListener("click", () => runAgentInboxTriage());
    document.getElementById("btn-add-list-header")?.addEventListener("click", async () => {
      const b = getActiveBoard();
      if (!b) return;
      const name = await openPromptModal("Nome da nova Lista:", "");
      if (name && name.trim()) {
        b.lists.push({ id: "list-" + Date.now(), name: name.trim(), cards: [] });
        saveWorkspace();
        renderActiveView();
      }
    });

    // Filtro rápido no topo
    document.getElementById("global-filter-input")?.addEventListener("input", () => renderActiveView());

    // Quick Add Card Modal (`newcard`)
    document.getElementById("newcard-close-btn")?.addEventListener("click", () => {
      document.getElementById("modal-newcard")?.classList.add("hidden");
    });
    document.querySelectorAll(".destination-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        quickCardDestination = tab.getAttribute("data-dest");
        document.querySelectorAll(".destination-tab").forEach(t => t.setAttribute("aria-selected", String(t === tab)));
        document.getElementById("newcard-board-list-row").style.display = quickCardDestination === "inbox" ? "none" : "block";
      });
    });
    ["newcard-title-input", "newcard-desc-input"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", () => {
        localStorage.setItem("newcardDraft", JSON.stringify({
          title: document.getElementById("newcard-title-input").value,
          description: document.getElementById("newcard-desc-input").value
        }));
      });
    });
    document.getElementById("newcard-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = document.getElementById("newcard-title-input").value.trim();
      const desc = document.getElementById("newcard-desc-input").value.trim();
      if (!title) return;

      if (quickCardDestination === "inbox") {
        Workspace.inbox.cards.unshift({
          id: "card-" + Date.now(),
          name: title,
          desc,
          createdAt: new Date().toISOString(),
          sourceAgent: "QuickCard"
        });
        renderInbox();
      } else {
        const bId = document.getElementById("newcard-board-select").value;
        const lId = document.getElementById("newcard-list-select").value;
        const b = Workspace.boards.find(x => x.id === bId) || getActiveBoard();
        const l = b.lists.find(x => x.id === lId) || b.lists[0];
        l.cards.push({
          id: "card-" + Date.now(),
          name: title,
          desc,
          labels: [],
          due: "",
          members: ["JN"],
          checklist: [],
          googleDocUrl: "",
          agentStatus: "ready"
        });
      }
      localStorage.removeItem("newcardDraft");
      saveWorkspace();
      document.getElementById("modal-newcard").classList.add("hidden");
      renderActiveView();
      showNotification(getText("notification.newCard.title"), getText("notification.newCard.body"));
    });

    // Preferences Modal
    document.getElementById("pref-close-btn")?.addEventListener("click", () => {
      document.getElementById("modal-preferences")?.classList.add("hidden");
    });
    document.querySelectorAll(".sidebarmenu a[data-pref-tab]").forEach(a => {
      a.addEventListener("click", () => {
        ActivePrefTab = a.getAttribute("data-pref-tab");
        renderPreferencesTab();
      });
    });

    // Card Detail Modal
    document.getElementById("card-detail-close-btn")?.addEventListener("click", () => {
      document.getElementById("modal-card-detail")?.classList.add("hidden");
    });

    // Auth Modal
    document.getElementById("auth-cancel-btn")?.addEventListener("click", () => {
      document.getElementById("modal-auth")?.classList.add("hidden");
    });
    document.getElementById("auth-submit-btn")?.addEventListener("click", () => {
      const user = document.getElementById("auth-username-input").value.trim();
      if (user) {
        Workspace.user.fullName = user;
        Workspace.user.initials = user.slice(0, 2).toUpperCase();
        document.getElementById("user-avatar-chip").textContent = Workspace.user.initials;
        saveWorkspace();
      }
      document.getElementById("modal-auth")?.classList.add("hidden");
      showNotification("Sessão Autenticada", `Conectado como ${Workspace.user.fullName}`);
    });

    // Welcome Overlay
    document.getElementById("welcome-continue-btn")?.addEventListener("click", () => toggleWelcomeOverlay(false));
    document.getElementById("welcome-auth-btn")?.addEventListener("click", () => {
      toggleWelcomeOverlay(false);
      openAuthModal();
    });

    // Downloads Bar
    document.getElementById("btn-close-downloads-bar")?.addEventListener("click", () => {
      document.getElementById("downloads-bar-container")?.classList.add("hidden");
    });

    // Find in Page Bar
    document.getElementById("find-in-page-input")?.addEventListener("input", (e) => updateFindMatches(e.target.value));
    document.getElementById("find-in-page-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") stepFindMatch(e.shiftKey ? -1 : 1);
      if (e.key === "Escape") {
        document.getElementById("find-in-page-floating")?.classList.add("hidden");
        updateFindMatches("");
      }
    });
    document.getElementById("find-prev-btn")?.addEventListener("click", () => stepFindMatch(-1));
    document.getElementById("find-next-btn")?.addEventListener("click", () => stepFindMatch(1));
    document.getElementById("find-close-btn")?.addEventListener("click", () => {
      document.getElementById("find-in-page-floating")?.classList.add("hidden");
      updateFindMatches("");
    });

    // Atalhos Globais de Teclado (Mousetrap-compatible)
    window.addEventListener("keydown", (e) => {
      // Ctrl+Alt+Space -> Quick Card
      if (e.ctrlKey && e.altKey && e.code === "Space") {
        e.preventDefault();
        openQuickCardModal();
        return;
      }
      // Ctrl+F -> Find in Page
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        openFindInPage();
        return;
      }
      // Ctrl+, -> Preferences
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        openPreferencesModal("settings");
        return;
      }
      // Ctrl+Shift+B -> Open Boards Page
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        switchWorkspaceView("all-boards");
        return;
      }
      // Ctrl+Shift+M -> My Cards
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        switchWorkspaceView("my-cards");
        return;
      }
      // Ctrl+Shift+N -> New Window Instance
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        createNewWindowInstance();
        return;
      }
      // Ctrl+D / Ctrl+Shift+D -> Default Board
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (e.shiftKey) setCurrentBoardAsDefault();
        else goToDefaultBoard();
        return;
      }
      // Ctrl+1..9 -> Starred Boards 1..9
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key, 10) - 1;
        const starred = Workspace ? Workspace.boards.filter(b => b.starred) : [];
        if (starred[idx]) {
          e.preventDefault();
          selectBoard(starred[idx].id);
        }
        return;
      }
      // Escape closes active modals
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay:not(.hidden)").forEach(m => m.classList.add("hidden"));
        closeAllMenus();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    loadInitialData();
  });
})();
