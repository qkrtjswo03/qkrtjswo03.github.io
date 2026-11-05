---
title: "Grafana 대시보드 링크 일원화: 도메인 하나, 경로로 나누기"
description: "흩어져 있던 Grafana 대시보드 주소를 메인 도메인 하나로 모으고, Istio Gateway와 VirtualService 경로 라우팅, OAuth2 Proxy·Keycloak 인증을 거쳐 대시보드까지 가는 7단계 흐름을 정리했다."
pubDate: 2026-11-05T13:30:00+09:00
categories:
  - 관측
  - 보안
tags:
  - Grafana
  - Istio
  - VirtualService
  - OAuth2 Proxy
  - Keycloak
series: grafana-unified-auth
seriesOrder: 1
draft: false
---

사내 Kubernetes PaaS에는 Grafana 대시보드가 스무 개 가까이 있다. 클러스터 HA, 미들웨어, VM, 네트워크, 로그, 베어메탈, GPU, 그리고 Kubernetes 기본 컴포넌트까지. 예전에는 대시보드마다 접근 주소가 제각각이라 콘솔에서 링크를 걸 때도, 인증서를 관리할 때도 번거로웠다.

그래서 **메인 도메인 하나 아래에서 경로만 바꿔** 모든 대시보드로 들어가게 만들었다. 이 글은 그 구성의 큰 그림이고, 경로별 라우팅 규칙은 [다음 글](/blog/grafana-dashboard-route-rules/), 인증 구조는 [세 번째 글](/blog/grafana-oauth2-keycloak-auth/)에서 다룬다.

## 왜 일원화했나

| 목표 | 내용 |
| --- | --- |
| 단일 진입점 | 메인 도메인 하나로 모든 모니터링 대시보드에 접근 |
| 경로 기반 라우팅 | URL 경로로 서비스별 대시보드를 구분 |
| 통합 인증·보안 | 어느 대시보드로 가든 같은 인증·접근 정책 적용 |
| 운영 효율 | 서브도메인마다 따로 두던 SSL 인증서와 DNS 레코드를 하나로 정리 |

대시보드가 늘 때마다 서브도메인을 하나씩 늘리는 대신, 경로 규칙 한 줄만 추가하면 되게 하는 게 핵심이다.

## 구성 요소

| 구성 요소 | 역할 |
| --- | --- |
| Istio Gateway | 외부 트래픽이 메시 안으로 들어오는 진입점 |
| VirtualService | URL 경로를 보고 어느 대시보드로 보낼지 결정, 필요하면 URI rewrite |
| OAuth2 Proxy | 세션 확인, 미인증 요청은 Keycloak으로 리다이렉트 |
| Keycloak | 중앙 인증 서버(SSO, OIDC) |
| Redis | OAuth2 Proxy 세션 저장소 |
| Grafana | 실제 대시보드 |

접근 주소는 이런 모양이 된다.

```text
https://console.example.com/v1/grafana/dashboards/<그룹>/<대시보드 별칭>
```

사용자는 Grafana 내부 UID(`/d/<uid>/<slug>?...`)를 몰라도 된다. 짧고 읽히는 별칭 경로만 알면 VirtualService가 실제 대시보드 URL로 바꿔 준다.

## 대시보드는 어떻게 묶였나

플랫폼(IaaS) 쪽과 Kubernetes 쪽 두 묶음으로 나뉜다.

| 묶음 | 대분류 | 대시보드 |
| --- | --- | --- |
| 플랫폼 | HA | Cluster Monitoring, HAProxy & Pacemaker |
| 플랫폼 | Components | 플랫폼 서비스 Monitoring |
| 플랫폼 | VM | Virtual Machine Resource |
| 플랫폼 | Middleware | Memcached, MySQL, RabbitMQ |
| 플랫폼 | Network | Virtual Network(OVS) |
| 플랫폼 | Log | 플랫폼 Log Monitoring |
| 플랫폼 | Baremetal | Node IPMI, Node Resource |
| 플랫폼 | GPU | GPU Monitoring |
| Kubernetes | 기본 컴포넌트 | k8s components, CNI(Cilium), etcd, Node Status |
| Kubernetes | 서비스 | Service(Pod) Monitoring |
| Kubernetes | 스토리지 | PV / PVC |
| Kubernetes | 로그 | Kubernetes Log |
| Kubernetes | GPU | Host GPU |

## 요청이 대시보드까지 가는 7단계

```text
사용자 브라우저
   │ ① https://console.example.com/v1/grafana/dashboards/...
   ▼
Istio Ingress Gateway            ② 외부 트래픽 수신
   │
   ▼
VirtualService                   ③ 경로 매칭 + rewrite
   │
   ▼
OAuth2 Proxy ── 세션 없음 ──▶ Keycloak 로그인   ④ ⑤
   │  ▲                           │
   │  └──── 세션 저장(Redis) ◀────┘   ⑥
   ▼
Grafana (헤더로 사용자 전달)      ⑦
```

**① 사용자 접근.** 브라우저가 메인 도메인의 대시보드 경로로 요청한다.

**② Istio Gateway 수신.** 외부 트래픽을 메시 안으로 받아 VirtualService로 넘긴다.

**③ VirtualService 라우팅.** URL 패턴을 보고 목적지를 정한다. 특정 대시보드 경로는 exact match로 잡아서 Grafana의 실제 대시보드 URL로 rewrite한다.

```text
/v1/grafana/dashboards/k8s/core-components
    ↓ (exact match)
/d/paas-k8s-components-mon/paas-monitoring-components?orgId=1&from=now-1h&to=now
```

규칙에는 우선순위가 있다.

1. **Exact match**: 특정 대시보드 별칭 경로
2. **Prefix match**: API, 정적 리소스, 사용자 관리 경로
3. **Catch-all**: 그 밖의 모든 Grafana 경로

**④ OAuth2 Proxy 인증 확인.** 브라우저 세션 쿠키를 보고 Redis에서 유효한 세션인지, 토큰이 만료되지 않았는지 확인한다. 인증돼 있으면 Grafana로 넘기고, 아니면 Keycloak 로그인 페이지로 보낸다.

**⑤ Keycloak 인증(미인증일 때만).** 로그인 폼에서 받은 자격 증명을 사용자 저장소(DB 또는 LDAP)로 검증하고, 그룹·역할 정보를 읽은 뒤 토큰을 발급한다.

**⑥ 세션 저장.** OAuth2 Proxy가 받은 세션을 Redis에 저장한다. 이후 요청은 Keycloak까지 가지 않고 Redis 조회로 끝난다. OAuth2 Proxy 파드가 여러 개여도 세션을 공유하니 로그인이 풀리지 않는다.

**⑦ Grafana 접근.** OAuth2 Proxy가 인증 정보를 헤더에 붙여 Grafana 파드로 프록시한다.

```http
Authorization: Bearer <access-token>
X-Auth-Request-User: <username>
X-Auth-Request-Email: <email>
```

Grafana는 auth proxy 모드로 이 헤더를 믿고 로그인 처리한다. 자세한 건 [OAuth2 Proxy·Keycloak 인증 구조](/blog/grafana-oauth2-keycloak-auth/)에서 다룬다.

## 정리

- 대시보드 주소를 **도메인 하나 + 경로**로 바꾸니 인증서·DNS가 하나로 줄었다.
- 사용자는 짧은 별칭 경로만 쓰고, 실제 UID와 쿼리 파라미터는 VirtualService rewrite가 숨긴다.
- 인증은 어느 대시보드든 OAuth2 Proxy → Keycloak → Redis 한 경로로 통일했다.
