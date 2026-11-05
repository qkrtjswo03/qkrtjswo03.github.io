---
title: "Harbor HA: CloudNativePG와 Redis(Valkey)로 외부 DB·캐시 붙이기"
description: "Kubernetes에서 Harbor를 HA로 세우기 위해 CloudNativePG PostgreSQL 3노드와 Bitnami Redis(Sentinel)·Valkey를 먼저 구성하고, Harbor Helm values로 외부 DB·Redis에 연결한 과정을 정리했다."
pubDate: 2026-11-05T13:30:00+09:00
categories:
  - 쿠버네티스
tags:
  - Harbor
  - CloudNativePG
  - Redis
  - HA
  - Helm
draft: false
---

Image Registry를 단일 파드에 두면 노드 장애나 업그레이드 때 푸시·풀이 한꺼번에 멈춘다. 그래서 Kubernetes 위에 **Harbor HA**를 세웠고, 차트 내장 PostgreSQL·Redis 대신 **CloudNativePG**와 **Redis Sentinel(Valkey 이미지)** 를 밖으로 빼서 붙였다.

> 글에 나오는 비밀번호는 전부 `CHANGE_ME_*` 플레이스홀더다. 배포 전에 직접 넣고, 문서·저장소에 실값을 남기지 말 것. 노드 이름·파드 IP도 예시로 일반화했다. `storageClass`는 환경에 맞게 `nfs-storage` 자리를 바꾸면 된다.

## 1. 개요

구성은 세 층으로 나뉜다.

| 계층 | 구성 | 역할 |
| --- | --- | --- |
| DB | CloudNativePG Cluster 3인스턴스 | registry / clair / notary_* |
| 캐시 | Redis(Valkey) + Sentinel, replica 3 | Harbor 세션·작업 큐 |
| Registry | Harbor Helm, 컴포넌트 replicas ≥ 2 | core / portal / nginx / registry / jobservice |

의존성은 `harbor-deps` 네임스페이스에, Harbor 본체는 `cicd` 네임스페이스에 올렸다.

## 2. PostgreSQL HA (CloudNativePG)

### 2.1 Operator 설치

```bash
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm repo update
kubectl create namespace cnpg-system
helm install cloudnative-pg cnpg/cloudnative-pg -n cnpg-system
kubectl get pods -n cnpg-system
```

Operator 파드가 `Running`이면 충분하다.

### 2.2 Cluster 배포

```bash
kubectl create namespace harbor-deps
```

```yaml
# postgresql-ha.yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: harbor-db
  namespace: harbor-deps
spec:
  instances: 3
  imageName: ghcr.io/cloudnative-pg/postgresql:16
  bootstrap:
    initdb:
      database: postgres
      owner: postgres
  storage:
    size: 10Gi
    storageClass: nfs-storage
  affinity:
    podAntiAffinityType: required
    topologyKey: kubernetes.io/hostname
```

```bash
kubectl apply -f postgresql-ha.yaml
kubectl get pods -n harbor-deps -o wide
kubectl get cluster -n harbor-deps
```

정상일 때 인스턴스 3개가 서로 다른 노드에 있고, `STATUS`가 healthy이며 PRIMARY가 하나 잡힌다. 출력 예시는 대략 이런 형태다.

```text
NAME        INSTANCES   READY   STATUS                     PRIMARY
harbor-db   3           3       Cluster in healthy state   harbor-db-1
```

### 2.3 Harbor용 DB 생성·비밀번호

Primary 파드(예: `harbor-db-1`)에서 DB 네 개를 만든다.

```bash
kubectl exec -it harbor-db-1 -n harbor-deps -- psql -U postgres -c "CREATE DATABASE registry;"
kubectl exec -it harbor-db-1 -n harbor-deps -- psql -U postgres -c "CREATE DATABASE clair;"
kubectl exec -it harbor-db-1 -n harbor-deps -- psql -U postgres -c "CREATE DATABASE notary_server;"
kubectl exec -it harbor-db-1 -n harbor-deps -- psql -U postgres -c "CREATE DATABASE notary_signer;"
```

CNPG가 만든 초기 비밀번호를 Harbor가 쓸 값으로 바꾼다.

```bash
kubectl exec -it harbor-db-1 -n harbor-deps -- psql -U postgres \
  -c "ALTER USER postgres PASSWORD 'CHANGE_ME_POSTGRES';"
```

읽기-쓰기 엔드포인트는 보통 `harbor-db-rw.harbor-deps.svc.cluster.local:5432`다.

## 3. Redis HA (Bitnami 차트 + Valkey)

### 3.1 왜 Valkey인가

Bitnami Redis 이미지 라이선스·유료화 이슈를 피하려고 **Valkey** 이미지를 썼다. API는 Redis와 호환되니, 필요하면 공식 Redis 이미지로 바꿔도 된다. 차트는 그대로 Bitnami Redis 차트를 쓴다.

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

```yaml
# redis-ha-values.yaml
image:
  registry: docker.io
  repository: valkey/valkey
  tag: "7.2"
  pullPolicy: IfNotPresent

global:
  security:
    allowInsecureImages: true
  defaultFips: "off"

commonConfiguration: |-
  appendonly yes
  save ""

auth:
  enabled: true
  password: "CHANGE_ME_REDIS"
  sentinel: true

sentinel:
  enabled: true
  quorum: 2
  masterService:
    enabled: true

rbac:
  create: true

serviceAccount:
  create: true

replica:
  replicaCount: 3
  podAntiAffinityPreset: "hard"
  automountServiceAccountToken: true
  persistence:
    enabled: true
    size: 1Gi
    storageClass: nfs-storage

master:
  automountServiceAccountToken: true
  podAntiAffinityPreset: "hard"
  persistence:
    enabled: true
    size: 1Gi
    storageClass: nfs-storage
```

