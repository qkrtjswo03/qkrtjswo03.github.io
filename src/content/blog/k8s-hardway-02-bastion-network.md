---
title: "[K8s Hard Way 2/12] Bastion과 노드 네트워크 구성"
description: "Bastion에서 root SSH를 열고, Netplan으로 ens33(192.168.34.226/24)과 ens34(172.31.1.1/24) 고정 IP를 설정한다."
pubDate: 2025-01-09
categories:
  - Kubernetes 구축
tags:
  - kubernetes
  - hard-way
  - bastion
  - netplan
series: k8s-hardway
seriesOrder: 2
draft: false
---

## 터미널 구성

```bash
# Root 계정으로 바로 사용
sudo passwd root
sudo vi /etc/ssh/sshd_config

# config 파일에 아래 내용 추가
PermitRootLogin yes
PasswordAuthentication yes

# SSH 서비스 재시작
sudo systemctl restart sshd

# Bastion 서버 구성
apt update -y;\
apt upgrade -y;\
apt install net-tools htop vim openssl ipset python3-pip -y;\
pip install scp paramiko
```

## Bastion 서버 구성 (  Ubuntu NetPlan으로 고정 IP 설정하기 )

```bash
root@bastion:# cd /etc/netplan

# 원본 백업
root@bastion:# cp 00-installer-config.yaml 00-installer-config.yaml.bak

# Ubuntu NetPlan으로 고정 IP 설정하기
root@bastion:# vi 00-installer-config.yaml

root@bastion:/etc/netplan# cat 00-installer-config.yaml
---
# This is the network config written by 'subiquity'
network:
  version: 2 
  ethernets:
    ens33:
      addresses:
      - 192.168.34.226/24
      gateway4: 192.168.34.1
      nameservers:
        addresses:
        - 8.8.8.8
        search: []
    ens34:
      addresses:
      - 172.31.1.1/24
      nameservers:
        addresses:
        - 8.8.8.8
---

# IP 변경 적용 후 확인
root@bastion:/etc/netplan# sudo netplan apply

root@bastion:# apt -y update 
root@bastion:# apt install -y net-tools
root@bastion:# systemctl status sshd
root@bastion:# apt-get install -y wget curl vim openssl

root@bastion:# telnet www.google.com 80
root@bastion:# sudo ufw disable
Firewall stopped and disabled on system startup

root@sj-bastion:# telnet www.google.com 80
Trying 203.0.113.50...
Connected to www.google.com.
Escape character is '^]'.

root@bastion:# ping 8.8.8.8

# IP 포워딩 활성화
sudo sysctl -w net.ipv4.ip_forward=1

# 영구 설정 
sudo vi /etc/sysctl.conf
---
net.ipv4.ip_forward = 1   # 항목 추가

# 변경 사항 적용
sudo sysctl -p

# iptables 를 활용한 NAT 규칙 추가
- ens33: 외부와 연결된 인터페이스 (외부 통신)
- ens34: 172.31.1.1/24: 내부 네트워크 대역

# 사설 대역(ens34) 172.31.1.0/24 NAT 규칙 추가 ( ens33에 대해서 사설대역(ens34)을 마스커레이드 )
sudo iptables -t nat -A POSTROUTING -s 172.31.1.0/24 -o ens33 -j MASQUERADE

# 규칙 조회
root@sj-bastion:# iptables -t nat -L --line-numbers
Chain PREROUTING (policy ACCEPT)
num  target     prot opt source               destination         

Chain INPUT (policy ACCEPT)
num  target     prot opt source               destination         

Chain OUTPUT (policy ACCEPT)
num  target     prot opt source               destination         

Chain POSTROUTING (policy ACCEPT)
num  target     prot opt source               destination         
1    MASQUERADE  all  --  172.31.1.0/24        anywhere            
2    MASQUERADE  all  --  10.20.0.0/24         anywhere            
3    MASQUERADE  all  --  anywhere             anywhere 
        
# 동작 요약 
# 내부 네트워크의 IP 주소를 외부 네트워크로 변환:
# 내부 네트워크(172.31.1.0/24)에서 출발하는 모든 패킷이 외부 네트워크로 나갈 때, ens33의 IP 주소를 사용하도록 출발지 IP를 변환합니다.

# IP 마스커레이드의 목적:
# 하나의 공인 IP 주소(또는 외부 네트워크의 인터페이스 IP 주소)를 사용하여 내부의 여러 프라이빗 IP 주소를 NAT 처리할 수 있습니다.
# 이는 내부 네트워크에서 외부로 데이터를 전송할 때 주로 사용됩니다.

# 예시 동작:
# 내부 네트워크의 172.31.1.0에서 외부로 패킷을 전송하면, 패킷의 출발지 IP가 ens33의 IP(예: 192.168.34.10)로 변경됩니다.
# 반대로 응답 패킷은 NAT 테이블을 참조하여 내부 네트워크의 적절한 IP로 전달됩니다.

# iptables-persistent 패키지를 사용하여 영구 설정
# 방화벽 규칙 영구 저장
sudo apt-get update
sudo apt-get install iptables-persistent
sudo netfilter-persistent save            #이미 설정한 NAT 규칙 저장 명령어
sudo sh -c "iptables-save > /etc/iptables/rules.v4"  # NAT 규칙 수동으로 저장

# 호스트 네임 설정 
hostnamectl set-hostname sj-auth-bastion
```

