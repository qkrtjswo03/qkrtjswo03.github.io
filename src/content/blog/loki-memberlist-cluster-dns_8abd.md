---
title: "Loki가 memberlist에 못 붙던 이유: kubelet clusterDNS 한 줄"
description: "Loki Distributed 컴포넌트가 줄줄이 CrashLoopBackOff에 빠졌다. 범인은 Loki 설정이 아니라 kubelet clusterDNS에 들어간 잘못된 IP 하나였다."
pubDate: 2026-11-03
categories:
  - 관측
  - 트러블슈팅
tags:
  - Loki
  - Kubernetes
  - CoreDNS
  - kubelet
  - memberlist
draft: false
---

Loki Distributed를 올렸더니 Compactor, Ingester, Distributor, Gateway가 한꺼번에 무너졌다. 처음에는 Loki 설정부터 의심했지만, 끝까지 따라가 보니 원인은 kubelet 설정 파일의 IP 한 줄이었다. 그 과정을 정리해 둔다.

> 글에 나오는 IP는 모두 예시 값(10.0.0.x)으로 바꿨다.

## 배경과 증상

Loki Distributed 구성에서 다음 증상이 동시에 나타났다.

- Compactor / Ingester / Distributor / Gateway Pod가 **CrashLoopBackOff**
- memberlist 클러스터 join 실패
- MinIO(S3) 접근 실패로 delete store 초기화 실패
- Pod 안에서 DNS가 아예 동작하지 않음

증상은 여러 갈래였지만 로그를 하나씩 보니 전부 같은 곳을 가리키고 있었다.

### memberlist join 실패

```bash
level=warn ts=2025-12-05T05:21:44.302145651Z caller=memberlist_client.go:595 msg="joining memberlist cluster: failed to reach any nodes" retries=0 err="1 error occurred:
        * Failed to resolve prometheus-stack-loki-distributed-memberlist: lookup prometheus-stack-loki-distributed-memberlist on 10.0.0.3:53: read udp 10.0.1.153:50418->10.0.0.3:53: i/o timeout
"
```

Compactor가 memberlist headless Service 이름을 DNS로 풀지 못했다. 그런데 질의를 보낸 대상인 `10.0.0.3`이 이상했다. 이건 kube-dns Service의 ClusterIP가 아니라 **CoreDNS Pod의 IP**였다.

### Compactor delete store 초기화 실패

```bash
failed to init delete store: failed to get s3 object: RequestError: send request failed
caused by: Get "http://prometheus-stack-minio.monitoring.svc.cluster.local:9000/k8s-loki/index/delete_requests/delete_requests.gz": dial tcp: lookup prometheus-stack-minio.monitoring.svc.cluster.local: no such host
```

S3 엔드포인트도 이름 해석에서 막혔다. memberlist만의 문제가 아니라 Pod 안 DNS 자체가 죽어 있다는 뜻이다.

### Pod 안에서 DNS 직접 확인

```bash
kubectl exec -it prometheus-stack-loki-distributed-compactor-0 -n monitoring -- nslookup kube-dns.kube-system.svc.cluster.local

;; connection timed out; no servers could be reached
```

kube-dns조차 찾지 못했다. 클러스터 DNS 전체가 죽은 게 아니라 **Pod에 주입된 DNS 설정**이 잘못됐을 가능성이 커졌다.

### resolv.conf

```bash
search monitoring.svc.cluster.local svc.cluster.local cluster.local openstacklocal
nameserver 10.0.0.3
options ndots:5
```

- 들어가 있는 값: `nameserver 10.0.0.3` (CoreDNS Pod IP)
- 들어가야 할 값: `nameserver 10.0.0.10` (kube-dns ClusterIP)

## 원인

Pod의 `resolv.conf`는 kubelet이 만들어 준다. 그리고 nameserver 값은 kubelet 설정의 `clusterDNS`에서 온다. 즉 **kubelet clusterDNS가 처음부터 잘못된 IP로 들어가 있었다.**

