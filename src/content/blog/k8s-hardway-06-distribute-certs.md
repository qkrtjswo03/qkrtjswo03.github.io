---
title: "[K8s Hard Way 6/12] 인증서·kubeconfig 배포"
description: "ca, kube-apiserver, service-account, etcd-server 인증서를 Bastion에서 마스터 172.31.1.2~4로 보낸다."
pubDate: 2025-01-13
categories:
  - Kubernetes 구축
tags:
  - 쿠버네티스
  - kubernetes
  - hard-way
  - certificates
  - etcd
series: k8s-hardway
seriesOrder: 6
draft: false
---

## 파일을 마스터 서버로 전송

> 전송 할 파일 목록
>
> - ca.crt, ca.key
> - kube-apiserver.key, kube-apiserver.crt
> - service-account.key, service-account.crt
> - etcd-server.key, etcd-server.crt

```bash
# 파일 전송 for문 일괄 전송
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# for instance in 172.31.1.2 172.31.1.3 172.31.1.4; do
   scp  -i sunjae.pem ca.crt ca.key kube-apiserver.key kube-apiserver.crt \
     service-account.key service-account.crt \
     etcd-server.key etcd-server.crt \
     ubuntu@${instance}:/home/ubuntu/hardway/certs
done
```

<details>
<summary>개별 전송 명령어 (마스터 서버 디렉토리 소유자 권한 ubuntu로 변경해야 보내짐)</summary>

```bash
# master01 번으로 파일 전송
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# scp -i sunjae.pem ca.crt ca.key kube-apiserver.key kube-apiserver.crt service-account.key service-account.crt etcd-server.key etcd-server.crt  master01@172.31.1.2:/tmp
master01@172.31.1.2's password:
ca.crt                                                                                                                                                                            100% 1001   899.6KB/s   00:00    
ca.key                                                                                                                                                                            100% 1704     1.6MB/s   00:00    
kube-apiserver.key                                                                                                                                                                100% 1704     1.3MB/s   00:00    
kube-apiserver.crt                                                                                                                                                                100% 1363     1.3MB/s   00:00    
service-account.key                                                                                                                                                               100% 1704     2.2MB/s   00:00    
service-account.crt                                                                                                                                                               100% 1005   666.4KB/s   00:00    
etcd-server.key                                                                                                                                                                   100% 1708     1.8MB/s   00:00    
etcd-server.crt   

# master02 번으로 파일 전송
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# scp -i sunjae.pem ca.crt ca.key kube-apiserver.key kube-apiserver.crt service-account.key service-account.crt etcd-server.key etcd-server.crt  master02@172.31.1.3:/tmp

master02@172.31.1.3's password:
ca.crt                                                                                                                                                                            100% 1001     1.1MB/s   00:00    
ca.key                                                                                                                                                                            100% 1704     2.2MB/s   00:00    
kube-apiserver.key                                                                                                                                                                100% 1704     3.1MB/s   00:00    
kube-apiserver.crt                                                                                                                                                                100% 1363     2.8MB/s   00:00    
service-account.key                                                                                                                                                               100% 1704     3.0MB/s   00:00    
service-account.crt                                                                                                                                                               100% 1005     1.7MB/s   00:00    
etcd-server.key                                                                                                                                                                   100% 1708     2.6MB/s   00:00    
etcd-server.crt      

# master03 번으로 파일 전송 
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# scp -i sunjae.pem ca.crt ca.key kube-apiserver.key kube-apiserver.crt service-account.key service-account.crt etcd-server.key etcd-server.crt  master03@172.31.1.4:/tmp

master03@172.31.1.4's password:
ca.crt                                                                                                                                                                            100% 1001     1.2MB/s   00:00    
ca.key                                                                                                                                                                            100% 1704     3.4MB/s   00:00    
kube-apiserver.key                                                                                                                                                                100% 1704     2.6MB/s   00:00    
kube-apiserver.crt                                                                                                                                                                100% 1363     2.6MB/s   00:00    
service-account.key                                                                                                                                                               100% 1704     2.9MB/s   00:00    
service-account.crt                                                                                                                                                               100% 1005     2.3MB/s   00:00    
etcd-server.key                                                                                                                                                                   100% 1708     2.3MB/s   00:00    
etcd-server.crt                                                                                                                                                                   100% 1220     3.0MB/s   00:00                                                                                                                                                             100% 1220     1.8MB/s   00:00                                                                                                                                                                    100% 1220   971.7KB/s   00:00    
```

</details>

> Kubernetes 클러스터에서 인증서와 개인 키를 마스터 노드에 배포하는 이유는 클러스터의 다양한 컴포넌트들 간에 안전하고 신뢰할 수 있는 통신을 보장하기 위함입니다. 각 인증서와 키는 특정 역할에 따라 API 서버, ETCD, 서비스 계정 등과의 안전한 연결을 위해 사용되며, 마스터 노드에서 이를 관리함으로써 전체 클러스터의 보안과 인증을 중앙화하여 관리합니다.

---

## 모든 노드에 배포

> 전송 파일 LIST
>
> - ca.crt
> - kube-proxy.kubeconfig

```bash
# 파일 전송 for문 
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# for instance in 172.31.1.2 172.31.1.3 172.31.1.4 172.31.1.5 172.31.1.6 172.31.1.7; do
scp -i sunjae.pem ca.crt kube-proxy.kubeconfig ubuntu@${instance}:/home/ubuntu/hardway/certs
done
```

---

## 마스터 노드에 배포

> 전송 파일 LIST
>
> - admin.kubeconfig
> - kube-controller-manager.kubeconfig
> - kube-scheduler.kubeconfig

```bash
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# for instance in 172.31.1.2 172.31.1.3 172.31.1.4; do
scp -i sunjae.pem admin.kubeconfig kube-controller-manager.kubeconfig kube-scheduler.kubeconfig ubuntu@${instance}:/home/ubuntu/hardway/certs
done

ubuntu@172.31.1.2's password:
admin.kubeconfig                             100% 5328     3.4MB/s   00:00
kube-controller-manager.kubeconfig           100% 5378     3.2MB/s   00:00
kube-scheduler.kubeconfig                    100% 5344     5.6MB/s   00:00

ubuntu@172.31.1.3's password:
admin.kubeconfig                             100% 5328     6.0MB/s   00:00
kube-controller-manager.kubeconfig           100% 5378     3.9MB/s   00:00
kube-scheduler.kubeconfig                    100% 5344     5.2MB/s   00:00

ubuntu@172.31.1.4's password:
admin.kubeconfig                             100% 5328     5.1MB/s   00:00
kube-controller-manager.kubeconfig           100% 5378     4.2MB/s   00:00
kube-scheduler.kubeconfig                    100% 5344     5.2MB/s   00:00
```

---

[목차](/blog/k8s-hardway-01-overview/#series) · [← 이전](/blog/k8s-hardway-05-apiserver-etcd-sa-certs/) · [다음 →](/blog/k8s-hardway-07-etcd/)
