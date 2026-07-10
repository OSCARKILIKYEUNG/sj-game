# Spidey Jump v3

以 Phaser、TypeScript 和 Vite 重建的直向跳躍遊戲。桌面及手機使用同一份程式碼，可免費部署到 GitHub Pages。

> 個人／內部非商業用途。角色概念屬 Marvel IP；請保持連結低調、不要作商業宣傳。頁面已設 `noindex`。

## 技術與啟動

- Phaser 4：2D 遊戲、物理與場景管理
- TypeScript：嚴格型別
- Vite：開發、建置及 GitHub Pages 路徑
- Vitest：核心規則與 Boss 狀態測試

```bash
npm install
npm run dev
npm test
npm run build
```

正式建置輸出在 `dist/`。原本的 `spidey-jump.html` 和 `logic-test.js` 只保留作 v2 參考，v3 入口是 `index.html`。

## 操作

| 動作 | 桌面 | 手機 |
|---|---|---|
| 左右移動 | `←` `→` 或 `A` `D` | 傾斜手機；感應器不可用時顯示左右鍵 |
| 向上射網 | 短按滑鼠左鍵 | 短按畫面 |
| 滑翔 | 按住滑鼠右鍵 | 長按畫面約 0.22 秒 |
| 暫停／靜音 | `P`／`M` 或右上按鈕 | 右上 48px 按鈕 |

iPhone 首次使用傾斜控制時按 `ENABLE TILT` 並授權。裝置方向 API 需要 HTTPS，GitHub Pages 已符合。切到背景、失焦或手機橫放時遊戲會暫停；回來後按 `TAP TO RESUME`。

## v3 遊戲規則

- 全程共用 3 條生命；敵人、子彈或 Boss 攻擊扣 1 命，之後有 1.8 秒無敵時間。
- 跌出畫面立即結束，不會只扣一命。
- 約 5,000 分開始有賊人：會先警示，再短距離持刀飛撲；踩一次或射網一次可擊敗。
- 約 5,400 分開始有市民：接觸即救援，回復 1 命，上限仍是 3。
- 約 6,500 分開始有警察：會先警示再射子彈；不能踩死，也不能用網擊殺，應避開。
- Iron Man 反應爐道具約每 4,200–5,600 高度出現；取得後 Iron Man 抱 Spider-Man 上升 900 高度，期間無敵，結束時生成安全平台。
- 每 10,000 分一場 Boss 戰。Sandman 和 Rhino 都有 3 HP，必須在攻擊後的反擊窗口踩頭 3 次。勝出獎勵 1,500 分、網與滑翔各 +5。

### Rhino

Rhino 先在場中等待，0.85 秒紅色警示後，對準玩家高度作高速直線角撞。角只在衝刺期間造成傷害。撞到左右牆後會停在畫面內側、變金色並顯示 `STOMP!`，反擊窗口維持 2.4 秒。玩家需在窗口內由上而下踩頭；3 次成功即勝出。失去最後一命或跌落即失敗。

## GitHub Pages

專案已包含 `.github/workflows/deploy-pages.yml`。推送到 `main` 後會自動執行測試、建置和部署。

1. GitHub repo 的 **Settings → Pages → Build and deployment** 選 **GitHub Actions**。
2. 確認 repo 名稱是 `sj-game`；`vite.config.ts` 的 base 已設定為 `/sj-game/`。
3. 推送到 `main`，等待 `Deploy game to GitHub Pages` workflow 完成。

預期網址：<https://oscarkilikyeung.github.io/sj-game/>

## QA/debug URL

- `?touch=1`：強制顯示手機備援控制
- `?start=1`：直接開始
- `?score=5000`：跳到指定分數
- `?boss=sandman` 或 `?boss=rhino`：直接進入 Boss 戰

例：`http://localhost:5173/?touch=1&start=1&score=5000`
