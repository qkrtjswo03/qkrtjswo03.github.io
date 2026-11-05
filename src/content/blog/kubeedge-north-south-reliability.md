---
title: "KubeEdge North-South: 통신이 끊겨도 엣지 데이터가 남는 이유"
description: "클라우드와 엣지가 끊겼을 때 EdgeCore가 무엇을 어디에 남기는지, 단절·재연결 로그와 내장 SQLite(edgecore.db)를 직접 열어 확인했다."
pubDate: 2026-11-05T09:40:00+09:00
categories:
  - 엣지
tags:
  - KubeEdge
  - EdgeCore
  - SQLite
  - MetaManager
  - DIL
series: kubeedge
seriesOrder: 6
draft: false
---

KubeEdge를 쓰는 가장 큰 이유는 **클라우드와 끊겨도 엣지가 계속 일한다**는 점이다. 말로는 쉽지만, 정말 그런지 보고 싶었다. 클라우드↔엣지 방향(North-South) 통신을 끊었다 붙이면서 EdgeCore 로그와 로컬 DB를 직접 열어 봤다.

## 핵심 구조

EdgeCore는 데이터베이스 서버를 따로 띄우지 않는다. SQLite 라이브러리를 프로세스 안에서 직접 호출해 로컬 파일 하나에 메타데이터를 저장한다.

```text
[App] → [EventBus] → [MetaManager (SQLite)] → [EdgeHub] → (Cloud)
```

- EdgeCore 단일 프로세스 안에 SQLite가 들어 있다.
- MySQL이나 PostgreSQL 같은 외부 DB가 필요 없다.
- 저장 위치는 `/var/lib/kubeedge/edgecore.db` 파일 하나다.

## EdgeCore 데몬이 얼마나 가벼운가

```bash
systemctl status edgecore
● edgecore.service
     Loaded: loaded (/etc/systemd/system/edgecore.service; enabled)
     Active: active (running) since ...; 4 days ago
   Main PID: 505761 (edgecore)
      Tasks: 16 (limit: 9484)
     Memory: 37.0M (peak: 38.9M)
     CGroup: /system.slice/edgecore.service
             └─505761 /usr/local/bin/edgecore
```

나흘 동안 돌고 있던 EdgeCore가 **메모리 37MB**를 쓰고 있었다. CGroup 아래에 `edgecore` 프로세스 하나뿐이다. DB 서버 프로세스가 없다는 뜻이고, 라즈베리파이 같은 저사양 장비에서도 충분하다는 근거가 된다.

## 1. DB 파일 확인

```bash
ls -lh /var/lib/kubeedge/edgecore.db
-rw-r--r-- 1 root root 340K ... /var/lib/kubeedge/edgecore.db
```

MetaManager가 관리하는 내장 DB다. 340KB 정도였다.

## 2. 단절했을 때 로그

엣지와 CloudCore 사이 연결을 끊고 `journalctl -u edgecore -f`로 지켜봤다. 핵심 줄만 추렸다.

```text
# CloudCore ↔ EdgeCore WebSocket 연결 끊김 (TCP 레벨 강제 종료)
ws.go:108] failed to read message, error: read tcp ...: read: connection reset by peer

# 클라우드로 전달 실패 → 재연결 모드
process.go:99]  failed to send message to cloud: ... use of closed network connection
edgehub.go:138] connection is broken, will reconnect after 30s
process.go:52]  websocket read error: the fifo is broken

# 로컬 처리는 계속된다 (Edge autonomy)
process.go:305] DeviceTwin receive msg
process.go:70]  Send msg to the CommModule module in twin

# 클라우드 쪽 상태 갱신은 실패
process.go:240] process remote failed, req[... kube-node-lease/lease/edge01], err: not connected
kubelet_node_status.go:466] "Error updating node status, will retry"
kubelet_node_status.go:453] "Unable to update node status" err="update node status exceeds retry count"
```

## 3. 다시 붙었을 때 로그

```text
ws.go:47]        dial wss://<cloudcore>:31987/.../edge01/events successfully
websocket.go:93] Websocket connect to cloud access successful
process.go:305]  DeviceTwin receive msg
process.go:70]   Send msg to the CommModule module in twin
```

흐름을 순서대로 놓으면 이렇다.

```text
[1] connection reset by peer        → 연결 끊김
[2] failed to send message          → 전송 실패
[3] connection is broken            → 30초 간격 재연결 모드
[4] DeviceTwin receive msg          → 로컬 처리 지속
[5] websocket write/read error      → 완전 단절
[6] Error updating node status      → 클라우드 동기화 실패
[7] Websocket connect successful    → 연결 복구
[8] 메시지 처리 재개                → 정상 상태 복귀
```