---

## Master01~03 번, worker01~03에서 진행

```bash
root@k8s-hardway-master01~03:/etc/netplan# vi 00-installer-config.yaml
# This is the network config written by 'subiquity'
network:
  version: 2
  ethernets:
    ens34:
      addresses:
      - 172.31.1.2~4/24
      gateway4: 172.31.1.1
      nameservers: 
        addresses:
        - 8.8.8.8
        search: []
        
root@k8s-hardway-master01~03:/etc/netplan# sudo netplan apply 

# net-tools 설치 진행
root@k8s-hardway-master01~03:/etc/netplan# apt update -y 
root@k8s-hardway-master01~03:/etc/netplan# apt install -y net-tools

root@k8s-hardway-master01~03:/etc/netplan# ifconfig
ens34: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 172.31.1.4  netmask 255.255.255.0  broadcast 172.31.1.255
        inet6 fe80::250:56ff:feb1:f0f5  prefixlen 64  scopeid 0x20<link> 
        
# 호스트 네임 설정 
hostnamectl set-hostname k8s-hardway-master01
hostnamectl set-hostname k8s-hardway-master02
hostnamectl set-hostname k8s-hardway-master03
hostnamectl set-hostname k8s-hardway-worker01
hostnamectl set-hostname k8s-hardway-worker02
hostnamectl set-hostname k8s-hardway-worker03
```

---

## Bastion 서버에서 실행

```bash
root@sunjae-auth-bastion-192-168-34-226:~# cat << EOF >> /etc/hosts
127.0.0.1 localhost
172.31.1.2 k8s-hardway-master01
172.31.1.3 k8s-hardway-master02
172.31.1.4 k8s-hardway-master03
172.31.1.5 k8s-hardway-worker01
172.31.1.6 k8s-hardway-worker02
172.31.1.7 k8s-hardway-worker03
EOF

## /etc/hosts 조회
root@sunjae-auth-bastion-192-168-34-226:~# cat /etc/hosts
127.0.0.1 localhost
127.0.1.1 bastion

# The following lines are desirable for IPv6 capable hosts
::1     ip6-localhost ip6-loopback
fe00::0 ip6-localnet
ff00::0 ip6-mcastprefix
ff02::1 ip6-allnodes
ff02::2 ip6-allrouters
127.0.0.1 localhost
172.31.1.2 k8s-hardway-master01
172.31.1.3 k8s-hardway-master02
172.31.1.4 k8s-hardway-master03
172.31.1.5 k8s-hardway-worker01
172.31.1.6 k8s-hardway-worker02
172.31.1.7 k8s-hardway-worker03
----------------------------------------------------------------------

# 디렉토리 생성
root@sunjae-auth-bastion-192-168-34-226:~# mkdir hardway
root@sunjae-auth-bastion-192-168-34-226:~# cd hardway/
root@sunjae-auth-bastion-192-168-34-226:~/hardway# mkdir certs 
root@sunjae-auth-bastion-192-168-34-226:~/hardway# cd certs/
```

---

[목차](/blog/k8s-hardway-01-overview/#series) · [← 이전](/blog/k8s-hardway-01-overview/) · [다음 →](/blog/k8s-hardway-03-certificates/)
