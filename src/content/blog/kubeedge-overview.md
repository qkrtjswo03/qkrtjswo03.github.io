---
title: "KubeEdge 개요: 엣지 노드가 갖춰야 할 최소 조건"
description: "KubeEdge가 무엇인지, 엣지 노드에 어떤 OS·메모리·런타임이 필요한지, 그리고 DaemonSet을 엣지에서 빼야 하는 이유까지 처음 시작할 때 확인한 내용을 정리했다."
pubDate: 2026-11-05T09:00:00+09:00
categories:
  - 엣지
tags:
  - KubeEdge
  - Kubernetes
  - Edge Computing
  - containerd
series: kubeedge
seriesOrder: 1
draft: false
---

사내 Kubernetes PaaS에 엣지 노드를 붙여 보는 작업을 맡으면서 가장 먼저 KubeEdge가 어떤 물건인지, 엣지 노드에 무엇이 있어야 하는지부터 정리했다. 이 글은 그 출발점이다. 시리즈의 나머지 글은 맨 아래에 모아 두었다.

## KubeEdge는 무엇인가

KubeEdge는 Kubernetes를 엣지까지 늘린 오픈소스 플랫폼이다. CNCF 프로젝트이고, 클라우드와 엣지 노드를 이어 IoT 장치와 엣지 애플리케이션을 Kubernetes API로 관리하게 해 준다.

구조는 단순하게 두 덩어리로 나뉜다.

```text
┌──────────────────────────────┐
│  Cloud                       │
│  Kubernetes Control Plane    │
│  + CloudCore                 │
└──────────────┬───────────────┘
               │ WebSocket / QUIC
┌──────────────┴───────────────┐
│  Edge Node                   │
│  EdgeCore (경량 kubelet 포함) │
│  Pods · Device I/O           │
└──────────────────────────────┘
```

- **CloudCore**: 클라우드(Kubernetes 마스터 쪽)에서 엣지 노드와 리소스를 동기화한다.
- **EdgeCore**: 엣지 노드에서 돌아가는 에이전트다. kubelet을 가볍게 만든 Edged가 안에 들어 있다.

엣지 노드는 클라우드(Kubernetes + CloudCore)에 붙어서 EdgeCore를 실행하는 노드다. 그래서 일반 워커 노드와 요구 조건이 조금 다르다.

## 엣지 노드 최소 요구사항

### 운영체제

x86_64에서는 선택지가 넓다.

- Ubuntu LTS (16.04, 18.04, 20.04, 22.04)
- CentOS, RHEL, Rocky Linux
- EulerOS, openEuler, Kylin, NeoKylin, NewStart Linux

aarch64(arm64)는 Ubuntu LTS(18.04 이상), CentOS, EulerOS를 지원한다. 라즈베리파이 같은 ARM 보드를 엣지로 쓰려면 이쪽을 본다.

실제로 내가 붙인 엣지 VM은 Ubuntu 24.04 LTS였고 문제없이 동작했다.

### 메모리·CPU·디스크

| 항목 | 기준 |
| --- | --- |
| 메모리 | EdgeCore 기본 사용량 약 150MB, 권장 256MB 이상 |
| CPU | 최소 1코어 |
| 디스크 | 최소 1GB |

엣지 관리 부하가 커지면 메모리 사용량도 늘어난다. 다만 실측해 보면 생각보다 훨씬 가볍다. 테스트 엣지에서 `systemctl status edgecore`로 본 EdgeCore 메모리는 37MB 수준이었다. 자세한 내용은 [North-South 데이터 보장 글](/blog/kubeedge-north-south-reliability/)에 적었다.

### 컨테이너 런타임

Docker나 containerd 중 하나가 있어야 한다.

- **Docker**: 19.0 이상(권장 19.03.6). 단, KubeEdge 1.14 이상 + Kubernetes 1.24 이상 조합에서는 dockershim이 없으므로 **cri-dockerd**를 따로 설치해야 한다.
- **containerd**: KubeEdge 1.12부터 권장 런타임이다.

새로 구성한다면 고민할 것 없이 containerd로 가는 편이 낫다. 나도 containerd 1.7.22로 구성했다.

### 시간 동기화

엣지 노드와 클라우드 서버의 시간이 맞아야 한다. 인증서 검증과 상태 동기화가 시간에 민감하기 때문이다. UTC 기준으로 맞추고 NTP를 켜 두는 것을 권장한다.

## DaemonSet은 엣지에서 빼야 한다

처음에 가장 많이 막힌 부분이 이것이다. 엣지 노드는 Calico, kube-proxy, 모니터링 수집기 같은 일부 구성 요소를 지원하지 않는다.

이유는 엣지가 경량 환경을 목표로 하기 때문이다.

- CPU·메모리가 낮다.
- IoT 게이트웨이 같은 환경이다.
- 네트워크가 불안정할 수 있다.

클러스터 전체 데이터를 모으는 모니터링 컴포넌트처럼 무겁거나 kubelet 전제가 깔린 DaemonSet이 엣지에 스케줄되면 노드 상태가 흔들리거나 EdgeCore 오류로 이어질 수 있다.

그래서 엣지에 올라가면 안 되는 DaemonSet에는 다음 nodeAffinity를 넣어 엣지 노드를 제외했다.

```yaml
# edge 노드에는 해당 DaemonSet을 스케줄하지 않음
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: node-role.kubernetes.io/edge
              operator: DoesNotExist
```

`keadm join`으로 붙은 엣지 노드에는 `node-role.kubernetes.io/edge` 라벨이 자동으로 붙는다. 이 라벨이 없는 노드에만 스케줄하라는 뜻이다. 실제로 Cilium과 node-exporter DaemonSet에 이 패치를 넣은 과정은 [설치 가이드](/blog/kubeedge-install-guide/)에 있다.

## 정리

| 항목 | 핵심 |
| --- | --- |
| 정체 | Kubernetes를 엣지까지 확장한 CNCF 프로젝트 |
| 구조 | CloudCore(클라우드) + EdgeCore(엣지) |
| 최소 사양 | 1코어, 256MB 이상, 디스크 1GB |
| 런타임 | containerd 권장 (Docker는 cri-dockerd 필요) |
| 주의 | 시간 동기화, DaemonSet 엣지 제외 |

다음 글에서는 CloudCore와 EdgeCore 안을 열어 [모듈 단위 아키텍처](/blog/kubeedge-architecture/)를 정리한다.
