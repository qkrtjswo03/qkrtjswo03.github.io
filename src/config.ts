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
  /**
   * AdSense 게시자 ID. 예: "ca-pub-1234567890123456".
   * 비우면 광고 스크립트, 수동 광고, ads.txt를 넣지 않습니다. 임의의 ID를 만들지 마세요.
   */
  adsensePublisherId: string;
  /**
   * 선택. 글 본문 아래 수동 광고 단위의 슬롯 숫자.
   * 비우면 수동 슬롯은 없고, 게시자 ID가 있을 때만 자동 광고 스크립트가 head에 들어갑니다.
   */
  adsenseInArticleSlot: string;
  /** 선택. 사이드바 광고 슬롯 숫자. */
  adsenseSidebarSlot: string;
  /** 예: "G-ABCD1234" */
  ga4MeasurementId: string;
  /** GoatCounter 사이트 코드(서브도메인만, 예: "sunjae"). 비우면 꺼집니다. */
  goatcounterCode: string;
  /**
   * Google Search Console HTML 태그 방식의 content 값만.
   * 비우면 확인 태그를 넣지 않는다. 임의의 코드를 만들지 않는다.
   */
  googleSiteVerification: string;
  /**
   * 네이버 서치어드바이저 HTML 태그 방식의 content 값만.
   * 비우면 확인 태그를 넣지 않는다. 임의의 코드를 만들지 않는다.
   */
  naverSiteVerification: string;
  giscus: GiscusConfig;
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
  // 여기에 AdSense에서 받은 ca-pub- 로 시작하는 게시자 ID만 넣습니다. 비어 있으면 광고를 넣지 않습니다.
  adsensePublisherId: '',
  adsenseInArticleSlot: '',
  adsenseSidebarSlot: '',
  ga4MeasurementId: '',
  goatcounterCode: 'sunjae',
  // 소유 확인 코드 자리. 받은 content 값만 넣고, 비어 있으면 태그를 만들지 않는다.
  // googleSiteVerification: '여기에_Google_Search_Console_content',
  // naverSiteVerification: '여기에_네이버_서치어드바이저_content',
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
};

export const nav = [
  { href: '/blog/', label: '글' },
  { href: '/projects/', label: '프로젝트' },
  { href: '/archive/', label: '아카이브' },
  { href: '/about/', label: '소개' },
] as const;

export const affiliateDisclosure =
  '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';
