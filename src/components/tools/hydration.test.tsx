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
