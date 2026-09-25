/**
 * File-cabinet codes for each service: `code` is the short form used on paper artefacts
 * (meta lines, checklists), `tab` is the label shown on a folder tab or ledger row.
 */
export const serviceCodes: Record<string, { code: string; tab: string }> = {
  'income-tax-return-filing': { code: 'ITR', tab: 'ITR' },
  'gst-registration-and-returns': { code: 'GST', tab: 'GST' },
  tds: { code: 'TDS', tab: 'TDS' },
  'challan-payments': { code: 'CHL', tab: 'Challans' },
  financing: { code: 'FIN', tab: 'Finance' },
};

export const codeFor = (slug: string) => serviceCodes[slug] ?? { code: slug.slice(0, 3).toUpperCase(), tab: slug };

/** Two-digit folio number, e.g. 1 → "01". */
export const folio = (n: number) => String(n).padStart(2, '0');
