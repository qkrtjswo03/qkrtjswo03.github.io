---
title: "KubeEdge v1.22 설치: 기존 클러스터에 엣지 VM 한 대 붙이기"
description: "기존 Kubernetes 1.30 클러스터에 keadm으로 CloudCore를 올리고, 엣지 VM에 containerd와 EdgeCore를 설치해 join한 과정을 최소 구성 기준으로 정리했다. CNI, MQTT, DaemonSet 제외까지 포함."
pubDate: 2026-11-05T09:20:00+09:00
categories:
  - 엣지
tags:
  - KubeEdge
  - keadm
  - containerd
  - CloudCore
  - EdgeCore
series: kubeedge
seriesOrder: 3
draft: false
---

[아키텍처](/blog/kubeedge-architecture/)를 정리했으니 실제로 붙여 봤다. 목표는 **이미 있는 Kubernetes 클러스터에 엣지 VM 한 대를 붙이는 최소 테스트 구성**이다. 사내 Kubernetes PaaS 테스트 클러스터를 클라우드 영역으로 그대로 쓰고, CloudCore와 EdgeCore만 더했다.

> 글의 IP와 호스트 이름은 예시 값으로 바꿨다. 클러스터 내부망은 `10.0.10.x`, 외부 접근망은 `10.0.20.x`로 적었다.

## 1. 구성

### 최소 구성

| 구분 | 수량 | 설명 |
| --- | --- | --- |
| Kubernetes 클러스터 | 기존 클러스터 | 클라우드 영역 |
| CloudCore | 1 (control-plane 중 1대에서 init) | KubeEdge 클라우드 컴포넌트 |
| Edge VM | 1 | EdgeCore 설치 |

기존 클러스터는 다음과 같았다.

| 항목 | 값 |
| --- | --- |
| Kubernetes | v1.30.12 |
| OS / Kernel | Ubuntu 24.04 LTS / 6.8.0-40 |
| Runtime | containerd 1.7.22 |
| 노드 | control-plane 3대(HA) + worker 3대 |

### 전체 구조

```text
┌──────────────────────────────────────────────┐
│          Kubernetes Cluster (Cloud)          │
│                                              │
│  master01 (control-plane)                    │
│  ┌────────────────────────┐                  │
│  │ CloudCore              │                  │
│  │  CloudHub   (10000)  ◀─┼──────┐           │
│  │  EdgeController        │      │           │
│  │  DeviceController      │      │           │
│  └────────────────────────┘      │           │
│  master02, master03              │           │
│  worker01 ~ worker03             │           │
└──────────────────────────────────┼───────────┘
                                   │ TLS / WebSocket
                                   │ (NodePort)
┌──────────────────────────────────┼───────────┐
│  Edge VM                         ▼           │
│  ┌────────────────────────┐                  │
│  │ EdgeCore               │                  │
│  │  EdgeHub ──────────▶ CloudHub              │
│  │  MetaManager           │                  │
│  │  EventBus              │                  │
│  └───────────┬────────────┘                  │
│          containerd → Pod                    │
└──────────────────────────────────────────────┘
```

엣지를 늘릴 때는 같은 CloudCore 아래 Edge01, Edge02, Edge03 식으로 join만 반복하면 된다.

## 2. 버전 호환성

KubeEdge 공식 GitHub의 호환성 표 일부다.

| KubeEdge | K8s 1.26 | 1.27 | 1.28 | 1.29 | 1.30 | 1.31 |
| --- | --- | --- | --- | --- | --- | --- |
| v1.20 | + | + | ✓ | ✓ | ✓ | - |
| v1.21 | + | + | ✓ | ✓ | ✓ | - |
| v1.22 | + | + | + | ✓ | ✓ | ✓ |

`✓`는 공식 호환, `+`는 부분 호환(기능 제한 가능), `-`는 비지원이다. Kubernetes 1.30에 v1.22를 골랐다.

## 3. CloudCore 설치 (클라우드)

