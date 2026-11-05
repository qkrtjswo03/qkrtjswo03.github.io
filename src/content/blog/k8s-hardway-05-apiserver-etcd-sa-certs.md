---
title: "[K8s Hard Way 5/12] API 서버·etcd 인증서와 Service Account 키"
description: "SAN이 포함된 openssl-kube-apiserver.cnf로 API 서버 인증서를 만들고, etcd 인증서와 Service Account 키를 준비한다."
pubDate: 2025-01-12
categories:
  - 쿠버네티스
tags:
  - 쿠버네티스
  - kubernetes
  - hard-way
  - certificates
  - etcd
  - apiserver
series: k8s-hardway
seriesOrder: 5
draft: false
---

- openssl-kube-apiserver.cnf 구성 파일 생성

> 목적: 이 단계에서는 SAN(주체 대체 이름)이 포함된 인증서를 생성하는 데 사용되는 'openssl-kube-apiserver.cnf'라는 구성 파일을 생성합니다. SAN을 사용하면 Kubernetes 구성 요소가 여러 도메인 이름, IP 주소 또는 기타 식별자를 인식할 수 있습니다. 이는 여러 방법(예: 도메인 이름 또는 IP 주소)으로 접근할 수 있어야 하기 때문에 API 서버에 중요합니다.

---

```bash
# SANs 생성 
# 클러스터에 여러 도메인 이름, IP 주소, 또는 다른 식별자를 인증서에 추가하여 Kubernetes 구성 요소들이 여러 가지 접근 방법을 인식할 수 있도록 만드는 과정)
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# cat > openssl-kube-apiserver.cnf <<EOF
[req]
req_extensions = v3_req
distinguished_name = req_distinguished_name

[req_distinguished_name]

[ v3_req ]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = kubernetes
DNS.2 = kubernetes.default
DNS.3 = kubernetes.default.svc
DNS.4 = kubernetes.default.svc.cluster.local
IP.1 = 10.231.0.1 # Cluster IP 
IP.2 = 172.31.1.2 # k8s-hardway-master01 IP
IP.3 = 172.31.1.3 # k8s-hardway-master02 IP 
IP.4 = 172.31.1.4 # k8s-hardway-master03 IP
IP.5 = 127.0.0.1
# IP.6 = 172.31.1.8 # VIP PCS 구성시
EOF

# 생성 조회
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# ll | grep openssl-kube-apiserver.cnf
-rw-r--r-- 1 root root  450 Jan  5 10:40 openssl-kube-apiserver.cnf
```

---

## API 인증서 생성

---

> **요약**<br>개인 키 생성(kube-apiserver.key): 첫 번째 명령은 서명 및 암호화에 사용될 개인 키를 생성합니다.<br>CSR 생성(kube-apiserver.csr): 두 번째 명령은 개인 키와 구성 파일을 기반으로 CSR을 생성합니다. CSR에는 API 서버에 대한 정보가 포함되어 있습니다.<br>CSR에 서명하여 인증서 생성(kube-apiserver.crt): 세 번째 명령은 CA의 인증서와 개인 키를 사용하여 CSR에 서명하여 최종 인증서(kube-apiserver.crt)를 생성합니다. 보안 통신을 위해 Kubernetes API 서버에서 사용할 수 있습니다.

```bash
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl genrsa -out kube-apiserver.key 2048
root@sj-auth-bastion-192-168-34-226:~# ll | grep apiserver
-rw-------  1 root root  1704 Jan  5 13:18 kube-apiserver.key

root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl req -new -key kube-apiserver.key -subj "/CN=kube-apiserver" -out kube-apiserver.csr -config openssl-kube-apiserver.cnf
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# ll | grep openssl
-rw-r--r-- 1 root root  454 Jan  5 13:31 openssl-kube-apiserver.cnf

root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl x509 -req -in kube-apiserver.csr -CA ca.crt -CAkey ca.key -CAcreateserial  -out kube-apiserver.crt -extensions v3_req -extfile openssl-kube-apiserver.cnf -days 365
Certificate request self-signature ok
subject=CN = kube-apiserver
```

---

