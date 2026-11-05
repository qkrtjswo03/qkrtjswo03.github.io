---
title: "DIL 환경에서 KubeEdge 검증: 끊기고, 반복되고, 느려질 때"
description: "클라우드와 엣지 사이 통신을 360초 끊고, 60초씩 12번 끊고, 64kbps·200ms로 10분 제한했을 때 엣지 결과가 누락 없이 도착하는지 측정했다. 시나리오 설계, 장애 주입 명령, 실측 타임라인까지 정리."
pubDate: 2026-11-05T09:50:00+09:00
categories:
  - 엣지
tags:
  - KubeEdge
  - DIL
  - tc netem
  - toleration
  - Kubernetes
series: kubeedge
seriesOrder: 7
draft: false
---

[North-South 글](/blog/kubeedge-north-south-reliability/)에서 EdgeCore가 끊긴 동안 메타데이터를 들고 버틴다는 것을 봤다. 그럼 **엣지에서 돌던 앱이 만든 결과**는 어떻게 될까. 통신이 나쁜 환경을 세 가지로 나눠서 직접 측정했다.

## DIL이란

DIL은 Disconnected · Intermittent · Limited, 즉 통신이 끊기거나, 반복적으로 끊기거나, 매우 제한된 상태를 묶어 부르는 말이다.

| 조건 | 상태 | 장애 주입 |
| --- | --- | --- |
| D (Disconnected) | 아무것도 오가지 않음 | 엣지 NIC `down` |
| I (Intermittent) | 단절과 연결 반복 | NIC `down`/`up` 반복 |
| L (Limited) | 연결은 되지만 품질이 나쁨 | `tc netem`으로 대역폭·지연 제한 |

## 확인하려던 것

1. 장애 중에도 엣지의 결과 생성이 이어지는가
2. 연결이 돌아오면 그동안 만든 결과가 **누락·중복 없이** 클라우드에 도착하는가
3. 클라우드가 연락 안 되는 엣지의 Pod를 **의도치 않게 강제 종료**하지 않는가

AI 모델 성능이나 정확도는 보지 않았다. 엣지끼리의 통신(East-West), 엣지↔디바이스 연결, 학습·모델 동기화도 이번 범위 밖이다.

## 시간 기준은 Kubernetes 기본값에 맞췄다

세 조건의 시간은 Kubernetes가 노드 장애를 처리하는 기본값에 맞췄다. 이 값들은 바꾸지 않았다.

| 항목 | 기본값 | 의미 |
| --- | --- | --- |
| node-monitor-period | 5초 | 노드 상태 확인 주기 |
| node-monitor-grace-period | 40초 | 이 시간 동안 소식이 없으면 "연결 끊김" 판정 |
| NotReady/Unreachable toleration | 300초 | 판정 뒤 일반 Pod를 강제 종료(eviction)하기까지 대기 |

```text
Interface DOWN
   │  약 40초
   ▼
Node NotReady / Unreachable
   │  기본 toleration 300초
   ▼
Pod Eviction 가능 (약 340초 이후 다른 노드로 재스케줄링 가능)
```

- **D 360초**는 판정(40초)과 강제 종료(340초) 기준을 모두 넘긴다.
- **I 60초**는 판정 기준은 넘지만 강제 종료 기준에는 못 미친다.
- **L 10분**은 끊기지 않고 느린 연결이 300초를 넘겨도 판정이 나지 않는지 본다.

## 테스트 환경

```text
           ┌──────────── 클라우드 ────────────┐
           │ ① KubeEdge 클라우드 (CloudCore)  │
           │ ② 수신 앱: 결과 저장, 누락 계산   │
           └───────────────┬──────────────────┘
                           │ ③ 결과 전송 + 관리 신호
                           │
                ④ 장애 주입: 엣지 NIC (ens3)
                           │
           ┌───────────────┴──────────────────┐
           │ ⑤ EdgeCore: 끊겨도 마지막 지시대로 │
           │ ⑥ 기본 Pod   (300초 뒤 강제 종료) │
           │ ⑦ 유지 설정 Pod (강제 종료 안 됨)  │
           └──────────── 엣지 1대 ────────────┘
```

- 물리 서버 3대 위에 OpenStack VM 11대
- 클라우드 1곳 + 엣지 1대. 엣지는 다른 망에 있고 게이트웨이 2대를 거쳐 접속
- Kubernetes 1.32.8, KubeEdge 1.23.1

### 테스트 앱