### keadm 받기

```bash
wget https://github.com/kubeedge/kubeedge/releases/download/v1.22.0/keadm-v1.22.0-linux-amd64.tar.gz
tar -xzf keadm-v1.22.0-linux-amd64.tar.gz
sudo cp keadm-v1.22.0-linux-amd64/keadm/keadm /usr/local/bin/
keadm version
```

### CloudCore 초기화

```bash
sudo keadm init \
  --advertise-address=10.0.10.101 \
  --kube-config=/root/.kube/config
```

`Kubernetes version verification passed, KubeEdge v1.22.0 installation will start...`가 뜨면 진행된다. 끝나면 `kubeedge` 네임스페이스를 본다.

```bash
kubectl get pods -n kubeedge -o wide
NAME                           READY   STATUS    NODE
cloud-iptables-manager-c78zh   1/1     Running   worker02
cloud-iptables-manager-qfc6z   1/1     Running   worker01
cloud-iptables-manager-sf7hk   1/1     Running   worker03
cloudcore-fbdb89495-t565h      1/1     Running   worker01

kubectl get svc -n kubeedge
NAME        TYPE       PORT(S)
cloudcore   NodePort   10000:31987/TCP,10001:30543/UDP,10002:31159/TCP,10003:32226/TCP,10004:31202/TCP
```

CloudCore는 NodePort로 열린다. 엣지가 붙을 때 쓰는 포트는 두 개다.

| 포트 | NodePort | 용도 |
| --- | --- | --- |
| 10000 | 31987 | CloudHub (WebSocket) |
| 10002 | 31159 | 인증서 발급 (certport) |

CloudCore가 뜬 노드에서 리슨도 확인했다.

```bash
ss -lntp | grep -E '10000|10002'
LISTEN 0 4096 *:10000 *:* users:(("cloudcore",pid=15961,fd=11))
LISTEN 0 4096 *:10002 *:* users:(("cloudcore",pid=15961,fd=10))
```

### 토큰

```bash
keadm gettoken
```

출력된 토큰을 엣지에서 join할 때 쓴다. 토큰은 만료 시간이 있는 비밀 값이라 글에는 남기지 않았다.

## 4. EdgeCore 설치 (엣지 VM)

### 필수 패키지

```bash
sudo apt update
sudo apt install -y curl wget socat conntrack ipset
```

### containerd 1.7.22 + runc

```bash
wget https://github.com/containerd/containerd/releases/download/v1.7.22/containerd-1.7.22-linux-amd64.tar.gz
sudo tar Cxzvf /usr/local containerd-1.7.22-linux-amd64.tar.gz
wget https://raw.githubusercontent.com/containerd/containerd/main/containerd.service
sudo mv containerd.service /etc/systemd/system/containerd.service

wget https://github.com/opencontainers/runc/releases/download/v1.1.12/runc.amd64
sudo install -m 755 runc.amd64 /usr/local/sbin/runc
containerd --version
```

설정 파일을 만들고 기동한다.

```bash
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml >/dev/null
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml

sudo systemctl daemon-reload
sudo systemctl enable --now containerd
systemctl status containerd --no-pager -l
```

### join 전에 포트부터 확인

엣지에서 CloudHub와 인증서 포트가 열려 있는지 먼저 본다. 여기서 막히면 join이 애매한 에러로 실패한다.

```bash
nc -vz 10.0.10.101 31987   # cloudhub
nc -vz 10.0.10.101 31159   # certport

# CA 인증서 응답 확인
curl -vk https://10.0.10.101:31159/ca.crt -o /tmp/ca.crt
```

`curl` 결과에서 `subject: O=KubeEdge; CN=KubeEdge`, `HTTP/2 200`, `content-length: 381`이 보이면 인증서 엔드포인트가 정상이다. 자체 서명 CA라 `unable to get local issuer certificate`는 예상된 경고다.

### keadm으로 join

