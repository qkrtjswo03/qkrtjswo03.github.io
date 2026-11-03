---
title: "[K8s Hard Way 11/12] 네트워크 통신 테스트 (netshoot, echo, IPVS)"
description: "netshoot DaemonSet으로 노드 통신을 확인하고, echo와 IPVS로 서비스 경로를 살펴본다."
pubDate: 2025-01-18
categories:
  - 쿠버네티스
tags:
  - kubernetes
  - hard-way
  - cilium
  - netshoot
  - ipvs
series: k8s-hardway
seriesOrder: 11
draft: false
---

## netshoot 디버깅 컨테이너 생성 (통신테스트)

```bash
root@sj-auth-bastion-192-168-34-226:~/hardway/certs# vi netshoot.yaml
```

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: netshoot-cluster
  labels:
    app: netshoot-cluster
spec:
  selector:
    matchLabels:
      name: netshoot-cluster
  template:
    metadata:
      labels:
        name: netshoot-cluster
    spec:
      tolerations:
      - operator: Exists
      containers:
      - name: netshoot-cluster
        tty: true
        stdin: true
        args:
        - bash
        image: nicolaka/netshoot
```

```bash
root@sj-auth-bastion-192-168-34-226:~/hardway/certs# kubectl apply -f  netshoot.yaml
```

---

- netshoot 사용

```bash
root@sj-auth-bastion-192-168-34-226:~/hardway/certs# kubectl get pod
NAME                     READY   STATUS    RESTARTS   AGE
netshoot-cluster-jj48b   1/1     Running   0          39s
```

```bash
root@sj-auth-bastion-192-168-34-226:~/hardway/certs# kubectl exec -it netshoot-cluster-jj48b /bin/bash
kubectl exec [POD] [COMMAND] is DEPRECATED and will be removed in a future version. Use kubectl exec [POD] -- [COMMAND] instead.
bash-5.1# hostname
netshoot-cluster-jj48b

bash-5.1# nslookup kubernetes.default.svc.cluster.local
Server:         10.231.0.10
Address:        10.231.0.10#53

Name:   kubernetes.default.svc.cluster.local
Address: 10.231.0.1

bash-5.1# nslookup naver.com
Server:         10.231.0.10
Address:        10.231.0.10#53

Non-authoritative answer:
Name:   naver.com
Address: 203.0.113.11
Name:   naver.com
Address: 203.0.113.12
Name:   naver.com
Address: 203.0.113.13
Name:   naver.com
Address: 203.0.113.14
```

---

- echo-server

```bash
root@sj-auth-bastion-192-168-34-226:~/hardway/certs# vi echo-server.yaml
kind: Deployment
apiVersion: apps/v1
metadata:
  name: service-test
spec:
  replicas: 2
  selector:
    matchLabels:
      app: service_test_pod
  template:
    metadata:
      labels:
        app: service_test_pod
    spec:
      containers:
      - name: simple-http
        image: python:2.7
        imagePullPolicy: IfNotPresent
        command: ["/bin/bash"]
        args: ["-c", "echo \"<p>Hello from $(hostname)</p>\" > index.html; python -m SimpleHTTPServer 8080"]
        ports:
        - name: http
          containerPort: 8080
```

```bash
root@sj-auth-bastion-192-168-34-226:~/hardway/certs# kubectl create -f echo-server.yaml
```

---

```bash
root@sj-auth-bastion-192-168-34-226:~/hardway/certs# vi echo-service.yaml
---
apiVersion: v1
kind: Service
metadata:
  labels:
    app: service_test_pod
  name: echo
spec:
  ports:
    - name: 8080-8080
      port: 8080
      protocol: TCP
      targetPort: 8080
  selector:
    app: service_test_pod
  type: ClusterIP
  ---
