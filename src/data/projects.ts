export interface ProjectLink {
  href: string;
  label: string;
}

export interface Project {
  title: string;
  period: string;
  role: string;
  stack: string[];
  results: string[];
  posts?: ProjectLink[];
}

/** 경력 프로젝트. 최신 재직이 앞이다. */
export const careerProjects: Project[] = [
  {
    title: 'KubeEdge 엣지 검증',
    period: '2024.12 ~ 현재',
    role: '검증 환경 설계·구축, 네트워크 단절 시나리오 설계·검증',
    stack: ['KubeEdge', 'Kubernetes', 'EdgeMesh', 'MQTT', 'Helm', 'Kubespray'],
    results: [
      'Kubespray로 7노드를 구성하고 CloudCore와 Gateway를 이중화했다.',
      'EdgeMesh Relay로 P2P를 두고, 단절 중에는 로컬에 보존한 뒤 다시 동기화한다.',
      'DeviceTwin과 MQTT 동기화 시나리오 5개를 통과했다.',
      '단절 장애를 넣은 뒤 데이터 누락 0, 중복 0이었다.',
    ],
    posts: [{ href: '/blog/kubeedge-device-mapper-mqtt/', label: 'KubeEdge Device, Mapper, MQTT' }],
  },
  {
    title: '사내 Kubernetes PaaS 관측 통합',
    period: '2024.12 ~ 현재',
    role: '멀티 클러스터 모니터링 스택 설계와 Helm Chart 패키징',
    stack: ['Prometheus', 'Thanos', 'Loki', 'Tempo', 'Grafana Alloy', 'OpenTelemetry Collector', 'SeaweedFS', 'Grafana'],
    results: [
      '여러 클러스터의 메트릭을 한곳의 Grafana에서 본다.',
      'Thanos, Loki, Tempo를 이중화했다.',
      '로그 수집을 Promtail에서 Alloy로, 오브젝트 저장을 MinIO에서 SeaweedFS로 바꿨다.',
      'Helm Chart와 values.yaml로 배포를 반복할 수 있게 했다.',
    ],
    posts: [
      { href: '/blog/grafana-download-dashboards-init-container/', label: 'Grafana 대시보드 다운로드' },
      { href: '/blog/loki-memberlist-cluster-dns/', label: 'Loki memberlist와 DNS' },
      { href: '/blog/node-exporter-metrics-minimization/', label: 'Node Exporter 메트릭 줄이기' },
    ],
  },
  {
    title: '사내 Kubernetes PaaS 접근과 인증',
    period: '2024.12 ~ 현재',
    role: '통합 대시보드 접근과 중앙 인증 구성',
    stack: ['Istio', 'OAuth2 Proxy', 'Keycloak', 'JWT', 'Redis', 'Grafana'],
    results: [
      '하나의 도메인으로 여러 Grafana 대시보드에 들어가게 했다.',
      '경로 라우팅과 중앙 인증을 붙였다.',
      '세션은 Redis에 두고, 인증 헤더를 붙여 뒤쪽 서비스로 넘긴다.',
      '인증에 실패하면 다시 로그인으로 보낸다.',
    ],
  },
  {
    title: 'Istio 컨트롤 플레인 중단 영향',
    period: '2024.12 ~ 현재',
    role: 'istiod가 없을 때 데이터 플레인이 어떻게 되는지 확인',
    stack: ['Istio', 'Envoy'],
    results: [
      '이미 떠 있는 Pod와 그 사이 통신은 유지됐다.',
      '사이드카 주입이 켜진 네임스페이스의 새 Pod는 기동하지 않았다.',
      '새 Service 엔드포인트는 사이드카가 붙은 워크로드에서 도달하지 못했다.',
    ],
  },
  {
    title: '사내 Kubernetes PaaS 구성 요소 검증',
    period: '2024.12 ~ 현재',
    role: '모니터링 패키징과 인그레스, 데이터, GPU 구성 검증',
    stack: ['Helm', 'Istio', 'CloudNativePG', 'Redis', 'SeaweedFS', 'Velero', 'Harbor', 'GPU Operator', 'DCGM Exporter'],
    results: [
      'Helm으로 모니터링 스택을 패키징하고 Grafana JWT 인증과 경로 라우팅을 연결했다.',
      '인그레스를 nginx에서 Istio Gateway로 바꿨다.',
      'CloudNativePG와 Redis, Harbor를 고가용성으로 구성했다.',
      'SeaweedFS와 Velero로 백업을 확인하고, GPU Operator로 MIG를 구성했다.',
    ],
  },
  {
    title: 'KT Cloud 멀티 클러스터 운영',
    period: '2022.09 ~ 2024.04',
    role: '클러스터 운영과 장애 대응, 구축 지원, 기술 지원',
    stack: ['OKD', 'Kubernetes', 'Grafana', 'Prometheus', 'Thanos', 'Zabbix', 'Ansible'],
    results: [
      'OKD와 Kubernetes 클러스터 약 30개, VM 약 1,400대를 운영했다.',
      '컨테이너 SLA를 80점대에서 90점대로 올렸고, 2023년 3분기 가용률은 100%였다.',
      '이슈 관리와 문서 현행화로 같은 장애의 복구 시간을 줄였다.',
      'OS, 컨테이너, 웹의 보안 취약점을 조치했다.',
    ],
  },
];