클라우드와 같은 버전(v1.22.0)의 keadm을 엣지에도 설치한 뒤 join한다.

```bash
sudo keadm join \
  --cloudcore-ipport=10.0.20.151:31987 \
  --certport=31159 \
  --token='<keadm gettoken 출력값>' \
  --kubeedge-version=1.22.0 \
  --remote-runtime-endpoint=unix:///run/containerd/containerd.sock \
  --cgroupdriver=systemd \
  --edgenode-name=edge01
```

join 로그는 10단계로 진행된다.

```text
1. Check KubeEdge edgecore process status
2. Check if the management directory is clean
3. Check if the node name is valid
4. Create the necessary directories
5. Pull Images
6. Copy resources from the image to the management directory
7. Generate systemd service file
8. Generate EdgeCore default configuration
   NodeIP is empty , use default ip which can connect to cloud.
9. Run EdgeCore daemon
   KubeEdge edgecore is running, For logs visit: journalctl -u edgecore.service -xe
10. Install Complete!
```

### CNI

여기서 한 번 막혔다. 클러스터의 Cilium DaemonSet은 엣지 노드에 뜨지 않는다. 엣지는 kubelet 기반이 아니라 EdgeCore(Edged) 기반이기 때문이다. 별도 DaemonSet을 만들 수도 있지만, 테스트 구성에서는 경량 CNI 플러그인을 직접 까는 편이 간단했다.

```bash
sudo apt install -y containernetworking-plugins
```

설정 파일이 없을 때만 최소 bridge 구성을 만든다.

```bash
sudo tee /etc/cni/net.d/10-bridge.conflist >/dev/null <<'CNI'
{
  "cniVersion": "0.4.0",
  "name": "kubeedge-net",
  "plugins": [
    {
      "type": "bridge",
      "bridge": "kubeedge0",
      "isGateway": true,
      "ipMasq": true,
      "hairpinMode": true,
      "ipam": {
        "type": "host-local",
        "subnet": "10.244.0.0/16",
        "routes": [{ "dst": "0.0.0.0/0" }]
      }
    },
    { "type": "portmap", "capabilities": { "portMappings": true } }
  ]
}
CNI
```

Ubuntu 패키지는 플러그인을 `/usr/lib/cni`에 두는데, 런타임은 `/opt/cni/bin`을 찾는다. 경로를 맞춰 준다.

```bash
sudo mkdir -p /opt/cni/bin
if [ -d /usr/lib/cni ]; then sudo cp -f /usr/lib/cni/* /opt/cni/bin/; fi
sudo ls -l /opt/cni/bin/loopback
```

### cgroup 드라이버 맞추기

containerd와 EdgeCore의 cgroup 드라이버는 반드시 같아야 한다. 나는 최종적으로 cgroupfs로 통일했다. 이때 EdgeCore 쪽(`/etc/kubeedge/config/edgecore.yaml`의 cgroupDriver)도 같은 값이어야 한다.

```bash
sudo sed -i 's/SystemdCgroup = true/SystemdCgroup = false/g' /etc/containerd/config.toml
sudo systemctl restart containerd
sudo systemctl restart edgecore
```

### MQTT (1883)

EventBus가 쓸 MQTT 브로커다. 패키지로 바로 올릴 수도 있다.

```bash
sudo apt install -y mosquitto
sudo systemctl enable --now mosquitto
```

CloudCore가 엣지에 `edge-eclipse-mosquitto` DaemonSet을 올리는 방식도 있다. 이 환경에서는 그 Pod가 엣지 노드에 `hostNetwork`로 떴다. 브로커가 왜 필요한지는 [Device, Mapper, MQTT 글](/blog/kubeedge-device-mapper-mqtt/)에 있다.

## 5. DaemonSet 제외

엣지 노드가 붙으면 클러스터의 DaemonSet들이 엣지에도 스케줄되려고 한다. Cilium이나 node-exporter처럼 엣지에서 제대로 돌지 않는 DaemonSet은 엣지를 제외했다. 이유는 [개요](/blog/kubeedge-overview/)에 적었다.

