/**
 * Badge Component Tests
 * Basic unit tests for the Badge component (Tailwind CSS version)
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge Component', () => {
  it('renders with children text', () => {
    render(<Badge>Content</Badge>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('applies default variant styling', () => {
    const { container } = render(<Badge>Content</Badge>);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-neutral-100');
    expect(badge).toHaveClass('text-neutral-900');
  });

  it('applies success variant styling', () => {
    const { container } = render(<Badge variant="success">Content</Badge>);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-success-light');
  });

  it('applies error variant styling', () => {
    const { container } = render(<Badge variant="error">Content</Badge>);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-error-light');
  });

  it('applies warning variant styling', () => {
    const { container } = render(<Badge variant="warning">Content</Badge>);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-warning-light');
  });

  it('applies default size styling (md)', () => {
    const { container } = render(<Badge>Content</Badge>);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('px-3');
    expect(badge).toHaveClass('py-1');
    expect(badge).toHaveClass('text-sm');
  });

  it('applies sm size styling', () => {
    const { container } = render(<Badge size="sm">Content</Badge>);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('px-2');
    expect(badge).toHaveClass('text-xs');
  });

  it('combines variant and size classes', () => {
    const { container } = render(
      <Badge variant="success" size="sm">
        Content
      </Badge>
    );
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-success-light');
    expect(badge).toHaveClass('px-2');
    expect(badge).toHaveClass('text-xs');
  });

  it('applies custom className', () => {
    const { container } = render(<Badge className="custom-class">Content</Badge>);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('custom-class');
  });
});
