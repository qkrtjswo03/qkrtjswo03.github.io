export interface ProjectLink {
  href: string;
  label: string;
}

export interface Project {
  title: string;
  /** 카드 상단 색조. hsl 색상각. */
  hue: number;
  /** 카드 머리말에 붙는 한 줄 분류. */
  kind: string;
  /** public/logos 아래 SVG 파일명. */
  logo: string;
  period: string;
  role: string;
  stack: string[];
  results: string[];
  posts?: ProjectLink[];
  repo?: string;
}

/** 경력 프로젝트. 최신 재직이 앞이다. */
export const careerProjects: Project[] = [
  {
    title: 'KubeEdge 엣지 클라우드 동작 검증',
    hue: 205,
    kind: '엣지 · 국방 연구과제',
    logo: 'kubeedge.svg',
    period: '2024.12 ~ 현재',
    role: '시험 환경 설계·구축, 네트워크 단절 시나리오 설계와 측정',
    stack: ['KubeEdge 1.23.1', 'Kubernetes 1.32.8', 'OpenStack', 'MQTT', 'Helm', 'Kubespray'],
    results: [
      '2026.10 시험 기준, 물리 서버 3대 위에 가상 컴퓨터 11대를 올려 클라우드 1곳과 엣지 1대를 나눴다.',
      '단절 360초, 간헐 60초×12회, 제한 64kbps·지연 200ms·10분의 세 조건을 각각 시험했다.',
      '단절 중 쌓인 352건이 복구 17초 뒤 모두 도착했고, 간헐은 생성 2,151건과 수신 2,151건이 같았다.',
      '세 조건 모두 누락 0 · 중복 0이었고, 클라우드는 단절 42초 뒤 연결 끊김으로 판정했다.',
    ],
    posts: [
      { href: '/blog/kubeedge-overview/', label: 'KubeEdge 개요' },
      { href: '/blog/kubeedge-architecture/', label: 'KubeEdge 아키텍처' },
      { href: '/blog/kubeedge-install-guide/', label: 'KubeEdge v1.22 설치' },
      { href: '/blog/kubeedge-device-mapper-mqtt/', label: 'KubeEdge Device, Mapper, MQTT' },
      { href: '/blog/kubeedge-devicetwin-mqtt-test/', label: 'DeviceTwin·MQTT 시험' },
      { href: '/blog/kubeedge-north-south-reliability/', label: 'North-South 데이터 보장' },
      { href: '/blog/kubeedge-dil-validation/', label: 'DIL 환경 동작 검증' },
      { href: '/blog/edgemesh-overview/', label: 'EdgeMesh 개요' },
      { href: '/blog/edgemesh-p2p-east-west/', label: 'EdgeMesh P2P(East-West)' },
    ],
  },
  {
    title: '멀티 클러스터 관측 스택 통합',
    hue: 158,
    kind: '관측 · PaaS',
    logo: 'grafana.svg',
    period: '2024.12 ~ 현재',
    role: 'MGMT·BIZ 클러스터 모니터링 설계와 Helm 패키징',
    stack: ['Prometheus', 'Thanos', 'Loki', 'Alloy', 'SeaweedFS', 'Grafana', 'Hubble', 'Istio'],
    results: [
      'MGMT 클러스터가 Grafana·Prometheus·Alertmanager·Thanos를 맡고, BIZ 클러스터는 Thanos Sidecar로 메트릭만 밀어 넣는 구조로 나눴다.',
      '오브젝트 스토리지를 MinIO에서 SeaweedFS로 바꾸고 S3 NodePort 30333으로 클러스터 간에 붙였다.',
      '로그 수집을 Promtail에서 Grafana Alloy로 옮기고, 마스터 노드 taint를 toleration으로 통과시켜 6노드에서 돌게 했다.',
      'L4는 Hubble, L7은 Istio sidecar 메트릭으로 계약을 나눠 트래픽 화면에 연결했다.',
    ],
    posts: [
      { href: '/blog/grafana-download-dashboards-init-container/', label: 'Grafana 대시보드 다운로드' },
      { href: '/blog/loki-memberlist-cluster-dns/', label: 'Loki memberlist와 DNS' },
      { href: '/blog/node-exporter-metrics-minimization/', label: 'Node Exporter 메트릭 줄이기' },
    ],
  },
  {
    title: '통합 대시보드 접근과 중앙 인증',
    hue: 285,
    kind: '보안 · 인증',
    logo: 'keycloak.svg',
    period: '2024.12 ~ 현재',
    role: '도메인 단일화, 경로 라우팅, 세션 설계',
    stack: ['Istio', 'OAuth2 Proxy', 'Keycloak', 'JWT', 'Redis', 'Grafana'],
    results: [
      '하나의 도메인 아래 경로로 여러 Grafana 대시보드를 나눠 들어가게 했다.',
      '인증은 Keycloak에 맡기고 OAuth2 Proxy가 JWT를 붙여 뒤쪽 서비스로 넘긴다.',
      '세션은 Redis에 두어 파드가 늘어도 로그인이 유지되게 했다.',
      '인증에 실패하면 원래 가려던 주소로 다시 로그인을 태운다.',
    ],
    posts: [
      { href: '/blog/grafana-unified-dashboard-routing/', label: 'Grafana 링크 일원화와 접근 흐름' },
      { href: '/blog/grafana-dashboard-route-rules/', label: '특정 대시보드 라우팅 규칙' },
      { href: '/blog/grafana-oauth2-keycloak-auth/', label: 'OAuth2 Proxy·Keycloak 인증 구조' },
    ],
  },
  {
    title: 'Istio 컨트롤 플레인 중단 영향 분석',
    hue: 188,
    kind: '네트워크 · 장애 분석',
    logo: 'istio.svg',
    period: '2024.12 ~ 현재',
    role: 'istiod를 세우지 않은 상태에서 데이터 플레인이 어떻게 되는지 실측',
    stack: ['Istio', 'Envoy', 'Kubernetes'],
    results: [
      '이미 떠 있는 파드 사이 통신은 istiod가 없어도 그대로 유지됐다.',
      '사이드카 주입이 켜진 네임스페이스에서는 새 파드가 기동하지 못했다.',
      '새 Service 엔드포인트는 사이드카가 붙은 워크로드에서 도달하지 못했다.',
      '그래서 컨트롤 플레인을 재시작하는 순서와 점검 항목을 문서로 남겼다.',
    ],
  },
  {
    title: 'PaaS 구성 요소 검증과 패키징',
    hue: 265,
    kind: '플랫폼 · 검증',
    logo: 'helm.svg',
    period: '2024.12 ~ 현재',
    role: '인그레스 교체, 데이터·백업·GPU 구성 검증, 차트 패키징',
    stack: ['Helm', 'Istio Gateway', 'CloudNativePG', 'Redis', 'Harbor', 'Velero', 'GPU Operator', 'MIG'],
    results: [
      '인그레스를 nginx Ingress에서 Istio Gateway로 옮기고 라우팅 규칙을 다시 정리했다.',
      'CloudNativePG, Redis, Harbor를 고가용성으로 세우고 장애 시 승격을 확인했다.',
      'SeaweedFS와 Velero로 백업·복구 절차를 세우고 실제 복원까지 돌렸다.',
      'GPU Operator로 MIG를 쪼개 노드 한 대를 여러 워크로드가 나눠 쓰게 했다.',
    ],
    posts: [
      { href: '/blog/harbor-ha-cnpg-redis/', label: 'Harbor HA (CNPG·Redis)' },
    ],
  },
  {
    title: 'KT Cloud 멀티 클러스터 운영',
    hue: 46,
    kind: '운영 · 클라우드',
    logo: 'redhat.svg',
    period: '2022.09 ~ 2024.04',
    role: '클러스터 운영, 장애 대응, 구축 지원, 기술 지원',
    stack: ['OKD', 'Kubernetes', 'Prometheus', 'Thanos', 'Grafana', 'Zabbix', 'Ansible'],
    results: [
      'OKD와 Kubernetes 클러스터 약 30개, 가상 머신 약 1,400대를 운영했다.',
      '컨테이너 SLA를 80점대에서 90점대로 올렸고, 2023년 3분기 가용률은 100%였다.',
      '이슈 관리와 문서 현행화로 같은 장애의 복구 시간을 줄였다.',
      'OS·컨테이너·웹 계층의 보안 취약점을 진단하고 조치했다.',
    ],
  },
];

