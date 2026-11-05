# SunJae.Log

클라우드, 인프라, AI 운영을 적는 한국어 기술 블로그입니다. 주소는 [https://qkrtjswo03.github.io](https://qkrtjswo03.github.io) 이고, GitHub Pages 사용자 사이트라 저장소 루트에서 제공됩니다. 화면은 k9s·vim을 떠올리게 한 어두운 터미널 테마입니다.

## 왜 Astro인가

글은 `src/content/blog`에 Markdown 파일 하나만 추가하면 됩니다. 화면, 광고 자리, 사이트맵, OG 이미지, 검색 색인은 Astro가 빌드할 때 만들고, GitHub Actions가 `main`에 푸시될 때마다 Pages로 올립니다. 로컬에 Node를 설치하지 않아도 됩니다. GitHub 웹에서 파일을 추가하고 커밋하면 배포됩니다.

설정이 비어 있으면 해당 스크립트는 HTML에 들어가지 않습니다. AdSense 게시자 ID는 `src/config.ts`에 자리만 있고, 값을 넣기 전에는 광고를 넣지 않습니다.

## 지금 있는 기능

- **글 목록**은 k9s 표처럼 보입니다. `/`로 필터하고, 포커스된 목록에서 `j`/`k` 또는 화살표로 이동합니다. 아카이브처럼 연도가 여러 개이면 포커스된 연도만 움직입니다.
- **검색**(`/search/`)은 제목·주제·태그뿐 아니라 본문도 찾습니다. 본문 색인(`/search-index.json`)은 검색을 시작할 때만 불러오므로 다른 페이지를 키우지 않습니다. 잠긴 글의 본문은 색인에 넣지 않습니다.
- **잠긴 글**은 페이지 HTML에 본문을 넣지 않고, 저장소 주인의 GitHub 토큰으로만 엽니다. 잠긴 글은 사이트맵·robots에서 빠지고 `noindex`입니다.
- **복사 방지**는 글 본문 영역에서만 동작합니다. 방문자는 본문을 복사할 수 없고, 사이트 전체에서 인쇄(`Ctrl+P`)는 허용합니다. 주인으로 로그인하면 해제가 됩니다.
- **웹 터미널**(하단 vim 독, `/terminal/`)에서 `login`, `ls`, `cat`, `cd`, `edit`, `:w`/`:q`/`:wq`, `posts`, `lock` 등을 쓸 수 있습니다. 모바일에서는 독이 자동으로 열리지 않습니다.
- **주인 로그인**은 브라우저 `prompt`가 아니라 테마에 맞춘 페이지 안 창입니다. 토큰은 이 탭의 `sessionStorage`에만 두고 저장소에는 넣지 않습니다.
- **PWA** 서비스 워커는 문서를 네트워크 우선으로 가져옵니다. `api.github.com`, raw GitHub URL, 광고 호스트는 캐시하지 않습니다.
- **보기 전환**과 k9s 스타일 움직임이 있습니다. `prefers-reduced-motion`이면 움직임을 줄입니다.
- **SEO**: 사이트맵, `robots.txt`, RSS, Open Graph(1200×630) 이미지가 빌드됩니다.
- **날짜**는 화면에 Asia/Seoul(KST)로 표시합니다.
- **인쇄** 시 왼쪽 레일, 오른쪽 상태 패널, 하단 vim 독 같은 장식은 숨깁니다.
- **조회수**는 GoatCounter가 켜져 있으면 글 페이지와 전체(TOTAL)에 표시합니다. 목록마다 카운터를 치지 않아, 조회가 없는 글의 404가 홈 콘솔에 나지 않습니다.

## 배포하기 전에 한 번만

1. 저장소 **Settings → Pages → Build and deployment**
2. **Source**를 **GitHub Actions**로 바꿉니다.
3. `main`에 푸시되어 있으면 **Actions** 탭에서 “GitHub Pages로 배포”를 한 번 다시 실행합니다.

워크플로는 `.github/workflows/deploy.yml`입니다. Source를 “Deploy from a branch”로 두면 이 워크플로가 사이트를 갱신하지 않습니다. 첫 실행에서 `github-pages` 환경 승인을 물으면 승인하면 됩니다.

## 새 글 쓰기

`src/content/blog/파일-이름.md`를 추가합니다. 파일 이름이 주소가 됩니다. 예를 들어 `src/content/blog/loki-memberlist-cluster-dns.md`는 `/blog/loki-memberlist-cluster-dns/`입니다.

```md
---
title: "글 제목"
description: "검색 결과와 공유 카드에 쓰이는 한두 문장"
pubDate: 2026-11-03
updatedDate: 2026-11-03
categories:
  - 쿠버네티스
tags:
  - Prometheus
heroImage: "/images/example.svg"
heroAlt: "그림이 없어도 이해되는 설명"
draft: false
sample: false
locked: false
---

첫 문단입니다. 글의 제목은 위의 title이므로, 본문은 ## 부터 시작합니다.

## 소제목

본문.
```

- `draft: true`이면 목록, RSS, 사이트맵에 나오지 않습니다.
- `locked: true`이면 본문을 페이지에 넣지 않습니다. 저장소 주인만 터미널 로그인 뒤에 볼 수 있습니다.
- `categories`와 `tags`는 새 이름을 적어도 주제·태그 페이지가 생깁니다.
- 그림 파일은 `public/images/`에 둡니다. 본문에서는 `/images/파일명.svg`로 부릅니다.
- `updatedDate`는 생략해도 됩니다.
- 시리즈 글은 `series`와 `seriesOrder`를 쓸 수 있습니다.

쿠팡 파트너스처럼 제휴 링크를 넣을 때는 원하는 위치에 아래 한 줄을 **혼자** 둡니다. 위아래는 빈 줄입니다.

```md
::affiliate
```

빌드하면 다음 문장으로 바뀝니다.

> 이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.

브라우저 터미널에서도 `new post`, `edit`, `save`, `pr`, `lock`으로 글을 다루고, `login`으로 주인 토큰을 넣을 수 있습니다.

## 설정

모든 값은 `src/config.ts`입니다.

| 항목 | 넣을 값 | 비어 있을 때 |
| --- | --- | --- |
| `email` | 본인 이메일 | 문의·개인정보처리방침에 예시 주소가 보입니다 |
| `adsensePublisherId` | `ca-pub-` 뒤 숫자 | 광고 스크립트, 본문·사이드바 광고 영역, 실제 ads.txt를 넣지 않습니다 |
| `adsenseInArticleSlot` | 광고 단위 숫자 ID | 없어도 게시자 ID만으로 인아티클 영역은 켜집니다 |
| `adsenseSidebarSlot` | 광고 단위 숫자 ID | 없어도 사이드바 영역은 켜집니다 |
| `ga4MeasurementId` | `G-`로 시작 | Analytics 스크립트를 넣지 않습니다 |
| `goatcounterCode` | GoatCounter 서브도메인 | 통계 스크립트와 조회수를 넣지 않습니다 |
| `googleSiteVerification` | Search Console content 값 | 확인 메타 태그를 넣지 않습니다 |
| `naverSiteVerification` | 서치어드바이저 content 값 | 확인 메타 태그를 넣지 않습니다 |
| `giscus.enabled` | `true`와 repo, repoId, category, categoryId | 기본 `false`. 댓글 스크립트를 넣지 않습니다 |

광고 ID를 넣으면 `<head>`에 AdSense 자동 광고 스크립트가 들어가고, 글 본문 첫 단락 뒤와 사이드바에 광고 영역이 생깁니다. 같은 값으로 `ads.txt`도 다시 만들어집니다. 주소는 `https://qkrtjswo03.github.io/ads.txt`이고, 내용은 `google.com, pub-숫자, DIRECT, f08c47fec0942fa0`입니다. `pub-` 앞의 `ca-`는 빼서 넣습니다.

AdSense 심사에 자주 보는 페이지는 이미 연결되어 있습니다.

- 소개 `/about/`
- 개인정보처리방침 `/privacy/` (쿠키, AdSense, Analytics, 제휴 링크)
- 문의 `/contact/`
- 주제 `/categories/`, 태그 `/tags/`, 검색 `/search/`, 아카이브 `/archive/`

소개·방침·문의의 문장은 각각 `src/pages/about.astro`, `privacy.astro`, `contact.astro`입니다. 블로그 이름과 한 줄 소개는 `src/config.ts`의 `title`, `tagline`, `description`입니다.

댓글을 켤 때는 [giscus.app](https://giscus.app)에서 이 저장소를 연결한 뒤 나온 `data-repo`, `data-repo-id`, `data-category`, `data-category-id`를 `giscus`에 붙이고 `enabled`를 `true`로 둡니다. 저장소 Discussions가 켜져 있어야 합니다.

## 로컬에서 보기

Node.js 22가 필요합니다.

```bash
npm install
npm test
npm run dev
```

브라우저에서 `http://localhost:4321`을 엽니다. 배포와 같은 결과를 확인하려면 `npm run build` 다음 `npm run preview`입니다. `npm test`는 터미널 명령 파서(ls/cat/cd/:q/:w/:wq/history)와 서울 시간 날짜 표시를 검사합니다.

## 검색과 피드

- 사이트맵: `/sitemap-index.xml`
- robots: `/robots.txt`
- RSS: `/rss.xml`
- 글 검색은 `/search/`에서 제목·본문·주제·태그를 거릅니다. 본문 색인은 `/search-index.json`이며 검색할 때 한 번 불러옵니다.
- 기본 화면은 어두운 터미널입니다.

## 글 쓰기와 주인 기능

홈, 글 목록, 글 페이지의 `new post`, `edit`, `delete`, 잠금 전환은 웹 터미널을 통해 저장소를 고칩니다. 저장소 주인 GitHub 계정으로 `login`한 뒤에만 실제로 커밋할 수 있습니다. 토큰은 이 탭의 세션에만 남고, 저장소나 페이지 소스에 넣지 않습니다.

자물쇠 아이콘은 공개 글(열린 자물쇠)과 잠긴 글(닫힌 자물쇠)을 구별합니다. 잠금 전환 버튼은 주인 인증이 끝난 뒤에만 보입니다.
