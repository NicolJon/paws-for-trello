/**
 * ============================================================================
 * PAWS FOR TRELLO (v2.16.10) - GOOGLE SHEETS & GOOGLE DOCS NATIVE BRIDGE
 * ============================================================================
 *
 * INSTRUÇÕES DE IMPLANTAÇÃO (ZERO-CONFIG OAUTH):
 * 1. Acesse https://sheets.new (ou abra uma Planilha Google existente).
 * 2. No menu superior, clique em: Extensões > Apps Script.
 * 3. Cole todo este código no arquivo `Código.gs` e salve.
 * 4. Clique em "Implantar" (Deploy) > "Nova implantação" (New deployment).
 * 5. Selecione o tipo: "App da Web" (Web app).
 * 6. Em "Executar como": selecione "Eu" (seu e-mail Google).
 * 7. Em "Quem tem acesso": selecione "Qualquer pessoa" (Anyone).
 * 8. Copie a URL do Web App gerada e cole na aba "Google Workspace (Sheets & Docs)"
 *    dentro de Preferências (Ctrl+,) no Paws for Trello!
 */

function setupWorkspaceSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Aba de Cartões (Cards)
  let cardsSheet = ss.getSheetByName("Paws_Cards");
  if (!cardsSheet) {
    cardsSheet = ss.insertSheet("Paws_Cards");
    cardsSheet.appendRow([
      "CardID", "BoardID", "BoardName", "ListID", "ListName",
      "Title", "Description", "Labels", "DueDate", "Members",
      "ChecklistJSON", "GoogleDocUrl", "AgentStatus", "UpdatedAt"
    ]);
    cardsSheet.getRange(1, 1, 1, 14).setFontWeight("bold").setBackground("#0c66e4").setFontColor("#ffffff");
    cardsSheet.setFrozenRows(1);
  }

  // 2. Aba de Quadros e Listas (Boards & Lists)
  let boardsSheet = ss.getSheetByName("Paws_Boards");
  if (!boardsSheet) {
    boardsSheet = ss.insertSheet("Paws_Boards");
    boardsSheet.appendRow([
      "BoardID", "Name", "Background", "Starred", "ListsJSON", "UpdatedAt"
    ]);
    boardsSheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#002457").setFontColor("#ffffff");
    boardsSheet.setFrozenRows(1);
  }

  // 3. Aba de Caixa de Entrada (Inbox)
  let inboxSheet = ss.getSheetByName("Paws_Inbox");
  if (!inboxSheet) {
    inboxSheet = ss.insertSheet("Paws_Inbox");
    inboxSheet.appendRow([
      "CardID", "Title", "Description", "CreatedAt", "SourceAgent"
    ]);
    inboxSheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#1f845a").setFontColor("#ffffff");
    inboxSheet.setFrozenRows(1);
  }

  // 4. Aba de Logs de Agentes (Antigravity & Codex)
  let logsSheet = ss.getSheetByName("Paws_AgentLogs");
  if (!logsSheet) {
    logsSheet = ss.insertSheet("Paws_AgentLogs");
    logsSheet.appendRow([
      "Timestamp", "Agent", "Action", "TargetID", "Details"
    ]);
    logsSheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#292a2e").setFontColor("#ffffff");
    logsSheet.setFrozenRows(1);
  }
}

