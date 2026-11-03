---
title: "[K8s Hard Way 3/12] CA와 컴포넌트 클라이언트 인증서"
description: "Bastion에서 CA 개인 키와 CSR, 자체 서명 인증서를 만든 뒤 관리자와 컴포넌트 클라이언트 인증서를 발급한다."
pubDate: 2025-01-10
categories:
  - 쿠버네티스
tags:
  - kubernetes
  - hard-way
  - certificates
  - openssl
series: k8s-hardway
seriesOrder: 3
draft: false
---

## 인증서 생성 ( 마찬가지로 bastion server )

---

> CA 인증서 워크 플로우 <br>  - 개인 키(ca.key) 생성 : 모든 암호화 작업의 루트입니다.<br>  - CSR 생성(ca.csr) : 공개 키 및 주체 정보를 포함한 인증서 발급 요청입니다.<br>  - 자체 서명된 인증서 생성(ca.crt) : 동일한 개인 키로 발급되고 서명된 인증서로 CA를 설정합니다.

<details>
<summary>Create ca.key</summary>

```bash
# openssl genrsa -out ca.key 2048 명령은 2048비트 RSA 개인 키를 생성하여 ca.key 파일에 저장합니다.
# 이 개인 키는 인증서 발급, 디지털 서명, SSL/TLS 설정 등 다양한 암호화 작업에 사용
root@sunjae-auth-bastion-192-168-34-226:~/hardway/cert# openssl genrsa -out ca.key 2048
```

</details>

<details>
<summary>Create ca.csr</summary>

```bash
# Create CSR using the private key
# openssl req -new -key ca.key -subj "/CN=KUBERNETES-CA" -out ca.csr 명령은 ca.key라는 개인 키를 사용하여 주체 이름이 KUBERNETES-CA인 CSR을 생성하고 이를 ca.csr 파일에 저장합니다.
# 생성된 CSR은 Kubernetes 클러스터에서 인증 기관 역할을 하는 인증서를 발급받는 데 사용됩니다.
root@sunjae-auth-bastion-192-168-34-226:~/hardway/cert# openssl req -new -key ca.key -subj "/CN=KUBERNETES-CA" -out ca.csr
```

</details>

<details>
<summary>Create ca.crt</summary>

```bash
# Self sign the csr using its own private key
# CSR(ca.csr)을 기반으로 10년(3650일) 동안 유효한 셀프 서명 인증서
root@sunjae-auth-bastion-192-168-34-226:~/hardway/cert# openssl x509 -req -in ca.csr -signkey ca.key -CAcreateserial  -out ca.crt -days 3650
-signkey ca.key -CAcreateserial  -out ca.crt -days 3650
Certificate request self-signature ok
subject=CN = KUBERNETES-CA

```

</details>

---

> 관리자용 인증서 워크 플로우
>
>   - 관리자용 개인키(admin.key) : 관리자의 개인키입니다. Kubernetes 클러스터에서 사용자를 인증하는 데 사용됩니다.
>
>   - CSR 생성(admin.csr) : 관리자에게 인증서를 발급해 달라는 CA에 대한 공식 요청입니다.
>
>   - 관리자 인증서(admin.crt) : CA에서 발급한 서명된 인증서입니다. 이는 Kubernetes 클러스터의 관리자를 나타냅니다.

<details>
<summary>Create admin.key</summary>

```bash
# Generate private key for admin user
root@sunjae-auth-bastion-192-168-34-226:~/hardway/cert# openssl genrsa -out admin.key 2048
```

</details>

<details>
<summary>Create admin.csr</summary>

```bash
# Generate CSR for admin user. Note the OU.
# Kubernetes에서의 의미: admin 사용자에게 클러스터 관리자 권한을 부여하기 위한 인증서 요청 과정입니다.
root@sunjae-auth-bastion-192-168-34-226:~/hardway/cert# openssl req -new -key admin.key -subj "/CN=admin/O=system:masters" -out admin.csr
```

</details>

<details>
<summary>Create admin.crt</summary>

```bash
# Sign certificate for admin user using CA servers private key
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl x509 -req -in admin.csr -CA ca.crt -CAkey ca.key -CAcreateserial  -out admin.crt -days 365
Certificate request self-signature ok
subject=CN = admin, O = system:masters

# 명령어 역할: admin.csr CSR을 기반으로 CA(ca.crt, ca.key)를 사용하여 클라이언트 인증서(admin.crt)를 생성합니다.
# 인증서의 유효 기간은 1년(365일)입니다.
# 결과: admin.crt: 최종 클라이언트 인증서. / ca.srl: CA 일련 번호 파일.
# 활용: Kubernetes에서 클라이언트 인증 및 관리자 권한 부여. 클러스터와의 안전한 통신을 위한 인증 설정.
```

