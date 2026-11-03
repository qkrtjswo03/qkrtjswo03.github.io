---
title: "Grafana 대시보드 JSON이 0바이트로 뜨던 이유: download-dashboards initContainer"
description: "kube-prometheus-stack으로 Grafana를 올렸더니 대시보드 JSON이 가끔 빈 파일로 남았다. helm template을 열 번 돌려 보니 initContainer가 나왔다 안 나왔다 했다."
pubDate: 2026-11-03
categories:
  - 관측
  - 트러블슈팅
tags:
  - Grafana
  - Helm
  - kube-prometheus-stack
  - initContainer
draft: false
---

kube-prometheus-stack으로 Grafana를 배포했는데, 대시보드가 어떤 때는 뜨고 어떤 때는 비어 있었다. Pod 안을 열어 보니 대시보드 JSON 파일이 이름만 있고 크기가 0바이트였다. 원인을 찾고 고친 과정을 정리한다.

## 배경과 증상

구성은 이랬다.

- `kube-prometheus-stack` 루트 차트 아래 Grafana 서브차트를 사용
- 대시보드는 sidecar가 아니라 `downloadDashboards` 방식으로, Pod 시작 시 initContainer(`download-dashboards`)가 JSON을 받아 오도록 설정

문제가 생긴 Pod 안의 대시보드 디렉터리를 보면 파일은 있는데 전부 0바이트였다. (디렉터리 이름은 예시로 바꿨다.)

```bash
kubectl exec -it prometheus-stack-grafana-0 -n monitoring -- ls -l /var/lib/grafana/dashboards/custom
total 0
-rw-r--r--    1 root     472              0 Dec  5 07:07 cilium.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 components.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 etcd.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 gpu.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 logs.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 node.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 pv.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 service.json
```

다른 대시보드 폴더도 같은 상태였다.

```bash
kubectl exec -it prometheus-stack-grafana-0 -n monitoring -- ls -l /var/lib/grafana/dashboards/infra
total 0
-rw-r--r--    1 root     472              0 Dec  5 07:07 cluster.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 gpu.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 haproxy.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 ipmi.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 log.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 machine.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 memcached.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 monitoring.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 mysql.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 rabbitmq.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 resource.json
-rw-r--r--    1 root     472              0 Dec  5 07:07 virtual.json
```

JSON을 채워 넣어야 할 `download-dashboards` initContainer가 제대로 돌지 않았다는 의심이 들었다.

## 원인 찾기: helm template을 열 번 돌리기

렌더링 결과에 initContainer가 들어가는지 확인하려고 `helm template`을 열 번 반복해 봤다.

```bash
for i in {1..10}; do   echo "--- RUN $i ---";   helm template prometheus-stack charts/kube-prometheus-stack -n monitoring     --set grafana.enabled=true     --set grafana.sidecar.dashboards.enabled=false     --set grafana.forceDeployDashboards=true     | grep -A7 "download-dashboards";   sleep 0.1; done
```

결과가 이상했다. 같은 명령인데 어떤 회차에는 initContainer가 나오고, 어떤 회차에는 아예 없었다.

```yaml
--- RUN 1 ---
        - name: download-dashboards
          image: "docker.io/curlimages/curl:7.85.0"
          imagePullPolicy: IfNotPresent
          command: ["/bin/sh"]
          args: [ "-c", "mkdir -p /var/lib/grafana/dashboards/default && /bin/sh -x /etc/grafana/download_dashboards.sh" ]
          env:
          securityContext:
            allowPrivilegeEscalation: false
--- RUN 2 ---
        - name: download-dashboards
          (RUN 1과 동일)
--- RUN 3 ---
--- RUN 4 ---
        - name: download-dashboards
          (RUN 1과 동일)
--- RUN 5 ---
--- RUN 6 ---
        - name: download-dashboards
          (RUN 1과 동일)
--- RUN 7 ---
        - name: download-dashboards
          (RUN 1과 동일)
--- RUN 8 ---
        - name: download-dashboards
          (RUN 1과 동일)
--- RUN 9 ---
--- RUN 10 ---
        - name: download-dashboards
          (RUN 1과 동일)
```

