[English](README.md) | **한국어** | [日本語](README.ja.md) | [繁體中文](README.zh-Hant.md) | [简体中文](README.zh-CN.md)

# 팰월드 개체값 확인 도구

세이브 파일에서 바로 읽어, 팰월드 월드에 있는 모든 팰의 개체값, 패시브, 스킬, 응축, 영혼 강화, 주인을 한 번에 보여 줍니다. 모든 처리는 브라우저 안에서 끝나며, 세이브는 내 컴퓨터 밖으로 나가지 않고 바뀌지도 않습니다.

**온라인에서 바로 사용하기:** [팰월드 개체값 확인 도구](https://www.keepworlds.com/ko/tools/palworld-iv-checker?utm_source=github&utm_medium=referral&utm_campaign=palworld_2610_github_ivchecker)

## 왜 필요한가요

게임 안에서는 팰을 한 마리씩만 확인할 수 있고, 전용 서버(데디 서버)에서는 접속하지 않은 플레이어의 팰을 볼 수 없습니다. 그런데 이 정보는 모두 세이브에 들어 있습니다. 이 도구는 월드의 모든 팰을 표 하나로 보여 주므로, 개체값으로 정렬해 교배용 팰을 고르거나 플레이어마다 어떤 팰을 갖고 있는지 확인할 수 있습니다.

## 보여 주는 정보

- HP, 공격, 방어 **개체값**(0~100). 90 이상은 굵게, 30 미만은 흐리게 표시합니다. 1.0 세이브에는 공격 개체값이 하나만 기록됩니다.
- **응축** 단계(별), **영혼 강화** 레벨(HP·공격·방어·작업 속도, 각각 최대 20), **패시브**(좋은 것은 초록, 나쁜 것은 빨강), 장착한 **스킬**과 그 밖에 익힌 스킬 수.
- **주인**: 지금 그 팰을 가진 플레이어. 거점에서 일하는 팰은 세이브에 현재 주인이 기록되지 않아 "거점"으로 표시됩니다.
- **위치**: 파티 칸, 팰 상자 페이지(페이지당 30칸), 차원 팰 보관소, 거점. 거점은 번호로만 묶이며, 번호는 게임 속 거점 이름과 대응하지 않습니다.
- 요약: 팰 수, 플레이어 수, 도감 등록 수, 희귀 팰 수, 플레이어별 팰 수.
- 이름·별명·패시브·스킬로 검색하고, 주인·위치·희귀·보스·응축함·영혼 강화함으로 거르고, 개체값 합계·개별 개체값·레벨·응축·이름으로 정렬할 수 있습니다.
- 보스, 변이 개체, 포획한 인간도 제 이름으로 표시합니다. 함께 들어 있는 도감 데이터보다 새로운 팰이나 스킬은 빠뜨리지 않고 내부 코드로 표시합니다.
- 팰월드 1.0 세이브(Oodle 압축 `PlM`)와 이전 zlib 세이브(`PlZ`)를 지원하며, Steam판 로컬 월드와 전용 서버 세이브를 읽을 수 있습니다. Xbox, PlayStation, PC Game Pass 세이브는 지원하지 않습니다.

읽기만 합니다. 수정한 세이브는 문제없이 열렸다가 게임 안에서 망가질 수 있고, 전용 서버에서 개체값이나 패시브를 바꾸면 다른 플레이어에게도 영향을 줍니다. 그래서 이 도구는 아무것도 수정하지 않습니다.

## 사용 방법

1. **세이브 찾기.** 아래 중 무엇이든 고르거나 끌어다 놓으면 됩니다. 특정 파일을 찾을 필요는 없습니다.
   - 내 Windows PC의 월드(Steam): `%LOCALAPPDATA%\Pal\Saved\SaveGames`. 파일 탐색기 주소창에 붙여 넣고 `SaveGames` 폴더를 고르면 안에 있는 모든 월드가 나열됩니다.
   - 전용 서버 월드: 서버 설치 폴더 안의 `Pal/Saved/SaveGames/0`. 먼저 내 컴퓨터로 복사하세요. 호스팅 패널에서 `.zip`으로 받았다면 압축을 풀어 주세요.
   - 세이브 폴더의 `.tar.gz` 백업: 압축을 풀지 않고 그대로 고르거나 끌어다 놓으면 됩니다. 휴대폰에서도 됩니다.
2. **도구를 열고** 폴더를 고르거나 페이지에 끌어다 놓습니다.
3. 월드가 여러 개라면 **볼 월드를 고릅니다**.
4. 목록을 **정렬하고 걸러 봅니다**.

큰 월드는 읽는 데 10초 이상 걸립니다. 비어 있는 차원 팰 보관소 파일은 해석하지 않고 건너뛰므로, 플레이어가 많은 서버도 빠르게 읽습니다.

## 로컬에서 실행하기

Node.js 22.18 이상이 필요합니다.

```sh
npm install
npm run dev
```

`npm run build`를 실행하면 어디서나 호스팅할 수 있는 정적 사이트가 `dist/`에 만들어집니다. `npm run check`는 타입 검사와 `scripts/check.mjs`의 정적 검사를 실행합니다.

## 크레딧

세이브 파서는 [zlmitchell/palworld-save-toolkit](https://github.com/zlmitchell/palworld-save-toolkit)을, Oodle 압축 해제는 [SnosMe/ooz-wasm](https://github.com/SnosMe/ooz-wasm)([powzix/ooz](https://github.com/powzix/ooz) 기반)을 수정 없이 그대로 사용하며, 둘 다 GPL-3.0입니다. 팰·패시브·스킬 이름은 [KrisCris/Palworld-Pal-Editor](https://github.com/KrisCris/Palworld-Pal-Editor)(GPL-3.0)에서, 속성 이름은 [tylercamp/palcalc](https://github.com/tylercamp/palcalc)(MIT)에서 가져왔습니다. 필드 구조는 [palworld-save-tools](https://github.com/cheahjs/palworld-save-tools)(MIT)를 따릅니다. 게임 이미지는 포함하지 않습니다. 자세한 내용은 [THIRD_PARTY.md](THIRD_PARTY.md)를 참고하세요.

## 라이선스

[GPL-3.0](LICENSE).

팰월드 전용 서버 호스팅 [KeepWorlds](https://www.keepworlds.com/ko?utm_source=github&utm_medium=referral&utm_campaign=palworld_2610_github_ivchecker)가 관리합니다. Pocketpair와는 관련이 없습니다.
