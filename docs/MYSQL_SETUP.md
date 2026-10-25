# Node.js + MySQL：Windows 安裝與使用

先讓專案在自己的電腦連到 MySQL，再處理公開部署。每一步完成後再做下一步。密碼只保存在本機設定，不要貼到聊天室或提交到 Git。

## 1. 安裝 MySQL Server

前往 [MySQL Community Server 官方下載](https://dev.mysql.com/downloads/mysql/)，選擇 **8.4 LTS → Windows → MSI**。8.4 的 MSI 包含 MySQL Configurator；只裝 Workbench 不會安裝資料庫服務。參考 [官方 Windows 安裝說明](https://dev.mysql.com/doc/refman/8.4/en/windows-installation.html)。

安裝後執行 Configurator：

1. 選擇 Development 開發用途，TCP/IP 連接埠保留 `3306`。
2. 本機學習不需要開放防火牆給外部電腦。
3. 設定 root 管理密碼並自己保存。
4. 設為 Windows 服務，套用設定並確認服務啟動。

設定可參照 [Configurator 官方說明](https://dev.mysql.com/doc/refman/8.4/en/mysql-configurator.html)。在 PowerShell 驗證：

```powershell
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe' -u root -p
```

出現 `Enter password:` 後輸入管理密碼；輸入時不會顯示字元。不要把密碼加在指令後面。

## 2. 建立資料庫與專案帳號

在 `mysql>` 中執行。`SOURCE` 請換成實際專案路徑，使用正斜線：

```sql
CREATE DATABASE calendar_app CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE calendar_app;
SOURCE C:/Users/USER/Desktop/calendar/server/schema.sql;

CREATE USER 'calendar_app'@'127.0.0.1' IDENTIFIED BY 'REPLACE_WITH_YOUR_OWN_LONG_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON calendar_app.* TO 'calendar_app'@'127.0.0.1';
SHOW TABLES;
```

將密碼範例換成自己的專案密碼。`SHOW TABLES` 應看到 `calendar_users`、`calendar_sessions`、`calendar_notes`，分別儲存網站使用者、登入工作階段與記事。

網站使用權限較小的 calendar_app 資料庫帳號；管理操作才用 root。它們都不是稍後在網站註冊的登入帳號。

已存在的資料庫、帳號不需要重建。schema.sql 使用 `CREATE TABLE IF NOT EXISTS`，保留既有資料。`npm run db:init` 也能建表，但需提供具有建表權限的管理連線；上面已用 root 建表時不需再執行。

## 3. 設定 .env

在專案目錄執行；只有尚未建立 `.env` 時才複製範本，避免蓋掉自己的設定：

```powershell
Set-Location 'C:\Users\USER\Desktop\calendar'
Copy-Item .env.example .env
notepad .env
```

內容調整為：

```dotenv
STORAGE_MODE=mysql
PORT=3000
APP_ORIGIN=http://localhost:3000
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=calendar_app
DB_USER=calendar_app
DB_PASSWORD="你剛設定的專案密碼"
DB_SSL=false
ALLOW_REGISTRATION=true
```

DB_PASSWORD 是 calendar_app 資料庫帳號的密碼，不是 root 密碼。`.env` 已被 Git 忽略，也不會由網站提供下載。

## 4. 啟動 Node.js

```powershell
npm ci
npm run dev
```

開啟 **http://localhost:3000**，和 APP_ORIGIN 保持完全一致。終端應顯示 `(MySQL)`，側欄出現「登入同步」。這個步驟使用本機網站，不是 GitHub Pages。

沒有 `.env` 時預設使用本機記事；`npm run dev:mysql` 則會要求可用的資料庫設定。

| 錯誤 | 檢查方式 |
| --- | --- |
| ECONNREFUSED | MySQL Windows 服務是否啟動、連接埠是否 3306 |
| ER_ACCESS_DENIED_ERROR | DB_USER、DB_PASSWORD 與帳號 host 是否一致 |
| ER_BAD_DB_ERROR | 是否已建立 calendar_app 資料庫 |
| ER_NO_SUCH_TABLE | 是否在正確資料庫執行 schema.sql |
| 來源驗證錯誤 | 網址是否是 localhost:3000，而不是 127.0.0.1:3000 |

## 5. 建立網站帳號與記事

1. 點「登入同步」，填入 3–32 位英數字或底線的帳號，及 10–128 字元密碼。
2. 點「建立帳號」。成功後標籤變成「帳號記事」。
3. 關閉帳號視窗，點日期新增記事。
4. 重新整理，確認記事保留。
5. 在另一個瀏覽器開啟相同網址，登入同一帳號，確認讀到相同記事。

網站密碼經 scrypt 雜湊，登入工作階段有效七天；過期需重新登入。目前沒有忘記密碼功能。

可在 MySQL 管理介面查驗：

```sql
USE calendar_app;
SELECT id, username, created_at FROM calendar_users;
SELECT user_id, note_date, content FROM calendar_notes ORDER BY note_date;
```

## 6. 搬移舊記事

同網址的本機記事，可以登入後在帳號視窗按「匯入本機記事至此帳號」。若舊記事在 GitHub Pages，而後端在 localhost，請使用備份檔：

1. 在原本使用的瀏覽器、原 GitHub Pages 網址按「匯出記事」。
2. 開啟 localhost:3000 並登入網站帳號，確認標籤為「帳號記事」。
3. 按「匯入備份」，選取下載的 JSON。
4. 查看新增與略過筆數。帳號已有記事的日期不會被覆寫。
5. 驗證資料後保留備份檔；原網站的 localStorage 不會被刪除。

備份涵蓋所有月份。每次最多 1,000 筆、檔案最多 3 MB。MySQL DATE 不支援 1000 年以前的日期；有此類舊記事時請先保留原備份，不要直接匯入。

## 7. 本機與公開部署

localhost 表示目前這台電腦；手機的 localhost 不是你的電腦。本機安裝 MySQL 不會自動讓 GitHub Pages 變成帳號同步網站。

下一階段需部署「同一個 Node.js 服務與前端」，並連接可用的 MySQL。設定 `NODE_ENV=production`、HTTPS 的 `APP_ORIGIN` 與資料庫連線。雲端 MySQL 若要求 TLS，使用 `DB_SSL=true`，必要時以 `DB_SSL_CA` 指向服務商的 CA 檔。

本專案不使用跨網域 Cookie API，前後端由同一服務提供。正式啟動指令是 `npm start`。選定平台後再設定資料庫備份、註冊限制及公開網址；Pages 可繼續作為本機模式展示。

## 測試專用資料庫

另建 calendar_test 資料庫及測試帳號，依第 2 步建表。不要使用一般記事資料庫。在單獨的 PowerShell 視窗設定：

```powershell
$env:RUN_MYSQL_TESTS='1'
$env:DB_NAME='calendar_test'
$env:DB_USER='你的測試帳號'
$env:DB_PASSWORD='你的測試密碼'
npm run test:api
```

資料庫名稱必須以 `_test` 結尾。測試會建立隨機使用者，最後只清除自己建立的使用者及關聯資料。測完關閉此終端，重新開終端啟動開發服務，避免沿用測試連線。

GitHub CI 會啟動 MySQL 8.4 的獨立測試服務。本機未設定 RUN_MYSQL_TESTS=1 時，真實資料庫測試會顯示 SKIP。