엣지 앱은 1초에 1건씩 결과를 만들어 클라우드로 보낸다. 핵심은 **클라우드의 저장 확인을 받기 전까지 엣지에서 지우지 않는 것**이다.

```text
결과 생성 (1초 1건)
  → 엣지 디스크에 일련번호(seq) 붙여 저장
  → 클라우드로 전송 (실패하면 그대로 두고 재시도)
  → 수신 앱이 "stored" 또는 "duplicate" 응답
  → 응답을 받은 뒤에만 엣지 사본 삭제
```

결과 1건은 추론 결과물 형식을 흉내 낸 약 150바이트 JSON이다.

```json
{
  "site": "<pod-id>",
  "seq": 1,
  "ts": 1759227600,
  "node": "<edge-id>",
  "model_version": "v1-cpu-lite",
  "prediction": 0.09302,
  "input_feature": 0.120445
}
```

수신 앱의 응답은 둘 중 하나다.

```json
{"status": "stored",    "seq": 1, "sha256": "..."}
{"status": "duplicate", "seq": 1, "sha256": "..."}
```

같은 번호가 두 번 오면 한 번만 저장한다(멱등). 집계 화면은 이렇게 생겼다.

```json
{"sites": {"<pod-id>": {
  "received": 189, "max_seq": 189,
  "missing": 0, "missing_sample": [],
  "receipts": 189 }}}
```

`missing`은 1부터 `max_seq` 사이 빈 번호 수다. 이 글에서 말하는 "누락 0"은 이 값이다.

### Pod 두 개

같은 앱을 Pod 두 개로 같은 엣지에 띄우고, 장애 시 대기 설정만 다르게 했다.

| Pod | 설정 | 기대 |
| --- | --- | --- |
| 기본 Pod | 아무것도 안 붙임 | 판정 300초 뒤 강제 종료 대상 |
| 유지 설정 Pod | `unreachable`/`not-ready` toleration을 기한 없이 | 시간과 상관없이 유지 |

유지 설정은 Kubernetes 표준 toleration이다. KubeEdge 고유 기능이 아니다.

```yaml
tolerations:
  - key: node.kubernetes.io/unreachable
    operator: Exists
    effect: NoExecute
  - key: node.kubernetes.io/not-ready
    operator: Exists
    effect: NoExecute
```

`tolerationSeconds`를 빼면 기한 없이 버틴다. 데이터센터에서는 고장 난 서버의 일을 다른 서버로 옮기는 것이 맞지만, 엣지는 **통신만 끊기고 장비는 돌고 있는** 경우가 많아서 이 차이를 비교하고 싶었다.

## 장애 주입 방법

엣지의 단일 NIC를 내리면 SSH도 끊긴다. 그래서 OpenStack 콘솔(또는 `virsh console`)을 복구 채널로 확보한 상태에서 진행했다. 한 번에 하나의 조건만 넣고, 끝나면 반드시 복구했다.

### D: 360초 단절

```bash
ip link set ens3 down
sleep 360
ip link set ens3 up
```

### I: 60초 단절 × 12회

```bash
IF=ens3
for i in $(seq 1 12); do
  echo "[$i/12] 정상 통신 60초";  sleep 60
  echo "[$i/12] Interface DOWN 60초"; ip link set "$IF" down; sleep 60
  echo "[$i/12] Interface UP";     ip link set "$IF" up
  echo "[$i/12] 복구 안정화 30초"; sleep 30
done
```

### L: 64kbps · 지연 200ms · 10분

```bash
tc qdisc add dev ens3 root netem rate 64kbit delay 200ms
tc qdisc show dev ens3
sleep 600
tc qdisc del dev ens3 root
```

설계 단계에서는 15초 단절(I-Short)이나 256kbps·손실 2% 조건도 잡아 뒀다. 실제 측정은 위 세 조건으로 했다.

매 시험 전에는 엣지 Ready, Pod Running, 적체 0, `tc` 규칙 없음을 확인했다. 관측은 10초 간격으로 노드·Pod 상태를 조회하고 수신 앱 집계를 읽는 방식이었다.

## 결과

| 조건 | 결과 |
| --- | --- |
| D: 360초 단절 | 단절 중 엣지에 쌓인 352건이 복구 17초 뒤 모두 도착. 누락 0 · 중복 0 |
| I: 60초 × 12회 | 생성 2,151건 = 수신 2,151건, 남은 적체 0 |
| L: 64kbps · 200ms · 10분 | 수신 1,383건, 누락 0, 연결 끊김 판정 없음, Pod 재시작 0회 |

