/**
 * Input Component Tests
 * Basic unit tests for the Input component (Tailwind CSS version)
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './Input';

describe('Input Component', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders with label', () => {
    render(<Input label="Username" />);
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('calls onChange handler when value changes', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('displays error message when error is present', () => {
    render(<Input error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('applies error styling when error is present', () => {
    const { container } = render(<Input error="Error" />);
    // Error state applies border-error class to the container
    const inputContainer = container.querySelector('.border-error');
    expect(inputContainer).toBeInTheDocument();
  });

  it('applies full width class', () => {
    const { container } = render(<Input fullWidth />);
    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('w-full');
  });

  it('displays helper text', () => {
    render(<Input helperText="Enter your username" />);
    expect(screen.getByText('Enter your username')).toBeInTheDocument();
  });

  it('does not display helper text when error is present', () => {
    render(<Input helperText="Helper" error="Error" />);
    expect(screen.queryByText('Helper')).not.toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('renders left addon', () => {
    render(<Input leftAddon={<span>$</span>} />);
    expect(screen.getByText('$')).toBeInTheDocument();
  });

  it('renders right addon', () => {
    render(<Input rightAddon={<span>@</span>} />);
    expect(screen.getByText('@')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('sets aria-invalid when error is present', () => {
    render(<Input error="Error" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });
});
