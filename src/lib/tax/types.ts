/**
 * Types for the income-tax engine. Pure data, no UI or DOM imports.
 *
 * Scope: resident individuals only (no HUF, no non-residents). Figures come from versioned rules files
 * in ./rules; nothing here hard-codes a rate or limit.
 */

export type Regime = 'new' | 'old';
export type AgeBracket = 'below60' | '60to79' | '80plus';
export type TaxAct = '1961' | '2025';
export type YearId = 'fy2025-26' | 'ty2026-27';

/** One slab. `upTo` is the inclusive upper bound of the slab; `null` means no upper bound. */
export interface Slab {
  upTo: number | null;
  rate: number;
}

/** Surcharge applies at `rate` when total income exceeds `above`. */
export interface SurchargeTier {
  above: number;
  rate: number;
}

export interface RegimeRules {
  /** Slabs by age. The new regime uses the same slabs for every age. */
  slabs: Record<AgeBracket, Slab[]>;
  /** Standard deduction from salary. */
  standardDeduction: number;
  /** Family pension deduction: the lower of `fraction` × pension and `cap`. */
  familyPension: { fraction: number; cap: number };
  rebate: {
    /** Rebate applies when total income (including special-rate income) does not exceed this. */
    incomeLimit: number;
    maxRebate: number;
    /** New regime only: tax cannot exceed the income above `incomeLimit`. */
    marginalRelief: boolean;
    /** Tax on these special-rate incomes cannot be reduced by the rebate. */
    notAgainst: SpecialKind[];
  };
  surcharge: SurchargeTier[];
  /** Employer NPS contribution cap as a fraction of basic + DA (80CCD(2)). */
  employerNpsPct: number;
  /** Which old-style exemptions and deductions this regime allows. */
  allows: {
    hraExemption: boolean;
    selfOccupiedInterest: boolean;
    chapterVIA: boolean;
  };
}

export type SpecialKind = '111A' | '112A';

export type SectionKey =
  | 'standardDeduction'
  | 'hra'
  | 'houseProperty'
  | 'selfOccupiedInterest'
  | 'familyPension'
  | 'c80'
  | 'ccd1b'
  | 'ccd2'
  | 'd80'
  | 'tta'
  | 'ttb'
  | 'rebate'
  | 'stcg'
  | 'ltcg'
  | 'roundIncome'
  | 'roundTax'
  | 'newRegime';

export interface TaxRules {
  id: YearId;
  /** e.g. "FY 2025-26 (AY 2026-27)" or "Tax Year 2026-27". */
  label: string;
  /** Short form for compact UI, e.g. "FY 2025-26". */
  shortLabel: string;
  act: TaxAct;
  /** Section references shown in the UI. Under the 2025 Act these are old-Act references until verified. */
  sectionLabels: Record<SectionKey, string>;
  verified: { status: 'unverified' | 'verified'; note: string; date: string | null };
  regimes: Record<Regime, RegimeRules>;
  special: {
    stcg111ARate: number;
    ltcg112ARate: number;
    ltcg112AExemption: number;
    /** Maximum surcharge rate on tax on 111A / 112A gains and dividends. */
    surchargeCap: number;
  };
  cessRate: number;
  /** Old-regime deduction caps (Chapter VI-A and house property). */
  caps: {
    c80: number;
    ccd1b: number;
    d80SelfBelow60: number;
    d80SelfSenior: number;
    d80ParentsBelow60: number;
    d80ParentsSenior: number;
    tta: number;
    ttb: number;
    selfOccupiedInterest: number;
    /** Standard deduction on let-out house property as a fraction of net annual value (s.24(a)). */
    houseStandardDeductionPct: number;
  };
  /** Nearest multiple used for rounding total income (288A) and tax (288B). */
  rounding: { income: number; tax: number };
}

/** All amounts are annual, in rupees. Omitted fields count as 0. */
export interface TaxInput {
  /** Defaults to 'new' (the default regime). */
  regime?: Regime;
  age: AgeBracket;
  /** Gross salary (including taxable allowances, before HRA exemption and standard deduction). */
  salary?: number;
  /** Basic + DA, used only for the employer NPS cap. Defaults to `salary`. */
  basicPlusDA?: number;
  familyPension?: number;
  savingsInterest?: number;
  /** FD, RD and other deposit interest. */
  depositInterest?: number;
  dividends?: number;
  /** Any other income taxed at slab rates. */
  otherIncome?: number;
  /** Net annual value of a let-out property (rent received less municipal taxes). */
  rentalIncome?: number;
  stcg111A?: number;
  ltcg112A?: number;

  /** Old-regime items (ignored in the new regime unless noted). */
  hraExemption?: number;
  /** Home-loan interest on a self-occupied house (24(b)). */
  homeLoanInterest?: number;
  c80?: number;
  ccd1b?: number;
  d80Self?: number;
  d80Parents?: number;
  parentsSenior?: boolean;
  /** Employer NPS contribution (80CCD(2)); allowed in both regimes with different caps. */
  employerNps?: number;
}

export type LineKind = 'heading' | 'item' | 'less' | 'subtotal' | 'total';

/** A row of the itemised breakdown, ready to render. `amount` is unrounded rupees unless noted. */
export interface BreakdownLine {
  key: string;
  label: string;
  amount: number;
  kind: LineKind;
  note?: string;
}

export interface DeductionItem {
  key: SectionKey | 'd80Self' | 'd80Parents';
  label: string;
  claimed: number;
  /** null = no fixed cap. */
  cap: number | null;
  allowed: number;
  note?: string;
}

export interface SlabLine {
  from: number;
  to: number | null;
  rate: number;
  taxable: number;
  tax: number;
}

export interface SpecialLine {
  kind: SpecialKind;
  label: string;
  income: number;
  basicExemptionSetOff: number;
  exemption: number;
  taxable: number;
  rate: number;
  tax: number;
}

export interface TaxBreakdown {
  regime: Regime;
  yearId: YearId;
  income: {
    salaryGross: number;
    hraExemption: number;
    standardDeduction: number;
    salaryNet: number;
    rentalNav: number;
    houseStandardDeduction: number;
    selfOccupiedInterest: number;
    houseProperty: number;
    otherSources: number;
    familyPensionDeduction: number;
    stcg111A: number;
    ltcg112A: number;
    /** Gross total income (normal heads, after set-off, plus special-rate gains). */
    grossTotal: number;
  };
  deductions: DeductionItem[];
  totalDeductions: number;
  /** Total income before 288A rounding. */
  totalIncomeUnrounded: number;
  /** Total income after 288A rounding. */
  totalIncome: number;
  /** Portion of total income taxed at slab rates. */
  normalIncome: number;
  /** Portion taxed at special rates (111A + 112A, before exemption). */
  specialIncome: number;
  slabLines: SlabLine[];
  slabTax: number;
  specialLines: SpecialLine[];
  specialTax: number;
  taxBeforeRebate: number;
  rebate: number;
  rebateMarginalRelief: number;
  taxAfterRebate: number;
  surcharge: { rate: number; gross: number; marginalRelief: number; net: number };
  cess: number;
  /** Tax + surcharge + cess before 288B rounding. */
  totalTaxUnrounded: number;
  /** Final tax payable after 288B rounding. */
  totalTax: number;
  /** totalTax / grossTotal, 0 when no income. */
  effectiveRate: number;
  lines: BreakdownLine[];
  notes: string[];
}

export interface RegimeComparison {
  old: TaxBreakdown;
  new: TaxBreakdown;
  better: Regime | 'equal';
  /** Absolute difference in final tax. */
  saving: number;
}
