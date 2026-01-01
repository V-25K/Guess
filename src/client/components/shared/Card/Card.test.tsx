/**
 * Card Component Tests
 * Basic unit tests for the Card component (Tailwind CSS version)
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card Component', () => {
  it('renders with children content', () => {
    render(<Card>Content</Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('applies default variant styling', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild;
    expect(card).toHaveClass('bg-white');
    expect(card).toHaveClass('shadow-sm');
  });

  it('applies elevated variant styling', () => {
    const { container } = render(<Card variant="elevated">Content</Card>);
    const card = container.firstChild;
    expect(card).toHaveClass('bg-white');
    expect(card).toHaveClass('shadow-md');
  });

  it('applies outlined variant styling', () => {
    const { container } = render(<Card variant="outlined">Content</Card>);
    const card = container.firstChild;
    expect(card).toHaveClass('bg-white');
    expect(card).toHaveClass('border');
    expect(card).toHaveClass('border-neutral-200');
  });

  it('applies default padding (md)', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild;
    expect(card).toHaveClass('p-4');
  });

  it('applies none padding', () => {
    const { container } = render(<Card padding="none">Content</Card>);
    const card = container.firstChild;
    expect(card).not.toHaveClass('p-2');
    expect(card).not.toHaveClass('p-4');
    expect(card).not.toHaveClass('p-6');
  });

  it('applies sm padding', () => {
    const { container } = render(<Card padding="sm">Content</Card>);
    const card = container.firstChild;
    expect(card).toHaveClass('p-2');
  });

  it('applies lg padding', () => {
    const { container } = render(<Card padding="lg">Content</Card>);
    const card = container.firstChild;
    expect(card).toHaveClass('p-6');
  });

  it('combines variant and padding classes', () => {
    const { container } = render(
      <Card variant="elevated" padding="lg">
        Content
      </Card>
    );
    const card = container.firstChild;
    expect(card).toHaveClass('shadow-md');
    expect(card).toHaveClass('p-6');
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>);
    const card = container.firstChild;
    expect(card).toHaveClass('custom-class');
  });

  it('applies rounded corners', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild;
    expect(card).toHaveClass('rounded-game-md');
  });
});
