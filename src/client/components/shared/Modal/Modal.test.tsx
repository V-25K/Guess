/**
 * Modal Component Tests
 * Basic unit tests for the Modal component (Tailwind CSS version)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal Component', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  describe('Rendering', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(
        <Modal isOpen={false} onClose={mockOnClose}>
          Content
        </Modal>
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders content when isOpen is true', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Modal Content
        </Modal>
      );
      expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });

    it('renders title when provided', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Title">
          Content
        </Modal>
      );
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('renders close button when title is provided', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Title">
          Content
        </Modal>
      );
      expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
    });
  });

  describe('Size variants', () => {
    it('applies default size (md)', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveClass('max-w-md');
    });

    it('applies sm size', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={mockOnClose} size="sm">
          Content
        </Modal>
      );
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveClass('max-w-xs');
    });

    it('applies lg size', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={mockOnClose} size="lg">
          Content
        </Modal>
      );
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveClass('max-w-xl');
    });
  });

  describe('Accessibility', () => {
    it('has role="dialog"', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal="true"', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby when title is provided', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Title">
          Content
        </Modal>
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
    });
  });

  describe('Close behavior', () => {
    it('calls onClose when close button is clicked', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test">
          Content
        </Modal>
      );
      fireEvent.click(screen.getByLabelText('Close modal'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked (closeOnOverlayClick=true)', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={mockOnClose} closeOnOverlayClick={true}>
          Content
        </Modal>
      );
      const overlay = container.querySelector('[role="presentation"]');
      fireEvent.click(overlay!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when overlay is clicked (closeOnOverlayClick=false)', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={mockOnClose} closeOnOverlayClick={false}>
          Content
        </Modal>
      );
      const overlay = container.querySelector('[role="presentation"]');
      fireEvent.click(overlay!);
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('does not call onClose when modal content is clicked', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          <div data-testid="content">Content</div>
        </Modal>
      );
      fireEvent.click(screen.getByTestId('content'));
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Body scroll lock', () => {
    it('prevents body scroll when open', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when closed', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      rerender(
        <Modal isOpen={false} onClose={mockOnClose}>
          Content
        </Modal>
      );
      expect(document.body.style.overflow).toBe('');
    });
  });
});
