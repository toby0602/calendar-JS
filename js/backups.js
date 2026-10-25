"use strict";

(() => {
  const app = CalendarApp;
  const $ = app.$;
  let busy = false;
  function status(message) { $("backup-status").hidden = false; $("backup-status").textContent = message; }
  $("export-notes").addEventListener("click", async () => {
    try {
      const notes = await app.notesStore.read();
      const blob = new Blob([JSON.stringify({ version: 1, notes }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `my-calendar-${app.dateKey(new Date())}.json`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status(`已匯出 ${Object.keys(notes).length} 筆記事。備份檔含記事內容，請妥善保存。`);
    } catch { status("無法匯出記事，請檢查儲存設定或同步連線。"); }
  });
  $("import-notes-button").addEventListener("click", () => $("import-notes-file").click());
  $("import-notes-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file || busy) return;
    busy = true; $("import-notes-button").disabled = true;
    try {
      if (file.size > 3 * 1024 * 1024) throw new Error("備份檔最多 3 MB。");
      const data = JSON.parse(await file.text());
      if (data.version !== 1) throw new Error("不支援此備份版本，請選擇由月曆匯出的 JSON 檔。");
      const notes = CalendarLocalNotes.validate(data.notes);
      const result = await app.notesStore.importNotes(notes);
      app.state.notes = result.notes; app.renderMonth();
      status(`已匯入 ${result.imported} 筆記事，${result.skipped} 筆同日期記事已略過。`);
    } catch (error) { status(`匯入失敗：${error.message} 原有記事仍保留。`); }
    finally { busy = false; $("import-notes-button").disabled = false; event.target.value = ""; }
  });
})();
