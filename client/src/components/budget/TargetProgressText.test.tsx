import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TargetProgressText } from './TargetProgressIndicator';
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

describe('TargetProgressText', () => {
  describe('Overspent State', () => {
    it('should display "Overspent. X of Y" when spent exceeds assigned (monthly)', () => {
      const target = createMockTarget({ targetType: 'monthly', targetAmount: 100000 });
      render(
        <TargetProgressText
          target={target}
          assigned={100000}
          activity={-120000} // Spent 1200.00
          available={-20000}
          currentMonth="2026-01"
        />
      );

      expect(screen.getByText(/Overspent/)).toBeInTheDocument();
      expect(screen.getByText(/1 200,00 of 1 000,00/)).toBeInTheDocument();
    });

    it('should display "Overspent. X of Y" when spent exceeds assigned (yearly)', () => {
      const target = createMockTarget({ targetType: 'yearly', targetAmount: 100000 });
      render(
        <TargetProgressText
          target={target}
          assigned={100000}
          activity={-150000}
          available={-50000}
          currentMonth="2026-01"
        />
      );

      expect(screen.getByText(/Overspent/)).toBeInTheDocument();
      expect(screen.getByText(/1 500,00 of 1 000,00/)).toBeInTheDocument();
    });

    it('should display "Overspent. X of Y" when spent exceeds assigned (by_date)', () => {
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 100000,
        targetDate: '2026-06-30',
      });
      render(
        <TargetProgressText
          target={target}
          assigned={100000}
          activity={-110000}
          available={-10000}
          currentMonth="2026-01"
        />
      );

      expect(screen.getByText(/Overspent/)).toBeInTheDocument();
      expect(screen.getByText(/1 100,00 of 1 000,00/)).toBeInTheDocument();
    });

    it('should format Norwegian currency correctly in overspent message', () => {
      const target = createMockTarget({ targetAmount: 600000 }); // 6000.00
      render(
        <TargetProgressText
          target={target}
          assigned={600000}
          activity={-692863} // 6928.63 (from screenshot)
          available={-92863}
          currentMonth="2026-01"
        />
      );

      expect(screen.getByText(/6 928,63 of 6 000,00/)).toBeInTheDocument();
    });
  });

  describe('Fully Spent State', () => {
    it('should display "Fully Spent" badge when funded and available is 0', () => {
      const target = createMockTarget({ targetAmount: 100000 });
      render(
        <TargetProgressText
          target={target}
          assigned={100000}
          activity={-100000}
          available={0}
          currentMonth="2026-01"
        />
      );

      expect(screen.getByText('Fully Spent')).toBeInTheDocument();
    });

    it('should display "Fully Spent" badge when funded and available is negative', () => {
      const target = createMockTarget({ targetAmount: 100000 });
      render(
        <TargetProgressText
          target={target}
          assigned={100000}
          activity={-105000}
          available={-5000}
          currentMonth="2026-01"
        />
      );

      // Overspent takes precedence over fully spent
      expect(screen.getByText(/Overspent/)).toBeInTheDocument();
    });

    it('should apply correct styling (green badge) to "Fully Spent"', () => {
      const target = createMockTarget({ targetAmount: 30000 });
      render(
        <TargetProgressText
          target={target}
          assigned={30000}
          activity={-30000}
          available={0}
          currentMonth="2026-01"
        />
      );

      const badge = screen.getByText('Fully Spent');
      expect(badge).toHaveClass('text-green-600');
      expect(badge).toHaveClass('bg-green-100');
    });
  });

  describe('Funded but Not Fully Spent', () => {
    it('should display "Funded. Spent X of Y" when funded with positive available (monthly)', () => {
      const target = createMockTarget({ targetType: 'monthly', targetAmount: 100000 });
      render(
        <TargetProgressText
          target={target}
          assigned={100000}
          activity={-50000}
          available={50000}
          currentMonth="2026-01"
        />
      );

      expect(screen.getByText(/Funded/)).toBeInTheDocument();
      expect(screen.getByText(/Spent 500,00 of 1 000,00/)).toBeInTheDocument();
    });

    it('should display "Funded. Spent X of Y" when funded with positive available (yearly)', () => {
      const target = createMockTarget({ targetType: 'yearly', targetAmount: 100000 });
      render(
        <TargetProgressText
          target={target}
          assigned={100000}
          activity={-25000}
          available={75000}
          currentMonth="2026-01"
        />
      );

      expect(screen.getByText(/Funded/)).toBeInTheDocument();
      expect(screen.getByText(/Spent 250,00 of 1 000,00/)).toBeInTheDocument();
    });

    it('should display "Funded. Spent X of Y" when funded with positive available (by_date)', () => {
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 100000,
        targetDate: '2026-06-30',
      });
      render(
        <TargetProgressText
          target={target}
          assigned={100000}
          activity={-30000}
          available={70000}
          currentMonth="2026-01"
        />
      );

      expect(screen.getByText(/Funded/)).toBeInTheDocument();
      expect(screen.getByText(/Spent 300,00 of 1 000,00/)).toBeInTheDocument();
    });

    it('should display spent as 0 when no activity and fully funded', () => {
      const target = createMockTarget({ targetAmount: 100000 });
      render(
        <TargetProgressText
          target={target}
          assigned={100000}
          activity={0}
          available={100000}
          currentMonth="2026-01"
        />
      );

      expect(screen.getByText(/Funded/)).toBeInTheDocument();
      expect(screen.getByText(/Spent 0,00 of 1 000,00/)).toBeInTheDocument();
    });
  });

  describe('By Date On Track', () => {
    it('should display "On track" when by_date target meets expected progress', () => {
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 60000,
        targetDate: '2026-06-30',
        createdAt: '2026-01-01T00:00:00Z',
      });

      // Month 1 of 6, need 10000 to be on track
      render(
        <TargetProgressText
          target={target}
          assigned={10000}
          activity={0}
          available={10000}
          currentMonth="2026-01"
        />
      );

      expect(screen.getByText('On track')).toBeInTheDocument();
    });

    it('should display "On track" when by_date target exceeds expected progress', () => {
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 60000,
        targetDate: '2026-06-30',
        createdAt: '2026-01-01T00:00:00Z',
      });

      render(
        <TargetProgressText
          target={target}
          assigned={20000} // More than expected 10000
          activity={0}
          available={20000}
          currentMonth="2026-01"
        />
      );

      expect(screen.getByText('On track')).toBeInTheDocument();
    });

    it('should apply correct styling to "On track" text', () => {
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 120000,
        targetDate: '2026-12-31',
        createdAt: '2026-01-01T00:00:00Z',
      });

      render(
        <TargetProgressText
          target={target}
          assigned={10000}
          activity={0}
          available={10000}
          currentMonth="2026-01"
        />
      );

      const text = screen.getByText('On track');
      expect(text).toHaveClass('text-green-600');
      expect(text).toHaveClass('font-medium');
    });
  });

  describe('By Date Underfunded', () => {
    it('should display "X needed this month" when nothing assigned yet', () => {
      // Target: 2095.00 kr by March 15th
      // Current: January (3 months remaining: Jan, Feb, Mar)
      // Available: 0 kr, Assigned: 0 kr
      // Monthly target: 2095.00 / 3 = 698.34 kr (rounded up)
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 209500, // 2095.00 kr
        targetDate: '2026-03-15',
        createdAt: '2025-12-01T00:00:00Z',
      });

      render(
        <TargetProgressText
          target={target}
          assigned={0}
          activity={0}
          available={0}
          currentMonth="2026-01"
        />
      );

      // Should show full monthly amount without "more"
      expect(screen.getByText(/698,34 needed this month/)).toBeInTheDocument();
      expect(screen.queryByText(/more needed/)).not.toBeInTheDocument();
    });

    it('should display "X more needed this month" when partially assigned', () => {
      // Target: 2095.00 kr by March
      // Available: 1047.50 kr (includes this month's 200 kr assignment)
      // Assigned this month: 200 kr
      // Available before this month: 1047.50 - 200 = 847.50 kr
      // Remaining: 2095 - 847.50 = 1247.50 kr
      // Months remaining: 2 (Feb, Mar)
      // Monthly target: 1247.50 / 2 = 623.75 kr (rounded up)
      // More needed: 623.75 - 200 = 423.75 kr
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 209500, // 2095.00 kr
        targetDate: '2026-03-15',
        createdAt: '2025-12-01T00:00:00Z',
      });

      render(
        <TargetProgressText
          target={target}
          assigned={20000} // 200 kr assigned this month
          activity={0}
          available={104750} // 1047.50 kr total (includes this month's 200)
          currentMonth="2026-02" // February, 2 months remaining
        />
      );

      expect(screen.getByText(/423,75 more needed this month/)).toBeInTheDocument();
    });

    it('should display "On track" when monthly target is met', () => {
      // Target: 1500 kr by March
      // Available: 1000 kr (includes this month's 500 kr)
      // Assigned this month: 500 kr
      // Available before: 1000 - 500 = 500 kr
      // Remaining: 1500 - 500 = 1000 kr
      // Months remaining: 2 (Feb, Mar)
      // Monthly target: 1000 / 2 = 500 kr
      // More needed: 500 - 500 = 0 → On track!
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 150000,
        targetDate: '2026-03-30',
        createdAt: '2026-01-01T00:00:00Z',
      });

      render(
        <TargetProgressText
          target={target}
          assigned={50000} // 500 kr assigned this month
          activity={0}
          available={100000} // 1000 kr total (includes this month's 500)
          currentMonth="2026-02"
        />
      );

      expect(screen.getByText('On track')).toBeInTheDocument();
    });

    it('should calculate monthly amount correctly for by_date target with 1 month remaining', () => {
      // Target: 1000 kr by Feb 28, current month is Feb
      // Available: 500 kr
      // Remaining: 500 kr
      // Months remaining: 1
      // Monthly: 500 / 1 = 500 kr
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 100000,
        targetDate: '2026-02-28',
        createdAt: '2026-01-01T00:00:00Z',
      });

      render(
        <TargetProgressText
          target={target}
          assigned={0}
          activity={0}
          available={50000}
          currentMonth="2026-02"
        />
      );

      expect(screen.getByText(/500,00 needed this month/)).toBeInTheDocument();
    });

    it('should handle by_date target in final month', () => {
      // Target: 1000 kr by June 30, current month is June (final month)
      // Available: 200 kr
      // Remaining: 800 kr
      // Months remaining: 1 (same month as target)
      // Should show: 800 kr needed this month
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 100000,
        targetDate: '2026-06-30',
        createdAt: '2026-01-01T00:00:00Z',
      });

      render(
        <TargetProgressText
          target={target}
          assigned={0}
          activity={0}
          available={20000}
          currentMonth="2026-06"
        />
      );

      expect(screen.getByText(/800,00 needed this month/)).toBeInTheDocument();
    });

    it('should round up monthly amount to avoid underfunding', () => {
      // Target: 1001 kr by March (3 months: Jan, Feb, Mar)
      // Available: 0 kr
      // Remaining: 1001 kr
      // Monthly: 1001 / 3 = 333.67 kr (100100 / 3 = 33366.67 cents → rounds up to 33367)
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 100100, // 1001.00 kr
        targetDate: '2026-03-30',
        createdAt: '2026-01-01T00:00:00Z',
      });

      render(
        <TargetProgressText
          target={target}
          assigned={0}
          activity={0}
          available={0}
          currentMonth="2026-01"
        />
      );

      // Should round up to ensure target is met
      expect(screen.getByText(/333,67 needed this month/)).toBeInTheDocument();
    });
  });

  describe('Recurring Underfunded', () => {
    it('should display "X more needed" when monthly target is underfunded', () => {
      const target = createMockTarget({ targetType: 'monthly', targetAmount: 100000 });
      render(
        <TargetProgressText
          target={target}
          assigned={60000}
          activity={0}
          available={60000}
          currentMonth="2026-01"
        />
      );

      expect(screen.getByText(/400,00 more needed/)).toBeInTheDocument();
      // Should not have "by the" text
      expect(screen.queryByText(/by the/)).not.toBeInTheDocument();
    });

    it('should display "X more needed" when yearly target is underfunded', () => {
      const target = createMockTarget({ targetType: 'yearly', targetAmount: 100000 });
      render(
        <TargetProgressText
          target={target}
          assigned={75000}
          activity={0}
          available={75000}
          currentMonth="2026-01"
        />
      );

      expect(screen.getByText(/250,00 more needed/)).toBeInTheDocument();
      expect(screen.queryByText(/by the/)).not.toBeInTheDocument();
    });

    it('should calculate remaining amount correctly for recurring targets', () => {
      const target = createMockTarget({ targetType: 'monthly', targetAmount: 100000 });
      render(
        <TargetProgressText
          target={target}
          assigned={30000}
          activity={0}
          available={30000}
          currentMonth="2026-01"
        />
      );

      // Remaining: 100000 - 30000 = 70000 = 700.00 kr
      expect(screen.getByText(/700,00 more needed/)).toBeInTheDocument();
    });
  });

  describe('Currency Formatting', () => {
    it('should format amounts with Norwegian locale (comma as decimal separator)', () => {
      const target = createMockTarget({ targetAmount: 100000 });
      render(
        <TargetProgressText
          target={target}
          assigned={100000}
          activity={-50000}
          available={50000}
          currentMonth="2026-01"
        />
      );

      // Should use comma, not period
      expect(screen.getByText(/500,00/)).toBeInTheDocument();
      expect(screen.getByText(/1 000,00/)).toBeInTheDocument();
    });

    it('should display 2 decimal places for all amounts', () => {
      const target = createMockTarget({ targetAmount: 100050 }); // 1000.50
      render(
        <TargetProgressText
          target={target}
          assigned={100050}
          activity={-50025} // 500.25
          available={50025}
          currentMonth="2026-01"
        />
      );

      expect(screen.getByText(/500,25/)).toBeInTheDocument();
      expect(screen.getByText(/1 000,50/)).toBeInTheDocument();
    });

    it('should handle large amounts (1000s separator)', () => {
      const target = createMockTarget({ targetAmount: 2200000 }); // 22000.00
      render(
        <TargetProgressText
          target={target}
          assigned={2200000}
          activity={-2196900} // 21969.00 (from screenshot)
          available={3100}
          currentMonth="2026-01"
        />
      );

      expect(screen.getByText(/21 969,00/)).toBeInTheDocument();
      expect(screen.getByText(/22 000,00/)).toBeInTheDocument();
    });
  });

  describe('Negative Assigned Amount', () => {
    it('should calculate remaining correctly when assigned is negative (by_date)', () => {
      // Target: 900 kr by Feb 20 (2 months: Jan, Feb)
      // Assigned: -707.31 kr (money moved out)
      // Activity: +707.31 kr (offsets to 0 available)
      // Available: 0 kr
      // Remaining: 900 - 0 = 900 kr
      // Monthly: 900 / 2 = 450 kr needed this month
      const target = createMockTarget({
        targetType: 'by_date',
        targetAmount: 90000, // 900 kr
        targetDate: '2026-02-20',
      });
      render(
        <TargetProgressText
          target={target}
          assigned={-70731} // -707.31 kr
          activity={70731} // +707.31 kr (offsets to 0 available)
          available={0}
          currentMonth="2026-01"
        />
      );

      // Should show monthly amount: 450.00 needed this month
      expect(screen.getByText(/450,00 needed this month/)).toBeInTheDocument();
    });

    it('should calculate remaining correctly when assigned is negative (monthly)', () => {
      // Target: 1000 kr, Assigned: -500 kr
      // Remaining should be: 1000 - (-500) = 1500 kr
      const target = createMockTarget({
        targetType: 'monthly',
        targetAmount: 100000, // 1000 kr
      });
      render(
        <TargetProgressText
          target={target}
          assigned={-50000} // -500 kr
          activity={25000} // +250 kr
          available={-25000}
          currentMonth="2026-01"
        />
      );

      // Should show: 1500.00 more needed
      expect(screen.getByText(/1 500,00 more needed/)).toBeInTheDocument();
    });

    it('should not show as overspent when assigned is negative and activity offsets it', () => {
      const target = createMockTarget({ targetAmount: 100000 });
      render(
        <TargetProgressText
          target={target}
          assigned={-70731} // -707.31 kr
          activity={70731} // +707.31 kr (offsets perfectly)
          available={0}
          currentMonth="2026-01"
        />
      );

      // Should not show "Overspent"
      expect(screen.queryByText(/Overspent/)).not.toBeInTheDocument();
      // Should show remaining needed
      expect(screen.getByText(/more needed/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle exactly 0 assigned and 0 activity', () => {
      const target = createMockTarget({ targetAmount: 100000 });
      render(
        <TargetProgressText
          target={target}
          assigned={0}
          activity={0}
          available={0}
          currentMonth="2026-01"
        />
      );

      expect(screen.getByText(/1 000,00 more needed/)).toBeInTheDocument();
    });

    it('should handle negative activity (refunds/returns)', () => {
      const target = createMockTarget({ targetAmount: 100000 });
      render(
        <TargetProgressText
          target={target}
          assigned={100000}
          activity={50000} // Positive activity (inflow/refund)
          available={150000}
          currentMonth="2026-01"
        />
      );

      // Should show as funded (assigned >= target)
      expect(screen.getByText(/Funded/)).toBeInTheDocument();
      // Activity is positive, so Math.abs gives 50000 / 100 = 500.00
      // The component shows spent as Math.abs(activity)
      expect(screen.getByText(/Spent 500,00 of 1/)).toBeInTheDocument();
    });

    it('should handle assigned amount exactly matching target amount', () => {
      const target = createMockTarget({ targetAmount: 100000 });
      render(
        <TargetProgressText
          target={target}
          assigned={100000}
          activity={-50000}
          available={50000}
          currentMonth="2026-01"
        />
      );

      expect(screen.getByText(/Funded/)).toBeInTheDocument();
      expect(screen.getByText(/Spent 500,00 of 1 000,00/)).toBeInTheDocument();
    });
  });
});