열 번 중 세 번(RUN 3, 5, 9)은 `download-dashboards`가 렌더링되지 않았다. 이 상태로 배포되면 initContainer 없이 Pod가 뜨고, 대시보드 파일은 빈 채로 남는다.

정리하면 원인은 이렇다. **루트 차트에서 Grafana 서브차트로 값이 제대로 전달되지 않아서, 서브차트 입장에서는 `downloadDashboards.enabled`와 `dashboards` 값이 비어 있는 상태로 렌더링될 때가 있었다.** initContainer 템플릿은 이 조건이 채워져야 만들어진다.

## 조치: 서브차트가 필요한 값을 명시적으로 채우기

루트 차트의 `values.yaml`에서 Grafana 서브차트가 initContainer를 만들 때 보는 조건을 전부 직접 적어 줬다.

```yaml
grafana:
  enabled: true
  forceDeployDashboards: true
  sidecar:
    dashboards:
      enabled: false
  downloadDashboards:
    enabled: true
  dashboards:
    init-test:
      dummy:
        json: "{}"
```

포인트는 두 가지다.

- `downloadDashboards.enabled: true`를 루트 values에 명시한다.
- `dashboards`가 비어 있지 않도록 더미 항목(`init-test.dummy`)을 하나 넣는다.

이렇게 하면 렌더링 때마다 조건이 항상 채워져서 `download-dashboards` initContainer 템플릿이 빠지지 않는다.

## 검증

같은 방식으로 열 번 다시 렌더링했다. (이미지 레지스트리 주소는 예시로 바꿨다.)

```bash
for i in {1..10}; do   echo "--- RUN $i ---";   helm template prometheus-stack . -f values.yaml   | grep -A7 "download-dashboards";   sleep 0.1; done
```

```yaml
--- RUN 1 ---
        - name: download-dashboards
          image: "registry.example.com/prometheus-stack/curlimages/curl:7.85.0"
          imagePullPolicy: IfNotPresent
          command: ["/bin/sh"]
          args: [ "-c", "mkdir -p /var/lib/grafana/dashboards/default && /bin/sh -x /etc/grafana/download_dashboards.sh" ]
          env:
          securityContext:
            allowPrivilegeEscalation: false
--- RUN 2 ---
        - name: download-dashboards
          (RUN 1과 동일)
...
--- RUN 10 ---
        - name: download-dashboards
          (RUN 1과 동일)
```

이번에는 열 번 모두 `download-dashboards`가 렌더링됐다.

대시보드 JSON 경로가 렌더링 결과에 들어가는지도 같이 확인할 수 있다.

```bash
for i in {1..10}; do   echo "--- RUN $i ---";   helm template prometheus-stack . -n monitoring     | grep -E "dashboards\/.*\.json"; done
```

배포 후 Pod 안을 다시 보면 파일 크기가 채워져 있다.

```bash
kubectl exec -it prometheus-stack-grafana-0 -n monitoring -- ls -l /var/lib/grafana/dashboards/custom
total 268
-rw-r--r--    1 root     472          12039 Dec  5 07:41 cilium.json
-rw-r--r--    1 root     472          44761 Dec  5 07:41 components.json
-rw-r--r--    1 root     472          37927 Dec  5 07:41 etcd.json
-rw-r--r--    1 root     472          22555 Dec  5 07:41 gpu.json
-rw-r--r--    1 root     472          17019 Dec  5 07:41 logs.json
-rw-r--r--    1 root     472          32785 Dec  5 07:41 node.json
-rw-r--r--    1 root     472          35787 Dec  5 07:41 pv.json
-rw-r--r--    1 root     472          55149 Dec  5 07:41 service.json
```

## 정리

- 대시보드 JSON이 0바이트라면 Grafana보다 먼저 `download-dashboards` initContainer가 실제로 렌더링됐는지 본다.
- "가끔" 생기는 문제는 한 번 렌더링해서는 안 보인다. `helm template`을 반복 실행해 결과가 매번 같은지 확인하는 게 빠르다.
- 서브차트 기능은 루트 values에서 필요한 조건을 명시적으로 채워 두는 편이 안전하다. 이번에는 `downloadDashboards.enabled`와 더미 `dashboards` 항목 두 줄로 해결됐다.