```

```bash
root@sj-auth-bastion-192-168-34-226:~/hardway/certs# kubectl create -f echo-service.yaml
```

---

```bash
root@sj-auth-bastion-192-168-34-226:~/hardway/certs# kubectl get pods -owide
NAME                               READY   STATUS    RESTARTS   AGE     IP           NODE                   NOMINATED NODE   READINESS GATES
cilium-82fgv                       1/1     Running   0          172m    172.31.1.5   k8s-hardway-worker01   <none>           <none>
cilium-operator-5d64788c99-8wg8r   0/1     Pending   0          169m    <none>       <none>                 <none>           <none>
cilium-operator-5d64788c99-lkcvm   1/1     Running   0          172m    172.31.1.5   k8s-hardway-worker01   <none>           <none>
coredns-8bfd66759-rj7fr            1/1     Running   0          7m53s   10.0.0.176   k8s-hardway-worker01   <none>           <none>
netshoot-cluster-zk7pt             1/1     Running   0          3h25m   10.0.0.57    k8s-hardway-worker01   <none>           <none>
service-test-6b8c8fdb64-7cdws      1/1     Running   0          112s    10.0.0.70    k8s-hardway-worker01   <none>           <none>
service-test-6b8c8fdb64-k6x4f      1/1     Running   0          112s    10.0.0.106   k8s-hardway-worker01   <none>           <none>

# svc 확인
root@sj-auth-bastion-192-168-34-226:~/hardway/certs# kubectl get svc
NAME          TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)                  AGE
coredns       ClusterIP   10.231.0.10     <none>        53/UDP,53/TCP,9153/TCP   7m35s
echo          ClusterIP   10.231.58.2     <none>        8080/TCP                 6s
hubble-peer   ClusterIP   10.231.34.153   <none>        443/TCP                  172m
```

---

```bash
root@sj-auth-bastion-192-168-34-226:~/hardway/certs#  netshoot-cluster-zk7pt:~# curl -vk 10.0.0.106:8080
*   Trying 10.0.0.106:8080...
* Connected to 10.0.0.106 (10.0.0.106) port 8080
> GET / HTTP/1.1
> Host: 10.0.0.106:8080
> User-Agent: curl/8.7.1
> Accept: */*
>
* Request completely sent off
* HTTP 1.0, assume close after body
< HTTP/1.0 200 OK
< Server: SimpleHTTP/0.6 Python/2.7.18
< Date: Wed, 08 Jan 2025 04:57:56 GMT
< Content-type: text/html
< Content-Length: 48
< Last-Modified: Wed, 08 Jan 2025 04:55:04 GMT
<
<p>Hello from service-test-6b8c8fdb64-k6x4f</p>
* Closing connection

## 쿠버네티스 클러스터 내부에서 
netshoot-cluster-zk7pt:~# nslookup echo
Server:		10.231.0.10
Address:	10.231.0.10#53

Name:	echo.kube-system.svc.cluster.local
Address: 10.231.58.2

## echo 는 로드밸런서 역할을 하여 라운드 로빈으로 접속
netshoot-cluster-zk7pt:~# curl echo:8080
<p>Hello from service-test-6b8c8fdb64-k6x4f</p>

netshoot-cluster-zk7pt:~# curl echo:8080
<p>Hello from service-test-6b8c8fdb64-7cdws</p>
```

---

- worker01

```bash
# IP 가상 서버(IPVS): 여러 백엔드 서버에 걸쳐 들어오는 네트워크 트래픽의 부하를 분산할 수 있는 전송 계층(계층 4)의 부하 분산 장치
root@k8s-hardway-worker01:/home/ubuntu/hardway/certs# ipvsadm -ln
IP Virtual Server version 1.2.1 (size=4096)
Prot LocalAddress:Port Scheduler Flags
  -> RemoteAddress:Port           Forward Weight ActiveConn InActConn
TCP  10.231.0.1:443 rr
  -> 172.31.1.2:6443              Masq    1      3          0
  -> 172.31.1.3:6443              Masq    1      0          0
  -> 172.31.1.4:6443              Masq    1      0          0
TCP  10.231.0.10:53 rr
  -> 10.0.0.176:53                Masq    1      0          0
TCP  10.231.0.10:9153 rr
  -> 10.0.0.176:9153              Masq    1      0          0
TCP  10.231.34.153:443 rr
  -> 172.31.1.5:4244              Masq    1      0          0
TCP  10.231.58.2:8080 rr
  -> 10.0.0.70:8080               Masq    1      0          0
  -> 10.0.0.106:8080              Masq    1      0          0
UDP  10.231.0.10:53 rr
  -> 10.0.0.176:53                Masq    1      0          0
```

---

[목차](/blog/k8s-hardway-01-overview/#series) · [← 이전](/blog/k8s-hardway-10-cilium-coredns/) · [다음 →](/blog/k8s-hardway-12-tls-bootstrap-workers/)
