/**
 * 사이트 설정입니다. 값을 고친 뒤 main 브랜치에 푸시하면 다시 배포됩니다.
 * 광고, 접속 통계, 댓글, 사이트 소유 확인은 비어 있으면 페이지에 넣지 않습니다.
 */
export interface GiscusConfig {
  enabled: boolean;
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
  lang: string;
}

export interface SiteConfig {
  title: string;
  description: string;
  tagline: string;
  url: string;
  author: string;
  email: string[];
  lang: string;
  locale: string;
  /** 예: "ca-pub-1234567890123456". 비우면 광고 스크립트와 광고 영역을 넣지 않습니다. */
  adsensePublisherId: string;
  /** 선택. AdSense에서 만든 인피드/인아티클 슬롯 숫자. 비워도 게시자 ID만으로 영역은 켜집니다. */
  adsenseInArticleSlot: string;
  /** 선택. 사이드바 광고 슬롯 숫자. */
  adsenseSidebarSlot: string;
  /** 예: "G-ABCD1234" */
  ga4MeasurementId: string;
  /** GoatCounter 사이트 코드(서브도메인만, 예: "sunjae"). 비우면 꺼집니다. */
  goatcounterCode: string;
  /** Google Search Console에서 받은 content 값 */
  googleSiteVerification: string;
  /** 네이버 서치어드바이저에서 받은 content 값 */
  naverSiteVerification: string;
  giscus: GiscusConfig;
  /** 잠긴 글 공통 비밀번호 SHA-256 hex. 비우면 잠금 UI만 막힘. */
  postUnlockPasswordHash: string;
}

export const site: SiteConfig = {
  title: 'SunJae.Log',
  description:
    'Kubernetes, 관측 가능성, 장애 원인 분석, LLM 운영을 다루는 한국어 기술 블로그입니다.',
  tagline: '클라우드, 인프라, AI 운영을 기록합니다.',
  url: 'https://qkrtjswo03.github.io',
  author: 'qkrtjswo03',
  email: ['xodids0341@gmail.com', 'qkrtjswo03@naver.com'],
  lang: 'ko',
  locale: 'ko_KR',
  adsensePublisherId: '',
  adsenseInArticleSlot: '',
  adsenseSidebarSlot: '',
  ga4MeasurementId: '',
  goatcounterCode: 'sunjae',
  googleSiteVerification: '',
  naverSiteVerification: '',
  giscus: {
    enabled: false,
    repo: '',
    repoId: '',
    category: '',
    categoryId: '',
    lang: 'ko',
  },
  // SHA-256 of the shared unlock password (not the password itself)
  postUnlockPasswordHash: 'fa7835fc1c74a9e014c750a4f452b56f215702a9802d386a0560e5099da94fbb',
};

export const nav = [
  { href: '/blog/', label: '글' },
  { href: '/projects/', label: '프로젝트' },
  { href: '/archive/', label: '아카이브' },
  { href: '/about/', label: '소개' },
] as const;

export const affiliateDisclosure =
  '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';
