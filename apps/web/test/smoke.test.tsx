import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App.js';

describe('App', () => {
  it('renders the board by default', () => {
    render(<App />);
    expect(screen.getByRole('grid', { name: /weaving board/i })).toBeInTheDocument();
  });

  it('names itself', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toHaveTextContent(/weavesmith/i);
  });
});
