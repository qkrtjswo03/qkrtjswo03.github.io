---
title: "[K8s Hard Way 1/12] 개요: 환경, VM 구성, 인증서·포트"
description: "kubeadm 없이 바이너리와 systemd로 master 3, worker 3, Bastion을 두는 Hard Way 랩의 환경, VM, 인증서·포트를 정리한다."
pubDate: 2025-01-08
categories:
  - Kubernetes 구축
tags:
  - kubernetes
  - hard-way
  - etcd
  - cilium
  - certificates
series: k8s-hardway
seriesOrder: 1
draft: false
---

자동화 스크립트는 [K8s-Hardway-Installation](https://github.com/qkrtjswo03/K8s-Hardway-Installation) 저장소에 있다.

## 목표와 환경

> - 클러스터는 Hard Way 방식(kubeadm 없이 바이너리 + systemd)으로 직접 구축한다.
> - 노드 구성: master 3대, worker 3대 (+ Bastion 1대)
> - OS: Ubuntu 22.04.3
> - kube-apiserver HA: Pacemaker + Corosync(pcs)로 VIP 구성
> - etcd: 3대 클러스터링
> - Kubernetes: v1.29.7
> - CNI: Cilium v1.15.4
> - CPU / MEM / DISK 스펙은 직접 산정
> - 구축 환경: VMware vSphere 랩

## VMware vSphere 구성항목

> -  vSphere Client  ⇒ v8.0.2.00200
>
> -  Hypervisor Type-2 ⇒ ESXi 8.0 이상
>
> -  O/S Image ⇒ ubuntu-22.04.3-live-server-amd64.iso  ⇒ 2,083,390KB
>
> -  Kernel Version ⇒ Linux version 5.15.0-78-generic
>
> - kubernetes Version  ⇒ v1.29.7

---

```text
- 공인 IP : 192.168.34.226
      ㄴ 서브넷 : 192.168.34.0/24
      ㄴ 게이트웨이 : 192.168.34.1 
```

## VM Spec

| Host Name | Interface | IP | CPU/RAM | DISK Size | Describe |
|---|---|---|---|---|---|
| bastion-sj | ens33<br>ens34 | 192.168.34.226<br>172.31.1.1 | 2Core/2G | 25GB | TLS 인증서 생성<br>SSH 접속용 |
| k8s-hardway-master01 | ens34 | 172.31.1.2 | 2Core/4G | 25GB | Control-Plane |
| k8s-hardway-master02 | ens34 | 172.31.1.3 | 2Core/4G | 25GB | Control-Plane |
| k8s-hardway-master03 | ens34 | 172.31.1.4 | 2Core/4G | 25GB | Control-Plane |
| k8s-hardway-worker01 | ens34 | 172.31.1.5 | 4Core/8G | 25GB | 워크로드 실행 |
| k8s-hardway-worker02 | ens34 | 172.31.1.6 | 4Core/8G | 25GB | 워크로드 실행 |
| k8s-hardway-worker03 | ens34 | 172.31.1.7 | 2Core/4G | 25GB | 워크로드 실행 |

---

```text
0. VM 구성 아키텍처        

      { INTERNET }--------------
                                |        (ens33 : 사외망)  
                             -------                ㄴ 192.168.34.226  
                            |BASTION| -----------| kubectl,ssh,TLS |
                            |( NAT )|                
                             ------- 
                                |                   ⌐ [ 172.31.1.0 ]
 =============== ============== | ====== (ens34 : 사설망) ==========                         
|       --------------------------------------------------        |
|      |                        |                         |       | 
|   -------                  -------                   -------    |
|  |MASTER1| -- corosync -- |MASTER2| -- corosync --  |MASTER3|   |
|   -------                  -------                   -------    |
|      |                        |                         |       |
|   -------                  -------                   -------    |
|  |WORKER1|                |WORKER2|                 |WORKER3|   |
|   -------                  -------                   -------    | 
  =============== =============== =============== ===============
   
1. 기본 구조
ㅁ Bastion : TLS, SSH, Kubectl
    
ㅁ MasterNode(Control Plane) : 3EA
   - kube-apiserver 
   - kube-controller-manager
   - kube-scheduler 
   - etcd 

ㅁ worker node : 3EA
   - kube-proxy 
   - kubelet 
   - Runtime
```

---

## 컨트롤 플레인 (k8s-master)

**1) 사전 작업**

