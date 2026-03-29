import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@icon-park/react', () => ({
  Left: (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>left</span>,
  Right: (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>right</span>,
  Refresh: (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>refresh</span>,
  Loading: (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>loading</span>,
}));

import WebviewHost from '@/renderer/components/media/WebviewHost';

describe('WebviewHost browser fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as Window & { electronAPI?: unknown }).electronAPI = undefined;
  });

  it('renders an iframe and updates the target URL after form submit', () => {
    render(<WebviewHost url='https://example.com' showNavBar />);

    const iframe = screen.getByTitle('Embedded Content');
    const input = screen.getByPlaceholderText('Enter URL...');

    expect(iframe).toHaveAttribute('src', 'https://example.com');

    fireEvent.change(input, { target: { value: 'openai.com/docs' } });
    fireEvent.submit(input.closest('form')!);

    expect(iframe).toHaveAttribute('src', 'https://openai.com/docs');
  });

  it('keeps the current page when the submitted URL is empty', () => {
    render(<WebviewHost url='https://example.com/start' showNavBar />);

    const iframe = screen.getByTitle('Embedded Content');
    const input = screen.getByPlaceholderText('Enter URL...');

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(input.closest('form')!);

    expect(iframe).toHaveAttribute('src', 'https://example.com/start');
  });
});