```bash
kubectl -n kube-system patch ds cilium --type='merge' -p '{
  "spec": {"template": {"spec": {"affinity": {"nodeAffinity": {
    "requiredDuringSchedulingIgnoredDuringExecution": {
      "nodeSelectorTerms": [{"matchExpressions": [
        {"key": "node-role.kubernetes.io/edge", "operator": "DoesNotExist"}
      ]}]
    }
  }}}}}
}'
```

node-exporter도 같은 패치를 `monitoring` 네임스페이스 DaemonSet에 넣었다.

## 6. 결과 확인

```bash
kubectl get nodes -o wide
NAME       STATUS   ROLES           VERSION                     OS-IMAGE           CONTAINER-RUNTIME
edge01     Ready    agent,edge      v1.31.12-kubeedge-v1.22.0   Ubuntu 24.04 LTS   containerd://1.7.22
master01   Ready    control-plane   v1.30.12                    Ubuntu 24.04 LTS   containerd://1.7.22
master02   Ready    control-plane   v1.30.12                    Ubuntu 24.04 LTS   containerd://1.7.22
master03   Ready    control-plane   v1.30.12                    Ubuntu 24.04 LTS   containerd://1.7.22
worker01   Ready    <none>          v1.30.12                    Ubuntu 24.04 LTS   containerd://1.7.22
worker02   Ready    <none>          v1.30.12                    Ubuntu 24.04 LTS   containerd://1.7.22
worker03   Ready    <none>          v1.30.12                    Ubuntu 24.04 LTS   containerd://1.7.22
```

엣지 노드는 join 직후 `NotReady`였다가 1분 안에 `Ready`가 됐다. 역할은 `agent,edge`, 버전 문자열은 `v1.31.12-kubeedge-v1.22.0`으로 일반 노드와 구분된다.

```bash
kubectl get all -n kubeedge
pod/cloud-iptables-manager-...   1/1   Running
pod/cloudcore-fbdb89495-g87db    1/1   Running
service/cloudcore                NodePort   10000:31987/TCP,...
daemonset.apps/cloud-iptables-manager   3   3   3
daemonset.apps/edge-eclipse-mosquitto   ...
deployment.apps/cloudcore        1/1
```

## 7. 무시해도 되는 CloudCore 로그

처음 보면 겁나는 경고가 몇 개 있는데 모두 정상이었다.

| 로그 | 의미 |
| --- | --- |
| `TLSTunnelPrivateKeyFile does not exist ... will load from secret` | 로컬 파일 대신 Secret에서 인증서를 읽는다. 뒤에 `Succeed in loading TunnelCA from CloudHub`가 나오면 정상 |
| `Neither --kubeconfig nor --master was specified. Using the inClusterConfig.` | 클러스터 안 Pod로 돌 때 정상 메시지 |
| `Module taskmanager is disabled, do not register` | 설정상 비활성 모듈 |
| `message pool for edge node edge01 not found and created now` | 첫 연결 때 노드별 메시지 큐를 새로 만든 것 |
| `Ca and CaKey don't exist in local directory, and will read from the secret` | Secret 기반 CA 로딩 |

마지막에 `Start session for edge node edge01`이 찍히면 클라우드-엣지 세션이 성립한 것이다.

## 정리

- 기존 클러스터에 `keadm init` 한 번, 엣지에 `keadm join` 한 번이면 붙는다.
- 실제로 시간이 든 곳은 **포트 확인, CNI, cgroup 드라이버, DaemonSet 제외**였다.
- 엣지는 kubelet 노드가 아니라서, 클러스터 DaemonSet이 그대로 따라오지 않는다는 점을 먼저 알고 가면 편하다.

붙인 엣지가 통신이 끊겼을 때 어떻게 버티는지는 [North-South 데이터 보장 메커니즘](/blog/kubeedge-north-south-reliability/)에서 이어서 본다.
