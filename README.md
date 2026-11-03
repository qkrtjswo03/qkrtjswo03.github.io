# 관측 노트

클라우드, 인프라, AI 운영을 적는 한국어 기술 블로그입니다. 주소는 [https://qkrtjswo03.github.io](https://qkrtjswo03.github.io) 이고, GitHub Pages 사용자 사이트라 저장소 루트에서 제공됩니다.

## 왜 Astro인가

글은 `src/content/blog`에 Markdown 파일 하나만 추가하면 됩니다. 화면, 광고, 사이트맵은 Astro가 빌드할 때 만들고, GitHub Actions가 `main`에 푸시될 때마다 Pages로 올립니다. 로컬에 Node를 설치하지 않아도 됩니다. GitHub 웹에서 파일을 추가하고 커밋하면 배포됩니다.

Jekyll 기본 빌드 대신 Actions를 쓰는 이유는 광고 스크립트와 제휴 문구, 검색, 다크 모드를 설정값 하나로 켜고 끌 수 있기 때문입니다. 설정이 비어 있으면 해당 스크립트는 HTML에 들어가지 않습니다.

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
---

첫 문단입니다. 글의 제목은 위의 title이므로, 본문은 ## 부터 시작합니다.

## 소제목

본문.
```

- `draft: true`이면 목록, RSS, 사이트맵에 나오지 않습니다.
- `categories`와 `tags`는 새 이름을 적어도 주제·태그 페이지가 생깁니다.
- 그림 파일은 `public/images/`에 둡니다. 본문에서는 `/images/파일명.svg`로 부릅니다.
- `updatedDate`는 생략해도 됩니다.

쿠팡 파트너스처럼 제휴 링크를 넣을 때는 원하는 위치에 아래 한 줄을 **혼자** 둡니다. 위아래는 빈 줄입니다.

```md
::affiliate
```

빌드하면 다음 문장으로 바뀝니다.

> 이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.

## 설정

모든 값은 `src/config.ts`입니다.

| 항목 | 넣을 값 | 비어 있을 때 |
| --- | --- | --- |
| `email` | 본인 이메일 | 문의·개인정보처리방침에 예시 주소가 보입니다 |
| `adsensePublisherId` | `ca-pub-` 뒤 숫자 | 광고 스크립트, 본문·사이드바 광고 영역, 실제 ads.txt를 넣지 않습니다 |
| `adsenseInArticleSlot` | 광고 단위 숫자 ID | 없어도 게시자 ID만으로 인아티클 영역은 켜집니다 |
| `adsenseSidebarSlot` | 광고 단위 숫자 ID | 없어도 사이드바 영역은 켜집니다 |
| `ga4MeasurementId` | `G-`로 시작 | Analytics 스크립트를 넣지 않습니다 |
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
npm run dev
```

브라우저에서 `http://localhost:4321`을 엽니다. 배포와 같은 결과를 확인하려면 `npm run build` 다음 `npm run preview`입니다.

## 검색과 피드

- 사이트맵: `/sitemap-index.xml`
- robots: `/robots.txt`
- RSS: `/rss.xml`
- 글 검색은 `/search/`에서 페이지 안의 목록을 거릅니다. 별도 검색 서버는 없습니다.
- 기본 화면은 어두운 터미널입니다. 오른쪽 위 버튼으로 밝은 화면을 켤 수 있고, 고른 값은 이 브라우저에만 저장됩니다.

## 글 쓰기 버튼 (소유자)

홈, 글 목록, 글 페이지의 `new post`, `edit`, `delete`는 GitHub에서 파일을 만들거나 고치거나 지우는 링크입니다. 저장소에 쓸 권한이 있는 사람만 실제로 커밋할 수 있고, 그 판단은 GitHub가 합니다. 이 사이트는 비밀번호나 토큰을 넣지 않습니다.

버튼은 기본적으로 숨겨 있습니다. 주소 끝에 `?owner=1`을 붙이면 이 브라우저에만 켜지고, `?owner=0`이면 꺼집니다. 선택한 값은 `owner-mode`라는 이름으로 이 브라우저의 localStorage에만 남습니다.
