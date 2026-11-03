---
title: "MTU 1500에서 MSS 1460까지: 엣지 데이터가 Segment로 쪼개지는 과정"
description: "엣지 노드에서 클라우드로 보내는 데이터가 TCP Segment, IP Packet, Ethernet Frame으로 바뀌는 과정을 바이트 단위로 따라갔다. MTU와 MSS 계산, 오버레이 터널에서 줄어드는 MSS, MQTT 경로까지 정리했다."
pubDate: 2026-11-03
categories:
  - 네트워크
tags:
  - TCP/IP
  - MTU
  - MSS
  - KubeEdge
  - MQTT
  - VXLAN
draft: false
---

엣지 노드에서 클라우드 수집기로 데이터를 보내는 경로를 보다가, "이 JSON 한 건, 이 이미지 한 장이 선로 위에서는 몇 조각이 되나"가 궁금해졌다. MTU 1500이라는 숫자는 자주 보지만, 그 안에 무엇이 들어가고 밖에 무엇이 붙는지는 대충 알고 있었다. 이번에 바이트 단위로 다시 정리해 둔다.

> 글에 나오는 노드 이름, IP, 엔드포인트는 모두 예시 값(edge-node, cloud-collector, 10.0.0.x)이다.

## 배경: 계층과 캡슐화 다시 보기

데이터는 보내는 쪽에서 위에서 아래로 내려가면서 계층마다 헤더가 하나씩 붙고, 받는 쪽에서는 아래에서 위로 올라가면서 하나씩 벗겨진다. 이게 캡슐화(encapsulation)다. 애플리케이션이 만든 바이트에 TCP 헤더가 붙으면 Segment, 거기에 IP 헤더가 붙으면 Packet, 다시 Ethernet 헤더와 FCS가 붙으면 Frame이 된다. 각 계층은 바로 아래 계층이 주는 칸에 자기 데이터를 넣을 뿐, 그 안의 내용이 무슨 의미인지는 모른다.

OSI 7계층은 이 구조를 설명하는 참조 모델이고, 실제 인터넷은 TCP/IP 4계층(링크, 인터넷, 전송, 응용)으로 돌아간다. 그래서 HTTP, MQTT, gRPC는 OSI 기준으로 L7 응용 계층 프로토콜이다. "JSON은 표현 계층, 세션 관리는 세션 계층"처럼 L5·L6에 억지로 나눠 넣는 설명을 자주 보는데, TCP/IP에는 그 경계가 따로 없다. TLS처럼 L4와 L7 사이에 걸쳐 있는 것도 있다. 이 글에서는 L5~L7을 한 덩어리의 "애플리케이션 데이터"로 본다.

중요한 건 아래쪽이다. 크기 제한과 분할은 L4(MSS)와 L3(MTU)에서 일어나고, 애플리케이션은 그 숫자를 몰라도 된다.

| 계층 | PDU | 이 글에서 보는 것 |
| --- | --- | --- |
| L7~L5 (응용) | Data / Message | HTTP 요청, MQTT PUBLISH, JSON, 이미지 |
| L4 (전송) | Segment (TCP) / Datagram (UDP) | TCP 헤더 + Data, Data는 MSS 이하 |
| L3 (네트워크) | Packet | IP 헤더 + Segment, 전체는 MTU 이하 |
| L2 (데이터링크) | Frame | Ethernet 헤더 + Packet + FCS |
| L1 (물리) | Bit | 선로 위 신호 |

## 한 Frame 안에 들어 있는 것

<!-- diagram: 가로로 긴 Frame 한 줄. 왼쪽부터 [Ethernet 14B][IPv4 20B][TCP 20B][Data 1460B][FCS 4B]. 위쪽 중괄호로 IP~Data 구간을 "MTU 1500", 그 안의 Data만 "MSS 1460"으로 표시. 아래쪽 중괄호로 L2 Frame 전체(1518B), L3 Packet, L4 Segment 범위를 층별로 표시. -->

옵션 없는 IPv4와 TCP를 기준으로 표준 Ethernet Frame 하나는 이렇게 생겼다.

```txt
| Ethernet 헤더 14B | IP 헤더 20B | TCP 헤더 20B | Data 1460B | FCS 4B |
                    |<-------------- MTU 1500B --------------->|
                                                |<-- MSS --->|
```