```bash
helm install harbor-redis bitnami/redis -n harbor-deps -f redis-ha-values.yaml
kubectl get pods -n harbor-deps -o wide
```

`harbor-redis-node-0` ~ `2`가 서로 다른 노드에 올라왔는지 본다. 각 파드는 redis + sentinel 등으로 Ready가 3/3인 경우가 많다.

### 3.2 Master / Replica 확인

```bash
kubectl exec -n harbor-deps harbor-redis-node-0 -c redis -- \
  redis-cli -a CHANGE_ME_REDIS role
```

첫 줄이 `master`면 그 파드가 마스터, `slave`(또는 replica)면 복제본이다. Harbor 쪽 주소는 master 서비스인 `harbor-redis-master.harbor-deps.svc.cluster.local:6379`를 쓴다.

## 4. Harbor HA

```bash
kubectl create namespace cicd
helm repo add harbor https://helm.goharbor.io
helm repo update
```

핵심은 **내장 DB/Redis를 끄고**, 앞에서 만든 외부 엔드포인트에 붙이는 것, 그리고 주요 컴포넌트 `replicas`를 2 이상으로 두고 topology spread로 노드에 흩뿌리는 것이다.

values에서 손댄 부분만 추리면 아래와 같다. 전체 values는 차트 기본값을 기준으로 필요한 키만 덮어쓰면 된다.

```yaml
# harbor-ha-values.yaml (발췌)
expose:
  type: clusterIP
  tls:
    enabled: true
    certSource: auto
    auto:
      commonName: "harbor.example.com"
  clusterIP:
    name: harbor

persistence:
  enabled: true
  resourcePolicy: "keep"
  persistentVolumeClaim:
    registry:
      storageClass: "nfs-storage"
      accessMode: ReadWriteMany
      size: 100Gi
    jobservice:
      jobLog:
        storageClass: "nfs-storage"
        accessMode: ReadWriteMany
        size: 5Gi
    database:
      storageClass: "nfs-storage"
      accessMode: ReadWriteMany
      size: 5Gi
    redis:
      storageClass: "nfs-storage"
      accessMode: ReadWriteMany
      size: 5Gi
    trivy:
      storageClass: "nfs-storage"
      accessMode: ReadWriteMany
      size: 25Gi
  imageChartStorage:
    type: filesystem
    filesystem:
      rootdirectory: /storage

harborAdminPassword: "CHANGE_ME_HARBOR_ADMIN"

nginx:
  replicas: 2
  topologySpreadConstraints:
    - maxSkew: 1
      topologyKey: kubernetes.io/hostname
      whenUnsatisfiable: ScheduleAnyway

portal:
  replicas: 2
  topologySpreadConstraints:
    - maxSkew: 1
      topologyKey: kubernetes.io/hostname
      whenUnsatisfiable: ScheduleAnyway

core:
  replicas: 2
  topologySpreadConstraints:
    - maxSkew: 1
      topologyKey: kubernetes.io/hostname
      whenUnsatisfiable: ScheduleAnyway

jobservice:
  replicas: 2
  topologySpreadConstraints:
    - maxSkew: 1
      topologyKey: kubernetes.io/hostname
      whenUnsatisfiable: ScheduleAnyway

registry:
  replicas: 2
  topologySpreadConstraints:
    - maxSkew: 1
      topologyKey: kubernetes.io/hostname
      whenUnsatisfiable: ScheduleAnyway

trivy:
  enabled: true
  replicas: 1

database:
  type: external
  external:
    host: "harbor-db-rw.harbor-deps.svc.cluster.local"
    port: "5432"
    username: "postgres"
    password: "CHANGE_ME_POSTGRES"
    coreDatabase: "registry"
    clairDatabase: "clair"
    notaryServerDatabase: "notary_server"
    notarySignerDatabase: "notary_signer"

redis:
  type: external
  external:
    addr: "harbor-redis-master.harbor-deps.svc.cluster.local:6379"
    sentinelMasterSet: ""
    username: "default"
    password: "CHANGE_ME_REDIS"
```

참고:

- `expose.type: ingress`로 두면 NGINX 파드는 안 뜬다. 여기서는 clusterIP + 앞단 프록시를 전제로 했다.
- PVC는 HA 파드가 같이 붙을 수 있게 `ReadWriteMany`와 공유 가능한 StorageClass를 썼다. 블록 스토리지만 있으면 스토리지 전략을 다시 짜야 한다.
- `CHANGE_ME_POSTGRES` / `CHANGE_ME_REDIS` / `CHANGE_ME_HARBOR_ADMIN`은 반드시 배포 전에 강한 값으로 바꾸고 시크릿 관리 체계에 넣는다.

```bash
helm install harbor harbor/harbor -n cicd -f harbor-ha-values.yaml
kubectl get pods -n cicd -o wide
```

core / portal / nginx / registry / jobservice가 각각 2개씩, 가능하면 서로 다른 노드에 분산됐는지 확인한다. Trivy는 환경에 따라 1개로 두어도 된다.

## 5. 정리

1. **CNPG**로 PostgreSQL 3노드 HA → Harbor용 DB 4개 생성  
2. **Bitnami Redis + Valkey**로 Sentinel HA → master 서비스 주소 확보  
3. **Harbor Helm**에서 `database.type` / `redis.type`을 `external`로 두고 HA 레플리카·topology spread 적용  

이후에는 Primary 파드 강제 삭제나 Redis 마스터 failover를 한 번 돌려 보고, Harbor UI 로그인·이미지 push/pull이 끊기지 않는지만 보면 된다. 비밀번호는 이 글을 따라 한 뒤 바로 로테이션하는 것을 권한다.