</details>

---

> **kube-controller-manager** 인증서 워크 플로우
>
> - 개인 키 생성: kube-controller-manager 구성 요소의 보안을 유지하기 위한 키 생성.
>
> - CSR 생성: 인증서를 요청하는 파일 생성(CN=system:kube-controller-manager 설정).
>
> - CA를 통한 인증서 서명: CSR을 기반으로 인증서를 서명하고 생성.

<details>
<summary>Create kube-controller-manager</summary>

```bash
# kube-controller-manager
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl genrsa -out kube-controller-manager.key 2048

# Kube-controller-manager.csr 
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl req -new -key kube-controller-manager.key -subj "/CN=system:kube-controller-manager" -out kube-controller-manager.csr

# kube-controller-manager.crt 
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl x509 -req -in kube-controller-manager.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out kube-controller-manager.crt -days 365
Certificate request self-signature ok
subject=CN = system:kube-controller-manager
```

</details>

<details>
<summary>Create kube-proxy</summary>

```bash
# Kube-proxy 생성
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl genrsa -out kube-proxy.key 2048
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl req -new -key kube-proxy.key -subj "/CN=system:kube-proxy" -out kube-proxy.csr
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl x509 -req -in kube-proxy.csr -CA ca.crt -CAkey ca.key -CAcreateserial  -out kube-proxy.crt -days 365
Certificate request self-signature ok
subject=CN = system:kube-proxy
```

</details>

<details>
<summary>Create kube-scheduler</summary>

```bash
# kube-scheduler
root@sunjae-auth-bastion-192-168-34-226:~/hardway# openssl genrsa -out kube-scheduler.key 2048

root@sunjae-auth-bastion-192-168-34-226:~/hardway# openssl req -new -key kube-scheduler.key -subj "/CN=system:kube-scheduler" -out kube-scheduler.csr

root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl x509 -req -in kube-scheduler.csr -CA ca.crt -CAkey ca.key -CAcreateserial  -out kube-scheduler.crt -days 365
Certificate request self-signature ok
subject=CN = system:kube-scheduler
```

</details>

---

## 인증서 확인

```bash
# 인증서 총 10개 생성 (csr, crt)
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# ll 
total 68
drwxr-xr-x 2 root root 4096 Jan  5 09:35 ./
drwxr-xr-x 3 root root 4096 Jan  5 08:13 ../
-rw-r--r-- 1 root root 1025 Jan  5 08:59 admin.crt
-rw-r--r-- 1 root root  920 Jan  5 08:51 admin.csr
-rw------- 1 root root 1704 Jan  5 08:46 admin.key
-rw-r--r-- 1 root root 1001 Jan  5 08:41 ca.crt
-rw-r--r-- 1 root root  895 Jan  5 08:40 ca.csr
-rw------- 1 root root 1704 Jan  5 08:37 ca.key
-rw-r--r-- 1 root root 1025 Jan  5 09:08 kube-controller-manager.crt
-rw-r--r-- 1 root root  920 Jan  5 09:07 kube-controller-manager.csr
-rw------- 1 root root 1704 Jan  5 09:05 kube-controller-manager.key
-rw-r--r-- 1 root root 1009 Jan  5 09:12 kube-proxy.crt
-rw-r--r-- 1 root root  903 Jan  5 09:12 kube-proxy.csr
-rw------- 1 root root 1704 Jan  5 09:11 kube-proxy.key
-rw-r--r-- 1 root root 1013 Jan  5 09:35 kube-scheduler.crt
-rw-r--r-- 1 root root  907 Jan  5 09:34 kube-scheduler.csr
-rw------- 1 root root 1704 Jan  5 09:32 kube-scheduler.key

# 1번 마스터의 INTERNAL IP(master01번의 IP(172.31.1.2) Or Virtual IP(172.31.1.8))를 사용
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# export KUBE_API_SERVER_ADDRESS=172.31.1.2
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# export KUBE_CLUSTER_NAME=sunjae-k8s-hardway

# kubectl 바이너리 다운로드
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# wget -q --show-progress --https-only --timestamping  "https://storage.googleapis.com/kubernetes-release/release/v1.29.7/bin/linux/amd64/kubectl"
kubectl                  100%[================================>]  47.90M  28.7MB/s    in 1.7s    

root@sj-auth-bastion-192-168-34-226:~/hardway/cert# ls | grep kubectl 
kubectl

# kubectl 실행 권한 부여 및 /usr/local/bin 디렉토리로 이동
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# {
 chmod +x kubectl 
 sudo mv kubectl /usr/local/bin/
}
```

---

[목차](/blog/k8s-hardway-01-overview/#series) · [← 이전](/blog/k8s-hardway-02-bastion-network/) · [다음 →](/blog/k8s-hardway-04-kubeconfig/)
