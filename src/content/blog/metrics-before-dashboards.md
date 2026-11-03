---
title: "새 서비스에 메트릭부터 붙이는 이유"
description: "로그를 열기 전에 RED 메트릭이 보이게 만들면, 장애의 범위가 훨씬 빨리 좁혀집니다."
pubDate: 2026-10-18
updatedDate: 2026-10-20
categories:
  - 쿠버네티스
  - 관측
tags:
  - Prometheus
  - RED
heroImage: "/images/observability-flow.svg"
heroAlt: "서비스의 메트릭과 로그가 수집기를 거쳐 RED와 요청 ID로 이어지는 흐름"
sample: true
---

<!-- 샘플 글입니다. src/content/blog/metrics-before-dashboards.md -->

새 워크로드를 클러스터에 올릴 때 대시보드를 먼저 만드는 경우가 많습니다. 화면보다 먼저 필요한 것은, 요청이 늘어나는지, 실패하는지, 느려지는지를 숫자로 보는 일입니다.

## 먼저 보는 세 숫자

RED만 있어도 첫 질문은 끝납니다.

- Rate. 초당 요청이 평소와 다른가
- Errors. 4xx와 5xx 비율이 같이 움직였는가
- Duration. 느려진 것이 전체인가, 한 경로인가

로그는 그다음입니다. 숫자가 "결제 API의 5xx가 10분 전부터"라고 알려 주면, 로그는 그 구간만 보면 됩니다.

## 스크랩이 되게만 하기

애플리케이션이 `/metrics`를 이미 내놓고 있다면, 수집기가 그 포트를 알게 하는 주석이면 충분할 때가 있습니다.

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
    prometheus.io/path: "/metrics"
```

이 주석을 믿을 수 있는 클러스터인지부터 확인해야 합니다. Prometheus Operator를 쓰는 곳에서는 `ServiceMonitor`가 기준이고, 주석은 무시될 수 있습니다. 팀의 수집 경로를 하나로 정하고, 그 경로만 문서에 남기는 편이 안전합니다.

## 첫 쿼리

상태 코드만 나눠 봐도 "에러가 늘었는지, 트래픽 자체가 줄었는지"가 갈립니다. 아래는 PromQL입니다.

```text
sum by (status) (
  rate(http_requests_total{job="checkout"}[5m])
)
```

`job` 라벨이 비어 있으면 쿼리부터 고치지 않습니다. 스크랩 설정에서 라벨이 붙는지 먼저 봅니다.

## 수집 경로를 한 장으로

메트릭과 로그를 한 제품으로 합칠 필요는 없습니다. 다만 요청 ID가 양쪽에 같이 남아야 나중에 이어 붙일 수 있습니다. 글 위의 그림은 그 경로만 고정한 것입니다.

트레이스는 모든 함수에 달기보다, 들어온 요청과 밖으로 나가는 호출의 경계에만 남겨도 원인 후보가 많이 줄어듭니다.

## 배포 직후 체크

1. 스크랩 대상이 되고, 라벨에 서비스 이름이 있는가
2. 5xx와 지연 버킷이 보이는가
3. 로그 한 줄에 요청 ID가 있는가
4. 알림은 증상이 계속될 때만 울리는가

알림을 많이 만드는 일은 이 목록에 없습니다. 온콜이 읽는 문장 하나면 됩니다. "checkout 5xx 비율이 5분 동안 2%를 넘으면 호출한다."
