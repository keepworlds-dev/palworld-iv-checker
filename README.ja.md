[English](README.md) | [한국어](README.ko.md) | **日本語** | [繁體中文](README.zh-Hant.md) | [简体中文](README.zh-CN.md)

# パルワールド 個体値チェッカー

パルワールドのワールドにいる全パルの個体値・パッシブ・技・凝縮・魂強化・持ち主を、セーブデータから直接読み取って一覧にします。処理はすべてブラウザ内で行い、セーブがパソコンの外に出ることも、書き換えられることもありません。

**オンラインで使う：** [パルワールド 個体値チェッカー](https://www.keepworlds.com/ja/tools/palworld-iv-checker?utm_source=github&utm_medium=referral&utm_campaign=palworld_2610_github_ivchecker)

## なぜ必要なのか

ゲーム内ではパルを一匹ずつしか確認できず、専用サーバーではログインしていないプレイヤーのパルも見られません。その情報はすべてセーブに入っています。このツールはワールドの全パルを一つの表にまとめるので、個体値で並べ替えて交配用のパルを選んだり、プレイヤーごとの手持ちを確認したりできます。

## 表示する内容

- HP・攻撃・防御の **個体値**（0〜100）。90 以上は太字、30 未満は薄く表示します。1.0 のセーブには攻撃の個体値が一つだけ記録されています。
- **凝縮** の段階（星）、**魂強化** のレベル（HP・攻撃・防御・作業速度、それぞれ最大 20）、**パッシブ**（良いものは緑、悪いものは赤）、セット中の **技** とそれ以外に覚えている技の数。
- **持ち主**：そのパルを今持っているプレイヤー。拠点で働いているパルはセーブに現在の持ち主が記録されないため「拠点」と表示します。
- **場所**：手持ちの枠、パルボックスのページ（1 ページ 30 枠）、次元パルストレージ、拠点。拠点は番号でまとめるだけで、番号はゲーム内の拠点名とは対応しません。
- 概要：パルの数、プレイヤー数、図鑑の登録数、希少パルの数、プレイヤーごとのパルの数。
- 名前・ニックネーム・パッシブ・技で検索し、持ち主・場所・希少・オヤブン・凝縮済み・魂強化済みで絞り込み、個体値の合計・各個体値・レベル・凝縮・名前で並べ替えられます。
- オヤブン、亜種、捕まえた人間も正しい名前で表示します。同梱の図鑑データより新しいパルや技は、消さずに内部コードのまま表示します。
- パルワールド 1.0 のセーブ（Oodle 圧縮の `PlM`）と以前の zlib セーブ（`PlZ`）に対応し、Steam 版のローカルワールドと専用サーバーのセーブを読めます。Xbox、PlayStation、PC 版 Game Pass のセーブには対応していません。

読み取り専用です。編集したセーブは問題なく開けても、ゲーム内で壊れることがあります。専用サーバーで個体値やパッシブを変えると、ほかのプレイヤーにも影響します。そのため、このツールは何も書き換えません。

## 使い方

1. **セーブを見つける。** 次のどれでも、そのまま選ぶかドロップできます。特定のファイルを探す必要はありません。
   - 自分の Windows PC のワールド（Steam）：`%LOCALAPPDATA%\Pal\Saved\SaveGames`。エクスプローラーのアドレスバーに貼り付けて `SaveGames` フォルダを選ぶと、中のワールドがすべて一覧に出ます。
   - 専用サーバーのワールド：サーバーのインストールフォルダ内の `Pal/Saved/SaveGames/0`。先にパソコンへコピーしてください。ホスティングのパネルから `.zip` で受け取った場合は展開してください。
   - セーブフォルダの `.tar.gz` バックアップ：展開せずにそのまま選ぶかドロップできます。スマートフォンでも使えます。
2. **ツールを開き**、フォルダを選ぶかページにドロップします。
3. ワールドが複数ある場合は **見たいワールドを選びます**。
4. 一覧を **並べ替え・絞り込み** ます。

大きなワールドは読み込みに 10 秒以上かかります。空の次元パルストレージは解析せずに飛ばすので、人数の多いサーバーでも速く読めます。

## ローカルで動かす

Node.js 22.18 以降が必要です。

```sh
npm install
npm run dev
```

`npm run build` を実行すると、どこにでも置ける静的サイトが `dist/` に出力されます。`npm run check` は型チェックと `scripts/check.mjs` の静的チェックを実行します。

## クレジット

セーブの解析は [zlmitchell/palworld-save-toolkit](https://github.com/zlmitchell/palworld-save-toolkit)、Oodle の展開は [SnosMe/ooz-wasm](https://github.com/SnosMe/ooz-wasm)（[powzix/ooz](https://github.com/powzix/ooz) ベース）のコードを無改変で使用しており、どちらも GPL-3.0 です。パル・パッシブ・技の名前は [KrisCris/Palworld-Pal-Editor](https://github.com/KrisCris/Palworld-Pal-Editor)（GPL-3.0）から、属性名は [tylercamp/palcalc](https://github.com/tylercamp/palcalc)（MIT）から書き出しています。フィールド構造は [palworld-save-tools](https://github.com/cheahjs/palworld-save-tools)（MIT）に従っています。ゲームの画像は含みません。詳しくは [THIRD_PARTY.md](THIRD_PARTY.md) をご覧ください。

## ライセンス

[GPL-3.0](LICENSE)。

パルワールド専用サーバーのホスティングを提供する [KeepWorlds](https://www.keepworlds.com/ja?utm_source=github&utm_medium=referral&utm_campaign=palworld_2610_github_ivchecker) がメンテナンスしています。Pocketpair とは関係ありません。