쿠버네티스 주요 컴포넌트들은 [**TLS 인증**](https://www.ibm.com/docs/en/ibm-mq/9.1?topic=tls-how-provides-identification-authentication-confidentiality-integrity)을 수행하며 통신하고 있습니다. 따라서 주요 컴포넌트 배포 전에 **TLS 인증서**와 **KubeConfig** 파일을 미리 적절하게 생성해주어야 합니다.

먼저 TLS 인증서를 살펴보겠습니다. 쿠버네티스 설치에서 가장 중요한(귀찮은) 작업은 TLS 인증서를 생성하는 일이라고 할 수 있을 것 같은데요. 🫢 다음과 같은 인증서들을 생성해 줍니다.

| 구분 | 인증서 | 설명 |
|---|---|---|
| ETCD | etcd ca key, crt | - |
|  | etcd server key, crt | - |
|  | etcd peer key, crt | etcd 서버 간 통신 시 사용 |
|  | etcd client key, crt | - |
| kubernetes | apiserver ca key, crt | - |
|  | apiserver server key, crt | - |
|  | apiserver kubelet client key, crt | kube-apiserver가 kubelet API 호출 시 사용 (예: pod log, pod exec) |
|  | apiserver client key, crt | 다음과 같은 컴포넌트들이 kube-apiserver와 통신 시 사용<br>- kubelet<br>- kube-controller-manager<br>- kube-scheduler |
| front-proxy | front-proxy ca key, crt | [**apiserver 확장 기능**](https://kubernetes.io/docs/tasks/extend-kubernetes/setup-extension-api-server/) 사용 시 필요 |
|  | front-proxy client key, crt | [**apiserver 확장 기능**](https://kubernetes.io/docs/tasks/extend-kubernetes/setup-extension-api-server/) 사용 시 필요 |

2) 방화벽 포트 

| **프로토콜** | **방향** | **포트 범위** | **용도** | **사용 주체** |
|---|---|---|---|---|
| TCP | 인바운드 | 6443 | 쿠버네티스 API 서버 | 전부 |
| TCP | 인바운드 | 2379-2380 | etcd 서버 클라이언트 API | kube-apiserver, etcd |
| TCP | 인바운드 | 10250 | Kubelet API | Self, 컨트롤 플레인 |
| TCP | 인바운드 | 10259 | kube-scheduler | Self |
| TCP | 인바운드 | 10257 | kube-controller-manager | Self |

---

## 워커 노드 (k8s-worker)

1) 쿠버네티스에서는 이러한 인증서 정보를 내부에서 [**KubeConfig**](https://kubernetes.io/docs/reference/config-api/kubeconfig.v1/) 형식으로도 관리하고 있습니다. kubelet, kube-controller-manager, kube-scheduler 같은 내부 앱들이 통신 시 KubeConfig를 사용합니다. 앞서 만들었던 kube-apiserver Client 인증서를 기반으로 내부 컴포넌트들을 위한 KubeConfig 파일을 생성해 줍니다.

| 파일 | 용도 |
|---|---|
| admin.conf | 관리자가 kube-apiserver 통신 시 사용 (예: kubectl) |
| kubelet.conf | kubelet이 kube-apiserver 통신 시 사용 |
| controller-manager.conf | kube-controller-manager가 kube-apiserver 통신 시 사용 |
| scheduler.conf | kube-scheduler가 kube-apiserver 통신 시 사용 |

2) 방화벽 포트 

| **프로토콜** | **방향** | **포트 범위** | **용도** | **사용 주체** |
|---|---|---|---|---|
| TCP | 인바운드 | 10250 | Kubelet API | Self, 컨트롤 플레인 |
| TCP | 인바운드 | 30000-32767 | NodePort 서비스† | 전부 |

---

[목차](/blog/k8s-hardway-01-overview/#series) · [다음 →](/blog/k8s-hardway-02-bastion-network/)
