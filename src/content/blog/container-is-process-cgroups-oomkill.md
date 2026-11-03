---
title: "컨테이너는 결국 프로세스다: 스케줄러·가상메모리·시스템콜로 보는 cgroups와 OOMKill"
description: "운영체제 기본 개념인 스케줄러, 가상 메모리, 시스템 콜, 커널 권한을 컨테이너 쪽에서 다시 봤다. CPU limit이 throttling이 되고 memory limit이 OOMKilled가 되는 과정을 cgroup v2 파일과 PromQL로 확인한다."
pubDate: 2026-11-03
categories:
  - 쿠버네티스
tags:
  - Linux
  - cgroup
  - Container
  - OOMKilled
  - CPU Throttling
  - seccomp
  - PromQL
draft: false
---

운영체제 기본 개념을 다시 공부하다 보니, Kubernetes에서 매일 보는 숫자들과 그대로 이어진다는 게 보였다. CPU limit, memory limit, OOMKilled, seccomp는 결국 리눅스 커널이 프로세스에 해 주던 일을 컨테이너 단위로 묶은 것이다.

컨테이너는 VM이 아니다. 노드에서 `ps`를 쳐 보면 컨테이너 안의 프로세스가 그대로 보인다. 다만 커널이 그 프로세스에 **namespace**로 보이는 범위를 좁히고, **cgroup**으로 쓸 수 있는 자원을 제한하고, **seccomp**로 호출할 수 있는 시스템 콜을 거를 뿐이다. 이 글에서는 OS 개념 네 가지를 하나씩 컨테이너 쪽으로 옮겨 본다.

> 파일 이름과 동작은 cgroup v2, containerd, Kubernetes 1.28 이상 기준이다.

## 큰 그림

| OS 개념 | 컨테이너에서는 | 확인할 곳 |
| --- | --- | --- |
| 스케줄러 | CPU request/limit -> `cpu.weight`, `cpu.max` | `cpu.stat`, `container_cpu_cfs_throttled_periods_total` |
| 가상 메모리 | memory limit -> `memory.max` | `memory.events`, `container_memory_working_set_bytes` |
| 시스템 콜 | seccomp 프로필 | `securityContext.seccompProfile` |
| 커널과 권한 링 | 모든 컨테이너가 호스트 커널 하나를 공유 | namespace, VM과의 차이 |

<!-- diagram: 세로 3단 구조. 맨 위 Node 박스 안에 Pod A/Pod B(각각 컨테이너 프로세스 아이콘). 가운데 "Host Linux Kernel" 가로 띠 하나에 namespace / cgroup / seccomp 세 칸. 맨 아래 CPU·RAM 하드웨어. 오른쪽에 비교용으로 VM 스택(Guest Kernel 박스가 VM마다 따로 있음)을 나란히 두고, 화살표 ①은 컨테이너 -> 공유 커널, ②는 VM -> 각자 커널 -> Hypervisor. -->

## 스케줄러 -> CPU request와 limit

CPU 코어 수보다 실행할 프로세스가 훨씬 많기 때문에, 커널 스케줄러가 CPU 시간을 잘게 나눠 번갈아 준다. 리눅스에서는 오랫동안 CFS(Completely Fair Scheduler)가 이 일을 했다. 커널 6.6부터는 기본 스케줄러가 EEVDF로 바뀌었지만, 컨테이너 CPU limit을 거는 **대역폭 제어(CFS bandwidth control)** 방식은 그대로다. 그래서 메트릭 이름에 아직 `cfs`가 남아 있다.

Kubernetes 설정은 cgroup v2 파일 두 개로 바뀐다.

- **request** -> `cpu.weight`: 경쟁할 때 나눠 갖는 비율이다. 노드가 한가하면 request보다 더 써도 된다.
- **limit** -> `cpu.max`: `quota period` 형식이다. 기본 period는 100ms(100000us)이고, limit 500m이면 다음과 같다.

```bash
# 컨테이너 안에서 (cgroup namespace 덕분에 자기 cgroup이 /sys/fs/cgroup에 보인다)
cat /sys/fs/cgroup/cpu.max
50000 100000        # 100ms마다 50ms까지 사용 가능
# limit이 없으면: max 100000

cat /sys/fs/cgroup/cpu.stat
usage_usec 81234567
nr_periods 51234
nr_throttled 8123
throttled_usec 912345678
```

헷갈리기 쉬운 부분은 quota가 **모든 CPU에서 쓴 시간의 합**이라는 점이다. limit 1 CPU인 컨테이너에서 스레드 4개가 동시에 돌면, 100ms period 중 25ms 만에 quota 100ms를 다 쓰고 나머지 75ms 동안 멈춘다. 평균 CPU 사용률은 limit보다 한참 낮은데 응답 지연이 튀는 경우가 대부분 이 throttling이다.