function doGet(e) {
  setupWorkspaceSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const boardsData = ss.getSheetByName("Paws_Boards").getDataRange().getValues();
  const cardsData = ss.getSheetByName("Paws_Cards").getDataRange().getValues();
  const inboxData = ss.getSheetByName("Paws_Inbox").getDataRange().getValues();

  const boards = [];
  for (let i = 1; i < boardsData.length; i++) {
    const r = boardsData[i];
    if (r[0]) {
      let lists = [];
      try { lists = JSON.parse(r[4] || "[]"); } catch (_) {}
      boards.push({
        id: String(r[0]),
        name: String(r[1]),
        background: String(r[2] || "#0079bf"),
        starred: r[3] === true || String(r[3]).toLowerCase() === "true",
        lists: lists,
        updatedAt: String(r[5] || "")
      });
    }
  }

  const cards = [];
  for (let i = 1; i < cardsData.length; i++) {
    const r = cardsData[i];
    if (r[0]) {
      let labels = [], members = [], checklist = [];
      try { labels = JSON.parse(r[7] || "[]"); } catch (_) {}
      try { members = JSON.parse(r[9] || "[]"); } catch (_) {}
      try { checklist = JSON.parse(r[10] || "[]"); } catch (_) {}
      cards.push({
        id: String(r[0]),
        boardId: String(r[1]),
        boardName: String(r[2]),
        listId: String(r[3]),
        listName: String(r[4]),
        name: String(r[5]),
        desc: String(r[6] || ""),
        labels: labels,
        due: String(r[8] || ""),
        members: members,
        checklist: checklist,
        googleDocUrl: String(r[11] || ""),
        agentStatus: String(r[12] || ""),
        updatedAt: String(r[13] || "")
      });
    }
  }

  const inbox = [];
  for (let i = 1; i < inboxData.length; i++) {
    const r = inboxData[i];
    if (r[0]) {
      inbox.push({
        id: String(r[0]),
        name: String(r[1]),
        desc: String(r[2] || ""),
        createdAt: String(r[3] || ""),
        sourceAgent: String(r[4] || "user")
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    spreadsheetUrl: ss.getUrl(),
    spreadsheetName: ss.getName(),
    boards: boards,
    cards: cards,
    inbox: inbox
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  setupWorkspaceSheets();
  try {
    const body = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Sincronizar Todo o Workspace no Google Sheets
    if (body.action === "syncWorkspace") {
      const sBoards = ss.getSheetByName("Paws_Boards");
      const sCards = ss.getSheetByName("Paws_Cards");
      const sInbox = ss.getSheetByName("Paws_Inbox");

      if (sBoards.getLastRow() > 1) sBoards.getRange(2, 1, sBoards.getLastRow() - 1, 6).clearContent();
      if (sCards.getLastRow() > 1) sCards.getRange(2, 1, sCards.getLastRow() - 1, 14).clearContent();
      if (sInbox.getLastRow() > 1) sInbox.getRange(2, 1, sInbox.getLastRow() - 1, 5).clearContent();

      const now = new Date().toISOString();
      const boardRows = [];
      const cardRows = [];

      (body.boards || []).forEach(b => {
        const listsMeta = (b.lists || []).map(l => ({ id: l.id, name: l.name }));
        boardRows.push([
          b.id, b.name, b.background || "#0079bf", Boolean(b.starred), JSON.stringify(listsMeta), now
        ]);
        (b.lists || []).forEach(l => {
          (l.cards || []).forEach(c => {
            cardRows.push([
              c.id, b.id, b.name, l.id, l.name,
              c.name, c.desc || "", JSON.stringify(c.labels || []), c.due || "",
              JSON.stringify(c.members || []), JSON.stringify(c.checklist || []),
              c.googleDocUrl || "", c.agentStatus || "", now
            ]);
          });
        });
      });

      if (boardRows.length > 0) sBoards.getRange(2, 1, boardRows.length, 6).setValues(boardRows);
      if (cardRows.length > 0) sCards.getRange(2, 1, cardRows.length, 14).setValues(cardRows);

      const inboxRows = (body.inbox || []).map(c => [
        c.id, c.name, c.desc || "", c.createdAt || now, c.sourceAgent || "user"
      ]);
      if (inboxRows.length > 0) sInbox.getRange(2, 1, inboxRows.length, 5).setValues(inboxRows);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        spreadsheetUrl: ss.getUrl(),
        boardsCount: boardRows.length,
        cardsCount: cardRows.length,
        inboxCount: inboxRows.length,
        message: "Workspace sincronizado com sucesso no Google Sheets!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Criar Documento Nativo no Google Docs a partir de um Cartão ou Quadro
    if (body.action === "createGoogleDoc") {
      const title = body.title || "Especificação - Paws for Trello";
      const doc = DocumentApp.create(title);
      const docBody = doc.getBody();

      docBody.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING1);
      docBody.appendParagraph("Gerado via Paws for Trello v2.16.10 (Google Workspace + Antigravity/Codex Bridge)")
        .setItalic(true).setForegroundColor("#626f86");
      docBody.appendHorizontalRule();

      if (body.boardName || body.listName) {
        docBody.appendParagraph(`Quadro: ${body.boardName || "N/A"}  |  Lista: ${body.listName || "N/A"}`)
          .setHeading(DocumentApp.ParagraphHeading.HEADING3);
      }

      if (body.due) {
        docBody.appendParagraph(`Data de Entrega: ${body.due}`).setBold(true);
      }

      docBody.appendParagraph("Descrição / Especificação").setHeading(DocumentApp.ParagraphHeading.HEADING2);
      docBody.appendParagraph(body.description || "Sem descrição detalhada.");

      if (body.checklist && body.checklist.length > 0) {
        docBody.appendParagraph("Checklist de Tarefas").setHeading(DocumentApp.ParagraphHeading.HEADING2);
        body.checklist.forEach(item => {
          const prefix = item.checked ? "[x] " : "[ ] ";
          docBody.appendListItem(prefix + item.text);
        });
      }

      if (body.agentNotes) {
        docBody.appendParagraph("Contexto para Agentes (Antigravity / Codex)").setHeading(DocumentApp.ParagraphHeading.HEADING2);
        docBody.appendParagraph(body.agentNotes);
      }

      doc.saveAndClose();

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        docId: doc.getId(),
        docUrl: doc.getUrl(),
        title: title,
        message: "Google Doc criado com sucesso!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "Ação não reconhecida: " + body.action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
