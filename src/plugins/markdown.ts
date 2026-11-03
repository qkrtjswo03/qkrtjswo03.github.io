import { inArticleAdHtml } from '../lib/ads';
import { affiliateHtml } from '../lib/affiliate';

type ParentNode = { type?: string } | undefined;

type PluginContext = {
  textContent: (node: unknown) => string;
  parent: (node: unknown) => ParentNode;
  data: Record<string, unknown>;
  insertAfter: (node: unknown, content: { raw: string; mdxExpressions: false }) => void;
};

function isTopLevel(node: unknown, context: PluginContext): boolean {
  return context.parent(node)?.type === 'root';
}

export const markdownPlugins = [
  {
    name: 'affiliate-disclosure',
    paragraph(node: unknown, context: PluginContext) {
      if (!isTopLevel(node, context)) return;
      if (context.textContent(node).trim() !== '::affiliate') return;
      return { raw: affiliateHtml(), mdxExpressions: false as const };
    },
  },
  {
    name: 'in-article-ad',
    paragraph(node: unknown, context: PluginContext) {
      if (context.data.inArticleAdInserted) return;
      if (!isTopLevel(node, context)) return;
      if (context.textContent(node).trim() === '::affiliate') return;
      const html = inArticleAdHtml();
      if (!html) return;
      context.data.inArticleAdInserted = true;
      context.insertAfter(node, { raw: html, mdxExpressions: false });
    },
  },
];