단절 동안 엣지가 "멈춘" 구간은 없었다. 클라우드로 올리는 것만 실패했고, 로컬 모듈은 계속 메시지를 처리했다.

## 4. SQLite 안을 열어 보기

```bash
sudo sqlite3 /var/lib/kubeedge/edgecore.db
SQLite version 3.45.1
sqlite> .tables
device       device_twin  meta_v2      target_urls
device_attr  meta         sub_topics
```

테이블은 두 묶음이다.

### 디바이스 영역

| 테이블 | 역할 |
| --- | --- |
| `device` | 등록된 IoT 디바이스 정보 |
| `device_attr` | 디바이스 속성 |
| `device_twin` | 디바이스 상태 (desired / reported) |

클라우드 없이도 디바이스 상태를 들고 있을 수 있는 이유다.

### 메타데이터 영역

`meta`, `meta_v2`가 가장 중요하다. Kubernetes 리소스 정보, Pod·ConfigMap·상태 데이터 캐시, 클라우드 동기화용 데이터가 여기 들어 있다.

```sql
sqlite> SELECT key, type FROM meta;
```

키 형식은 `<namespace>/<type>/<name>`이다. 실제로 들어 있던 항목을 종류별로 정리하면 다음과 같다. (값은 인증서와 토큰이 그대로 들어 있어서 글에는 옮기지 않았다.)

| type | 예시 키 | 의미 |
| --- | --- | --- |
| `configmap` | `kube-system/configmap/kube-proxy`, `*/configmap/kube-root-ca.crt` | 네트워크 설정과 API Server CA |
| `secret` | `<ns>/secret/<name>` | 엣지 Pod가 쓰는 Secret |
| `serviceaccounttoken` | 엣지 Pod별 바인딩 토큰 | 끊긴 상태에서도 Pod가 권한을 유지 |
| `pod` / `podpatch` | `test/pod/edge-nginx-...` | 엣지에서 돌고 있는 Pod 스펙과 상태 |
| `nodepatch` / `node` | `default/node/edge01` | 노드 상태와 조건 |
| `lease` | `kube-node-lease/lease/edge01` | 노드 하트비트 |

여기서 재미있는 점이 두 가지 있었다.

- **설정값이 남는다.** `kube-proxy` ConfigMap과 `kube-root-ca.crt`가 로컬에 있으니, 중앙이 없어도 엣지는 마지막 설정으로 네트워크를 유지하고 CA로 보안 통신을 이어 간다.
- **권한이 남는다.** ServiceAccount 토큰이 캐시돼 있어서, 끊긴 상태에서도 엣지 Pod는 정당한 권한으로 로컬 자원에 접근한다.

반대로 말하면 `edgecore.db`에는 Secret과 토큰이 평문 JSON으로 들어 있다. 엣지 디스크 자체를 보호해야 하는 이유이기도 하다.

## 5. 왜 데이터가 남는가

1. **SQLite의 ACID**: 원자성·일관성·격리성·지속성. 쓰는 도중 전원이 나가도 반쯤 쓴 상태로 남지 않는다.
2. **디스크 기반 저장**: 메모리가 아니라 파일 DB다. EdgeCore가 재시작돼도 남는다.
3. **EdgeCore 내부 통합**: 외부 DB가 없으니 장애 지점이 하나 줄어든다.

## 6. 한 장으로 요약

```text
[단절]
App → EventBus → MetaManager → SQLite (edgecore.db 저장)

[복구]
SQLite ← MetaManager → EdgeHub → CloudCore 동기화
```

끊기면 SQLite에 쌓고, 붙으면 EdgeHub를 통해 클라우드로 올린다.

## 주의: 이건 "메타데이터"의 이야기다

여기서 보장되는 것은 **Kubernetes 메타데이터와 디바이스 트윈 상태**다. 애플리케이션이 만든 업무 데이터(추론 결과 같은 것)를 EdgeCore SQLite에 넣어 클라우드로 올려 주는 기능은 없다. 이건 [DeviceTwin·MQTT 시험](/blog/kubeedge-devicetwin-mqtt-test/)에서 따로 확인했다.

그래서 [DIL 환경 검증](/blog/kubeedge-dil-validation/)에서는 앱이 직접 결과를 디스크에 쌓고, 클라우드의 확인 응답을 받은 뒤에만 지우도록 만들었다. KubeEdge는 **앱이 끊긴 동안 계속 돌게** 해 주고, 데이터 누락 0은 **앱 설계**가 만든다. 이 두 가지를 나눠서 보는 것이 중요했다.
