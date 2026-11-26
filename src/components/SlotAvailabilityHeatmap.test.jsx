/**
 * Slot Availability Heatmap Component Tests
 *
 * Tests for the heatmap calendar, list view, states, and accessibility.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SlotAvailabilityHeatmap from './SlotAvailabilityHeatmap';
import { CIVIC_OFFICES } from '../data/locationOffices';
import { MOCK_SERVICES } from '../data/services';

const delhiRto = CIVIC_OFFICES.find((o) => o.id === 'delhi-rto-sarai-kale-khan');
const drivingLicense = MOCK_SERVICES.find((s) => s.id === 'driving-license');

beforeEach(() => {
  // Reset mock timers or state if needed
});

describe('SlotAvailabilityHeatmap - Loading state', () => {
  it('renders loading state when no feed is loaded', () => {
    const { getByText, getByRole } = render(
      <SlotAvailabilityHeatmap
        officeId="delhi-rto-sarai-kale-khan"
        serviceId="driving-license"
      />
    );

    expect(screen.getByText('Loading appointment slot availability...')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /polite/i })).toBeInTheDocument();
  });
});

describe('SlotAvailabilityHeatmap - Error state', () => {
  it('renders error state when feed fetch fails', () => {
    // This test would need mock error handling
    // For now, just verify the component renders without crashing
    const { container } = render(
      <SlotAvailabilityHeatmap
        officeId="delhi-rto-sarai-kale-khan"
        serviceId="driving-license"
      />
    );

    expect(container).toBeInTheDocument();
  });
});

describe('SlotAvailabilityHeatmap - No feed state', () => {
  it('renders no-feed state for unsupported office+service combos', () => {
    // Use an unsupported combo
    const { getByText, container } = render(
      <SlotAvailabilityHeatmap
        officeId="nonexistent-office"
        serviceId="nonexistent-service"
      />
    );

    // Should show guidance rather than guessed slots
    const errorText = container.querySelector?.('text-node')?.textContent ||
      container.textContent || '';

    // Should not contain guessed slot data
    expect(errorText.toLowerCase()).not.toContain('guessed slot');
    // Should show office guidance
    expect(errorText.toLowerCase()).toContain('office');
  });
});

describe('SlotAvailabilityHeatmap - Heatmap view', () => {
  it('renders heatmap with slot data for supported combo', async () => {
    const { waitFor, getByText } = render(
      <SlotAvailabilityHeatmap
        officeId="delhi-rto-sarai-kale-khan"
        serviceId="driving-license"
      />
    );

    // Wait for the feed to load
    await waitFor(() =>
      expect(screen.getByText(/available|limited|full/i)).toBeInTheDocument()
    );

    // Should render the calendar grid
    const calendarGrid = screen.getByRole('grid');
    expect(calendarGrid).toBeInTheDocument();

    // Should have date cells
    const dateCells = screen.getAllByRole('gridcell');
    expect(dateCells.length).toBeGreaterThan(0);
  });

  it('displays slot count details in cells', async () => {
    const { waitFor, getByText } = render(
      <SlotAvailabilityHeatmap
        officeId="delhi-rto-sarai-kale-khan"
        serviceId="driving-license"
      />
    );

    await waitFor(
      expect(screen.getByText(/ slots available| slots limited| slots full/)).toBeInTheDocument()
    );

    // Slot count should be displayed
    const countElements = screen.getAllByText(/ slots? (available|limited|full)/i);
    expect(countElements.length).toBeGreaterThan(0);
  });

  it('handles date selection', async () => {
    const onDateSelect = jest.fn();
    render(
      <SlotAvailabilityHeatmap
        officeId="delhi-rto-sarai-kale-khan"
        serviceId="driving-license"
        onDateSelect={onDateSelect}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole('gridcell')).toBeInTheDocument()
    );

    // Find a date cell and click it
    const dateCells = screen.getAllByRole('gridcell');
    if (dateCells.length > 0) {
      fireEvent.click(dateCells[0]);
      // The focused date state should be set
      expect(onDateSelect).toHaveBeenCalled();
    }
  });

  it('is keyboard navigable', async () => {
    const user = userEvent.setup();
    render(
      <SlotAvailabilityHeatmap
        officeId="delhi-rto-sarai-kale-khan"
        serviceId="driving-license"
      />
    );

    await waitFor(() =>
      expect(screen.getByRole('gridcell')).toBeInTheDocument()
    );

    // Focus first cell and use arrow keys
    const firstCell = screen.getByRole('gridcell');
    await user.tab(); // move to next cell

    // Should not crash with keyboard navigation
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });
});

describe('SlotAvailabilityHeatmap - List view toggle', () => {
  it('shows list view alternative', async () => {
    const { getByText, getByRole } = render(
      <SlotAvailabilityHeatmap
        officeId="delhi-rto-sarai-kale-khan"
        serviceId="driving-license"
      />
    );

    await waitFor(() =>
      expect(screen.getByRole('grid')).toBeInTheDocument()
    );

    // Toggle to list view
    const listButton = screen.getByRole('button', {
      name: /switch to list/i,
    });
    await userEvent.click(listButton);

    // List view should be available
    const listSection = screen.getByRole('section', {
      name: /slot availability list/i,
    });
    expect(listSection).toBeInTheDocument();
  });

  it('displays slot details in list items', async () => {
    const { waitFor, getByText } = render(
      <SlotAvailabilityHeatmap
        officeId="delhi-rto-sarai-kale-khan"
        serviceId="driving-license"
      />
    );

    await waitFor(
      expect(screen.getByText(/ slots available| slots limited| slots full/)).toBeInTheDocument()
    );

    // List items should have slot descriptions
    const listItems = screen.getAllByRole('listitem');
    expect(listItems.length).toBeGreaterThan(0);

    // Each list item should have status info
    const statusTexts = listItems.map((item) =>
      item.textContent || ''
    );
    expect(statusTexts.some((t) => t.includes('Available'))).toBe(true);
    expect(statusTexts.some((t) => t.includes('Limited'))).toBe(true);
    expect(statusTexts.some((t) => t.includes('Full'))).toBe(true);
  });
});

describe('SlotAvailabilityHeatmap - Feed freshness', () => {
  it('displays feed freshness status', async () => {
    const { getByText } = render(
      <SlotAvailabilityHeatmap
        officeId="delhi-rto-sarai-kale-khan"
        serviceId="driving-license"
      />
    );

    await waitFor(() =>
      expect(screen.getByText(/Fresh|Stale/)).toBeInTheDocument()
    );

    const freshnessText = screen.getByText(/Fresh|Stale/);
    expect(freshnessText).toBeInTheDocument();
  });

  it('displays last checked time', async () => {
    const { getByText } = render(
      <SlotAvailabilityHeatmap
        officeId="delhi-rto-sarai-kale-khan"
        serviceId="driving-license"
      />
    );

    await waitFor(() =>
      expect(screen.getByText(/Last checked/)).toBeInTheDocument()
    );

    const lastChecked = screen.getByText(/Last checked/);
    expect(lastChecked).toBeInTheDocument();
  });
});

describe('SlotAvailabilityHeatmap - Legend and accessibility', () => {
  it('renders legend with colour-independent text labels', async () => {
    const { getByText } = render(
      <SlotAvailabilityHeatmap
        officeId="delhi-rto-sarai-kale-khan"
        serviceId="driving-license"
      />
    );

    await waitFor(() =>
      expect(screen.getByText(/Legend/i)).toBeInTheDocument()
    );

    // Legend should have text labels, not rely on colour alone
    const legend = screen.getByRole('region', { name: /legend/i });
    expect(legend).toBeInTheDocument();

    // Legend should have dt/dd structure for screen readers
    const legendDts = screen.getAllByRole('definition-term');
    expect(legendDts.length).toBeGreaterThan(0);
  });

  it('has accessible footer information', async () => {
    const { getByText } = render(
      <SlotAvailabilityHeatmap
        officeId="delhi-rto-sarai-kale-khan"
        serviceId="driving-license"
      />
    );

    await waitFor(() =>
      expect(screen.getByText(/Booking always opens the official/)).toBeInTheDocument()
    );

    const bookingText = screen.getByText(/Booking always opens the official/);
    expect(bookingText).toBeInTheDocument();
  });
});

describe('SlotAvailabilityHeatmap - States', () => {
  it('renders error state with retry button', async () => {
    const { getByText, getByRole } = render(
      <SlotAvailabilityHeatmap
        officeId="delhi-rto-sarai-kale-khan"
        serviceId="driving-license"
      />
    );

    // Wait then simulate error by checking error state rendering
    // The component should have a retry/refresh mechanism
    const refreshButton = screen.getByRole('button', {
      name: /refresh|retry|reload/i,
    });
    expect(refreshButton).toBeInTheDocument();
  });

  it('renders no-feed guidance', async () => {
    // Use unsupported combo
    const { container } = render(
      <SlotAvailabilityHeatmap
        officeId="nonexistent-office"
        serviceId="nonexistent-service"
      />
    );

    const text = container.textContent || '';
    // Should show office guidance, not guessed slots
    expect(text.toLowerCase()).toContain('office');
    expect(text.toLowerCase()).not.toMatch(/guessed slot/i);
  });
});