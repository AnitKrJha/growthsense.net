import { formatINR } from '../format';
import { pos, roundIncome, roundTax } from './rounding';
import type {
  AgeBracket,
  BreakdownLine,
  DeductionItem,
  Regime,
  RegimeComparison,
  RegimeRules,
  Slab,
  SlabLine,
  SpecialLine,
  TaxBreakdown,
  TaxInput,
  TaxRules,
} from './types';

/*
 * Income-tax engine for resident individuals.
 *
 * Order of computation:
 *   1. Income by head (salary, house property, other sources) and special-rate gains (111A, 112A).
 *   2. Deductions (Chapter VI-A in the old regime, 80CCD(2) in both), capped at normal-rate income.
 *   3. Total income rounded to ₹10 (288A).
 *   4. Slab tax on normal income; unused basic exemption set off against 111A, then 112A gains.
 *   5. 87A rebate (+ new-regime marginal relief), surcharge (+ marginal relief), 4% cess.
 *   6. Tax rounded to ₹10 (288B).
 *
 * Amounts are carried unrounded between steps; only total income and final tax are rounded.
 */

const pct = (r: number) => `${+(r * 100).toFixed(2)}%`;
const isSenior = (age: AgeBracket) => age !== 'below60';

/** Slab-wise tax on `income`. Returns every slab up to the one containing the income. */
export function slabTax(income: number, slabs: Slab[]): { lines: SlabLine[]; tax: number } {
  const lines: SlabLine[] = [];
  let from = 0;
  let tax = 0;
  for (const s of slabs) {
    const to = s.upTo;
    const top = to ?? Infinity;
    const taxable = Math.max(0, Math.min(income, top) - from);
    if (taxable <= 0 && lines.length > 0) break;
    const t = taxable * s.rate;
    lines.push({ from, to, rate: s.rate, taxable, tax: t });
    tax += t;
    if (income <= top) break;
    from = top;
  }
  return { lines, tax };
}

/** Portions of total income, after deductions and 288A rounding. `dividend` is included in `normal`. */
interface Composition {
  normal: number;
  dividend: number;
  stcg: number;
  ltcg: number;
}

interface Core {
  totalIncome: number;
  slabLines: SlabLine[];
  slabTax: number;
  specialLines: SpecialLine[];
  specialTax: number;
  taxBeforeRebate: number;
  rebate: number;
  rebateMarginalRelief: number;
  taxAfterRebate: number;
  surchargeRate: number;
  surchargeGross: number;
  surchargeRelief: number;
  surchargeNet: number;
}

