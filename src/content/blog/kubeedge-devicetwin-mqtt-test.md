---
title: "KubeEdge DeviceTwin·MQTT 시험: 값은 어디에 남고, 브로커는 왜 필요한가"
description: "가상 Mapper로 MQTT twin 메시지를 올려 DeviceStatus까지 값이 도는지 시험했다. EdgeCore SQLite는 앱 DB가 아니고, CloudCore는 저장소가 아니며, Mosquitto만으로는 센서 값이 생기지 않는다는 것을 확인했다."
pubDate: 2026-11-05T09:30:00+09:00
categories:
  - 엣지
tags:
  - KubeEdge
  - DeviceTwin
  - MQTT
  - Mosquitto
  - IoT
series: kubeedge
seriesOrder: 5
draft: false
---

[Device, Mapper, MQTT 글](/blog/kubeedge-device-mapper-mqtt/)에서 개념을 정리했다. 개념만으로는 남는 질문이 있어서 실제로 값을 흘려 봤다.

- EdgeCore SQLite에 애플리케이션 데이터를 쌓아 클라우드에서 제어할 수 있는가?
- 엣지에서 올린 값은 어디에 저장되는가? CloudCore 안인가?
- `kubectl get devices -A`가 `No resources found`면 무엇이 잘못된 것인가?
- CloudCore Helm 차트가 엣지에 올리는 `edge-eclipse-mosquitto`는 정확히 무슨 역할인가?

결론부터 적는다.

| 질문 | 답 |
| --- | --- |
| EdgeCore SQLite | 앱 DB가 아니라 Kubernetes 메타데이터 캐시다 |
| 값이 남는 곳 | CloudCore가 아니라 etcd의 Device / DeviceStatus CR이다. CloudCore는 중계만 한다 |
| 빈 Device 목록 | CRD 문제가 아니라 Device 인스턴스를 아직 안 만든 것이다 |
| Mosquitto | CloudCore 필수 컴포넌트가 아니라, EventBus와 Mapper가 쓰는 엣지 로컬 MQTT 브로커다 |

## 환경

- KubeEdge v1.23.1, Device API `devices.kubeedge.io/v1beta1`
- 엣지 두 대: **edge-a**(Mosquitto + 가상 Mapper + Device), **edge-b**(Mosquitto만, 대조군)
- CloudCore는 클라우드 워커 2대에서 Pod로 실행
- 별도 IoT 장비 없이 Pod 안 Python 스크립트가 센서 + Mapper 역할을 대신한다

엣지 노드에는 `node-role.kubernetes.io/edge:NoSchedule` taint가 있다. 엣지에 올릴 Pod는 이 key에 대한 toleration이 필요하다.

## 데이터 경로

```text
kubectl (Device desired 변경)
   │
Kubernetes API / etcd
   │
CloudCore DeviceController
   │ websocket
EdgeCore DeviceTwin + EventBus
   │ tcp://127.0.0.1:1883
edge-eclipse-mosquitto (hostNetwork)
   │
가상 Mapper (twin/update, state/update publish)
   │
DeviceTwin reported → DeviceStatus CR (etcd)
```

## 시험 준비

### 1. EdgeCore 모듈 켜기

`/etc/kubeedge/config/edgecore.yaml`에서 두 모듈을 켰다.

| 항목 | 값 | 이유 |
| --- | --- | --- |
| `deviceTwin.enable` | `true` | 트윈 처리 |
| `eventBus.enable` | `true` | MQTT 구독/발행 |
| `eventBus.mqttServerExternal` | `tcp://127.0.0.1:1883` | 노드 로컬 Mosquitto |

이 클러스터는 둘 다 `false`가 기본이었다. 바꾼 뒤 EdgeCore를 재시작했다. 원본은 `edgecore.yaml.demo.bak`으로 백업해 뒀다.

### 2. Helm으로 Mosquitto 올리기

CloudCore 차트의 `values.yaml`에서 Mosquitto를 켜고 엣지 taint toleration을 넣었다.

```yaml
cloudcore:
  mosquitto:
    enable: true
    tolerations:
      - key: node-role.kubernetes.io/edge
        operator: Exists
        effect: NoSchedule
```

차트 기본값은 `enable: true`지만 이 환경 overlay는 `false`였다. 바꾸고 `helm upgrade`하자 엣지마다 하나씩 떴다.

```bash
kubectl -n kubeedge get ds,po -l kubeedge=eclipse-mosquitto -o wide
# edge-eclipse-mosquitto-xxxxx  1/1 Running  edge-a
# edge-eclipse-mosquitto-yyyyy  1/1 Running  edge-b
```