/** 개인·학부 프로젝트. 최신이 앞이다. */
export const personalProjects: Project[] = [
  {
    title: 'Kubernetes Hard Way HA 설치',
    hue: 205,
    kind: '직접 구축 · HA',
    logo: 'kubernetes.svg',
    period: '2024.07',
    role: 'kubeadm 없이 바이너리와 systemd로 6노드 클러스터를 세우고, 같은 절차를 파이썬으로 자동화',
    stack: [
      'Kubernetes v1.29.7',
      'etcd v3.5.17',
      'Cilium 1.15.4',
      'Helm v3.9.4',
      'Pacemaker / Corosync',
      'Docker',
      'Ubuntu 22.04.3',
    ],
    results: [
      'Bastion 1대, 컨트롤 플레인 3대, 워커 3대를 VMware vSphere 8 랩에 올렸다.',
      'OpenSSL로 CA와 클라이언트 인증서를 직접 만들고 kubeconfig까지 손으로 맞췄다.',
      'API 진입점은 Pacemaker의 IPaddr2 리소스로 VIP를 묶고, apiserver-count를 3으로 두었다.',
      '수동 절차 12장을 docs/에 남기고, 같은 순서를 파이썬 스크립트 16개와 Bastion 메뉴로 자동화했다.',
    ],
    repo: 'https://github.com/qkrtjswo03/K8s-Hardway-Installation',
  },
  {
    title: 'Kubespray로 3노드 클러스터 자동 구축',
    hue: 158,
    kind: '자동화 · 구축',
    logo: 'kubernetes.svg',
    period: '2022.05',
    role: 'KVM·Vagrant 노드에 Kubespray와 Ansible로 클러스터 구성',
    stack: ['Kubespray', 'Ansible', 'Vagrant', 'KVM', 'containerd'],
    results: [
      '노드 3대를 Vagrant로 띄우고 Kubespray Playbook 한 번으로 클러스터를 올렸다.',
      '같은 인벤토리로 다시 돌려도 결과가 같도록 변수를 정리했다.',
      '이후 Ansible 배포 실습의 대상 클러스터로 계속 썼다.',
    ],
  },
  {
    title: 'Ansible과 GitLab CI로 노드에 배포',
    hue: 12,
    kind: 'CI/CD',
    logo: 'ansible.svg',
    period: '2022.05',
    role: '푸시하면 배포되는 파이프라인 구성',
    stack: ['Ansible', 'GitLab Runner', 'Kubespray', 'httpd'],
    results: [
      'git push가 GitLab Runner에서 Ansible Playbook을 실행하게 했다.',
      'KVM 노드에 httpd와 페이지를 배포하고, 푸시마다 내용이 바뀌는 것을 확인했다.',
      'Runner 등록부터 배포까지의 절차를 README로 남겼다.',
    ],
  },
  {
    title: 'EPS 파일 공유 웹',
    hue: 36,
    kind: '클라우드 · 3계층',
    logo: 'aws.svg',
    period: '2022.03 ~ 2022.04',
    role: '파일 업로드·다운로드와 데이터베이스 설계·구현',
    stack: ['JSP', 'Tomcat', 'AWS VPC', 'EC2', 'ELB', 'RDS', 'S3'],
    results: [
      '웹, 데이터베이스, 스토리지를 AWS에 3계층으로 나눠 구성했다.',
      'AMI 복제, Sticky Session, Crontab으로 S3 백업을 붙였다.',
      '업로드·다운로드 기능과 스키마를 직접 설계하고 구현했다.',
    ],
  },
  {
    title: '스마트 멀티탭',
    hue: 174,
    kind: 'IoT · 해커톤',
    logo: 'arduino.svg',
    period: '2019.07 ~ 2019.11',
    role: '원격 전원 제어와 전력 측정, 클라우드 연동',
    stack: ['Arduino Uno', 'ESP8266', 'ACS712', 'C/C++', 'ThingSpeak', 'Blynk', 'MQTT'],
    results: [
      'ACS712로 전류를 재고 ESP8266으로 클라우드에 올렸다.',
      '원격 전원 제어와 예약, 데이터 모니터링, GPS를 한 화면에 묶었다.',
      'ThingSpeak와 Blynk를 한 흐름으로 이었다.',
    ],
  },
  {
    title: '스마트 냉장고 관리 앱',
    hue: 88,
    kind: '앱 · 캡스톤',
    logo: 'android.svg',
    period: '2019.06 ~ 2019.10',
    role: 'Android 앱과 서버, 데이터베이스 설계',
    stack: ['Java', 'Android Studio', 'PHP', 'Apache', 'MySQL', 'Kakao SDK', 'ZXing'],
    results: [
      '회원가입, 카카오 로그인, QR 코드 스캐너를 붙였다.',
      '유통기한과 재고를 다루는 스키마를 설계했다.',
      '냉장고 모형을 만들어 전시했다.',
    ],
  },
];
