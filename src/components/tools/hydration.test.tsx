// @vitest-environment happy-dom
/**
 * Regression test: every calculator must hydrate without errors and handle "Calculate" in JS.
 * If hydration throws, the server HTML stays inert and the button falls back to a native form
 * submit, which reloads the page and wipes the inputs.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import IncomeTaxCalculator from './IncomeTaxCalculator';
import GstCalculator from './GstCalculator';
import HraCalculator from './HraCalculator';
import AdvanceTaxCalculator from './AdvanceTaxCalculator';
import TdsRateFinder from './TdsRateFinder';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const calculators: [string, ComponentType][] = [
  ['IncomeTaxCalculator', IncomeTaxCalculator],
  ['GstCalculator', GstCalculator],
  ['HraCalculator', HraCalculator],
  ['AdvanceTaxCalculator', AdvanceTaxCalculator],
  ['TdsRateFinder', TdsRateFinder],
];

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

function setValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe.each(calculators)('%s', (_name, Component) => {
  it('hydrates cleanly and Calculate is handled without a native submit', async () => {
    const errors: unknown[] = [];
    const container = document.createElement('div');
    container.innerHTML = renderToString(createElement(Component));
    document.body.appendChild(container);

    await act(async () => {
      root = hydrateRoot(container, createElement(Component), {
        onRecoverableError: (e) => errors.push(e),
        onUncaughtError: (e) => errors.push(e),
        onCaughtError: (e) => errors.push(e),
      });
    });
    expect(errors).toEqual([]);

    // Fill every empty text/number input with a plausible amount so required-field checks pass.
    for (const input of container.querySelectorAll<HTMLInputElement>('input[inputmode], input[type="text"], input[type="number"]')) {
      if (!input.value && !input.readOnly && !input.disabled && input.name !== 'website') {
        await act(async () => setValue(input, '500000'));
      }
    }

    const form = container.querySelector('form');
    const button = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(form, 'calculator should have a form').not.toBeNull();
    expect(button, 'calculator should have a submit button').not.toBeNull();

    const submit = new Event('submit', { bubbles: true, cancelable: true });
    await act(async () => {
      form!.dispatchEvent(submit);
    });
    expect(submit.defaultPrevented, 'onSubmit must call preventDefault (otherwise the page reloads)').toBe(true);
    expect(errors).toEqual([]);
  });
});

describe('IncomeTaxCalculator tabs', () => {
  it('keeps values across tab switches and calculates from the Income tab', async () => {
    const errors: unknown[] = [];
    const container = document.createElement('div');
    container.innerHTML = renderToString(createElement(IncomeTaxCalculator));
    document.body.appendChild(container);
    await act(async () => {
      root = hydrateRoot(container, createElement(IncomeTaxCalculator), {
        onRecoverableError: (e) => errors.push(e),
        onUncaughtError: (e) => errors.push(e),
      });
    });
    expect(errors).toEqual([]);

    const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tablist"][aria-label="Calculator steps"] [role="tab"]')];
    expect(tabs.map((t) => t.textContent)).toEqual([
      expect.stringContaining('About you'),
      expect.stringContaining('Income'),
      expect.stringContaining('Deductions'),
    ]);
    // Every tab button is type="button" so it can never submit the form.
    expect(tabs.every((t) => t.type === 'button')).toBe(true);

    const panelOf = (tab: HTMLButtonElement) => container.querySelector<HTMLElement>(`#${CSS.escape(tab.getAttribute('aria-controls')!)}`)!;
    const [you, income, ded] = tabs;
    expect(you.getAttribute('aria-selected')).toBe('true');
    expect(panelOf(income).hidden).toBe(true);

    await act(async () => income.click());
    expect(income.getAttribute('aria-selected')).toBe('true');
    expect(panelOf(income).hidden).toBe(false);
    const salary = panelOf(income).querySelector<HTMLInputElement>('input')!;
    await act(async () => setValue(salary, '1500000'));

    await act(async () => ded.click());
    expect(panelOf(income).hidden).toBe(true);
    // Inputs stay mounted while hidden.
    expect(container.contains(salary)).toBe(true);

    await act(async () => income.click());
    expect(salary.value.replace(/[^\d]/g, '')).toBe('1500000');

    // Arrow keys move between tabs (roving tabindex).
    await act(async () => income.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(ded.getAttribute('aria-selected')).toBe('true');
    expect(ded.tabIndex).toBe(0);
    expect(income.tabIndex).toBe(-1);

    const form = container.querySelector('form')!;
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    await act(async () => form.dispatchEvent(submit));
    expect(submit.defaultPrevented).toBe(true);
    const resultTabs = container.querySelector('[role="tablist"][aria-label="Result views"]');
    expect(resultTabs, 'result tabs appear after calculating').not.toBeNull();
    expect(container.textContent).toContain('Want this filed?');
    expect(errors).toEqual([]);
  });

  it('empty submit jumps to the Income tab with an error instead of reloading', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(createElement(IncomeTaxCalculator));
    document.body.appendChild(container);
    await act(async () => {
      root = hydrateRoot(container, createElement(IncomeTaxCalculator));
    });
    const form = container.querySelector('form')!;
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    await act(async () => form.dispatchEvent(submit));
    expect(submit.defaultPrevented).toBe(true);
    expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/salary/i);
    const income = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((t) => t.textContent?.includes('Income'))!;
    expect(income.getAttribute('aria-selected')).toBe('true');
  });
});