<!-- diagram: 가로 시간축 100ms period 두세 개. limit 1 CPU, 스레드 4개가 처음 25ms 동안 4칸 동시 실행(색칠), 이후 75ms "throttled" 회색 구간. 위쪽에 cpu.max "100000 100000" 라벨, 아래쪽에 nr_throttled +1 카운트 표시. -->

Prometheus에서는 cAdvisor 메트릭으로 throttling 비율을 본다.

```promql
# 컨테이너별 throttling 비율 (0~1)
sum by (namespace, pod, container) (
  rate(container_cpu_cfs_throttled_periods_total{container!=""}[5m])
)
/
sum by (namespace, pod, container) (
  rate(container_cpu_cfs_periods_total{container!=""}[5m])
)
```

```promql
# 초당 throttling으로 멈춘 시간(초)
sum by (namespace, pod, container) (
  rate(container_cpu_cfs_throttled_seconds_total{container!=""}[5m])
)
```

비율이 꾸준히 높으면 limit을 올리거나, 스레드 수(예: JVM의 GC 스레드, Go의 `GOMAXPROCS`)를 limit에 맞추는 쪽을 먼저 본다.

## 가상 메모리 -> memory limit과 OOMKilled

프로세스는 각자 자기만의 가상 주소 공간을 보고, 커널이 페이지 테이블로 가상 페이지를 실제 RAM 프레임에 연결한다. 덕분에 프로세스끼리 서로의 메모리를 침범할 수 없다. (주소 공간이 0번지부터 그대로 쓰이는 것은 아니다. 낮은 주소는 일부러 매핑하지 않고, ASLR로 배치도 매번 달라진다.)

컨테이너에서 중요한 건, **memory limit은 가상 주소 공간 크기가 아니라 실제로 할당받은 페이지를 센다**는 점이다. `ps`의 VSZ가 수십 GB여도 문제없고, cgroup이 세는 건 실제로 RAM에 올라간 anonymous 메모리와 page cache, 커널 메모리 일부다.

Kubernetes memory limit은 `memory.max`가 된다.

```bash
cat /sys/fs/cgroup/memory.max
536870912           # 512Mi, limit이 없으면 max

cat /sys/fs/cgroup/memory.current
498073600

cat /sys/fs/cgroup/memory.events
low 0
high 0
max 1532
oom 3
oom_kill 3
```

`memory.current`가 `memory.max`에 닿으면 커널은 먼저 page cache 같은 회수 가능한 메모리를 비운다. 그래도 모자라면 cgroup 안에서 OOM killer가 프로세스를 골라 `SIGKILL`을 보낸다. Kubernetes에서는 이게 `OOMKilled`로 보이고, exit code는 137(128 + 9)이다. 1.28부터는 cgroup v2에서 `memory.oom.group`을 켜기 때문에, 컨테이너 안 프로세스 하나가 아니라 컨테이너 전체가 같이 종료된다.

참고로 노드 메모리가 부족해서 kubelet이 Pod를 내보내는 건 `Evicted`이고, OOMKilled와는 다른 경로다.

메모리 사용량은 `container_memory_usage_bytes`보다 `container_memory_working_set_bytes`를 본다. usage에는 언제든 비울 수 있는 inactive page cache가 들어 있고, working set은 거기서 inactive file을 뺀 값이라 OOM에 더 가깝다. kubelet도 eviction 판단에 working set을 쓴다.

```promql
# limit 대비 working set 비율 (kube-state-metrics 필요)
max by (namespace, pod, container) (
  container_memory_working_set_bytes{container!=""}
)
/
max by (namespace, pod, container) (
  kube_pod_container_resource_limits{resource="memory"}
)
> 0.9
```

```promql
# 마지막 종료 사유가 OOMKilled인 컨테이너
kube_pod_container_status_last_terminated_reason{reason="OOMKilled"} == 1

# 최근 1시간 재시작 횟수와 같이 보기
increase(kube_pod_container_status_restarts_total[1h]) > 0
```

## 시스템 콜 -> seccomp

애플리케이션은 파일, 네트워크, 프로세스 생성처럼 커널 자원이 필요할 때 시스템 콜로 요청한다. 커널은 권한을 확인하고 대신 처리한다.

시스템 콜이 하드웨어로 가는 **유일한** 길은 아니다. 한 번 `mmap`으로 매핑한 메모리는 시스템 콜 없이 읽고 쓰고, `clock_gettime`은 vDSO로 커널 진입 없이 처리되며, `io_uring`은 공유 링 버퍼로 시스템 콜 횟수를 줄인다. 그래도 새 자원을 열거나 권한이 바뀌는 지점은 대부분 시스템 콜을 지난다. 그래서 이 지점을 거르는 게 효과가 크다.

