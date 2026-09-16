"use strict";

(() => {
  const { $, notify } = CalendarApp;
  // Deeper tones keep white text readable across all twelve original choices.
  const themes = [
    ["blue", "靜謐藍", "#153b5f", "#8daaba", "#edf3f7"],
    ["red", "磚紅", "#963939", "#daaaa4", "#faf0ee"],
    ["purple", "暮光紫", "#694379", "#b5a0c3", "#f4eff7"],
    ["green", "森林綠", "#286047", "#98bba8", "#eef5f0"],
    ["orange", "暖橘", "#985023", "#d8b18d", "#faf2e9"],
    ["deep-orange", "落日橘", "#a4412b", "#dda78a", "#faf0e9"],
    ["baby-blue", "晴空藍", "#286285", "#9ac4dd", "#eef6fa"],
    ["cerise", "莓果紅", "#9b395c", "#d5a0b4", "#faf0f4"],
    ["lime", "嫩葉綠", "#526827", "#b7c78b", "#f4f7ed"],
    ["teal", "湖水綠", "#24685f", "#91beb7", "#edf6f4"],
    ["pink", "玫瑰粉", "#984572", "#d5a4c2", "#faf0f6"],
    ["black", "石墨黑", "#303c3c", "#a0afad", "#f0f3f2"]
  ];
  const storageKey = "my-calendar.theme.v1";
  let current = "blue";
  function applyTheme(name) {
    const theme = themes.find(([id]) => id === name) || themes[0];
    current = theme[0];
    ["--primary", "--accent", "--tint"].forEach((property, index) => document.documentElement.style.setProperty(property, theme[index + 2]));
    document.querySelector('meta[name="theme-color"]').content = theme[2];
  }
  function initTheme() {
    try { applyTheme(localStorage.getItem(storageKey)); } catch { applyTheme("blue"); }
    for (const [id, name, color] of themes) {
      const label = document.createElement("label");
      label.className = "color-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "theme";
      input.value = id;
      input.className = "visually-hidden";
      const preview = document.createElement("span");
      preview.className = "color-preview";
      preview.style.setProperty("--swatch", color);
      preview.setAttribute("aria-hidden", "true");
      const caption = document.createElement("span");
      caption.textContent = name;
      label.append(input, preview, caption);
      $("color-options").append(label);
    }
  }
  CalendarApp.initTheme = initTheme;
  $("open-theme").addEventListener("click", () => {
    document.querySelector(`input[name="theme"][value="${current}"]`).checked = true;
    $("theme-dialog").showModal();
    document.querySelector('input[name="theme"]:checked').focus();
  });
  $("theme-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("theme");
    applyTheme(value);
    let message = "主題已更新。";
    try { localStorage.setItem(storageKey, current); } catch { message = "主題已套用，但瀏覽器無法儲存設定。"; }
    $("theme-dialog").close();
    notify(message);
  });
})();
