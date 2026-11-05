---
title: "EdgeMesh 배포와 P2P(East-West) 통신: 다른 서브넷의 엣지 두 대 붙이기"
description: "EdgeMesh Agent를 배포하고 relayNodes를 설정해, 서로 다른 L3 대역에 있는 엣지 두 대가 libp2p로 직접 연결되는지 로그와 tcpdump로 확인했다."
pubDate: 2026-11-05T10:10:00+09:00
categories:
  - 엣지
tags:
  - KubeEdge
  - EdgeMesh
  - libp2p
  - P2P
  - tcpdump
series: kubeedge
seriesOrder: 9
draft: false
---

[EdgeMesh 개요](/blog/edgemesh-overview/)에서 구조를 봤으니 실제로 배포했다. 목표는 **서로 다른 서브넷에 있는 엣지 VM 두 대가 클라우드를 거치지 않고 직접(P2P) 통신하는 것**이다.

> IP와 호스트 이름은 예시 값으로 바꿨다. 엣지 01은 `10.0.10.x` 대역, 엣지 02는 `10.0.20.x` 대역에 있다.

## 1. EdgeMesh 배포

### 방법 A: 저장소 클론

```bash
git clone https://github.com/kubeedge/edgemesh.git
cd edgemesh/build/agent/resources
kubectl apply -f .
```

### 방법 B: 클론 없이 YAML만

폐쇄망에 가까운 환경에서는 필요한 파일만 받아서 적용하는 편이 편했다.

```bash
BASE=https://raw.githubusercontent.com/kubeedge/edgemesh/main/build/agent/resources
kubectl apply -f $BASE/serviceaccount.yaml
kubectl apply -f $BASE/clusterrole.yaml
kubectl apply -f $BASE/clusterrolebinding.yaml
kubectl apply -f $BASE/configmap.yaml
kubectl apply -f $BASE/daemonset.yaml
```

### 엣지 노드에만 올리기

기본 DaemonSet은 모든 노드에 Agent를 띄운다. 클라우드 노드에 Agent가 있으면 CloudCore 재기동 때 포트 충돌이 날 수 있어서 엣지 노드로 제한했다.

```bash
kubectl -n kubeedge patch daemonset edgemesh-agent --type='json' -p='[
  {"op": "add", "path": "/spec/template/spec/nodeSelector",
   "value": {"node-role.kubernetes.io/edge": ""}}
]'
```

## 2. P2P 구성

### 상황

```text
edge01 → 10.0.10.151   (클러스터 내부망)
edge02 → 10.0.20.158   (외부망)
```

두 엣지는 서로 다른 L3 네트워크에 있다. 이 경우 **두 엣지 모두 접근할 수 있는 주소**를 relayNode로 등록해야 한다. 그리고 각 엣지는 relay로 등록할 노드의 터널 포트(20006)에 닿아야 한다.

```bash
# edge01에서
nc -zv 10.0.10.102 20006
Connection to 10.0.10.102 20006 port [tcp/*] succeeded!

# edge02에서
nc -zv 10.0.20.152 20006
Connection to 10.0.20.152 20006 port [tcp/*] succeeded!
```

master02는 두 대역에 모두 다리를 걸치고 있어서(`10.0.10.102` / `10.0.20.152`) 양쪽에서 다 닿는다.

### ConfigMap 두 개

EdgeMesh를 배포하면 ConfigMap 두 개가 같이 생긴다.

| ConfigMap | 역할 |
| --- | --- |
| `edgemesh-agent-cfg` | Agent 전체 동작 설정. 프록시, 터널, 릴레이, DNS 모듈 설정이 여기 있다 |
| `edgemesh-agent-psk` | P2P 터널 암호화용 사전 공유 키. 모든 Agent가 같은 키를 가져야 터널이 성립한다 |

PSK는 손댈 필요가 없었다(값은 비밀이라 생략). `edgemesh-agent-cfg`에서 `relayNodes`만 고쳤다.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: edgemesh-agent-cfg
  namespace: kubeedge
data:
  edgemesh-agent.yaml: |
    modules:
      edgeProxy:
        enable: true
      edgeTunnel:
        enable: true
        listenPort: 20006
        transport: tcp
        rendezvous: EDGEMESH_PLAYGOUND
        psk:
          enable: true
          path: /etc/edgemesh/psk
        relayNodes:
          - nodeName: edge01
            advertiseAddress:
              - 10.0.10.151
          - nodeName: edge02
            advertiseAddress:
              - 10.0.20.158
      edgeDNS:
        enable: true
