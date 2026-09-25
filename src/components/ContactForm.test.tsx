// @vitest-environment happy-dom
/**
 * Regression: the contact form must hydrate without throwing. An uncaught error during hydration makes
 * React 19 unmount the island, which wipes the server-rendered fields and leaves an empty slip.
 */
import { it, expect } from 'vitest';
import { createElement, act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import ContactForm from './ContactForm';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('hydrates and keeps its fields', async () => {
  const errors: string[] = [];
  const c = document.createElement('div');
  c.innerHTML = renderToString(createElement(ContactForm));
  document.body.appendChild(c);
  const before = c.querySelectorAll('input, select, textarea').length;
  await act(async () => {
    hydrateRoot(c, createElement(ContactForm), {
      onRecoverableError: (e) => errors.push(`recoverable: ${String(e)}`),
      onUncaughtError: (e) => errors.push(`uncaught: ${String(e)}`),
    });
  });
  expect(errors).toEqual([]);
  expect(before).toBeGreaterThan(4);
  expect(c.querySelectorAll('input, select, textarea').length).toBe(before);
});