## 생성된 인증서(kube-apiserver.crt) SANs 확인

```bash
# 이 출력은 openssl x509 -in kube-apiserver.crt -noout -text 명령어를 사용해 kube-apiserver.crt 인증서의 세부 정보를 확인한 결과
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl x509 -in kube-apiserver.crt -noout -text
Certificate:
    Data:
        Version: 3 (0x2)     # Version: 인증서의 버전이 3 (X.509 v3)임
        Serial Number:       # Serial Number: 인증서의 고유 식별자로, 16진수 형식의 값
            3f:4a:2a:3f:a0:6d:f0:47:10:1a:7a:dc:6e:ac:35:17:77:f4:d5:5b
        Signature Algorithm: sha256WithRSAEncryption # Signature Algorithm: sha256WithRSAEncryption 알고리즘을 사용하여 서명되었습니다.
        Issuer: CN = KUBERNETES-CA                   # Issuer: 인증서를 발급한 CA(인증 기관)입니다. CN=KUBERNETES-CA는 Kubernetes CA가 인증서를 발급했음을 나타냅니다.
        Validity 
            Not Before: Jan  5 13:32:09 2025 GMT     # Not Before: 인증서의 유효 시작 날짜입니다. 2025년 1월 5일 13:32:09 GMT부터 사용 가능합니다.
            Not After : Jan  5 13:32:09 2026 GMT     # Not After: 인증서의 만료 날짜입니다. 2026년 1월 5일 13:32:09 GMT에 만료됩니다.
        Subject: CN = kube-apiserver                 # Subject: 인증서를 발급받은 대상입니다. CN=kube-apiserver는 kube-apiserver가 이 인증서의 소유자임을 나타냅니다.
        Subject Public Key Info:
            Public Key Algorithm: rsaEncryption      # Public Key Algorithm: 공개 키 알고리즘으로 RSA를 사용합니다.
                Public-Key: (2048 bit)               # Public Key: 공개 키의 세부 정보로, Modulus(계수)와 Exponent(지수)가 포함됩니다.
                Modulus:                             # Modulus: RSA 공개 키의 핵심 값(2048비트).
                    00:9f:e0:23:98:f1:34:4a:b2:d5:87:8f:6c:f5:98:
                    f9:ec:26:c0:61:d4:8c:7c:5e:cb:76:86:68:8a:cd:
                    ac:4a:c3:30:81:18:75:1b:ad:2f:9e:f6:a3:c1:3d:
                    da:10:2a:84:93:59:3f:1f:e7:35:a8:8b:ba:1a:b3:
                    62:99:21:69:7a:0c:93:b1:ff:92:04:fe:b9:88:88:
                    06:78:57:b8:a7:ef:2e:d5:74:ef:a7:22:9e:95:59:
                    91:e4:67:a0:2d:8c:8a:f1:f8:f9:c7:0a:13:54:ec:
                    eb:21:63:c8:d9:9a:1c:8d:84:2e:2d:43:9d:2a:13:
                    70:d7:af:67:bf:76:ff:68:db:a6:c4:5e:0f:cd:9d:
                    64:30:91:7c:3a:c6:39:6e:37:20:22:fc:e9:e9:a5:
                    b3:cc:e4:5f:9d:9f:fb:94:81:7a:bc:42:b5:b9:7f:
                    fa:29:bf:bd:70:a1:0c:c9:b2:f9:c0:4c:2f:f0:a4:
                    24:a6:49:7e:d3:c1:34:83:c9:36:df:7d:bd:2a:70:
                    bf:57:31:e7:a4:78:07:0a:5f:36:e5:dc:06:b5:3e:
                    d0:13:5b:80:5b:bd:18:84:75:49:0a:6e:a4:7f:2f:
                    72:ec:55:67:82:7f:94:87:d6:b9:a8:d1:d0:2b:ba:
                    c9:fe:8e:ff:79:67:71:1d:57:28:dd:a7:39:41:32:
                    d4:b9
                Exponent: 65537 (0x10001)            # Exponent: 공개 키 지수로, 일반적으로 65537(0x10001) 값을 사용합니다.
        X509v3 extensions:    
            X509v3 Basic Constraints: 
                CA:FALSE     # CA:FALSE로 설정되어 이 인증서는 하위 인증서를 발급할 수 없습니다.
            X509v3 Key Usage:    # Digital Signature, Non Repudiation, Key Encipherment를 지원합니다. 이 인증서는 디지털 서명, 비재연 방지, 키 암호화 목적으로 사용됩니다.
                Digital Signature, Non Repudiation, Key Encipherment
            X509v3 Subject Alternative Name:  # Subject Alternative Name(SAN) 필드에는 인증서가 유효한 대상의 이름(DNS) 및 IP 주소가 포함됩니다
                DNS:kubernetes, DNS:kubernetes.default, DNS:kubernetes.default.svc, DNS:kubernetes.default.svc.cluster.local, IP Address:10.231.0.1, IP Address:172.31.1.2, IP Address:172.31.1.3, IP Address:172.31.1.4, IP Address:127.0.0.1
            X509v3 Subject Key Identifier:  # 인증서의 고유 식별자 값입니다.
                11:83:0A:7E:9E:7A:81:7A:ED:E9:04:2F:80:88:B4:56:7E:60:1B:8D
            X509v3 Authority Key Identifier:  # 발급 기관의 정보를 포함합니다.
                DirName:/CN=KUBERNETES-CA     # DirName:/CN=KUBERNETES-CA는 발급 CA의 이름입니다.
                serial:45:DF:25:4F:39:3A:42:C5:CD:95:A0:E6:47:03:71:4C:2E:58:C6:5B   #  serial은 발급 CA의 인증서 일련 번호입니다. 
    Signature Algorithm: sha256WithRSAEncryption     # 인증서의 서명 알고리즘은 sha256WithRSAEncryption입니다.
    Signature Value:                                 # Signature Value: 인증서를 서명한 실제 서명 값입니다
        52:17:6b:ea:05:7d:0c:96:77:cb:a6:e3:f0:51:1b:46:c7:26:
        b0:05:72:83:3a:d2:78:fc:63:be:97:cb:3e:0d:49:00:de:5e:
        e5:30:9b:12:46:4f:19:d0:81:b0:57:42:af:ed:39:77:5a:64:
        a1:dd:59:38:27:15:b3:33:e4:71:c1:2e:e1:7e:a3:40:ee:c8:
        a3:2d:74:54:0c:3e:76:cb:aa:69:c0:d2:38:13:bb:8d:98:56:
        7c:99:60:cc:b4:f6:29:22:d2:a0:7d:cd:fd:f5:b1:b3:83:ce:
        bf:ba:b0:f2:03:d7:00:64:b9:55:77:1f:2c:bc:b7:aa:24:35:
        ee:36:ad:98:9e:c3:21:3a:3b:b0:45:04:ca:6f:b9:a2:0f:29:
        2a:8d:12:6c:47:4e:6c:aa:7d:4a:e9:50:93:40:67:d0:07:1d:
        33:fe:1b:52:3d:bd:6d:f6:a4:aa:e5:ec:6b:9b:bf:07:27:e2:
        cd:6e:b7:7c:55:a2:fd:93:3d:1a:86:94:24:4c:41:37:8c:96:
        6a:9f:e1:18:71:5f:b1:a2:8b:d2:36:3d:3d:ba:47:31:ed:ac:
        93:d1:6f:fc:66:2b:c9:58:45:ef:62:f6:ba:18:27:16:0e:70:
        c7:27:40:b6:b1:45:11:38:f4:7b:bf:be:a5:59:92:0a:af:d7:
        74:ba:81:6b
        
# 결론: 이 인증서는 kube-apiserver용으로 발급된 유효한 인증서입니다. SAN 필드에 필요한 DNS와 IP 주소가 포함되어 있어 Kubernetes API 서버가 인증 요청을 처리할 수 있도록 설계되었습니다. 유효 기간은 2025년 1월 5일부터 2026년 1월 5일까지 1년입니다.
```

