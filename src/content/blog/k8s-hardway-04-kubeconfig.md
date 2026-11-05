---
title: "[K8s Hard Way 4/12] kubeconfig 생성"
description: "클라이언트 인증서와 키로 kubeconfig를 만들고, API 주소는 master01(172.31.1.2) 또는 VIP(172.31.1.8)를 쓴다."
pubDate: 2025-01-11
categories:
  - Kubernetes 구축
tags:
  - 쿠버네티스
  - kubernetes
  - hard-way
  - kubeconfig
series: k8s-hardway
seriesOrder: 4
draft: false
---

## Client 인증서와 key를 이용해 kubeconfig를 생성

```bash
# 앞서 했던 환경변수 설정 선행 되어야 함 
# 1번 마스터의 INTERNAL IP(master01번의 IP(172.31.1.2) Or VIP(172.31.1.8))를 사용
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# export KUBE_API_SERVER_ADDRESS=172.31.1.2
# root@sj-auth-bastion-192-168-34-226:~/hardway/cert# export KUBE_API_SERVER_ADDRESS=172.31.1.8 # PCS 구성시 VIP를 변수로 설정해 아래의 Kubeconfig 파일들을 생성합니다. 

root@sj-auth-bastion-192-168-34-226:~/hardway/cert# export KUBE_CLUSTER_NAME=sunjae-k8s-hardway
```

---

<details>
<summary>kube-proxy.kubeconfig 파일 생성</summary>

---

> **kube-proxy**의 클러스터 설정을 위한 **kubeconfig 파일**을 생성하는 작업을 수행합니다. `kube-proxy`는 Kubernetes 클러스터 내에서 네트워크 프로토콜과 관련된 트래픽을 처리하고, 서비스 간의 로드 밸런싱을 제공하는 중요한 구성 요소입니다. 이를 위해서는 올바른 인증과 클러스터 정보가 포함된 `kubeconfig` 파일이 필요합니다.

---

```bash
# 클러스터 설정 (kube-proxy.kubeconfig 파일 생성)
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# {
# 1. 클러스터 정보를 kube-proxy.kubeconfig 파일에 설정
   kubectl config set-cluster ${KUBE_CLUSTER_NAME} \
     --certificate-authority=ca.crt \
     --embed-certs=true \
     --server=https://${KUBE_API_SERVER_ADDRESS}:6443 \
     --kubeconfig=kube-proxy.kubeconfig
     
# 2. 사용자(인증 정보) 설정   
   kubectl config set-credentials system:kube-proxy \
     --client-certificate=kube-proxy.crt \
     --client-key=kube-proxy.key \
     --embed-certs=true \
     --kubeconfig=kube-proxy.kubeconfig

# 3. 컨텍스트 설정   
   kubectl config set-context default \
     --cluster=${KUBE_CLUSTER_NAME} \
     --user=system:kube-proxy \
     --kubeconfig=kube-proxy.kubeconfig

# 4. 기본 컨텍스트로 전환   
   kubectl config use-context default --kubeconfig=kube-proxy.kubeconfig
 }

# 출력 화면 
Cluster "sunjae-k8s-hardway" set.
User "system:kube-proxy" set.
Context "default" created.
Switched to context "default".
```

---

> ### 요약
>
> 이 명령어들을 통해 **kube-proxy**의 `kubeconfig` 파일이 생성되었습니다. `kube-proxy`는 Kubernetes 클러스터에서 네트워크 관련 작업을 처리하는 중요한 구성 요소로, 이 파일을 통해 API 서버와 안전하게 연결하고 인증 정보를 제공받습니다.

---

</details>

<details>
<summary>kube-controller-manager.kubeconfig 파일 생성</summary>

---

> **kube-controller-manager**의 `kubeconfig` 파일을 생성하는 과정입니다. `kube-controller-manager`는 Kubernetes 클러스터의 컨트롤 플레인에서 다양한 관리 작업을 수행하는 중요한 구성 요소입니다. 이 파일을 생성하는 과정은 `kube-controller-manager`가 Kubernetes API 서버와 안전하게 통신할 수 있도록 인증 정보를 설정하는 데 사용됩니다.

---

```bash
# 클러스터 설정 ( kube-controller-manager.kubeconfig 파일 생성 ) 
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# {
   kubectl config set-cluster ${KUBE_CLUSTER_NAME} \
     --certificate-authority=ca.crt \
     --embed-certs=true \
     --server=https://${KUBE_API_SERVER_ADDRESS}:6443 \
     --kubeconfig=kube-controller-manager.kubeconfig
  
   kubectl config set-credentials system:kube-controller-manager \
     --client-certificate=kube-controller-manager.crt \
     --client-key=kube-controller-manager.key \
     --embed-certs=true \
     --kubeconfig=kube-controller-manager.kubeconfig
  
   kubectl config set-context default \
     --cluster=${KUBE_CLUSTER_NAME} \
     --user=system:kube-controller-manager \
     --kubeconfig=kube-controller-manager.kubeconfig
  
   kubectl config use-context default --kubeconfig=kube-controller-manager.kubeconfig
 }
 
Cluster "sunjae-k8s-hardway" set.
User "system:kube-controller-manager" set.
Context "default" created.
Switched to context "default".
```

---

> ### 요약
>
> 이 명령어들은 **kube-controller-manager**의 `kubeconfig` 파일을 생성하고 설정하는 작업입니다. `kube-controller-manager`는 클러스터의 다양한 관리 작업을 수행하는 중요한 구성 요소입니다. 이 `kubeconfig` 파일을 사용하여 `kube-controller-manager`는 API 서버와 안전하게 연결하고 인증 정보를 제공받습니다.

