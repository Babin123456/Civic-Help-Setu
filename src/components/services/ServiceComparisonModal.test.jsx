import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import ServiceComparisonModal from './ServiceComparisonModal';
import ComparisonFloatingTray from './ComparisonFloatingTray';
import { services } from '../../data/services';

const renderModal = (comparedServices, isOpen = true) =>
  renderToStaticMarkup(
    <StaticRouter location="/services">
      <ServiceComparisonModal
        isOpen={isOpen}
        onClose={() => {}}
        comparedServices={comparedServices}
        onRemove={() => {}}
        onClear={() => {}}
      />
    </StaticRouter>
  );

describe('ServiceComparisonModal', () => {
  it('renders nothing when closed', () => {
    expect(renderModal([services[0]], false)).toBe('');
  });

  it('shows an empty state with no selection', () => {
    expect(renderModal([])).toContain('No services selected for comparison.');
  });

  it('labels each column and offers per-item removal', () => {
    const html = renderModal([services[0], services[1]]);
    expect(html).toContain(`Remove ${services[0].name} from comparison`);
    expect(html).toContain(`Remove ${services[1].name} from comparison`);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Clear all');
  });

  it('marks missing fields as Not available and adds stacked-layout labels', () => {
    const html = renderModal([services[0], { id: 'bare', name: 'Bare Service' }]);
    expect(html).toContain('Not available');
    expect(html).toContain('data-label="Bare Service"');
    expect(html).not.toContain('Identity &amp; Address Proof');
  });

  it('displays difference summary and diff badges when multiple services are compared', () => {
    const html = renderModal([services[0], services[1]]);
    expect(html).toContain('fields differ');
    expect(html).toContain('Show only differences');
    expect(html).toContain('Differs');
  });
});

describe('ComparisonFloatingTray', () => {
  it('renders nothing without a selection', () => {
    const html = renderToStaticMarkup(
      <ComparisonFloatingTray comparedServices={[]} onOpenModal={() => {}} onClear={() => {}} onRemove={() => {}} />
    );
    expect(html).toBe('');
  });

  it('lists selected services by name with remove and clear controls', () => {
    const html = renderToStaticMarkup(
      <ComparisonFloatingTray
        comparedServices={[services[0]]}
        onOpenModal={() => {}}
        onClear={() => {}}
        onRemove={() => {}}
      />
    );
    expect(html).toContain(services[0].name);
    expect(html).toContain(`Remove ${services[0].name} from comparison`);
    expect(html).toContain('Clear all');
    expect(html).toContain('Compare (1/3)');
  });
});