---

## etcd 인증서 생성

```bash
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# cat > openssl-etcd.cnf <<EOF
[req]
req_extensions = v3_req
distinguished_name = req_distinguished_name

[req_distinguished_name]

[ v3_req ]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
IP.1 = 172.31.1.2 # Master01
IP.2 = 172.31.1.3 # Master02
IP.3 = 172.31.1.4 # Master03
IP.4 = 127.0.0.1 
EOF

root@sj-auth-bastion-192-168-34-226:~/hardway/cert# ll | grep openssl-etcd.cnf 
-rw-r--r-- 1 root root  313 Jan  5 14:01 openssl-etcd.cnf

# etcd 인증서 생성
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl genrsa -out etcd-server.key 2048
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl req -new -key etcd-server.key -subj "/CN=etcd-server" -out etcd-server.csr -config openssl-etcd.cnf
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl x509 -req -in etcd-server.csr -CA ca.crt -CAkey ca.key -CAcreateserial  -out etcd-server.crt -extensions v3_req -extfile openssl-etcd.cnf -days 3650
Certificate request self-signature ok
subject=CN = etcd-server

root@sj-auth-bastion-192-168-34-226:~/hardway/cert# ll | grep etcd-server
-rw-r--r-- 1 root root 1220 Jan  5 14:02 etcd-server.crt
-rw-r--r-- 1 root root  997 Jan  5 14:02 etcd-server.csr
-rw------- 1 root root 1708 Jan  5 14:01 etcd-server.key
```

