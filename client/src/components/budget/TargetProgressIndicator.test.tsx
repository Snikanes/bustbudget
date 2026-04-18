import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TargetProgressIndicator, { TargetProgressText } from './TargetProgressIndicator';
import { CategoryTarget } from '@/types';

// Helper function to create mock targets
function createMockTarget(overrides: Partial<CategoryTarget> = {}): CategoryTarget {
  return {
    id: '1',
    categoryId: '1',
    targetType: 'monthly',
    targetAmount: 100000, // 1000.00 kr in cents
    targetDate: '2026-12-31',
    recurrenceDay: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('TargetProgressIndicator', () => {
  describe('Progress Bar Width', () => {
    it('should display 0% width when nothing assigned', () => {
      const target = createMockTarget({ targetAmount: 100000 });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={0}
          activity={0}
          available={0}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('[style*="width"]');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('should display 50% width when half assigned', () => {
      const target = createMockTarget({ targetAmount: 100000 });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={50000}
          activity={0}
          available={50000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('[style*="width"]');
      expect(progressBar).toHaveStyle({ width: '50%' });
    });

    it('should display 100% width when fully assigned', () => {
      const target = createMockTarget({ targetAmount: 100000 });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={100000}
          activity={0}
          available={100000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('[style*="width"]');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    it('should cap at 100% width when over-assigned', () => {
      const target = createMockTarget({ targetAmount: 100000 });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={150000}
          activity={0}
          available={150000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('[style*="width"]');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    it('should handle edge case of 0 target amount gracefully', () => {
      const target = createMockTarget({ targetAmount: 0 });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={50000}
          activity={0}
          available={50000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('[style*="width"]');
      // When target is 0, division results in Infinity, which Math.min caps at 100%
      expect(progressBar).toHaveStyle({ width: '100%' });
    });
  });

  describe('Progress Bar Width - by_date targets', () => {
    it('should use available (total progress) for by_date targets, not assigned', () => {
      // Target: 2095 kr by April
      // Assigned this month: 523.75 kr
      // Available (total): 1047.50 kr (includes previous months)
      // Progress should be based on available: 1047.50 / 2095 ≈ 50%
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 209500, // 2095 kr
        targetDate: '2026-04-30',
        createdAt: '2026-01-01T00:00:00Z',
      });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={52375} // 523.75 kr this month
          activity={0}
          available={104750} // 1047.50 kr total
          currentMonth="2026-02"
        />
      );

      const progressBar = container.querySelector('.h-full');
      // 104750 / 209500 * 100 = 50%
      expect(progressBar).toHaveStyle({ width: '50%' });
    });

    it('should show increasing progress as available increases across months', () => {
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 209500, // 2095 kr
        targetDate: '2026-04-30',
        createdAt: '2026-01-01T00:00:00Z',
      });

      // January: 523.75 kr available = 25% progress
      const { container: container1 } = render(
        <TargetProgressIndicator
          target={target}
          assigned={52375}
          activity={0}
          available={52375} // 523.75 kr
          currentMonth="2026-01"
        />
      );
      const bar1 = container1.querySelector('.h-full');
      expect(bar1).toHaveStyle({ width: '25%' });

      // February: 1047.50 kr available = 50% progress
      const { container: container2 } = render(
        <TargetProgressIndicator
          target={target}
          assigned={52375}
          activity={0}
          available={104750} // 1047.50 kr
          currentMonth="2026-02"
        />
      );
      const bar2 = container2.querySelector('.h-full');
      expect(bar2).toHaveStyle({ width: '50%' });
    });

    it('should use assigned (not available) for recurring targets', () => {
      // For monthly/yearly targets, progress is based on this month's assignment
      const target = createMockTarget({
        targetType: 'monthly',
        targetAmount: 100000, // 1000 kr
      });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={50000} // 500 kr this month
          activity={0}
          available={75000} // 750 kr total (different from assigned)
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('.h-full');
      // Should use assigned (50%), not available (75%)
      expect(progressBar).toHaveStyle({ width: '50%' });
    });
  });

  describe('Progress Bar Color - Overspent', () => {
    it('should display red bar when spent exceeds assigned and fully funded (monthly target)', () => {
      const target = createMockTarget({ targetType: 'monthly', targetAmount: 100000 });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={100000}
          activity={-120000} // Spent 1200.00 kr
          available={-20000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('.h-full');
      expect(progressBar).toHaveClass('bg-red-500');
    });

    it('should display red bar when spent exceeds assigned and fully funded (yearly target)', () => {
      const target = createMockTarget({ targetType: 'yearly', targetAmount: 100000 });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={100000}
          activity={-150000}
          available={-50000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('.h-full');
      expect(progressBar).toHaveClass('bg-red-500');
    });

    it('should display red bar when spent exceeds assigned and fully funded (by_date target)', () => {
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 100000,
        targetDate: '2026-06-30',
      });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={100000}
          activity={-110000}
          available={-10000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('.h-full');
      expect(progressBar).toHaveClass('bg-red-500');
    });

    it('should display two-part bar when underfunded but overspent', () => {
      // Target: 10000.00 kr, Assigned: 6000.00 kr, Spent: 6861.49 kr (overspent)
      const target = createMockTarget({ targetType: 'monthly', targetAmount: 1000000 });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={600000} // 60% of target
          activity={-686149} // Spent more than assigned
          available={-86149}
          currentMonth="2026-01"
        />
      );

      // Should have two progress bars
      const progressBars = container.querySelectorAll('.h-full');
      expect(progressBars).toHaveLength(2);

      // First bar (assigned portion) should be yellow
      expect(progressBars[0]).toHaveClass('bg-yellow-500');
      expect(progressBars[0]).toHaveStyle({ width: '60%' });

      // Second bar (overspent portion) should be red with stripes
      expect(progressBars[1]).toHaveClass('bg-red-500');
      expect(progressBars[1]).toHaveClass('bg-stripe-red');
    });

    it('should calculate overspent bar width correctly', () => {
      // Target: 10000 kr, Assigned: 5000 kr (50%), Spent: 7500 kr (25% overspent relative to target)
      const target = createMockTarget({ targetAmount: 1000000 });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={500000} // 50% of target
          activity={-750000} // 75% of target spent
          available={-250000}
          currentMonth="2026-01"
        />
      );

      const progressBars = container.querySelectorAll('.h-full');
      expect(progressBars).toHaveLength(2);

      // Assigned bar: 50%
      expect(progressBars[0]).toHaveStyle({ width: '50%' });

      // Overspent bar: (750000 - 500000) / 1000000 * 100 = 25%
      expect(progressBars[1]).toHaveStyle({ width: '25%' });
    });

    it('should cap total bar width at 100% when heavily overspent', () => {
      // Target: 1000 kr, Assigned: 500 kr, Spent: 2000 kr (way over target)
      const target = createMockTarget({ targetAmount: 100000 });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={50000} // 50% of target
          activity={-200000} // 200% of target spent
          available={-150000}
          currentMonth="2026-01"
        />
      );

      const progressBars = container.querySelectorAll('.h-full');
      expect(progressBars).toHaveLength(2);

      // Assigned bar: 50%
      expect(progressBars[0]).toHaveStyle({ width: '50%' });

      // Overspent bar should be capped so total doesn't exceed 100%
      const overspentWidth = parseFloat(
        progressBars[1].getAttribute('style')?.match(/width:\s*([\d.]+)%/)?.[1] || '0'
      );
      expect(overspentWidth).toBeLessThanOrEqual(50); // Should cap at 50% to make total 100%
    });
  });

  describe('Progress Bar Color - Funded', () => {
    it('should display green bar when fully funded (monthly target)', () => {
      const target = createMockTarget({ targetType: 'monthly', targetAmount: 100000 });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={100000}
          activity={0}
          available={100000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('.h-full');
      expect(progressBar).toHaveClass('bg-green-500');
    });

    it('should display green bar when fully funded (yearly target)', () => {
      const target = createMockTarget({ targetType: 'yearly', targetAmount: 100000 });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={100000}
          activity={0}
          available={100000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('.h-full');
      expect(progressBar).toHaveClass('bg-green-500');
    });

    it('should display green bar when fully funded (by_date target)', () => {
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 100000,
        targetDate: '2026-06-30',
      });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={100000}
          activity={0}
          available={100000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('.h-full');
      expect(progressBar).toHaveClass('bg-green-500');
    });

    it('should display green bar when over-funded', () => {
      const target = createMockTarget({ targetAmount: 100000 });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={150000}
          activity={0}
          available={150000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('.h-full');
      expect(progressBar).toHaveClass('bg-green-500');
    });
  });

  describe('Progress Bar Color - By Date On Track', () => {
    it('should display green bar when by_date target is on track', () => {
      // Target: 60000 cents by June 2026 (6 months)
      // Created: January 2026
      // Expected per month: 10000 cents
      // Month 1: Need 10000, have 10000 = on track
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 60000,
        targetDate: '2026-06-30',
        createdAt: '2026-01-01T00:00:00Z',
      });

      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={10000}
          activity={0}
          available={10000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('.h-full');
      expect(progressBar).toHaveClass('bg-green-500');
    });

    it('should display green bar when by_date target exceeds expected progress', () => {
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 60000,
        targetDate: '2026-06-30',
        createdAt: '2026-01-01T00:00:00Z',
      });

      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={20000} // Have more than the 10000 expected
          activity={0}
          available={20000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('.h-full');
      expect(progressBar).toHaveClass('bg-green-500');
    });

    it('should display yellow bar when by_date target falls behind schedule', () => {
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 60000,
        targetDate: '2026-06-30',
        createdAt: '2026-01-01T00:00:00Z',
      });

      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={5000} // Have less than the 10000 expected
          activity={0}
          available={5000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('.h-full');
      expect(progressBar).toHaveClass('bg-yellow-500');
    });
  });

  describe('Progress Bar Color - Underfunded', () => {
    it('should display yellow bar when partially funded (monthly target)', () => {
      const target = createMockTarget({ targetType: 'monthly', targetAmount: 100000 });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={50000}
          activity={0}
          available={50000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('.h-full');
      expect(progressBar).toHaveClass('bg-yellow-500');
    });

    it('should display yellow bar when partially funded (yearly target)', () => {
      const target = createMockTarget({ targetType: 'yearly', targetAmount: 100000 });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={75000}
          activity={0}
          available={75000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('.h-full');
      expect(progressBar).toHaveClass('bg-yellow-500');
    });

    it('should display yellow bar when partially funded and behind (by_date target)', () => {
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 60000,
        targetDate: '2026-06-30',
        createdAt: '2026-01-01T00:00:00Z',
      });

      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={5000}
          activity={0}
          available={5000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('.h-full');
      expect(progressBar).toHaveClass('bg-yellow-500');
    });
  });

  describe('Negative Assigned Amount', () => {
    it('should show no progress bar when assigned is negative', () => {
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 90000, // 900 kr
        targetDate: '2026-02-20',
      });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={-70731} // -707.31 kr (negative)
          activity={70731} // +707.31 kr (offset)
          available={0}
          currentMonth="2026-01"
        />
      );

      const progressBars = container.querySelectorAll('.h-full');
      if (progressBars.length > 0) {
        // Should show 0% or minimal width
        const width = progressBars[0].getAttribute('style')?.match(/width:\s*([\d.]+)%/)?.[1];
        expect(parseFloat(width || '0')).toBeLessThanOrEqual(1);
      }
    });

    it('should not show as overspent when negative assigned is offset by activity', () => {
      const target = createMockTarget({ targetAmount: 100000 });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={-50000} // Negative assigned
          activity={50000} // Positive activity offsets it
          available={0}
          currentMonth="2026-01"
        />
      );

      // Should not have red bar
      const progressBars = container.querySelectorAll('.h-full');
      progressBars.forEach((bar) => {
        expect(bar).not.toHaveClass('bg-red-500');
      });
    });
  });

  describe('Overspending Detection - Multi-Month', () => {
    it('should NOT show overspent when spending equals total assigned across months (available=0)', () => {
      // Target: 750 kr. Assigned 375 kr in Jan, 375 kr in Feb. Spent 750 kr in Feb.
      // Current month assigned: 37500, Activity: -75000, Available: 0
      // Old bug: was flagged as overspent because spent (750) > this-month assigned (375)
      const target = createMockTarget({
        targetType: 'monthly',
        targetAmount: 75000,
      });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={37500}
          activity={-75000}
          available={0}
          currentMonth="2026-02"
        />
      );

      // Should NOT be red (overspent) - available=0 means spent equals what was available
      const progressBars = container.querySelectorAll('.h-full');
      progressBars.forEach((bar) => {
        expect(bar).not.toHaveClass('bg-red-500');
      });
    });

    it('should show two-part bar when spending exceeds total available across months (available<0)', () => {
      // Target: 750 kr. Assigned 375 kr in Jan, 375 kr in Feb. Spent 800 kr in Feb.
      // Available: -5000 (overspent by 50 kr)
      const target = createMockTarget({
        targetType: 'monthly',
        targetAmount: 75000,
      });
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={37500}
          activity={-80000}
          available={-5000}
          currentMonth="2026-02"
        />
      );

      // Underfunded + overspent → two-part bar (yellow + red)
      const progressBars = container.querySelectorAll('.h-full');
      expect(progressBars).toHaveLength(2);
      expect(progressBars[0]).toHaveClass('bg-yellow-500');
      expect(progressBars[1]).toHaveClass('bg-red-500');
    });

    it('should show "Overspent" text when available is negative', () => {
      const target = createMockTarget({
        targetType: 'monthly',
        targetAmount: 75000,
      });
      const { container } = render(
        <TargetProgressText
          target={target}
          assigned={37500}
          activity={-80000}
          available={-5000}
          currentMonth="2026-02"
        />
      );

      expect(container.textContent).toContain('Overspent');
    });

    it('should show "more needed" text (not "Overspent") when available=0', () => {
      const target = createMockTarget({
        targetType: 'monthly',
        targetAmount: 75000,
      });
      const { container } = render(
        <TargetProgressText
          target={target}
          assigned={37500}
          activity={-75000}
          available={0}
          currentMonth="2026-02"
        />
      );

      // Not overspent, so should NOT show "Overspent" text
      expect(container.textContent).not.toContain('Overspent');
    });
  });

  describe('Date Calculations', () => {
    it('should calculate on-track correctly for by_date target in first month', () => {
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 120000,
        targetDate: '2026-12-31',
        createdAt: '2026-01-15T00:00:00Z', // Mid-month creation
      });

      // In month 1 of 12, need 10000 to be on track
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={10000}
          activity={0}
          available={10000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('.h-full');
      expect(progressBar).toHaveClass('bg-green-500');
    });

    it('should calculate on-track correctly for by_date target midway through timeline', () => {
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 120000,
        targetDate: '2026-12-31',
        createdAt: '2026-01-01T00:00:00Z',
      });

      // In month 6 of 12, need 60000 to be on track
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={60000}
          activity={0}
          available={60000}
          currentMonth="2026-06"
        />
      );

      const progressBar = container.querySelector('.h-full');
      expect(progressBar).toHaveClass('bg-green-500');
    });

    it('should calculate on-track correctly for by_date target in final month', () => {
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 120000,
        targetDate: '2026-12-31',
        createdAt: '2026-01-01T00:00:00Z',
      });

      // In month 12 of 12, need all 120000 to be on track
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={120000}
          activity={0}
          available={120000}
          currentMonth="2026-12"
        />
      );

      const progressBar = container.querySelector('.h-full');
      expect(progressBar).toHaveClass('bg-green-500');
    });

    it('should handle by_date target with past target date', () => {
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 100000,
        targetDate: '2025-12-31', // Past date
        createdAt: '2025-06-01T00:00:00Z',
      });

      // Target date has passed, should still evaluate based on available
      const { container } = render(
        <TargetProgressIndicator
          target={target}
          assigned={100000}
          activity={0}
          available={100000}
          currentMonth="2026-01"
        />
      );

      const progressBar = container.querySelector('.h-full');
      // Should be green because fully funded
      expect(progressBar).toHaveClass('bg-green-500');
    });
  });
});