이미지 `eclipse-mosquitto:1.6.15`, `hostNetwork`, 포트 1883이다.

### 3. DeviceModel · Device · 가상 Mapper

- DeviceModel `demo-temp-model`: property `temperature` (INT)
- Device `demo-temp-edge-a`: `nodeName: edge-a`
- Device `demo-temp-edge-b`: `nodeName: edge-b` (대조군)
- Deployment `demo-virtual-mapper`: edge-a에 `hostNetwork`로 고정, 8초마다 twin publish

v1.23에서 MQTT 토픽의 디바이스 ID는 `namespace/name` 2단이다.

```text
$hw/events/device/default/demo-temp-edge-a/twin/update
$hw/events/device/default/demo-temp-edge-a/state/update
```

순서가 중요했다. **DeviceTwin을 켠 뒤에 Device를 만들어야** 멤버십에 등록된다. 모듈을 먼저 켜고 Device를 apply했다.

## 가상 Mapper가 보내는 메시지

Mapper 역할을 하는 테스트 앱(`kubeedge-mqtt-tester`)은 Python 3.12 + paho-mqtt로 짰다. 하는 일과 안 하는 일을 분명히 나눴다.

| 하는 일 | 하지 않는 일 |
| --- | --- |
| MQTT 3.1.1로 브로커 연결 | Device CR이나 desired 값을 직접 수정 |
| `twin/update`, `state/update` publish | EdgeCore·CloudCore API 호출 |
| (옵션) `twin/update/delta` 구독해서 로그 | desired를 받아 실제 장치 제어 |
| 연결 실패 시 3초 간격 재시도 | Modbus·HTTP 등 다른 프로토콜 |

twin 메시지는 KubeEdge 규격을 따른다.

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": 1728345600123,
  "twin": {
    "temperature": {
      "actual": { "value": "25", "metadata": { "timestamp": 1728345600123 } },
      "metadata": { "type": "int" }
    }
  }
}
```

```json
{ "event_id": "550e8400-e29b-41d4-a716-446655440001", "timestamp": 1728345600123, "state": "online" }
```

- `event_id`는 메시지마다 UUID, `timestamp`는 밀리초다.
- `actual.value`는 **문자열** 숫자다.
- `metadata.type`은 DeviceModel의 INT와 맞춘다.

앱 설정과 Device CR이 맞아야 하는 부분이 있다.

| 앱 설정 | Device / DeviceModel | 맞아야 하는 이유 |
| --- | --- | --- |
| `DEVICE_ID=default/mqtt-test-edge-a` | `metadata.namespace/name` | 토픽 경로와 트윈 멤버십 |
| `PROPERTY=temperature` | `spec.properties[].name` | reported 키 이름 |
| Pod `nodeName: edge-a` | `spec.nodeName` | 그 엣지의 EdgeCore가 처리 |
| `MQTT_HOST=127.0.0.1` | - | 같은 노드의 Mosquitto |

### 왜 hostNetwork + nodeName 고정인가

Mosquitto DaemonSet이 `hostNetwork`로 노드의 `127.0.0.1:1883`에 붙는다. Mapper Pod도 같은 노드, 같은 loopback으로 붙어야 EdgeCore EventBus와 **같은 브로커**를 공유한다. `127.0.0.1`은 "그 노드 자신"만 가리키므로, edge-b에서 시험하려면 Device와 Pod를 모두 edge-b로 맞춰야 한다.

참고로 MQTT가 무선 전용이라는 뜻이 아니다. MQTT는 애플리케이션 계층이고, 그 아래 TCP → IP → 링크(유선 이더넷, Wi-Fi, 4G/5G)는 하위 네트워크가 정한다. 여기서는 목적지가 loopback일 뿐이다.

## 시나리오와 결과

| ID | 시나리오 | 판정 |
| --- | --- | --- |
| S0 | 빈 Device 목록이 CRD 부재 때문이 아님을 확인 | PASS |
| S1 | Mapper → Mosquitto → EventBus → DeviceTwin → DeviceStatus로 reported가 주기 갱신 | PASS |
| S2 | 클라우드에서 desired를 바꾸면 Device spec(etcd)에 남는지 | PASS |
| S3 | Mosquitto에 Mapper와 EventBus 클라이언트가 붙는지 | PASS |
| S4 | Mapper 없는 edge-b는 값이 비어 있는지 (대조군) | PASS |

### S0. 빈 목록

```bash
kubectl get crd | grep devices.kubeedge.io   # Device, DeviceModel, DeviceStatus CRD 있음
kubectl get devices.devices.kubeedge.io -A   # No resources found
```

CRD는 있고 인스턴스가 0건이었다. 트윈 DB 조회 실패가 아니라, Device YAML을 아직 apply하지 않은 상태다. apply하자 목록에 나타났다.

### S1. reported 주기 갱신

```bash
for i in 1 2 3 4; do
  date '+%H:%M:%S'
  kubectl get devicestatus demo-temp-edge-a \
    -o jsonpath='state={.status.state} online={.status.lastOnlineTime} temp={.status.twins[0].reported.value}{"\n"}'
  sleep 8
