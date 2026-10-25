[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [繁體中文](README.zh-Hant.md) | **简体中文**

# 幻兽帕鲁个体值查看器

直接读取存档，列出幻兽帕鲁世界里每只帕鲁的个体值、被动、技能、浓缩、魂强化和主人。全程在浏览器里完成，存档不会离开你的电脑，也不会被修改。

**在线使用：** [幻兽帕鲁个体值查看器](https://www.keepworlds.com/tools/palworld-iv-checker?utm_source=github&utm_medium=referral&utm_campaign=palworld_2610_github_ivchecker)

## 为什么需要它

游戏里只能一只一只地查看帕鲁，专用服务器上也看不到不在线玩家的帕鲁。这些信息其实都在存档里。这个工具把世界里的每只帕鲁放进同一张表，可以按个体值排序挑选配种用的帕鲁，也能看每个玩家各有哪些帕鲁。

## 会显示什么

- 生命、攻击、防御三项 **个体值**（0 到 100）。90 以上加粗，30 以下变淡。1.0 的存档只记录一项攻击个体值。
- **浓缩** 星数、**魂强化** 等级（生命、攻击、防御、工作速度，各最高 20）、**被动**（好的绿色、坏的红色）、装备中的 **技能**，以及另外学会了几招。
- **主人**：这只帕鲁目前属于哪个玩家。派到据点干活的帕鲁在存档里没有现主人，显示为“据点”。
- **位置**：队伍格位、帕鲁终端页码（每页 30 格）、次元帕鲁储藏或据点。据点只按编号分组，编号与游戏里的据点名称不对应。
- 概览：帕鲁总数、玩家数、图鉴收集数、稀有帕鲁数，以及每个玩家的帕鲁数。
- 可以按名称、昵称、被动或技能搜索；按主人、位置、稀有、头目、浓缩过、魂强化过筛选；按个体值合计、单项个体值、等级、浓缩或名称排序。
- 头目、变种和捕获的人类都会显示正确名称。比内置图鉴数据更新的帕鲁或技能不会被丢掉，而是直接显示内部代号。
- 支持幻兽帕鲁 1.0 存档（Oodle 压缩的 `PlM`）和旧版 zlib 存档（`PlZ`），可以读 Steam 版本地世界和专用服务器的存档。Xbox、PlayStation、PC 版 Game Pass 的存档不支持。

它只读不写。改过的存档可能正常加载，却在游戏里出问题；在专用服务器上改个体值和被动，也会影响其他玩家。所以这个工具不修改任何内容。

## 使用方法

1. **找到存档。** 以下任何一种都可以直接选中或拖进来，不用自己找特定文件。
   - 自己 Windows 电脑上的世界（Steam）：`%LOCALAPPDATA%\Pal\Saved\SaveGames`。粘贴到文件资源管理器的地址栏，选中 `SaveGames` 文件夹，里面的世界都会列出来。
   - 专用服务器的世界：服务器安装目录里的 `Pal/Saved/SaveGames/0`。先复制到自己的电脑上。如果面板给的是 `.zip`，请先解压。
   - 存档文件夹的 `.tar.gz` 备份：不用解压，直接选中或拖进来。手机上也能用。
2. **打开工具**，选中文件夹或拖进页面。
3. 有多个世界时，**选一个要看的世界**。
4. **排序和筛选** 列表。

大世界读取要十秒以上。空的次元帕鲁储藏会直接跳过、不解析，人多的服务器也能很快读完。

## 在本地运行

需要 Node.js 22.18 或更高版本。

```sh
npm install
npm run dev
```

运行 `npm run build` 会在 `dist/` 生成一个可以部署到任何地方的静态网站。`npm run check` 会执行类型检查和 `scripts/check.mjs` 里的静态检查。

## 致谢

存档解析原样使用 [zlmitchell/palworld-save-toolkit](https://github.com/zlmitchell/palworld-save-toolkit)，Oodle 解压使用 [SnosMe/ooz-wasm](https://github.com/SnosMe/ooz-wasm)（基于 [powzix/ooz](https://github.com/powzix/ooz)），两者均为 GPL-3.0。帕鲁、被动和技能名称导出自 [KrisCris/Palworld-Pal-Editor](https://github.com/KrisCris/Palworld-Pal-Editor)（GPL-3.0），属性名称来自 [tylercamp/palcalc](https://github.com/tylercamp/palcalc)（MIT）。字段结构参照 [palworld-save-tools](https://github.com/cheahjs/palworld-save-tools)（MIT）。不包含任何游戏美术素材。详见 [THIRD_PARTY.md](THIRD_PARTY.md)。

## 许可证

[GPL-3.0](LICENSE)。

由幻兽帕鲁专用服务器托管服务 [KeepWorlds](https://www.keepworlds.com/?utm_source=github&utm_medium=referral&utm_campaign=palworld_2610_github_ivchecker) 维护。与 Pocketpair 无关。