function core(c: Composition, rules: TaxRules, r: RegimeRules, age: AgeBracket): Core {
  const slabs = r.slabs[age];
  const totalIncome = c.normal + c.stcg + c.ltcg;
  const { lines: slabLines, tax: normalTax } = slabTax(c.normal, slabs);

  // Unused basic exemption (the nil slab) reduces special-rate gains for residents: 111A first (higher rate).
  const basicExemption = slabs[0] && slabs[0].rate === 0 ? (slabs[0].upTo ?? 0) : 0;
  let unused = Math.max(0, basicExemption - c.normal);
  const setOff111A = Math.min(unused, c.stcg);
  unused -= setOff111A;
  const setOff112A = Math.min(unused, c.ltcg);
  const stcgTaxable = c.stcg - setOff111A;
  const ltcgAfterSetOff = c.ltcg - setOff112A;
  const ltcgExemption = Math.min(ltcgAfterSetOff, rules.special.ltcg112AExemption);
  const ltcgTaxable = ltcgAfterSetOff - ltcgExemption;
  const stcgTax = stcgTaxable * rules.special.stcg111ARate;
  const ltcgTax = ltcgTaxable * rules.special.ltcg112ARate;

  const specialLines: SpecialLine[] = [];
  if (c.stcg > 0) {
    specialLines.push({
      kind: '111A',
      label: `Short-term capital gains (${rules.sectionLabels.stcg})`,
      income: c.stcg,
      basicExemptionSetOff: setOff111A,
      exemption: 0,
      taxable: stcgTaxable,
      rate: rules.special.stcg111ARate,
      tax: stcgTax,
    });
  }
  if (c.ltcg > 0) {
    specialLines.push({
      kind: '112A',
      label: `Long-term capital gains (${rules.sectionLabels.ltcg})`,
      income: c.ltcg,
      basicExemptionSetOff: setOff112A,
      exemption: ltcgExemption,
      taxable: ltcgTaxable,
      rate: rules.special.ltcg112ARate,
      tax: ltcgTax,
    });
  }
  const specialTax = stcgTax + ltcgTax;
  const taxBeforeRebate = normalTax + specialTax;

  // 87A rebate: eligibility tested on total income (special-rate gains included); amount limited to tax
  // on the incomes the rebate may be set against.
  const rb = r.rebate;
  const rebatable =
    normalTax + (rb.notAgainst.includes('111A') ? 0 : stcgTax) + (rb.notAgainst.includes('112A') ? 0 : ltcgTax);
  let rebate = 0;
  let rebateMarginalRelief = 0;
  if (totalIncome <= rb.incomeLimit) {
    rebate = Math.min(rebatable, rb.maxRebate);
  } else if (rb.marginalRelief) {
    // VERIFY: relief caps the rebatable tax at the income above the limit; special-rate tax stays payable.
    rebateMarginalRelief = Math.max(0, rebatable - (totalIncome - rb.incomeLimit));
  }
  const taxAfterRebate = taxBeforeRebate - rebate - rebateMarginalRelief;

  // Surcharge. Tax on 111A / 112A gains and on dividends is surcharged at no more than the cap (15%).
  let tier = null as (typeof r.surcharge)[number] | null;
  for (const t of r.surcharge) if (totalIncome > t.above) tier = t;
  const surchargeRate = tier?.rate ?? 0;
  let surchargeGross = 0;
  let surchargeRelief = 0;
  if (tier) {
    const dividendTax = c.dividend > 0 ? normalTax - slabTax(c.normal - c.dividend, slabs).tax : 0;
    const cappedBase = Math.min(taxAfterRebate, dividendTax + specialTax);
    const cappedRate = Math.min(surchargeRate, rules.special.surchargeCap);
    surchargeGross = (taxAfterRebate - cappedBase) * surchargeRate + cappedBase * cappedRate;

    // Marginal relief: tax + surcharge may exceed the tax + surcharge at the threshold by no more than the
    // income above the threshold. Income is trimmed from normal (non-dividend) income first.
    const excess = totalIncome - tier.above;
    const atThreshold = core(trim(c, excess), rules, r, age);
    const cap = atThreshold.taxAfterRebate + atThreshold.surchargeNet + excess;
    surchargeRelief = Math.min(surchargeGross, Math.max(0, taxAfterRebate + surchargeGross - cap));
  }
  return {
    totalIncome,
    slabLines,
    slabTax: normalTax,
    specialLines,
    specialTax,
    taxBeforeRebate,
    rebate,
    rebateMarginalRelief,
    taxAfterRebate,
    surchargeRate,
    surchargeGross,
    surchargeRelief,
    surchargeNet: surchargeGross - surchargeRelief,
  };
}

/** Removes `amount` of income: other normal income first, then dividends, then 112A, then 111A. */
function trim(c: Composition, amount: number): Composition {
  let left = amount;
  const take = (v: number) => {
    const t = Math.min(v, left);
    left -= t;
    return v - t;
  };
  const otherNormal = take(c.normal - c.dividend);
  const dividend = take(c.dividend);
  const ltcg = take(c.ltcg);
  const stcg = take(c.stcg);
  return { normal: otherNormal + dividend, dividend, stcg, ltcg };
}