done
```

| 시각 (KST) | state | lastOnlineTime (UTC) | temperature |
| --- | --- | --- | --- |
| 17:40:06 | online | 08:40:04Z | 23 |
| 17:40:14 | online | 08:40:12Z | 20 |
| 17:40:22 | online | 08:40:20Z | 23 |
| 17:40:30 | online | 08:40:28Z | 28 |

8초마다 `lastOnlineTime`이 앞으로 가고 값이 바뀐다. 같은 구간 Mapper 로그(23 / 20 / 23 / 28)와 일치했다. v1beta1에서 값은 Device YAML이 아니라 **DeviceStatus CR**에 있다.

### S2. desired 패치

```bash
kubectl get device demo-temp-edge-a -o jsonpath='{.spec.properties[0].desired.value}{"\n"}'
# 30
kubectl patch device demo-temp-edge-a --type merge -p '{
  "spec": {"properties": [{"name": "temperature", "reportToCloud": true,
    "desired": {"value": "41"}}]}}'
kubectl get device demo-temp-edge-a -o jsonpath='{.spec.properties[0].desired.value}{"\n"}'
# 41
```

desired는 Device CR spec, 즉 etcd에 남는다. CloudCore 내부 DB가 아니다. 이 가상 Mapper는 장치를 제어하지 않으니 `observedDesired`는 비어 있을 수 있다.

### S3. Mosquitto 접속

```text
mosquitto version 1.6.15 running
Opening ipv4 listen socket on port 1883.
New client connected from 127.0.0.1 as demo-virtual-mapper
New client connected from 127.0.0.1 as hub-client-sub-...
New client connected from 127.0.0.1 as hub-client-pub-...
```

`hub-client-sub-*`, `hub-client-pub-*`가 EdgeCore EventBus다. Mapper와 EventBus가 같은 브로커에 붙었다.

### S4. 대조군 edge-b

| 항목 | 결과 |
| --- | --- |
| Mosquitto | Running 1/1 |
| Mapper | 없음 |
| DeviceStatus | `status: {}` |

**브로커가 있다고 센서 값이 생기지 않는다.** publish하는 주체(실제 장치 + Mapper, 또는 가상 Mapper)가 있어야 한다.

## 실장비로 갈 때

이 시험에는 센서, PLC, 현장 게이트웨이가 필요 없었다. 가상 Mapper Pod가 "장치 + Mapper" 역할을 소프트웨어로 대신했기 때문이다. 그래도 엣지 노드(DeviceTwin·EventBus 활성), 엣지 Mosquitto, Device/DeviceModel CR, CloudCore와 API Server는 그대로 필요하다.

현장 데이터가 필요해지면 가상 Publisher 자리에 실장비 + 프로토콜 Mapper(공식 또는 커스텀)를 넣으면 된다. 토픽 형식과 DeviceTwin 경로는 그대로 유지된다.

## 정리

- 애플리케이션 데이터를 EdgeCore SQLite에 쌓아 CloudCore로 제어하는 구조는 **지원하지 않는다.** SQLite는 [메타데이터 캐시](/blog/kubeedge-north-south-reliability/)다.
- 작은 디바이스 현재값은 DeviceTwin을 거쳐 **etcd의 DeviceStatus**에 남는다. CloudCore는 중계만 한다.
- `edge-eclipse-mosquitto`는 없어도 Pod 오케스트레이션은 된다. MQTT Mapper와 EventBus를 쓸 때만 필요하다.

시험이 끝난 뒤 데모 리소스만 지우고 Mosquitto DaemonSet은 남겼다.

```bash
kubectl delete deploy demo-virtual-mapper
kubectl delete cm demo-virtual-mapper
kubectl delete device demo-temp-edge-a demo-temp-edge-b
kubectl delete devicemodel demo-temp-model
```
