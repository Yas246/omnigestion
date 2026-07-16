/**
 * Builds the DeepSeek messages for the " Analyse IA " report.
 * The data summary is rendered as a compact, human-readable block (cleaner for
 * the model than raw JSON) and the model is asked to reply with Markdown only.
 */
import type { DeepSeekMessage } from "./deepseek";
import type { ReportSummary } from "./report-data";

const nf = new Intl.NumberFormat("fr-FR");
const fmt = (n: number) => nf.format(Math.round(n || 0));

function dataBlock(s: ReportSummary): string {
  const lines: string[] = [];
  lines.push(
    `Période : ${s.periode.name} (${s.periode.debut} → ${s.periode.fin})`,
  );
  lines.push(`Devise : ${s.devise}`);
  lines.push("");
  lines.push("VENTES");
  lines.push(`- CA encaissé : ${fmt(s.ventes.caEncaisse)} ${s.devise}`);
  lines.push(`- Nombre de ventes : ${s.ventes.nbFactures}`);
  lines.push(`- Panier moyen : ${fmt(s.ventes.panierMoyen)} ${s.devise}`);
  if (s.ventes.repartitionPaiement.length) {
    lines.push(
      "- Répartition des encaissements : " +
        s.ventes.repartitionPaiement
          .map((p) => `${p.mode} ${fmt(p.montant)}`)
          .join(", "),
    );
  }
  if (s.ventes.topProduits.length) {
    lines.push(
      "- Top produits : " +
        s.ventes.topProduits
          .map((p) => `${p.nom} (${fmt(p.quantite)})`)
          .join(", "),
    );
  }
  if (s.ventes.topClients.length) {
    lines.push(
      "- Top clients : " +
        s.ventes.topClients.map((c) => `${c.nom} (${fmt(c.ca)})`).join(", "),
    );
  }
  lines.push("");
  lines.push("RENTABILITÉ");
  lines.push(`- CA vendu (HT) : ${fmt(s.rentabilite.caVente)} ${s.devise}`);
  lines.push(
    `- Coût des marchandises : ${fmt(s.rentabilite.coutTotal)} ${s.devise}`,
  );
  lines.push(`- Marge brute : ${fmt(s.rentabilite.margeTotale)} ${s.devise}`);
  lines.push(`- Taux de marge : ${s.rentabilite.tauxMarge.toFixed(1)} %`);
  lines.push("");
  lines.push("STOCK (instantané)");
  lines.push(`- Produits actifs : ${s.stock.nbProduitsActifs}`);
  lines.push(`- Valeur du stock : ${fmt(s.stock.valeurStock)} ${s.devise}`);
  lines.push(
    `- Ruptures : ${s.stock.ruptures} · Stock faible : ${s.stock.stockFaible}`,
  );
  lines.push("");
  lines.push("CRÉDITS CLIENTS (encours)");
  lines.push(
    `- Total restant dû : ${fmt(s.credits.totalRestantDu)} ${s.devise}`,
  );
  lines.push(`- Crédits ouverts : ${s.credits.nbCreditsActifs}`);
  lines.push("");
  lines.push("CAISSE");
  lines.push(`- Solde total : ${fmt(s.caisse.soldeTotal)} ${s.devise}`);
  lines.push(`- Entrées (période) : ${fmt(s.caisse.entrees)} ${s.devise}`);
  lines.push(`- Sorties (période) : ${fmt(s.caisse.sorties)} ${s.devise}`);
  return lines.join("\n");
}

export function buildReportMessages(summary: ReportSummary): DeepSeekMessage[] {
  const system =
    "Tu es un analyste financier senior qui aide un gérant de petite/moyenne entreprise (Afrique de l'Ouest, FCFA). " +
    "Tu reçois des indicateurs agrégés sur une période et tu rédiges un rapport de gestion clair, concret et actionnable. " +
    "Tu écris en français, au format Markdown uniquement. " +
    "Tu cites les chiffres précis (avec séparateur de milliers et la devise), tu mets en évidence ce qui compte, et tu évites tout remplissage ou formule passe-partout. " +
    "Si une donnée vaut 0 ou est absente, tu l'indiques sobrement sans inventer.";

  const user =
    `Voici les indicateurs de l'entreprise :\n\n${dataBlock(summary)}\n\n` +
    "Rédige le rapport en Markdown avec cette structure :\n" +
    "1. **Résumé exécutif** — 2 à 3 phrases qui synthétisent la période.\n" +
    "2. **Activité commerciale** — analyse du CA, du nombre de ventes, du panier moyen, des produits et clients qui se détachent, et des modes d’encaissement.\n" +
    "3. **Rentabilité** — marge brute, taux de marge, commentaire.\n" +
    "4. **Trésorerie & stock** — solde de caisse, flux de la période, valeur du stock, alertes (ruptures / stock faible).\n" +
    "5. **Crédits clients** — encours et risque éventuel.\n" +
    "6. **Points d’attention** — 2 à 4 points (au format liste).\n" +
    "7. **Recommandations** — 3 à 5 actions concrètes (au format liste).\n\n" +
    "Réponds UNIQUEMENT avec le rapport Markdown, sans texte avant ni après.";

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
