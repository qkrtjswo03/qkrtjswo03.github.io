---
title: "NetworkPolicy와 CiliumNetworkPolicy: L3·L4·L7 순서로 직접 막아 보기"
description: "라벨, 포트, HTTP 경로 순서로 CiliumNetworkPolicy를 하나씩 걸어 보면서, 기본 NetworkPolicy가 어디까지 하고 Cilium이 어디부터 더 하는지 확인했다."
pubDate: 2026-11-03
categories:
  - 네트워크
tags:
  - Kubernetes
  - Cilium
  - NetworkPolicy
  - CiliumNetworkPolicy
  - L7
draft: false
---

Kubernetes 기본 `NetworkPolicy`는 L3(누가)와 L4(어느 포트로)까지는 막을 수 있지만, HTTP 메서드나 경로 같은 L7 조건은 표현하지 못한다. Cilium을 CNI로 쓰고 있다면 `CiliumNetworkPolicy`(CNP)로 이 부분까지 내려갈 수 있다.

그래서 같은 백엔드에 L3 → L4 → L7 순서로 정책을 하나씩 걸어 보면서 어디까지 제어되는지 직접 확인해 봤다. Hubble 없이 `kubectl`과 `curl`만으로 검증했다.

## 배경

테스트 범위는 다음 세 가지다.

- **L3 정책**: 라벨로 접근 대상을 제한
- **L4 정책**: 특정 포트만 허용
- **L7 정책**: 특정 HTTP 메서드와 경로만 허용

테스트 환경은 이렇다.

- Kubernetes 1.29.7
- Cilium 1.15.4
- Hubble 미사용 (CLI로 검증)
- 테스트 네임스페이스: `test`
- 도구: `kubectl`, `cilium` CLI

## 개념: 어디까지가 NetworkPolicy의 영역인가

| 계층 | 조건 예시 | NetworkPolicy | CiliumNetworkPolicy |
| --- | --- | --- | --- |
| L3 | Pod 라벨, 네임스페이스 | 가능 | 가능 |
| L4 | TCP 80 포트 | 가능 | 가능 |
| L7 | `GET /public`만 허용 | 불가 | 가능 |

L3와 L4는 두 방식 모두 쓸 수 있으니, 이 글에서는 비교가 쉽도록 세 단계 모두 CNP로 작성했다. L7 단계에서 Cilium만의 차이가 드러난다.

## 실습 환경 만들기

### Nginx 설정

포트 3개(80, 443, 8080)와 경로 3개(`/`, `/public`, `/admin`)가 각각 다른 문자열을 돌려주도록 했다. 응답만 보고 어떤 요청이 통과했는지 바로 알 수 있다.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
  namespace: test
data:
  default.conf: |
    server {
        listen 80;
        listen 443;
        listen 8080;
        server_name localhost;

        location / {
            return 200 "Welcome to Nginx\n";
            add_header Content-Type text/plain;
        }
        location /public {
            return 200 "Public Endpoint Accessed\n";
            add_header Content-Type text/plain;
        }
        location /admin {
            return 200 "Admin Accessed\n";
            add_header Content-Type text/plain;
        }
    }
```

### frontend / backend

`test` 네임스페이스에 frontend와 backend를 두고, 비교용으로 `default` 네임스페이스에도 같은 라벨(`role: frontend`)의 frontend를 하나 더 띄운다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: frontend
  namespace: test
  labels:
    role: frontend
spec:
  containers:
  - name: frontend
    image: curlimages/curl:latest
    command: ["sleep", "3600"]
---
apiVersion: v1
kind: Pod
metadata:
  name: backend
  namespace: test
  labels:
    role: backend
spec:
  containers:
  - name: backend
    image: nginx
    ports:
    - containerPort: 80
    - containerPort: 443
    - containerPort: 8080
    volumeMounts:
    - name: config-volume
      mountPath: /etc/nginx/conf.d/default.conf
      subPath: default.conf
    - name: html-volume
      mountPath: /usr/share/nginx/html
  volumes:
  - name: config-volume
    configMap:
      name: nginx-config
  - name: html-volume
    emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: test
spec:
  selector:
    role: backend
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 80
    - name: https
      protocol: TCP
      port: 443
      targetPort: 443
    - name: custom-port
      protocol: TCP
      port: 8080
      targetPort: 8080
---
apiVersion: v1
kind: Pod
metadata:
  name: frontend
  namespace: default
  labels:
    role: frontend
spec:
  containers:
  - name: frontend
    image: curlimages/curl:latest
    command: ["sleep", "3600"]
```

```bash
kubectl apply -f nginx-config.yaml -n test
kubectl apply -f frontend-backend.yaml -n test
```

### 정책 없이 기준선 확인

정책을 걸기 전에 모든 요청이 통과하는지 먼저 본다.

```bash
kubectl exec -n test frontend -- curl -s http://backend-service.test.svc.cluster.local/
kubectl exec -n test frontend -- curl -s http://backend-service.test.svc.cluster.local/public
kubectl exec -n test frontend -- curl -s http://backend-service.test.svc.cluster.local/admin
kubectl exec -n test frontend -- curl -s http://backend-service.test.svc.cluster.local:8080/public
kubectl exec -n test frontend -- curl -s http://backend-service.test.svc.cluster.local:80/public
kubectl exec -n test frontend -- curl -s http://backend-service.test.svc.cluster.local:443/public
```

기대 결과는 `Public Endpoint Accessed`, `Admin Accessed` 같은 정상 응답이다.