설치 로그를 다시 보니 이미 경고가 찍혀 있었다.

```bash
The recommended value for "clusterDNS" in "KubeletConfiguration" is: [10.0.0.10]; the provided value is: [10.0.0.3]
```

이 상태로 클러스터가 만들어졌으니 결과는 이렇게 이어진다.

- 모든 Pod가 `resolv.conf`에 `10.0.0.3`을 nameserver로 갖는다.
- CoreDNS Pod IP는 고정된 값이 아니라서 안정적으로 응답하지 못하고 계속 타임아웃이 난다.
- Loki 컴포넌트의 DNS 기반 discovery가 전부 실패한다.
- memberlist join이 100% 실패하고, Loki Distributed 전체가 무너진다.

영향 범위를 정리하면 다음과 같다.

| 기능 | 영향 |
| --- | --- |
| memberlist gossip | DNS를 풀지 못해 join 실패 |
| Compactor delete store | MinIO DNS 실패로 Compactor crash |
| Ingester ring | memberlist 동기화 불가 |
| Distributor ring | ring 상태를 읽지 못함 |
| Gateway nginx resolver | LogQL 실행 실패 |
| Querier | store-gateway 조회 실패 |

Loki 쪽 설정을 아무리 만져도 풀리지 않는 문제였다.

## 조치

### 1. kubelet 설정 수정

모든 노드에서 kubelet 설정 파일을 연다.

```bash
sudo vi /var/lib/kubelet/config.yaml
```

`clusterDNS`를 kube-dns ClusterIP로 고친다.

```bash
clusterDNS:
- 10.0.0.10
```

kubelet을 systemd 인자(`--cluster-dns`)로 띄우는 환경이라면 그쪽 값도 같이 맞춰야 한다.

### 2. kubelet 재시작

```bash
sudo systemctl daemon-reload
sudo systemctl restart kubelet
```

### 3. Pod 재생성

여기서 한 번 더 걸린다. 이미 떠 있는 Pod의 `resolv.conf`는 kubelet을 재시작해도 바뀌지 않는다. Pod를 새로 만들어야 한다.

```bash
kubectl delete pod -n monitoring -l app.kubernetes.io/name=loki-distributed
```

또는 롤링 재시작을 한다.

```bash
kubectl rollout restart statefulset -n monitoring prometheus-stack-loki-distributed-compactor
kubectl rollout restart daemonset -n monitoring prometheus-stack-loki-distributed-gateway
```

## 검증

임시 Pod로 DNS부터 확인했다.

```bash
kubectl run dns-check --image=busybox:1.36 -it --rm --restart=Never -- nslookup kubernetes.default
```

응답 서버가 kube-dns ClusterIP로 나오면 정상이다.

```txt
Server: 10.0.0.10
```

그다음 Compactor 로그에서 memberlist join과 S3 초기화가 통과하는 것을 확인했다.

```bash
msg="memberlist fast-join finished" joined_nodes=4
msg="S3 delete store initialized successfully"
msg="Starting compactor"
```

## 정리

이번 장애는 Loki 설정 오류가 아니라 **클러스터 전체의 kubelet DNS 설정 오류**였다. 다음 세 가지가 모두 맞아야 완전히 풀린다.

- 모든 노드의 kubelet config에 `clusterDNS`가 kube-dns ClusterIP로 들어가 있을 것
- systemd 인자의 `--cluster-dns`도 같은 값일 것
- Pod를 재생성해서 `resolv.conf`를 새로 받을 것

배운 점도 적어 둔다.

- 여러 컴포넌트가 동시에 이름 해석에서 실패하면 애플리케이션보다 Pod의 `resolv.conf`를 먼저 본다.
- `nameserver`가 Service ClusterIP가 아니라 Pod IP라면 그 자체로 이상 신호다.
- 설치 로그의 경고는 넘기지 말자. 답이 이미 거기 적혀 있었다.
