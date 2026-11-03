import { affiliateDisclosure } from '../config';

export function affiliateHtml(): string {
  return `<aside class="affiliate" role="note"><p>${affiliateDisclosure}</p></aside>`;
}