---

## 생성된 인증서(etcd-server.crt) SANs 확인

```bash
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl x509 -in etcd-server.crt -noout -text
Certificate:
    Data:
        Version: 3 (0x2)
        Serial Number:
            1b:89:01:da:34:e7:68:7a:7c:58:f5:05:ab:c0:03:7b:da:67:01:69
        Signature Algorithm: sha256WithRSAEncryption
        Issuer: CN = KUBERNETES-CA
        Validity
            Not Before: Jan  5 14:02:22 2025 GMT
            Not After : Jan  3 14:02:22 2035 GMT
        Subject: CN = etcd-server
        Subject Public Key Info:
            Public Key Algorithm: rsaEncryption
                Public-Key: (2048 bit)
                Modulus:
                    00:ba:aa:fa:67:46:44:14:ac:55:cc:36:62:ad:ce:
                    ad:04:1d:15:95:0a:49:89:6a:5c:28:ea:b0:83:f6:
                    43:4d:f2:8a:1d:1b:03:78:b9:ab:c8:f0:36:a3:4a:
                    ef:c5:ef:c2:0e:bd:40:68:ad:fc:52:7b:03:da:ff:
                    00:e5:9c:cc:88:03:88:08:2f:36:b7:7a:a1:2a:79:
                    50:56:ae:4d:e1:a2:9b:87:e3:31:0f:2a:ad:6c:9d:
                    ad:a8:e4:b4:27:a2:76:c3:88:17:c0:08:14:46:d5:
                    27:b3:28:61:37:aa:d0:d0:c3:d6:39:3c:7a:4e:c2:
                    b4:e1:b9:54:0e:76:1c:fb:79:7e:e2:7a:f7:a0:2b:
                    d0:bb:b5:b0:1a:de:ef:ff:66:f4:79:57:e4:28:77:
                    cf:a4:d1:af:79:9f:45:3e:a7:27:f8:08:0c:fb:ca:
                    9f:0d:28:bd:a8:a8:82:6a:d7:8d:19:08:49:9d:69:
                    f7:8b:ba:ab:9d:fc:e4:91:be:57:cd:9d:66:42:c1:
                    46:84:4f:75:1e:1a:a8:dd:7f:e1:40:45:96:cc:5b:
                    71:c4:ee:24:67:36:64:9b:32:5a:d8:b6:93:a6:bc:
                    2a:8b:07:da:92:bc:8d:6a:25:29:f7:d8:de:15:73:
                    9a:a1:41:62:5a:3c:f5:2f:b1:1a:79:31:9f:86:6e:
                    e5:51
                Exponent: 65537 (0x10001)
        X509v3 extensions:
            X509v3 Basic Constraints: 
                CA:FALSE
            X509v3 Key Usage: 
                Digital Signature, Non Repudiation, Key Encipherment
            X509v3 Subject Alternative Name: 
                IP Address:172.31.1.2, IP Address:172.31.1.3, IP Address:172.31.1.4, IP Address:127.0.0.1
            X509v3 Subject Key Identifier: 
                B0:10:F4:2F:3D:C5:BD:FF:38:C5:ED:7D:13:4B:19:53:A7:A8:94:A3
            X509v3 Authority Key Identifier: 
                DirName:/CN=KUBERNETES-CA
                serial:45:DF:25:4F:39:3A:42:C5:CD:95:A0:E6:47:03:71:4C:2E:58:C6:5B
    Signature Algorithm: sha256WithRSAEncryption
    Signature Value:
        65:1a:55:0e:b2:f2:75:90:d0:58:fb:7a:83:29:84:61:90:41:
        92:7a:16:80:a4:32:c6:d1:92:8a:b8:00:10:dd:36:6b:0a:c4:
        9a:da:bc:a2:47:88:09:8d:6b:81:2b:d7:b9:c8:b0:a9:bd:e7:
        ba:04:d3:86:68:af:5a:93:59:ab:20:56:00:5a:72:af:82:b5:
        2c:40:1e:c3:86:7e:a8:b2:1e:ce:8c:88:89:79:4b:1b:59:31:
        33:55:0a:aa:de:c4:7a:0c:78:50:3d:8a:af:1b:54:91:19:10:
        06:c6:81:93:c6:48:79:59:8d:70:b6:62:09:68:09:0e:f8:69:
        60:c0:93:6c:c4:61:2f:8b:24:21:69:dc:f1:ae:25:1e:d4:2e:
        9f:06:0f:a6:df:09:4e:aa:c8:ac:e3:2b:85:af:99:51:a7:e2:
        1c:ad:25:0c:ec:a5:09:6f:f3:fe:aa:a7:96:9b:19:b0:6d:a4:
        11:fc:a2:37:1e:5d:90:22:ca:df:cb:e3:26:4e:a4:ab:22:a5:
        30:6f:9c:17:06:6e:4b:2b:79:bc:08:26:f7:2e:7e:0c:e6:fd:
        21:87:54:c3:d2:41:6d:0e:64:88:d1:88:5d:c7:70:d4:a6:62:
        c7:f9:37:5a:29:44:6b:b7:d8:d3:71:b3:1f:a7:04:a1:01:20:
        b2:ad:61:88
```