/** Full, itemised computation for one regime (`input.regime`, default 'new'). */
export function computeTax(input: TaxInput, rules: TaxRules): TaxBreakdown {
  const regime: Regime = input.regime ?? 'new';
  const r = rules.regimes[regime];
  const L = rules.sectionLabels;
  const caps = rules.caps;
  const age = input.age;
  const senior = isSenior(age);
  const notes: string[] = [];

  // ---- Salary
  const salaryGross = pos(input.salary);
  const hraExemption = r.allows.hraExemption ? Math.min(pos(input.hraExemption), salaryGross) : 0;
  const standardDeduction = Math.min(salaryGross - hraExemption, r.standardDeduction);
  const salaryNet = salaryGross - hraExemption - standardDeduction;
  if (!r.allows.hraExemption && pos(input.hraExemption) > 0) notes.push('HRA exemption is not available in the new regime.');

  // ---- House property (one let-out property as net annual value, plus self-occupied home-loan interest)
  const rentalNav = pos(input.rentalIncome);
  const houseStandardDeduction = rentalNav * caps.houseStandardDeductionPct;
  const interestClaimed = pos(input.homeLoanInterest);
  const selfOccupiedInterest = r.allows.selfOccupiedInterest ? Math.min(interestClaimed, caps.selfOccupiedInterest) : 0;
  if (!r.allows.selfOccupiedInterest && interestClaimed > 0) {
    notes.push('Home-loan interest on a self-occupied house is not deductible in the new regime.');
  }
  const houseProperty = rentalNav - houseStandardDeduction - selfOccupiedInterest;

  // ---- Other sources
  const familyPension = pos(input.familyPension);
  const familyPensionDeduction = Math.min(familyPension * r.familyPension.fraction, r.familyPension.cap);
  const savingsInterest = pos(input.savingsInterest);
  const depositInterest = pos(input.depositInterest);
  const dividends = pos(input.dividends);
  const otherSourcesGross = savingsInterest + depositInterest + dividends + pos(input.otherIncome) + familyPension;
  const otherSources = otherSourcesGross - familyPensionDeduction;

  // ---- Special-rate gains
  const stcg = pos(input.stcg111A);
  const ltcg = pos(input.ltcg112A);

  let normalGross = salaryNet + houseProperty + otherSources;
  if (normalGross < 0) {
    notes.push('House property loss above your other income is not set off against capital gains in this estimate.');
    normalGross = 0;
  }
  const grossTotal = normalGross + stcg + ltcg;

  // ---- Deductions
  const deductions: DeductionItem[] = [];
  const add = (key: DeductionItem['key'], label: string, claimed: number, cap: number | null, note?: string) => {
    if (claimed <= 0) return;
    deductions.push({ key, label, claimed, cap, allowed: cap === null ? claimed : Math.min(claimed, cap), note });
  };
  if (r.allows.chapterVIA) {
    add('c80', `Investments such as PPF, ELSS, EPF (${L.c80})`, pos(input.c80), caps.c80);
    add('ccd1b', `Own NPS contribution (${L.ccd1b})`, pos(input.ccd1b), caps.ccd1b);
    add(
      'd80Self',
      `Health insurance: self and family (${L.d80})`,
      pos(input.d80Self),
      senior ? caps.d80SelfSenior : caps.d80SelfBelow60,
    );
    add(
      'd80Parents',
      `Health insurance: parents (${L.d80})`,
      pos(input.d80Parents),
      input.parentsSenior ? caps.d80ParentsSenior : caps.d80ParentsBelow60,
    );
    if (senior) {
      add('ttb', `Deposit interest, senior citizen (${L.ttb})`, savingsInterest + depositInterest, caps.ttb);
    } else {
      add('tta', `Savings account interest (${L.tta})`, savingsInterest, caps.tta);
    }
  } else if (pos(input.c80) + pos(input.ccd1b) + pos(input.d80Self) + pos(input.d80Parents) > 0) {
    notes.push('Deductions such as 80C, 80CCD(1B) and 80D are not available in the new regime.');
  }
  const npsBase = input.basicPlusDA !== undefined && input.basicPlusDA > 0 ? input.basicPlusDA : salaryGross;
  add(
    'ccd2',
    `Employer NPS contribution (${L.ccd2}), up to ${pct(r.employerNpsPct)} of basic + DA`,
    pos(input.employerNps),
    npsBase * r.employerNpsPct,
  );
  const deductionSum = deductions.reduce((s, d) => s + d.allowed, 0);
  const totalDeductions = Math.min(deductionSum, normalGross);
  if (deductionSum > normalGross) {
    notes.push('Deductions are limited to income taxed at slab rates; they cannot reduce capital gains.');
  }

  // ---- Total income (288A)
  const specialIncome = stcg + ltcg;
  const totalIncomeUnrounded = normalGross - totalDeductions + specialIncome;
  const totalIncome = roundIncome(totalIncomeUnrounded, rules.rounding.income);
  const normalIncome = Math.max(0, totalIncome - specialIncome);
  const dividendInTotal = Math.min(dividends, normalIncome);

  const c = core({ normal: normalIncome, dividend: dividendInTotal, stcg, ltcg }, rules, r, age);

  const cess = (c.taxAfterRebate + c.surchargeNet) * rules.cessRate;
  const totalTaxUnrounded = c.taxAfterRebate + c.surchargeNet + cess;
  const totalTax = roundTax(totalTaxUnrounded, rules.rounding.tax);

  if (regime === 'new' && specialIncome > 0 && totalIncome <= r.rebate.incomeLimit) {
    notes.push(`The ${L.rebate} rebate does not reduce tax on capital gains taxed at special rates.`);
  }

  // ---- Itemised lines for display
  const lines: BreakdownLine[] = [];
  const push = (key: string, label: string, amount: number, kind: BreakdownLine['kind'], note?: string) =>
    lines.push({ key, label, amount, kind, note });

  push('h-income', 'Income', 0, 'heading');
  if (salaryGross > 0) {
    push('salary', 'Gross salary', salaryGross, 'item');
    if (hraExemption > 0) push('hra', `HRA exemption (${L.hra})`, hraExemption, 'less');
    push('std', `Standard deduction (${L.standardDeduction})`, standardDeduction, 'less');
    push('salary-net', 'Income from salary', salaryNet, 'subtotal');
  }
  if (rentalNav > 0 || selfOccupiedInterest > 0) {
    if (rentalNav > 0) {
      push('rent', 'Rent received (net annual value)', rentalNav, 'item');
      push('rent-std', `Standard deduction at ${pct(caps.houseStandardDeductionPct)} (${L.houseProperty})`, houseStandardDeduction, 'less');
    }
    if (selfOccupiedInterest > 0) {
      push(
        'hp-interest',
        `Home-loan interest, self-occupied (${L.selfOccupiedInterest})`,
        selfOccupiedInterest,
        'less',
        interestClaimed > selfOccupiedInterest ? `Claimed ${formatINR(interestClaimed)}, limit ${formatINR(caps.selfOccupiedInterest)}` : undefined,
      );
    }
    push('hp', 'Income from house property', houseProperty, 'subtotal');
  }
  if (otherSourcesGross > 0) {
    push('os-gross', 'Interest, dividends, pension and other income', otherSourcesGross, 'item');
    if (familyPensionDeduction > 0) push('fp', `Family pension deduction (${L.familyPension})`, familyPensionDeduction, 'less');
    push('os', 'Income from other sources', otherSources, 'subtotal');
  }
  if (stcg > 0) push('stcg', `Short-term capital gains on listed equity (${L.stcg})`, stcg, 'item');
  if (ltcg > 0) push('ltcg', `Long-term capital gains on listed equity (${L.ltcg})`, ltcg, 'item');
  push('gti', 'Gross total income', grossTotal, 'subtotal');

  if (deductions.length) {
    push('h-ded', 'Deductions', 0, 'heading');
    for (const d of deductions) {
      const note = d.cap !== null && d.claimed > d.cap ? `Claimed ${formatINR(d.claimed)}, limit ${formatINR(d.cap)}` : d.note;
      push(`ded-${d.key}`, d.label, d.allowed, 'less', note);
    }
    push('ded-total', 'Total deductions', totalDeductions, 'subtotal', deductionSum > totalDeductions ? 'Limited to income taxed at slab rates' : undefined);
  }
  push('ti', `Total income (rounded to ₹10, ${L.roundIncome})`, totalIncome, 'total');

  push('h-tax', 'Tax', 0, 'heading');
  for (const s of c.slabLines) {
    const range = s.to === null ? `Above ${formatINR(s.from)}` : `${formatINR(s.from)} to ${formatINR(s.to)}`;
    push(`slab-${s.from}`, `${range} at ${pct(s.rate)}`, s.tax, 'item', s.rate > 0 ? `On ${formatINR(s.taxable)}` : undefined);
  }
  for (const s of c.specialLines) {
    const parts: string[] = [`On ${formatINR(s.taxable)}`];
    if (s.exemption > 0) parts.push(`after ${formatINR(s.exemption)} exemption`);
    if (s.basicExemptionSetOff > 0) parts.push(`after ${formatINR(s.basicExemptionSetOff)} unused basic exemption`);
    push(`sp-${s.kind}`, `${s.label} at ${pct(s.rate)}`, s.tax, 'item', parts.join(', '));
  }
  push('tax-before', 'Tax before rebate', c.taxBeforeRebate, 'subtotal');
  if (c.rebate > 0) push('rebate', `Rebate (${L.rebate})`, c.rebate, 'less');
  if (c.rebateMarginalRelief > 0) {
    push('rebate-mr', `Marginal relief on rebate (${L.rebate})`, c.rebateMarginalRelief, 'less', `Tax limited to income above ${formatINR(r.rebate.incomeLimit)}`);
  }
  if (c.surchargeGross > 0) {
    push('sc', `Surcharge at ${pct(c.surchargeRate)}`, c.surchargeGross, 'item', specialIncome + dividendInTotal > 0 && c.surchargeRate > rules.special.surchargeCap ? `Capped at ${pct(rules.special.surchargeCap)} on capital gains and dividends` : undefined);
    if (c.surchargeRelief > 0) push('sc-mr', 'Marginal relief on surcharge', c.surchargeRelief, 'less');
  }
  push('cess', `Health and education cess at ${pct(rules.cessRate)}`, cess, 'item');
  push('total', `Total tax payable (rounded to ₹10, ${L.roundTax})`, totalTax, 'total');

  return {
    regime,
    yearId: rules.id,
    income: {
      salaryGross,
      hraExemption,
      standardDeduction,
      salaryNet,
      rentalNav,
      houseStandardDeduction,
      selfOccupiedInterest,
      houseProperty,
      otherSources,
      familyPensionDeduction,
      stcg111A: stcg,
      ltcg112A: ltcg,
      grossTotal,
    },
    deductions,
    totalDeductions,
    totalIncomeUnrounded,
    totalIncome,
    normalIncome,
    specialIncome,
    slabLines: c.slabLines,
    slabTax: c.slabTax,
    specialLines: c.specialLines,
    specialTax: c.specialTax,
    taxBeforeRebate: c.taxBeforeRebate,
    rebate: c.rebate,
    rebateMarginalRelief: c.rebateMarginalRelief,
    taxAfterRebate: c.taxAfterRebate,
    surcharge: { rate: c.surchargeRate, gross: c.surchargeGross, marginalRelief: c.surchargeRelief, net: c.surchargeNet },
    cess,
    totalTaxUnrounded,
    totalTax,
    effectiveRate: grossTotal > 0 ? totalTax / grossTotal : 0,
    lines,
    notes,
  };
}