/** 개인·학부 프로젝트. 최신이 앞이다. */
export const personalProjects: Project[] = [
  {
    title: 'Kubernetes 클러스터를 세 가지 방식으로 구축',
    period: '2022.05 · 2024.07',
    role: '클러스터를 직접 설치',
    stack: ['Kubernetes', 'kubeadm', 'Kubespray', 'Cilium', 'containerd', 'etcd'],
    results: [
      '2024.07에 The Hard Way로 마스터 3대, 워커 3대, 자체 CA와 TLS를 구성했다. Kubernetes v1.29.7.',
      'kubeadm init과 join으로 클러스터를 올렸다.',
      '2022.05에 Kubespray와 Ansible로 KVM·Vagrant 노드 3대를 자동 구축했다.',
    ],
    posts: [{ href: '/blog/cilium-network-policy-l3-l4-l7/', label: 'Cilium NetworkPolicy' }],
  },
  {
    title: 'Ansible과 GitLab CI로 노드에 배포',
    period: '2022.05',
    role: '푸시하면 배포되는 파이프라인 구성',
    stack: ['Ansible', 'GitLab Runner', 'Kubernetes', 'Kubespray'],
    results: [
      'git push가 GitLab Runner에서 Ansible Playbook을 실행하게 했다.',
      'Vagrant(KVM) 노드에 httpd와 페이지를 배포했다.',
      '푸시할 때마다 노드의 페이지가 바뀌는 것을 확인했다.',
    ],
  },
  {
    title: 'EPS 파일 공유 웹',
    period: '2022.03 ~ 2022.04',
    role: '파일 업로드·다운로드와 DB 설계·구현',
    stack: ['JSP', 'Tomcat', 'AWS VPC', 'EC2', 'ELB', 'RDS', 'S3'],
    results: [
      '웹, 데이터베이스, 스토리지를 AWS에 3계층으로 구성했다.',
      'AMI 복제, Sticky Session, Crontab으로 S3 백업을 넣었다.',
      '파일 업로드·다운로드와 데이터베이스 설계·구현을 맡았다.',
    ],
  },
  {
    title: '스마트 멀티탭',
    period: '2019.07.08 ~ 2019.11.01',
    role: '해커톤. 클라우드에 붙는 멀티탭',
    stack: ['Arduino Uno', 'ESP8266', 'ACS712', 'C', 'C++', 'ThingSpeak', 'Blynk', 'MQTT'],
    results: [
      '원격 전원 제어, 예약, 데이터 모니터링, GPS를 넣었다.',
      'ThingSpeak와 Blynk를 한 흐름으로 이었다.',
    ],
  },
  {
    title: '스마트 냉장고 관리 앱',
    period: '2019.06.01 ~ 2019.10.08',
    role: '캡스톤. Android 앱과 서버',
    stack: ['Java', 'Android Studio', 'PHP', 'Apache', 'Tomcat', 'MySQL', 'Kakao SDK', 'ZXing'],
    results: [
      '회원가입, 카카오 로그인, QR 코드 스캐너를 넣었다.',
      '데이터베이스를 설계했다.',
      '냉장고 모형을 만들어 전시했다.',
    ],
  },
];
