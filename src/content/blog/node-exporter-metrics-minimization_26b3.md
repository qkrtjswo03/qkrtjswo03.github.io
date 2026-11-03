---
title: "Node Exporter 메트릭 줄이기: collector 끄기와 keep 필터"
description: "kube-prometheus-stack의 node-exporter에서 쓰지 않는 collector를 끄고, ServiceMonitor 단계에서 필요한 메트릭만 남겨 Prometheus 저장량과 scrape 부하를 줄였다."
pubDate: 2026-11-03
categories:
  - 관측
tags:
  - Prometheus
  - node-exporter
  - kube-prometheus-stack
  - Helm
  - metricRelabelings
draft: false
---

node-exporter는 기본 설정만으로도 메트릭을 꽤 많이 내보낸다. 대시보드와 알람에서 실제로 쓰는 건 그중 일부라서, 나머지는 저장 공간과 scrape 시간만 잡아먹는다. kube-prometheus-stack 환경에서 메트릭을 줄인 방법을 정리한다.

## 배경

목표는 네 가지였다.

- 불필요한 메트릭 제거
- Prometheus 저장 용량 감소
- scrape 부하 감소
- 운영에 필요한 핵심 메트릭만 유지

적용 대상은 Helm 차트 `kube-prometheus-stack`의 **node-exporter** 컴포넌트다.

## 개념: 두 단계로 줄인다

메트릭을 줄이는 지점은 두 군데다.

1. **수집 단계**: node-exporter의 collector 자체를 끈다. 아예 만들어지지 않으니 node-exporter의 부하도 같이 준다.
2. **저장 단계**: ServiceMonitor의 `metricRelabelings`로 scrape한 결과 중 필요한 이름만 남긴다(`action: keep`).

그리고 원칙 하나. 차트 내부 파일은 직접 고치지 않고 **values.yaml에서 override**한다. 차트를 올릴 때 수정 내용이 날아가지 않게 하기 위해서다. 시작점은 이 항목이다.

```yaml
prometheus-node-exporter:
  extraArgs: []
```

## 조치

### 1. collector 정리

values.yaml에 필요한 collector는 켜고, 쓰지 않는 collector는 끄는 인자를 넣는다.

```yaml
prometheus-node-exporter:
  extraArgs:
# 필요한 collector만 활성화
    - --collector.cpu
    - --collector.meminfo
    - --collector.loadavg
    - --collector.netdev
    - --collector.filesystem

# 불필요 collector 비활성화
    - --no-collector.arp
    - --no-collector.conntrack
    - --no-collector.entropy
    - --no-collector.ipvs
    - --no-collector.mdadm
    - --no-collector.netstat
    - --no-collector.sockstat
    - --no-collector.softnet
    - --no-collector.stat
    - --no-collector.time
    - --no-collector.uname
    - --no-collector.vmstat
```

남기는 collector와 주요 메트릭은 다음과 같다.

| Collector | 주요 메트릭 |
| --- | --- |
| cpu | `node_cpu_seconds_total` |
| meminfo | `node_memory_*` |
| loadavg | `node_load1`, `node_load5`, `node_load15` |
| netdev | `node_network_*` |
| filesystem | `node_filesystem_*` |

### 2. ServiceMonitor별 keep 필터 (핵심)

collector를 꺼도 kubelet, cAdvisor, kube-state-metrics, GPU exporter 같은 다른 대상에서도 메트릭이 들어온다. 그래서 ServiceMonitor마다 공통 필터를 걸어, 대시보드와 알람에서 쓰는 이름만 남겼다.