---

</details>

<details>
<summary>kube-scheduler.kubeconfig 파일 생성</summary>

---

> **kube-scheduler**의 `kubeconfig` 파일을 생성하고 설정하는 작업입니다. `kube-scheduler`는 Kubernetes 클러스터에서 **스케줄링** 작업을 담당하는 중요한 컴포넌트입니다. `kube-scheduler.kubeconfig` 파일을 통해 `kube-scheduler`는 Kubernetes API 서버와 안전하게 연결하고 인증 정보를 제공받을 수 있습니다. 이 과정에서 클러스터 정보, 사용자 인증, 컨텍스트 설정을 통해 `kube-scheduler`가 클러스터와 통신할 수 있도록 구성합니다.

---

```bash
# 클러스터 설정 ( kube-scheduler.kubeconfig 파일 생성 ) 
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# {
   kubectl config set-cluster ${KUBE_CLUSTER_NAME} \
     --certificate-authority=ca.crt \
     --embed-certs=true \
     --server=https://${KUBE_API_SERVER_ADDRESS}:6443 \
     --kubeconfig=kube-scheduler.kubeconfig
  
   kubectl config set-credentials system:kube-scheduler \
     --client-certificate=kube-scheduler.crt \
     --client-key=kube-scheduler.key \
     --embed-certs=true \
     --kubeconfig=kube-scheduler.kubeconfig
  
   kubectl config set-context default \
     --cluster=${KUBE_CLUSTER_NAME} \
     --user=system:kube-scheduler \
     --kubeconfig=kube-scheduler.kubeconfig
  
   kubectl config use-context default --kubeconfig=kube-scheduler.kubeconfig
 }
 
Cluster "sunjae-k8s-hardway" set.
User "system:kube-scheduler" set.
Context "default" modified.
Switched to context "default".
```

---

> **요약**<br>이 명령어들은 kube-scheduler의 kubeconfig 파일을 생성하고 설정하는 작업입니다. kube-scheduler는 Kubernetes 클러스터에서 스케줄링 작업을 담당하는 중요한 컴포넌트입니다. kube-scheduler.kubeconfig 파일을 통해 kube-scheduler는 Kubernetes API 서버와 안전하게 연결하고 인증 정보를 제공받을 수 있습니다. 이 과정에서 클러스터 정보, 사용자 인증, 컨텍스트 설정을 통해 kube-scheduler가 클러스터와 통신할 수 있도록 구성합니다.

---

</details>

<details>
<summary>admin.kubeconfig 파일 생성</summary>

---

> **admin 사용자**를 위한 `kubeconfig` 파일을 설정하는 과정입니다. `admin.kubeconfig` 파일은 Kubernetes 클러스터에 대한 관리 권한을 가진 **admin** 사용자가 인증을 받아 클러스터와 통신할 수 있도록 설정합니다.

---

```bash
# 클러스터 설정 (admin 사용자용 kubeconfig 파일 (admin.kubeconfig)을 설정)
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# {
   kubectl config set-cluster ${KUBE_CLUSTER_NAME} \
     --certificate-authority=ca.crt \
     --embed-certs=true \
     --server=https://${KUBE_API_SERVER_ADDRESS}:6443 \
     --kubeconfig=admin.kubeconfig
  
   kubectl config set-credentials admin \
     --client-certificate=admin.crt \
     --client-key=admin.key \
     --embed-certs=true \
     --kubeconfig=admin.kubeconfig
  
   kubectl config set-context default \
     --cluster=${KUBE_CLUSTER_NAME} \
     --user=admin \
     --kubeconfig=admin.kubeconfig
  
   kubectl config use-context default --kubeconfig=admin.kubeconfig
 }
 
Cluster "sunjae-k8s-hardway" set.
User "admin" set.
Context "default" modified.
Switched to context "default".
```

---

> 요약
>
> **이 명령어들은 admin** 사용자의 `kubeconfig` 파일을 생성하고 설정하는 작업입니다. `admin.kubeconfig` 파일을 통해 `admin` 사용자는 Kubernetes 클러스터에 대한 **관리 권한**을 가지게 되며, 클러스터와 안전하게 통신할 수 있는 인증 정보가 포함됩니다. 이 과정에서 클러스터 정보, 사용자 인증, 컨텍스트 설정을 통해 `admin` 사용자가 Kubernetes 클러스터와 상호작용할 수 있도록 구성합니다.

</details>

---

## Kubernetes 클러스터 구성 설정 (kubeconfig 파일 생성, API 서버 인증서에 SAN 추가)

```bash
# 이 작업은 Kubernetes 클러스터에 접근하기 위한 인증 정보와 설정을 kubeconfig 파일로 설정
# kubectl 등의 도구에서 사용할 수 있도록 준비하는 과정

# 첫 번째 명령어는 ~/.kube 디렉터리를 생성합니다.
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# mkdir -p ~/.kube

# 두 번째 명령어는 admin.kubeconfig 파일을 ~/.kube/config로 복사하여, 해당 파일을 기본 Kubernetes 설정 파일로 사용하도록 설정합니다.
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# cp -rf admin.kubeconfig ~/.kube/config
```

---

[목차](/blog/k8s-hardway-01-overview/#series) · [← 이전](/blog/k8s-hardway-03-certificates/) · [다음 →](/blog/k8s-hardway-05-apiserver-etcd-sa-certs/)
