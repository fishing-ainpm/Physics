import katex from 'katex';
import { useMemo } from 'react';

/** Renderiza LaTeX com KaTeX (erros de sintaxe aparecem em vermelho, sem quebrar a página). */
export function Tex({ tex, display = false, className }: { tex: string; display?: boolean; className?: string }) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' }),
    [tex, display],
  );
  const Tag = display ? 'div' : 'span';
  return <Tag className={display ? `tex-block ${className ?? ''}` : className} dangerouslySetInnerHTML={{ __html: html }} />;
}
