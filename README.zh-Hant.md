[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | **繁體中文** | [简体中文](README.zh-CN.md)

# 幻獸帕魯 IV 個體值查詢

直接讀取存檔，列出《幻獸帕魯》世界裡每隻帕魯的個體值、被動、技能、濃縮、魂強化和主人。全程在瀏覽器裡完成，存檔不會離開你的電腦，也不會被修改。

**線上使用：** [幻獸帕魯 IV 個體值查詢](https://www.keepworlds.com/zh-Hant/tools/palworld-iv-checker?utm_source=github&utm_medium=referral&utm_campaign=palworld_2610_github_ivchecker)

## 為什麼需要它

遊戲裡只能一隻一隻查看帕魯，專用伺服器上也看不到不在線玩家的帕魯。這些資料其實都在存檔裡。這個工具把世界裡的每隻帕魯放進同一張表，可以按個體值排序挑選配種用的帕魯，也能看每位玩家各有哪些帕魯。

## 會顯示什麼

- 生命、攻擊、防禦三項 **個體值**（0 到 100）。90 以上加粗，30 以下變淡。1.0 的存檔只記錄一項攻擊個體值。
- **濃縮** 星數、**魂強化** 等級（生命、攻擊、防禦、工作速度，各最高 20）、**被動**（好的綠色、壞的紅色）、裝備中的 **技能**，以及另外學會了幾招。
- **主人**：這隻帕魯目前屬於哪位玩家。派到據點工作的帕魯在存檔裡沒有現任主人，顯示為「據點」。
- **位置**：隊伍格位、帕魯終端頁碼（每頁 30 格）、次元帕魯倉庫或據點。據點只按編號分組，編號與遊戲裡的據點名稱不對應。
- 概覽：帕魯總數、玩家數、圖鑑收集數、稀有帕魯數，以及每位玩家的帕魯數。
- 可依名稱、暱稱、被動或技能搜尋；依主人、位置、稀有、頭目、濃縮過、魂強化過篩選；依個體值合計、單項個體值、等級、濃縮或名稱排序。
- 頭目、變種和捕捉到的人類都會顯示正確名稱。比內附圖鑑資料更新的帕魯或技能不會被丟掉，而是直接顯示內部代號。
- 支援《幻獸帕魯》1.0 存檔（Oodle 壓縮的 `PlM`）與舊版 zlib 存檔（`PlZ`），可讀 Steam 版本機世界與專用伺服器的存檔。Xbox、PlayStation、PC 版 Game Pass 的存檔不支援。

它只讀不寫。改過的存檔可能正常載入，卻在遊戲裡出問題；在專用伺服器上改個體值和被動，也會影響其他玩家。所以這個工具不修改任何內容。

## 使用方式

1. **找到存檔。** 以下任一種都可以直接選取或拖進來，不用自己找特定檔案。
   - 自己 Windows 電腦上的世界（Steam）：`%LOCALAPPDATA%\Pal\Saved\SaveGames`。貼到檔案總管的網址列，選取 `SaveGames` 資料夾，裡面的世界都會列出來。
   - 專用伺服器的世界：伺服器安裝資料夾裡的 `Pal/Saved/SaveGames/0`。先複製到自己的電腦。如果託管面板給的是 `.zip`，請先解壓縮。
   - 存檔資料夾的 `.tar.gz` 備份：不用解壓縮，直接選取或拖進來。手機上也能用。
2. **打開工具**，選取資料夾或拖進頁面。
3. 有多個世界時，**選一個要看的世界**。
4. **排序與篩選** 列表。

大型世界讀取需要十秒以上。空的次元帕魯倉庫會直接略過、不解析，人多的伺服器也能很快讀完。

## 在本機執行

需要 Node.js 22.18 或以上版本。

```sh
npm install
npm run dev
```

執行 `npm run build` 會在 `dist/` 產生可部署到任何地方的靜態網站。`npm run check` 會執行型別檢查與 `scripts/check.mjs` 的靜態檢查。

## 致謝

存檔解析直接使用未經修改的 [zlmitchell/palworld-save-toolkit](https://github.com/zlmitchell/palworld-save-toolkit)，Oodle 解壓縮使用 [SnosMe/ooz-wasm](https://github.com/SnosMe/ooz-wasm)（基於 [powzix/ooz](https://github.com/powzix/ooz)），兩者皆為 GPL-3.0。帕魯、被動與技能名稱匯出自 [KrisCris/Palworld-Pal-Editor](https://github.com/KrisCris/Palworld-Pal-Editor)（GPL-3.0），屬性名稱來自 [tylercamp/palcalc](https://github.com/tylercamp/palcalc)（MIT）。欄位結構參照 [palworld-save-tools](https://github.com/cheahjs/palworld-save-tools)（MIT）。不包含任何遊戲美術素材。詳見 [THIRD_PARTY.md](THIRD_PARTY.md)。

## 授權

[GPL-3.0](LICENSE)。

由幻獸帕魯專用伺服器託管服務 [KeepWorlds](https://www.keepworlds.com/zh-Hant?utm_source=github&utm_medium=referral&utm_campaign=palworld_2610_github_ivchecker) 維護。與 Pocketpair 無關。
