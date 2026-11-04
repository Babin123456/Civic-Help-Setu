import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ShareableProfileModal from './ShareableProfileModal';

describe('ShareableProfileModal Component (#455)', () => {
  const mockUser = { id: 'u101', username: 'testuser' };
  const mockProfile = {
    fullName: 'Ramesh Patel',
    state: 'Gujarat',
    district: 'Ahmedabad',
    category: 'OBC',
  };

  it('renders modal with privacy assurances and field visibility options', () => {
    const html = renderToStaticMarkup(
      <ShareableProfileModal
        isOpen={true}
        onClose={() => {}}
        currentUser={mockUser}
        profileData={mockProfile}
      />
    );

    expect(html).toContain('Privacy-Controlled Profile Sharing');
    expect(html).toContain('Private documents, identity numbers, and contact details are permanently excluded');
    expect(html).toContain('Full Name');
    expect(html).toContain('State &amp; District Location');
    expect(html).toContain('Generate Privacy-Safe Link');
  });

  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <ShareableProfileModal
        isOpen={false}
        onClose={() => {}}
        currentUser={mockUser}
        profileData={mockProfile}
      />
    );

    expect(html).toBe('');
  });
});
