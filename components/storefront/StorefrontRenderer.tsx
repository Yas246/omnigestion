'use client';

import { allFontsClass } from './fonts';
import { resolveFonts } from './font-pairs';
import { MinimalTemplate } from './templates/MinimalTemplate';
import { BoutiqueTemplate } from './templates/BoutiqueTemplate';
import { MarcheTemplate } from './templates/MarcheTemplate';
import { StudioTemplate } from './templates/StudioTemplate';
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
 * Renders the merchant's storefront. Sets theme colors + the resolved font
 * pairing as CSS variables on a wrapper, then picks the template. Used both by
 * the public /store/[slug] page AND the live preview in the builder (same
 * component → preview is faithful).
 */
export function StorefrontRenderer({ company, config, products }: Props) {
  const { primary, accent, background, text } = config.colors;
  const isBoutique = config.template === 'boutique';
  const isMarche = config.template === 'marche';
  const isStudio = config.template === 'studio';

  const pair = resolveFonts(config);

  const style = {
    '--store-primary': primary,
    '--store-accent': accent,
    '--store-bg': background,
    '--store-text': text,
    '--store-font-display': pair.display,
    '--store-font-body': pair.body,
    backgroundColor: background,
    color: text,
    fontFamily: pair.body,
  } as React.CSSProperties;

  const Template = isBoutique ? BoutiqueTemplate : isMarche ? MarcheTemplate : isStudio ? StudioTemplate : MinimalTemplate;

  return (
    <div style={style} className={`${allFontsClass} min-h-screen antialiased`}>
      <Template company={company} config={config} products={products} />
    </div>
  );
}