세 조건 모두 결과 생성이 멈추지 않았고, 복구 후 누락 0 · 중복 0이었다.

### D: 360초 단절 타임라인

| 시각 | 이벤트 |
| --- | --- |
| T+0 | 엣지 NIC DOWN |
| T+16 | 클라우드 쪽 KubeEdge가 세션 끊김 감지 (keepalive timeout) |
| T+42 | 노드 `Ready=Unknown`. 연결 끊김 판정 |
| T+48 | 노드에 `unreachable:NoExecute` taint. 300초 대기 시작 |
| T+348 | 300초 만료. 하지만 단절 중이라 삭제 지시가 엣지에 닿지 않음 |
| UP+0 | NIC UP |
| UP+7 | 관리 포트 통신 복구, 적체 전송 시작 |
| UP+17 | 적체 전송 완료 |
| UP+18 | 기본 Pod에 `deletionTimestamp` 기록 |
| UP+21 | EdgeCore WebSocket 재연결 |
| UP+26 | 노드 `Ready`, `reason=EdgeReady` |

건수는 세 시점에서 읽었다.

| Pod | 단절 직전 | 단절 종료 직전 | 복구 후 최종 |
| --- | --- | --- | --- |
| 기본 Pod | 생성 422 · 적체 0 · 수신 422 | 생성 774 (+352) · 적체 352 · 수신 422 고정 | 생성 830 · 적체 0 · 수신 830 · 누락 0 |
| 유지 설정 Pod | 생성 419 · 적체 0 · 수신 419 | 생성 771 (+352) · 적체 352 · 수신 419 고정 | 적체 0 · 수신 960 · 누락 0 |

여기서 가장 흥미로웠던 부분은 **강제 종료가 실제로 일어나는 시점**이다. 300초 대기는 단절 중에 끝났지만, 삭제 지시가 엣지에 닿을 방법이 없었다. 그래서 기본 Pod는 단절 내내 계속 결과를 만들었고, **복구 18초 뒤**에야 삭제됐다. 그 사이 쌓인 결과는 이미 다 보낸 뒤였다. 유지 설정 Pod는 끝까지 유지됐다.

복구 시간을 세 지점으로 나누면 전송 재개 7초, 적체 해소 17초, 정상 판정 복귀 26초다.

### I: 60초 × 12회

```text
정상 60초   → 적체 1~2건이 바로 전송
단절 60초   → 결과 60건 정도가 엣지에 쌓임
복구        → 60~70건이 한 번에 도착, 엣지 사본 삭제
안정화 30초 → 다음 단절까지 대기  (× 12회)
```

매 단절마다 연결 끊김 판정은 났지만, 300초 강제 종료 기준 전에 다시 연결됐다. 그래서 이 시험은 유지 설정 Pod만 돌렸다. 엣지가 만든 마지막 일련번호 2,151과 클라우드가 받은 건수 2,151이 같았다.

### L: 64kbps · 200ms · 10분

10분 동안 연결 끊김 판정이 한 번도 나지 않았다. 느린 연결이라도 하트비트가 오가면 노드는 Ready를 유지한다. 제한 중에는 적체가 쌓이면서 느리게 전송됐고, 제한을 풀자 남은 적체가 모두 나갔다.

## 정리

- 세 조건 모두 **결과 생성 지속, 누락 0, 중복 0**.
- 클라우드는 단절 **42초** 뒤 연결 끊김으로 판정했고, 복구 **26초** 뒤 정상으로 돌아왔다.
- 기본 Pod는 복구 18초 뒤 강제 종료됐고, toleration을 붙인 Pod는 유지됐다.

그리고 역할을 나눠서 보는 것이 중요했다.

| 결과 | 만든 주체 |
| --- | --- |
| 단절 중에도 앱이 계속 돈다 | KubeEdge (EdgeCore 로컬 자율 실행) |
| 강제 종료되지 않는다 | Kubernetes 표준 toleration |
| 누락 0 · 중복 0 | 앱 설계 (확인 응답 전 삭제 금지 + seq 멱등 저장) |

말할 수 있는 범위도 분명히 해 둔다. 엣지 1대, 결과 1건 150바이트, 조건당 측정 1회의 자체 측정값이다. 엣지끼리의 통신은 [EdgeMesh P2P 글](/blog/edgemesh-p2p-east-west/)에서 따로 다룬다.
