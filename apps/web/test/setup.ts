import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// @testing-library/react's auto-cleanup relies on detecting a global
// `afterEach` (e.g. via vitest's `test.globals: true`). This project uses
// explicit vitest imports instead, so cleanup is wired up by hand — without
// it, DOM from one test's render() leaks into the next.
afterEach(() => {
  cleanup();
});