- **MTU**는 L3 Packet 전체 크기의 상한이다. IP 헤더부터 TCP Data 끝까지가 여기 들어간다.
- **Ethernet 헤더 14B와 FCS 4B는 MTU 밖**이다. 그래서 MTU 1500의 Frame은 1518B가 된다. VLAN 태그가 있으면 4B가 더 붙는다.
- **MSS**는 TCP Data만의 상한이다. 헤더는 포함하지 않는다.
- 이름도 계층마다 다르다. Ethernet Payload가 IP Packet이고, IP Payload가 TCP Segment이고, TCP Payload가 애플리케이션 Data다. Segment와 Packet은 같은 말이 아니다.

IP 헤더에서 이 글과 관련된 필드는 세 개다.

- **Total Length**: 헤더와 Payload를 합친 Packet 길이. 이 값이 MTU를 넘으면 한 Frame에 못 담는다.
- **Protocol**: Payload가 TCP(6)인지 UDP(17)인지.
- **DF(Don't Fragment)**: DF=1이면 경로 중간 라우터가 이 Packet을 쪼개지 않는다. 다음 링크 MTU보다 크면 버리고 ICMP "Fragmentation Needed"를 돌려보낸다. Linux는 TCP에 기본으로 DF=1을 켜고, 이 ICMP를 받아 경로 MTU를 알아낸다(PMTUD). 중간에서 ICMP를 막으면 큰 Packet만 조용히 사라지는 블랙홀이 생긴다.

## MTU에서 MSS 계산하기

계산 자체는 뺄셈이다.

```txt
IPv4 + TCP : 1500 - 20 (IP) - 20 (TCP) = 1460
IPv6 + TCP : 1500 - 40 (IP) - 20 (TCP) = 1440
IPv4 + UDP : 1500 - 20 (IP) -  8 (UDP) = 1472   # UDP는 MSS 협상이 없다. 단편화 없이 실을 수 있는 최대 Payload
```

헷갈렸던 건 TCP 타임스탬프 옵션이다. Linux는 기본으로 타임스탬프를 켜는데, 이 옵션이 붙으면 TCP 헤더가 32B(20B + 옵션 12B)가 된다.

- SYN에서 **광고하는 MSS는 그대로 1460**이다. MSS는 옵션을 뺀 값으로 협상한다.
- 실제 **Segment 하나에 실리는 Data는 1448B**(1500 - 20 - 32)다.

`ss -ti`에서 `mss:1448`로 보이는 게 이 때문이다.

## 큰 데이터는 MSS 단위로 나뉜다

<!-- diagram: 왼쪽에 "10,000B" 블록 하나, 오른쪽으로 화살표 ①(TCP가 분할) 후 1460B 블록 6개 + 1240B 블록 1개. 각 블록 아래에 IP 헤더/Ethernet 헤더가 붙는 모습을 작게 표시하고, 맨 오른쪽 수신 측에서 화살표 ②(TCP가 재조립)로 다시 10,000B 하나로 합쳐짐. -->

애플리케이션이 데이터를 MTU 크기로 잘라서 보내는 게 아니다. 애플리케이션은 소켓에 바이트를 쓰고, TCP가 그 바이트 스트림을 MSS 이하로 나눈다.

```txt
10,000B 전송, MSS 1460 (타임스탬프 없음 가정)

1460 | 1460 | 1460 | 1460 | 1460 | 1460 | 1240
=> 6 x 1460 + 1240 = 10,000B, Segment 7개
```

받는 쪽 TCP가 순서대로 다시 붙이고, 애플리케이션은 원래 요청이나 파일로 읽는다. 크기 때문에 내용이 바뀌지는 않고, 달라지는 건 조각 수와 전송 시간이다.

데이터 크기별로 보면 이렇다.

- **작은 JSON 한 건(수백 바이트)**: 헤더를 다 붙여도 MTU보다 훨씬 작아서 보통 Segment 하나로 끝난다.
- **이미지, 텐서, 모델 파일(수 MB)**: 1460B Segment가 수천 개가 된다. 중간에 하나만 유실돼도 재전송이 필요하고, 전송 시간이 길어진다.

TCP는 메시지 경계를 모른다는 점도 같이 기억해 둘 만하다. `write()` 한 번, HTTP 요청 하나, 파일 하나가 Segment 하나라는 보장은 없다. 작은 메시지 여러 개가 한 Segment에 같이 실리기도 하고, 큰 메시지 하나가 여러 Segment로 나뉘기도 한다. 메시지 경계는 HTTP의 `Content-Length`나 MQTT의 Remaining Length처럼 L7 프로토콜이 직접 표시한다.

UDP는 다르다. 재조립을 보장하지 않기 때문에 1472B를 넘는 UDP는 IP 단편화로 나뉘거나, DF가 켜져 있으면 버려진다.

## 캡처하면 MTU보다 큰 Segment가 보이는 이유: TSO/GSO

보내는 서버에서 `tcpdump`를 떠 보면 길이가 수만 바이트인 TCP Segment가 찍힌다. 처음엔 MTU 설정이 잘못된 줄 알았는데, 오프로딩 때문이다.

- **TSO(TCP Segmentation Offload)**: 커널은 큰 덩어리 하나를 NIC에 넘기고, NIC가 하드웨어에서 MSS 단위로 나눈다.
- **GSO(Generic Segmentation Offload)**: 같은 일을 소프트웨어로, 드라이버에 넘기기 직전에 한다.
- 받는 쪽에는 **GRO**가 있어서, 수신 캡처에서도 합쳐진 큰 Segment가 보일 수 있다.

`tcpdump`가 패킷을 보는 지점이 NIC가 나누기 전(수신은 GRO가 합친 뒤)이라서 이렇게 보인다. 선로 위의 Frame은 여전히 MTU 이하다. 실제 선로 크기를 보려면 스위치 미러링을 쓰거나, 테스트할 때만 `ethtool -K <iface> tso off gso off gro off`로 끄고 본다.

## 오버레이와 터널에서는 MSS가 더 작아진다

Kubernetes CNI가 VXLAN이나 Geneve 같은 오버레이를 쓰면, Pod의 Packet 전체를 바깥 헤더로 한 번 더 감싼다. 바깥 헤더만큼 안쪽 Packet이 쓸 수 있는 공간이 줄어든다.

```txt
VXLAN (IPv4 underlay) 오버헤드
  바깥 IP 20B + 바깥 UDP 8B + VXLAN 8B + 안쪽 Ethernet 14B = 50B

underlay MTU 1500
  -> Pod 인터페이스 MTU 1450
  -> MSS 1450 - 20 - 20 = 1410
```

다른 터널도 오버헤드만 다를 뿐 원리는 같다. IPIP는 20B, WireGuard(IPv4)는 60B 정도다. 그래서 **터널을 지나는 경로에서는 실효 MSS가 1460보다 작다.**

엣지 노드는 이 문제가 더 잘 드러난다. 엣지와 클라우드 사이에 VPN, LTE 망, 사설 터널이 끼면 경로 MTU가 1500보다 작아지는 일이 흔하다. 이때 생기는 문제는 대체로 이 순서다.

1. 작은 요청(헬스체크, 작은 JSON)은 잘 가서 연결은 정상처럼 보인다.
2. 큰 요청만 중간에서 버려지고, ICMP가 막혀 있으면 PMTUD도 동작하지 않는다.
3. 결과적으로 큰 업로드만 타임아웃이 난다.

해결 방법은 Pod나 인터페이스 MTU를 경로에 맞게 낮추거나, 경계 장비에서 MSS를 줄여 주는 것이다(MSS clamping, 예: `iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu`).

## MQTT와 DeviceTwin 경로

KubeEdge 엣지 노드 안에서는 다른 경로가 하나 더 있다. 장치 데이터를 처리하는 애플리케이션(Mapper 등)이 MQTT로 Mosquitto에 PUBLISH하면, EdgeCore의 EventBus가 토픽을 구독하고 DeviceTwin이 상태를 갱신한 뒤 EdgeHub를 통해 CloudCore로 올린다.

```txt
app (edge-node) -> Mosquitto 127.0.0.1:1883 -> EventBus -> DeviceTwin -> EdgeHub -> CloudCore
L7: MQTT PUBLISH, 토픽 $hw/events/device/<device-id>/twin/update, JSON payload
L4: TCP 1883
L3: 127.0.0.1 (같은 노드 안)
L2: loopback (lo)
```

여기서 두 가지를 바로잡아 둔다.

- **127.0.0.1로 가는 트래픽은 NIC를 타지 않는다.** 커널 안의 loopback 인터페이스(`lo`)에서 처리된다. `lo`의 MTU는 보통 65536이라 이 구간의 MSS는 6만 바이트대이고, 1460 분할은 일어나지 않는다. 그래서 이 구간에서는 MTU보다 브로커, 토픽, QoS 설정이 더 중요하다.
- **Pod 안의 127.0.0.1은 그 Pod 자신의 loopback이다.** Pod가 노드에 떠 있는 Mosquitto에 `127.0.0.1:1883`으로 붙으려면 `hostNetwork: true`여야 한다. 그렇지 않으면 노드 IP로 접속하거나, 브로커를 같은 Pod 안에 sidecar로 둬야 한다.

MQTT도 L7 프로토콜이라 결국 TCP 바이트 스트림 위에 실린다. CONNECT, SUBSCRIBE, PUBLISH가 각각 Segment 하나라는 보장은 없고, twin/update처럼 수백 바이트 JSON은 보통 Segment 하나에 들어간다. 큰 Payload를 MQTT로 보내면 HTTP와 똑같이 MSS 단위로 나뉜다. 링크가 유선 Ethernet이든 Wi-Fi나 LTE든 MQTT 규격은 같고, 바뀌는 건 L2와 그 링크의 MTU뿐이다.

정리하면 엣지에서 본 두 경로는 성격이 다르다.

| 경로 | 구간 | 신경 쓸 것 |
| --- | --- | --- |
| edge-node -> cloud-collector (HTTP/gRPC, TLS) | 실제 NIC, 터널 가능 | 경로 MTU, 실효 MSS, 큰 Payload 전송 시간 |
| app -> Mosquitto (MQTT) | 같은 노드 loopback | 브로커, 토픽, QoS, hostNetwork 여부 |

## 확인 명령

환경에 맞게 인터페이스 이름과 IP를 바꿔서 쓴다.

```bash
# 인터페이스 MTU 확인 (eth0, lo, vxlan/cilium 인터페이스 등)
ip link show
ip -d link show <iface>      # VXLAN 인터페이스면 vxlan id, dstport도 보인다

# 연결별 실제 MSS, PMTU 확인
ss -ti dst 10.0.0.20
#   mss:1448 pmtu:1500 ...  <- 타임스탬프가 켜진 연결

# SYN에서 협상하는 MSS 확인
tcpdump -ni <iface> 'tcp[tcpflags] & tcp-syn != 0 and host 10.0.0.20' -v
#   options [mss 1460,sackOK,TS ...]

# DF를 켠 상태로 경로 MTU 탐색 (1472 + 28 = 1500)
ping -M do -s 1472 10.0.0.20
ping -M do -s 1422 10.0.0.20  # 터널 경로면 이쪽만 통과하기도 한다

# 오프로딩 상태 확인
ethtool -k <iface> | grep -E 'tcp-segmentation|generic-(segmentation|receive)'

# 엣지 노드 안 MQTT 트래픽은 lo에서 본다
tcpdump -ni lo port 1883
```

## 정리

- MTU는 IP Packet 전체, MSS는 TCP Data만의 상한이다. Ethernet 헤더 14B와 FCS 4B는 MTU 밖이다.
- 1500 - 20 - 20 = 1460. IPv6는 1440, UDP는 1472, 타임스탬프가 켜지면 Segment당 Data는 1448이다.
- 분할은 애플리케이션이 아니라 TCP가 한다. 10,000B는 1460 x 6 + 1240, Segment 7개다.
- 캡처에 MTU보다 큰 Segment가 보이면 TSO/GSO/GRO부터 의심한다.
- 오버레이나 터널을 지나면 실효 MSS가 1460보다 작다. VXLAN이면 1410이다.
- 127.0.0.1 트래픽은 NIC가 아니라 `lo`를 탄다. Pod에서 노드의 127.0.0.1에 붙으려면 hostNetwork가 필요하다.