```

`rendezvous` 값의 철자(`PLAYGOUND`)는 업스트림 기본값 그대로다. 모든 Agent가 같은 값이면 된다. 고친 뒤 Agent를 재시작한다.

```bash
kubectl -n kubeedge rollout restart ds/edgemesh-agent
```

## 3. 로그 보기

KubeEdge 엣지에서는 `kubectl logs`와 port-forward가 기본으로 되지 않는다. 엣지 노드에서 `crictl`로 본다.

```bash
crictl ps -a | grep edgemesh
crictl logs <container-id>
```

### relay 부트스트랩

```text
server.go:98]  edgemesh-agent running on EdgeMode
module.go:52]  Module EdgeDNS registered successfully
server.go:68]  Using userspace Proxier.
module.go:52]  Module EdgeProxy registered successfully
module.go:128] Configure libp2p.ForceReachabilityPrivate()
module.go:189] I'm {12D3KooW...: [/ip4/10.0.10.151/tcp/20006 ...]}
module.go:211] Bootstrapping the DHT
tunnel.go:442] [Bootstrap] failed to bootstrap with {...: [/ip4/10.0.10.102/tcp/20006]}
tunnel.go:453] [Bootstrap] Not all bootstrapDail connected, continue bootstrapDail...
tunnel.go:448] [Bootstrap] success bootstrapped with {...: [/ip4/10.0.10.102/tcp/20006]}
```

첫 시도는 실패했지만 10초 뒤 재시도에서 relay 노드와 연결됐다.

### 피어 발견

```text
tunnel.go:85]  Starting MDNS discovery service
tunnel.go:98]  Starting DHT discovery service
dns.go:37]     Runs CoreDNS v1.8.0 as a local dns
tunnel.go:496] Starting relay finder
tunnel.go:131] [MDNS] Discovery found peer: {...}
tunnel.go:161] [MDNS] New stream between peer {...} success
tunnel.go:131] [DHT]  Discovery found peer: {...: [/ip4/10.0.20.158/tcp/20006]}
tunnel.go:505] [Finder] send relayMap peer: {...: [/ip4/10.0.10.102/tcp/20006]}
```

같은 L2에 있는 피어는 mDNS로, 다른 대역에 있는 피어는 DHT로 찾는다. Agent 안에 CoreDNS가 로컬 DNS로 따로 뜨는 것도 보인다.

## 4. P2P 통신 경로

EdgeMesh(libp2p)는 경로를 두 가지로 시도한다.

### 경로 1: Direct P2P (홀펀칭 성공)

```text
edge01  ←──── 직접 연결 ────→  edge02
```

같은 L2/L3 대역이거나 NAT를 통과할 수 있으면 직접 연결한다. 가장 빠르다.

### 경로 2: Relay 경유 (홀펀칭 실패)

```text
edge01  ────→  relay (master02)  ────→  edge02
```

NAT가 복잡하거나, 방화벽이 막거나, 대역이 달라서 직접 연결이 안 되면 자동으로 relay로 넘어간다.

### 처음 상태: 서로 닿지 않음

```text
edge01           ←──── 통신 안 됨 ────→         edge02
10.0.10.x                                    10.0.20.x
```

두 엣지 사이에 IP 경로 자체가 없었다. 양쪽에 master02를 게이트웨이로 쓰는 정적 경로를 넣었다.

```bash
# edge01
ip route add 10.0.20.0/24 via 10.0.10.102
nc -zv 10.0.20.158 20006   # succeeded

# edge02
ip route add 10.0.10.0/24 via 10.0.20.152
nc -zv 10.0.10.151 20006   # succeeded
```

```text
[ edge01 ]            [ master02 (라우터 역할) ]         [ edge02 ]
10.0.10.151 ────→    10.0.10.102 / 10.0.20.152   ←──── 10.0.20.158
```

## 5. Direct P2P인지 확인하기

가장 중요한 로그는 이것이다.

```text
[DHT] New stream between peer { ... 10.0.20.158 ... } success
Discovery found peer: { ... /ip4/10.0.20.158/tcp/20006 }
```

edge01이 edge02의 주소를 직접 알고 있고, DHT로 직접 스트림을 만들었다. relay를 거쳤다면 주소에 `/p2p-circuit`이 붙는다.

### tcpdump로 한 번 더

양쪽 엣지에서 서로의 터널 포트만 잡았다.

```bash
# edge01
tcpdump -i ens3 host 10.0.20.158 and port 20006 -nn
# edge02
tcpdump -i ens3 host 10.0.10.151 and port 20006 -nn
```

가만히 두면 패킷이 안 보일 수 있어서, 다른 노드에서 서비스로 `curl http://<서비스IP>:<PORT>`를 날려 트래픽을 만들었다.

```text
10.0.10.151.20006 > 10.0.20.158.20006: Flags [S],  ...   # SYN
10.0.20.158.20006 > 10.0.10.151.20006: Flags [S.], ...   # SYN+ACK
10.0.10.151.20006 > 10.0.20.158.20006: Flags [.],  ...   # ACK → 세션 수립
10.0.10.151.20006 > 10.0.20.158.20006: Flags [P.], length 24
10.0.10.151.20006 > 10.0.20.158.20006: Flags [P.], length 58
10.0.20.158.20006 > 10.0.10.151.20006: Flags [P.], length 24   # 양방향 시작
...
10.0.20.158.20006 > 10.0.10.151.20006: Flags [P.], length 794  # 큰 데이터 블록
```

- 두 엣지 IP 사이에서 TCP 3-way handshake가 바로 이뤄진다.
- 출발지·목적지가 relay 노드가 아니라 상대 엣지다.
- `/p2p-circuit` 흔적이 없다.

즉 **libp2p 세션은 relay 없이 엣지 간 직접(Direct) 연결**이다. 다만 IP 패킷은 정적 경로대로 master02를 L3 라우터로 지나간다. "relay를 안 탄다"와 "중간 홉이 없다"는 다른 이야기라서, 운영망에서는 이 라우팅 경로까지 같이 설계해야 한다.

## 정리

| 단계 | 핵심 |
| --- | --- |
| 배포 | Agent DaemonSet 하나, 엣지 노드로만 제한 |
| 설정 | `relayNodes`에 양쪽이 닿는 주소, PSK는 공통 |
| 로그 | 엣지에서는 `crictl logs` |
| 확인 | `New stream ... success` + tcpdump handshake, `/p2p-circuit` 없음 |
| 주의 | 대역이 다르면 IP 경로부터 만들어야 P2P가 성립 |

엣지끼리 통신이 되면, 클라우드가 끊겨도 현장 안에서 서비스끼리 협업할 수 있는 길이 생긴다. 클라우드와의 단절 자체를 측정한 결과는 [DIL 환경 검증](/blog/kubeedge-dil-validation/)에 있다.
