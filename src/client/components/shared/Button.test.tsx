/**
 * Button Component Tests
 * Basic unit tests for the Button component (Tailwind CSS version)
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button Component', () => {
  it('renders with children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick} disabled>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(<Button loading>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
    // Loading state shows a spinner with animate-spin class
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    const { container } = render(<Button variant="primary">Primary</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-game-primary');
  });

  it('applies secondary variant classes', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-white');
    expect(button).toHaveClass('border');
  });

  it('applies size classes', () => {
    const { container } = render(<Button size="lg">Large</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('px-6');
    expect(button).toHaveClass('py-3');
  });

  it('applies full width class', () => {
    const { container } = render(<Button fullWidth>Full Width</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('w-full');
  });

  it('renders left icon when provided', () => {
    render(
      <Button leftIcon={<span data-testid="left-icon">←</span>}>With Icon</Button>
    );
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
  });

  it('renders right icon when provided', () => {
    render(
      <Button rightIcon={<span data-testid="right-icon">→</span>}>With Icon</Button>
    );
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });

  it('renders both icons when provided', () => {
    render(
      <Button 
        leftIcon={<span data-testid="left-icon">←</span>}
        rightIcon={<span data-testid="right-icon">→</span>}
      >
        With Both Icons
      </Button>
    );
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });

  it('does not render icons when loading', () => {
    render(
      <Button 
        loading
        leftIcon={<span data-testid="left-icon">←</span>}
        rightIcon={<span data-testid="right-icon">→</span>}
      >
        Loading
      </Button>
    );
    expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument();
    // Loading state shows a spinner
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