/** Computes both regimes and says which gives lower tax. */
export function compareRegimes(input: TaxInput, rules: TaxRules): RegimeComparison {
  const oldB = computeTax({ ...input, regime: 'old' }, rules);
  const newB = computeTax({ ...input, regime: 'new' }, rules);
  const diff = oldB.totalTax - newB.totalTax;
  return {
    old: oldB,
    new: newB,
    better: diff === 0 ? 'equal' : diff > 0 ? 'new' : 'old',
    saving: Math.abs(diff),
  };
}

/** One slab of the "staircase", filled with as much of the income as falls inside it. */
export interface SlabFillStep {
  from: number;
  /** null = no upper bound (top slab). */
  to: number | null;
  rate: number;
  amountInSlab: number;
  taxInSlab: number;
}

export interface SlabFill {
  regime: Regime;
  taxableIncome: number;
  /** Every slab of the regime, including empty ones (amountInSlab 0). */
  slabs: SlabFillStep[];
  slabTax: number;
  rebate: number;
  /** 87A marginal relief (new regime). */
  marginalRelief: number;
  /** Net surcharge after marginal relief. */
  surcharge: number;
  cess: number;
  /** Final tax after rebate, surcharge, cess and 288B rounding. */
  totalTax: number;
}

/**
 * Pure helper for visualisations (e.g. a slab "staircase"): how a given taxable income (all at slab rates,
 * no special-rate gains) fills each slab, plus totals after rebate and cess. Income is rounded per 288A.
 */
export function slabFill(taxableIncome: number, regime: Regime, rules: TaxRules, age: AgeBracket = 'below60'): SlabFill {
  const b = computeTax({ regime, age, otherIncome: pos(taxableIncome) }, rules);
  let from = 0;
  const slabs: SlabFillStep[] = rules.regimes[regime].slabs[age].map((s) => {
    const top = s.upTo ?? Infinity;
    const amountInSlab = Math.max(0, Math.min(b.normalIncome, top) - from);
    const step = { from, to: s.upTo, rate: s.rate, amountInSlab, taxInSlab: amountInSlab * s.rate };
    from = top;
    return step;
  });
  return {
    regime,
    taxableIncome: b.totalIncome,
    slabs,
    slabTax: b.slabTax,
    rebate: b.rebate,
    marginalRelief: b.rebateMarginalRelief,
    surcharge: b.surcharge.net,
    cess: b.cess,
    totalTax: b.totalTax,
  };
}
