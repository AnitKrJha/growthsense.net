/**
 * Common TDS sections for FY 2025-26 (Income-tax Act, 1961), residents unless stated.
 *
 * STATUS: UNVERIFIED. Compiled without internet access on 26 Sep 2026 from memory of the Finance Acts
 * 2024 and 2025. Check every rate and threshold against incometax.gov.in (TDS rates chart) and the Finance
 * Act before relying on it. Surcharge and cess are not included (they apply mainly to salary and s.195).
 *
 * From 1 Apr 2026 the Income-tax Act, 2025 applies and TDS section numbers change (it reportedly moves most
 * TDS into table-based provisions). `newActRef` is TODO(verify) for every row.
 */

export type TdsCategory = 'salary' | 'interest' | 'contract-fees' | 'rent-property' | 'winnings' | 'other' | 'non-resident';

export interface TdsRow {
  /** Unique key, e.g. "194I(b)". */
  section: string;
  nature: string;
  category: TdsCategory;
  /** Human-readable threshold. */
  threshold: string;
  /** Rate in percent for individual/HUF payees. null = variable (see rateText). */
  rateIndividual: number | null;
  /** Rate in percent for other payees (firms, companies, etc.). null = variable. */
  rateOthers: number | null;
  /** Shown instead of / next to the numeric rates. */
  rateText?: string;
  /** Rate if the payee has no PAN (s.206AA), as display text. */
  noPan: string;
  /** TDS is charged only on the amount above this (e.g. 194Q, 194N). */
  onExcessOver?: number;
  /** Extra notes: Form 15G/15H, conditions, etc. */
  note?: string;
  /** Income-tax Act, 2025 equivalent. */
  newActRef: string;
  /** Extra search terms. */
  keywords?: string;
}

export const tdsMeta = {
  status: 'unverified' as const,
  financialYear: 'FY 2025-26',
  checkedOn: '2026-09-26',
  source: 'https://www.incometax.gov.in',
  note:
    'Unverified. Rates and thresholds for FY 2025-26 under the Income-tax Act, 1961. Section numbers change under the Income-tax Act, 2025 from 1 April 2026.',
  noPanRule:
    'No PAN (s.206AA): TDS at the higher of the normal rate or 20% (5% for 194O and 194Q). The higher rate for non-filers (s.206AB) was reportedly removed from 1 Apr 2025. VERIFY.',
};

const NEW_ACT_TODO = 'TODO(verify)';
const NO_PAN_20 = 'Higher of normal rate or 20%';

export const tdsCategories: Record<TdsCategory, string> = {
  salary: 'Salary',
  interest: 'Interest & dividend',
  'contract-fees': 'Contracts, fees & commission',
  'rent-property': 'Rent & property',
  winnings: 'Winnings',
  other: 'Other',
  'non-resident': 'Non-residents',
};