```yaml
metricRelabelings:
  - sourceLabels: [__name__]
    regex: "apiserver_request_total|cluster:kube_persistentvolumeclaim_resource_requests_storage_bytes:provisioner:sum|cluster:kubelet_volume_stats_used_bytes:provisioner:sum|cluster_quantile:apiserver_request_duration_seconds:histogram_quantile|cluster_quantile:apiserver_request_slo_duration_seconds:histogram_quantile|code_resource:apiserver_request_total:rate5m|container_cpu_usage_seconds_total|container_fs_reads_bytes_total|container_memory_usage_bytes|container_memory_working_set_bytes|container_network_receive_bytes_total|container_network_transmit_bytes_total|DCGM_FI_DEV_FB_FREE|DCGM_FI_DEV_FB_USED|DCGM_FI_DEV_GPU_TEMP|DCGM_FI_DEV_GPU_UTIL|DCGM_FI_DEV_MEM_CLOCK|DCGM_FI_DEV_POWER_USAGE|DCGM_FI_DEV_SM_CLOCK|DCGM_FI_PROF_GR_ENGINE_ACTIVE|instance:node_cpu:rate:sum|instance:node_network_receive_bytes_excluding_lo:rate1m|instance:node_network_transmit_bytes_excluding_lo:rate1m|instance:node_num_cpu:sum|kube_daemonset_created|kube_deployment_created|kube_deployment_metadata_generation|kube_deployment_status_replicas|kube_deployment_status_replicas_available|kube_deployment_status_replicas_ready|kube_deployment_status_replicas_unavailable|kube_deployment_status_replicas_updated|kube_ingress_info|kube_job_status_active|kube_job_status_failed|kube_job_status_succeeded|kube_namespace_created|kube_namespace_labels|kube_node_info|kube_node_role|kube_node_status_capacity|kube_node_status_condition|kube_persistentvolume_info|kube_persistentvolumeclaim_info|kube_persistentvolumeclaim_resource_requests_storage_bytes|kube_persistentvolumeclaim_status_phase|kube_pod_container_info|kube_pod_container_resource_limits|kube_pod_container_resource_requests|kube_pod_container_status_ready|kube_pod_container_status_running|kube_pod_container_status_terminated|kube_pod_container_status_waiting|kube_pod_created|kube_pod_deletion_timestamp|kube_pod_info|kube_pod_status_phase|kube_pod_status_ready|kube_pod_status_unschedulable|kube_replicaset_created|kube_resourcequota|kube_service_info|kube_statefulset_created|kube_storageclass_info|kubelet_node_name|kubelet_volume_stats_capacity_bytes|kubelet_volume_stats_used_bytes|machine_cpu_cores|machine_memory_bytes|namespace:container_cpu_usage:sum|namespace_workload_pod:kube_pod_owner:relabel|node:cpu_high|node:memory_high|node_cpu_seconds_total|node_disk_read_bytes_total|node_disk_reads_completed_total|node_disk_writes_completed_total|node_disk_written_bytes_total|node_filesystem_avail_bytes|node_filesystem_free_bytes|node_filesystem_size_bytes|node_load1|node_load15|node_load5|node_memory_MemAvailable_bytes|node_memory_MemTotal_bytes|node_network_receive_bytes_total|node_network_transmit_bytes_total|node_procs_running|node_uname_info|pod:container_fs_usage_bytes:sum|up"
    action: keep
```

`action: keep`은 regex에 맞는 이름만 남기고 나머지는 저장 전에 버린다. 목록에 없는 메트릭은 TSDB에 들어가지 않는다.

## 검증할 때 볼 것

적용 후에는 아래 두 가지를 확인하면 된다. (이 글의 원본 기록에는 전후 수치가 없어서, 확인 방법만 적어 둔다.)

- Prometheus UI의 **Status → TSDB Status**에서 메트릭 이름별 시계열 수가 줄었는지
- 기존 대시보드와 알람 패널이 "No data" 없이 그대로 그려지는지

특히 두 번째가 중요하다. keep 필터는 목록에 없는 건 조용히 버리기 때문에, 빠진 메트릭이 있어도 에러가 나지 않는다.

## 정리

- 메트릭은 **collector 끄기**(수집 단계)와 **keep 필터**(저장 단계) 두 군데에서 줄인다.
- 설정은 차트를 직접 고치지 말고 values.yaml override로 넣는다.
- keep 목록은 대시보드와 알람에서 쓰는 이름을 기준으로 만든다.