---

## Service Account Key Pair 생성

```bash
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl genrsa -out service-account.key 2048
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl req -new -key service-account.key -subj "/CN=service-accounts" -out service-account.csr
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# openssl x509 -req -in service-account.csr -CA ca.crt -CAkey ca.key -CAcreateserial  -out service-account.crt -days 1
Certificate request self-signature ok
subject=CN = service-accounts

root@sj-auth-bastion-192-168-34-226:~/hardway/cert# ll | grep service
-rw-r--r-- 1 root root 1005 Jan  5 14:09 service-account.crt
-rw-r--r-- 1 root root  899 Jan  5 14:09 service-account.csr
-rw------- 1 root root 1704 Jan  5 14:09 service-account.key
```

---

```bash
# service-account.key 의 인증서를 sunjae.pem 키에 삽입
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# vi sunjae.pem
# (service-account.key 개인 키 PEM 내용 — 공개 문서에서는 생략)

# 권한 부여
root@sj-auth-bastion-192-168-34-226:~/hardway/cert# chmod 400 sunjae.pem
```

> sunjae.pem 파일에 서비스 계정 키를 저장하는 이유는 보안, 인증, 유연성 등의 이유로 여러 환경에서 해당 인증서를 효율적으로 사용하기 위해서입니다. Kubernetes 클러스터와 외부 시스템 간에 안전하게 인증을 수행하거나, 클러스터 외부에서 클러스터 자원에 접근하기 위해 해당 PEM 파일을 사용할 수 있습니다.

---

[목차](/blog/k8s-hardway-01-overview/#series) · [← 이전](/blog/k8s-hardway-04-kubeconfig/) · [다음 →](/blog/k8s-hardway-06-distribute-certs/)