## L3: 라벨로 막기

`role: backend`로 들어오는 트래픽을 `role: frontend`에서 온 것만 허용한다.

```yaml
apiVersion: "cilium.io/v2"
kind: CiliumNetworkPolicy
metadata:
  name: "l3-policy"
  namespace: test
spec:
  endpointSelector:
    matchLabels:
      role: backend
  ingress:
  - fromEndpoints:
    - matchLabels:
        role: frontend
```

```bash
kubectl apply -f l3-policy.yaml -n test
```

### 검증

```bash
kubectl exec -n test frontend -- curl -s http://backend-service.test.svc.cluster.local/public  # ✅ 허용됨
kubectl exec -n test frontend -- curl -s http://backend-service.test.svc.cluster.local/admin  # ✅ 허용됨
kubectl exec -n default frontend -- curl -s http://backend-service.test.svc.cluster.local/public  # ❌ 차단됨
kubectl exec -n default frontend -- curl -s http://backend-service.test.svc.cluster.local/admin  # ❌ 차단됨
```

- `test` 네임스페이스의 frontend → backend-service: 허용
- `default` 네임스페이스의 frontend → backend-service: 차단

두 frontend는 라벨이 같은데 결과가 갈린다. CNP의 `fromEndpoints`는 네임스페이스를 따로 지정하지 않으면 정책이 있는 네임스페이스(`test`) 안의 엔드포인트만 고르기 때문이다. 다른 네임스페이스를 허용하려면 `k8s:io.kubernetes.pod.namespace` 라벨을 셀렉터에 넣어야 한다.

다음 단계로 넘어가기 전에 정책을 지운다.

```bash
kubectl delete -f l3-policy.yaml -n test
```

## L4: 포트로 막기

같은 L3 조건에 `toPorts`를 더해 TCP 80만 연다.

```yaml
apiVersion: "cilium.io/v2"
kind: CiliumNetworkPolicy
metadata:
  name: "l4-policy"
  namespace: test
spec:
  endpointSelector:
    matchLabels:
      role: backend
  ingress:
  - fromEndpoints:
    - matchLabels:
        role: frontend
    toPorts:
    - ports:
      - port: "80"
        protocol: TCP
```

```bash
kubectl apply -f l4-policy.yaml -n test
```

### 검증

```bash
kubectl exec -n test frontend -- curl -s http://backend-service.test.svc.cluster.local:80/public  # ✅ 허용됨
kubectl exec -n test frontend -- curl -s http://backend-service.test.svc.cluster.local:443/public  # ❌ 차단됨
kubectl exec -n test frontend -- curl -s http://backend-service.test.svc.cluster.local:8080/public  # ❌ 차단됨
```

- 80 포트: 허용
- 443, 8080 포트: 차단

여기까지는 기본 NetworkPolicy로도 똑같이 만들 수 있는 범위다.

```bash
kubectl delete -f l4-policy.yaml -n test
```

## L7: HTTP 메서드와 경로로 막기

이제 기본 NetworkPolicy로는 할 수 없는 단계다. 80 포트 안에서도 `GET /public`만 허용한다.

```yaml
apiVersion: "cilium.io/v2"
kind: CiliumNetworkPolicy
metadata:
  name: "l7-policy"
  namespace: test
spec:
  endpointSelector:
    matchLabels:
      role: backend
  ingress:
  - fromEndpoints:
    - matchLabels:
        role: frontend
    toPorts:
    - ports:
      - port: "80"
        protocol: TCP
      rules:
        http:
        - method: "GET"
          path: "/public"
```

```bash
kubectl apply -f l7-policy.yaml -n test
```

### 검증

```bash
kubectl exec -n test frontend -- curl -X GET http://backend-service.test.svc.cluster.local/public  # ✅ 허용됨
kubectl exec -n test frontend -- curl -X GET http://backend-service.test.svc.cluster.local/admin  # ❌ 차단됨
```

- `GET /public`: 허용
- `GET /admin`: 403 Forbidden 응답

L3와 L4에서는 차단된 요청이 응답 없이 끊겼다면, L7에서는 연결은 맺어지고 **HTTP 403**이 돌아온다. 패킷을 떨어뜨리는 게 아니라 Cilium이 HTTP 요청을 들여다보고 응답으로 거절하기 때문이다.

```bash
kubectl delete -f l7-policy.yaml -n test
```

## 정리

| 단계 | 정책 조건 | 결과 |
| --- | --- | --- |
| L3 | `role: frontend` 라벨만 허용 | 같은 네임스페이스만 통과, `default`는 차단 |
| L4 | L3 + TCP 80 | 80만 통과, 443·8080 차단 |
| L7 | L4 + `GET /public` | `/public`만 통과, `/admin`은 403 |

- L3, L4까지는 기본 `NetworkPolicy`로 충분하다.
- 경로나 메서드 단위로 막아야 한다면 `CiliumNetworkPolicy`의 `rules.http`가 필요하다.
- CNP의 `fromEndpoints`는 기본적으로 같은 네임스페이스만 고른다. 라벨이 같다고 다른 네임스페이스까지 열리지 않는다.
- 차단 방식이 다르다. L3·L4는 연결이 끊기고, L7은 403으로 돌아온다. 장애를 볼 때 이 차이를 알아 두면 원인을 더 빨리 좁힐 수 있다.

### 참고

- [https://kschoi728.tistory.com/282](https://kschoi728.tistory.com/282)
- [https://okms1017.tistory.com/84](https://okms1017.tistory.com/84)