export const tdsRows: readonly TdsRow[] = [
  {
    section: '192',
    nature: 'Salary',
    category: 'salary',
    threshold: 'When estimated taxable salary exceeds the basic exemption limit of the chosen regime',
    rateIndividual: null,
    rateOthers: null,
    rateText: 'Slab rates (average rate for the year)',
    noPan: 'Higher of average rate or 20%',
    newActRef: NEW_ACT_TODO,
    keywords: 'employer employee pay',
  },
  {
    section: '193',
    nature: 'Interest on securities (debentures, bonds)',
    category: 'interest',
    threshold: '₹10,000 a year for certain debentures paid to resident individuals/HUF (VERIFY)',
    rateIndividual: 10,
    rateOthers: 10,
    noPan: NO_PAN_20,
    note: 'Form 15G/15H may apply.',
    newActRef: NEW_ACT_TODO,
    keywords: 'bond debenture',
  },
  {
    section: '194',
    nature: 'Dividend',
    category: 'interest',
    threshold: '₹10,000 a year per shareholder',
    rateIndividual: 10,
    rateOthers: 10,
    noPan: NO_PAN_20,
    note: 'Form 15G/15H may apply.',
    newActRef: NEW_ACT_TODO,
    keywords: 'shares dividend',
  },
  {
    section: '194A',
    nature: 'Interest other than on securities (FD, RD, deposits, loans)',
    category: 'interest',
    threshold:
      'Bank, co-op bank, post office: ₹50,000 a year (₹1,00,000 for senior citizens). Others: ₹10,000 a year',
    rateIndividual: 10,
    rateOthers: 10,
    noPan: NO_PAN_20,
    note: 'Form 15G/15H may apply.',
    newActRef: NEW_ACT_TODO,
    keywords: 'fixed deposit fd rd bank interest',
  },
  {
    section: '194B',
    nature: 'Winnings from lottery, crossword puzzle, card games, etc.',
    category: 'winnings',
    threshold: 'More than ₹10,000 in a single transaction',
    rateIndividual: 30,
    rateOthers: 30,
    noPan: '30%',
    note: 'Online games are covered by 194BA (30%, no threshold).',
    newActRef: NEW_ACT_TODO,
    keywords: 'lottery game prize',
  },
  {
    section: '194C',
    nature: 'Payments to contractors and sub-contractors',
    category: 'contract-fees',
    threshold: '₹30,000 single payment or ₹1,00,000 total in the year',
    rateIndividual: 1,
    rateOthers: 2,
    noPan: NO_PAN_20,
    note: 'Transporters owning up to 10 goods carriages who give PAN and a declaration: nil.',
    newActRef: NEW_ACT_TODO,
    keywords: 'contract work labour transport advertising',
  },
  {
    section: '194D',
    nature: 'Insurance commission',
    category: 'contract-fees',
    threshold: '₹20,000 a year',
    rateIndividual: 2,
    rateOthers: 2,
    rateText: '2% (payees other than companies), 10% (companies)',
    noPan: NO_PAN_20,
    newActRef: NEW_ACT_TODO,
    keywords: 'insurance agent commission',
  },
  {
    section: '194H',
    nature: 'Commission or brokerage',
    category: 'contract-fees',
    threshold: '₹20,000 a year',
    rateIndividual: 2,
    rateOthers: 2,
    noPan: NO_PAN_20,
    newActRef: NEW_ACT_TODO,
    keywords: 'broker agent commission',
  },
  {
    section: '194I(a)',
    nature: 'Rent for plant, machinery or equipment',
    category: 'rent-property',
    threshold: '₹50,000 a month or part of a month',
    rateIndividual: 2,
    rateOthers: 2,
    noPan: NO_PAN_20,
    newActRef: NEW_ACT_TODO,
    keywords: 'rent machinery equipment hire',
  },
  {
    section: '194I(b)',
    nature: 'Rent for land, building or furniture',
    category: 'rent-property',
    threshold: '₹50,000 a month or part of a month',
    rateIndividual: 10,
    rateOthers: 10,
    noPan: NO_PAN_20,
    newActRef: NEW_ACT_TODO,
    keywords: 'rent office shop building land furniture',
  },
  {
    section: '194IA',
    nature: 'Purchase of immovable property (other than agricultural land)',
    category: 'rent-property',
    threshold: 'Consideration (or stamp duty value) of ₹50 lakh or more',
    rateIndividual: 1,
    rateOthers: 1,
    noPan: NO_PAN_20,
    note: 'Buyer deducts on the full consideration and files Form 26QB.',
    newActRef: NEW_ACT_TODO,
    keywords: 'property flat house land purchase buy 26qb',
  },
  {
    section: '194IB',
    nature: 'Rent paid by individuals/HUF not covered by 194I (no tax audit)',
    category: 'rent-property',
    threshold: '₹50,000 a month or part of a month',
    rateIndividual: 2,
    rateOthers: 2,
    noPan: NO_PAN_20,
    note: 'Deducted once a year (or at the end of tenancy) and filed in Form 26QC.',
    newActRef: NEW_ACT_TODO,
    keywords: 'house rent tenant landlord 26qc',
  },
  {
    section: '194J(a)',
    nature: 'Fees for technical services, call centre, certain film royalty',
    category: 'contract-fees',
    threshold: '₹50,000 a year',
    rateIndividual: 2,
    rateOthers: 2,
    noPan: NO_PAN_20,
    newActRef: NEW_ACT_TODO,
    keywords: 'technical services fts',
  },
  {
    section: '194J(b)',
    nature: 'Professional fees, other royalty, non-compete fees, director fees',
    category: 'contract-fees',
    threshold: '₹50,000 a year (no threshold for director fees)',
    rateIndividual: 10,
    rateOthers: 10,
    noPan: NO_PAN_20,
    newActRef: NEW_ACT_TODO,
    keywords: 'professional fees consultant doctor lawyer royalty director',
  },
  {
    section: '194N',
    nature: 'Cash withdrawal from bank, co-op bank or post office',
    category: 'other',
    threshold:
      'Above ₹1 crore a year (₹3 crore for co-operative societies). Lower limit of ₹20 lakh if no ITR filed for the last 3 years',
    rateIndividual: 2,
    rateOthers: 2,
    rateText: '2% above the limit (5% above ₹1 crore for non-filers)',
    noPan: NO_PAN_20,
    onExcessOver: 10000000,
    newActRef: NEW_ACT_TODO,
    keywords: 'cash withdrawal bank',
  },
  {
    section: '194O',
    nature: 'E-commerce operator paying e-commerce participants',
    category: 'other',
    threshold: 'No TDS for individual/HUF sellers with PAN/Aadhaar up to ₹5 lakh a year',
    rateIndividual: 0.1,
    rateOthers: 0.1,
    noPan: '5%',
    newActRef: NEW_ACT_TODO,
    keywords: 'ecommerce amazon flipkart seller marketplace',
  },
  {
    section: '194Q',
    nature: 'Purchase of goods (buyer turnover above ₹10 crore)',
    category: 'other',
    threshold: 'On purchases from one seller above ₹50 lakh a year',
    rateIndividual: 0.1,
    rateOthers: 0.1,
    noPan: '5%',
    onExcessOver: 5000000,
    newActRef: NEW_ACT_TODO,
    keywords: 'purchase goods buyer',
  },
  {
    section: '194S',
    nature: 'Transfer of virtual digital assets (crypto)',
    category: 'other',
    threshold: '₹50,000 a year for specified persons, ₹10,000 for others',
    rateIndividual: 1,
    rateOthers: 1,
    noPan: NO_PAN_20,
    newActRef: NEW_ACT_TODO,
    keywords: 'crypto vda bitcoin nft',
  },
  {
    section: '194T',
    nature: 'Salary, commission, interest, etc. paid by a firm to its partners',
    category: 'contract-fees',
    threshold: '₹20,000 a year',
    rateIndividual: 10,
    rateOthers: 10,
    noPan: NO_PAN_20,
    note: 'New from 1 Apr 2025. VERIFY.',
    newActRef: NEW_ACT_TODO,
    keywords: 'partner firm remuneration',
  },
  {
    section: '195',
    nature: 'Payments to non-residents (interest, royalty, fees, other sums)',
    category: 'non-resident',
    threshold: 'No threshold',
    rateIndividual: null,
    rateOthers: null,
    rateText: 'Rates in force under the Act or the tax treaty (DTAA), whichever is lower, plus surcharge and cess',
    noPan: 'Higher of normal rate or 20%, with exceptions if the non-resident gives specified documents',
    note: 'Treaty rate needs a Tax Residency Certificate and Form 10F. Forms 15CA/15CB may apply.',
    newActRef: NEW_ACT_TODO,
    keywords: 'nri foreign non resident dtaa remittance',
  },
];