seccomp는 프로세스가 호출할 수 있는 시스템 콜을 커널에서 필터링한다. 컨테이너 런타임의 `RuntimeDefault` 프로필은 일반 앱에 필요 없는 위험한 호출(`kexec_load`, `add_key`, `keyctl`, `open_by_handle_at` 등)을 막고, `mount`처럼 특권이 필요한 호출은 해당 capability가 있을 때만 허용한다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  securityContext:
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      image: nginx:1.27
      securityContext:
        allowPrivilegeEscalation: false
```

Kubernetes는 아무것도 지정하지 않으면 기본이 `Unconfined`다. Docker 단독 실행과 다른 점이라 놓치기 쉽다. Pod Security Standards의 `restricted` 수준은 `RuntimeDefault`나 `Localhost` 프로필을 요구하고, kubelet `--seccomp-default` 옵션(1.27 GA)을 켜면 노드 전체 기본값을 `RuntimeDefault`로 바꿀 수 있다.

```bash
# 적용됐는지 확인: 2면 filter 모드
grep Seccomp /proc/1/status
Seccomp:        2
```

## 커널과 권한 링 -> 컨테이너는 커널을 공유한다

CPU는 실행 중인 코드에 권한 수준을 둔다. 커널은 ring 0(커널 모드)에서, 일반 프로세스는 ring 3(사용자 모드)에서 돈다. 앱이 잘못된 메모리에 접근하면 CPU와 커널이 막고 그 프로세스만 종료시킨다.

컨테이너 안의 프로세스도 똑같이 ring 3에서 도는 **호스트의 프로세스**다. 컨테이너마다 커널이 따로 있는 게 아니다.

- **namespace**가 보이는 범위를 나눈다. pid, net, mnt, uts, ipc, user, cgroup namespace 덕분에 컨테이너 안에서는 자기 프로세스, 자기 네트워크, 자기 파일시스템만 보인다.
- **cgroup**이 쓸 수 있는 양을 제한한다.
- **seccomp, capabilities, LSM(AppArmor/SELinux)**이 할 수 있는 일을 줄인다.

VM은 다르다. VM마다 게스트 커널이 따로 있고, 하이퍼바이저가 하드웨어 수준에서 격리한다. 그래서 차이가 이렇게 난다.

| 구분 | 컨테이너 | VM |
| --- | --- | --- |
| 커널 | 호스트 커널 하나 공유 | VM마다 게스트 커널 |
| 격리 경계 | namespace, cgroup, seccomp | 하이퍼바이저 |
| 커널 취약점 영향 | 노드의 모든 컨테이너 | 해당 VM |
| 시작 속도, 오버헤드 | 프로세스 하나 띄우는 수준 | OS 부팅 |

커널 버그나 커널 패닉은 노드 위 모든 컨테이너에 영향을 준다. 격리가 더 필요하면 gVisor(사용자 공간 커널)나 Kata Containers(경량 VM) 같은 런타임을 `RuntimeClass`로 붙이는 방법이 있다.

노드에서 직접 확인해 보면 감이 온다.

```bash
# 노드에서 컨테이너 프로세스가 그대로 보인다
ps -ef | grep nginx

# 그 프로세스가 속한 cgroup
cat /proc/<pid>/cgroup
0::/kubepods.slice/kubepods-burstable.slice/kubepods-burstable-pod<uid>.slice/cri-containerd-<id>.scope

# 그 프로세스의 namespace
ls -l /proc/<pid>/ns
```

## 정리

- 컨테이너는 namespace로 시야를, cgroup으로 자원을, seccomp로 시스템 콜을 제한한 호스트 프로세스다.
- CPU limit은 `cpu.max`의 quota다. quota는 모든 코어 시간의 합이라 멀티스레드 앱은 평균 사용률이 낮아도 throttling된다. `container_cpu_cfs_throttled_periods_total` 비율로 본다.
- memory limit은 `memory.max`다. 가상 주소 공간이 아니라 실제 페이지를 센다. 넘으면 cgroup OOM killer가 `SIGKILL`을 보내고, exit 137, `OOMKilled`가 된다. 사용량은 `container_memory_working_set_bytes`로 본다.
- Kubernetes 기본 seccomp는 `Unconfined`다. `RuntimeDefault`를 명시하거나 kubelet 기본값을 바꾼다.
- 모든 컨테이너는 호스트 커널 하나를 공유한다. 더 강한 격리가 필요하면 VM 계열 런타임을 쓴다.
