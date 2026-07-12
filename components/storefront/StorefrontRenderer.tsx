'use client';

import { allFontsClass } from './fonts';
import { MinimalTemplate } from './templates/MinimalTemplate';
import { BoutiqueTemplate } from './templates/BoutiqueTemplate';
import type {
  StorefrontCompany,
  StorefrontConfig,
  StorefrontProduct,
} from './types';

interface Props {
  company: StorefrontCompany;
  config: StorefrontConfig;
  products: StorefrontProduct[];
}

/**
 * Renders the merchant's storefront. Sets theme colors + the template's font
 * pairing as CSS variables on a wrapper, then picks the template. Used both by
 * the public /store/[slug] page AND the live preview in the builder (same
 * component → preview is faithful).
 */
export function StorefrontRenderer({ company, config, products }: Props) {
  const { primary, accent, background, text } = config.colors;
  const isBoutique = config.template === 'boutique';
  const fontDisplay = isBoutique ? 'var(--font-cormorant)' : 'var(--font-fraunces)';
  const fontBody = isBoutique ? 'var(--font-jost)' : 'var(--font-manrope)';

  const style = {
    '--store-primary': primary,
    '--store-accent': accent,
    '--store-bg': background,
    '--store-text': text,
    '--store-font-display': fontDisplay,
    '--store-font-body': fontBody,
    backgroundColor: background,
    color: text,
    fontFamily: fontBody,
  } as React.CSSProperties;

  const Template = isBoutique ? BoutiqueTemplate : MinimalTemplate;

  return (
    <div style={style} className={`${allFontsClass} min-h-screen antialiased`}>
      <Template company={company} config={config} products={products} />
    </div>
  );
}
