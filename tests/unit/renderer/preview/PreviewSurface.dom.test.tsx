import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import ConversationCapabilitySurface from '@/renderer/pages/conversation/components/ConversationCapabilitySurface';

describe('ConversationCapabilitySurface', () => {
  it('renders the active preview label for the capability surface', () => {
    render(<ConversationCapabilitySurface title='Preview' value='README.md' />);

    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
  });
});
