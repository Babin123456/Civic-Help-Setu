import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
  minimizeDocumentNumber,
  minimizePhoneNumber,
  minimizeVaultDocuments,
  minimizeAppointments,
} from './dataMinimization';
import { saveDocument, getDocuments, importVaultData, exportVaultData } from './vaultStorage';
import { isDuplicateDocument } from './vaultValidation';
import { bookOfficeAppointment, getOfficeAppointments } from './locationService';
import { clearUserData } from './clearMyDataService';
import SharedDeviceNotice from '../components/privacy/SharedDeviceNotice';

const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
  };
};

beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorage());
});

describe('minimizeDocumentNumber', () => {
  it('keeps only the last four characters', () => {
    expect(minimizeDocumentNumber('1234 5678 9012')).toBe('XXXX 9012');
    expect(minimizeDocumentNumber('abcde1234f')).toBe('XXXX 234F');
    expect(minimizeDocumentNumber('DL-142022019')).toBe('XXXX 2019');
  });

  it('is stable on values that are already masked', () => {
    expect(minimizeDocumentNumber('XXXX 9012')).toBe('XXXX 9012');
    expect(minimizeDocumentNumber('XXXX XXXX 1234')).toBe('XXXX 1234');
  });

  it('leaves numbers of four characters or fewer and handles empty input', () => {
    expect(minimizeDocumentNumber('123')).toBe('123');
    expect(minimizeDocumentNumber('')).toBe('');
    expect(minimizeDocumentNumber(null)).toBe('');
  });
});

describe('minimizePhoneNumber', () => {
  it('keeps only the last four digits', () => {
    expect(minimizePhoneNumber('98765 43210')).toBe('XXXXXX3210');
    expect(minimizePhoneNumber('+91-9876543210')).toBe('XXXXXX3210');
    expect(minimizePhoneNumber('XXXXXX3210')).toBe('XXXXXX3210');
    expect(minimizePhoneNumber('')).toBe('');
  });
});

describe('record helpers', () => {
  it('returns the same array when nothing needs changing', () => {
    const docs = [{ id: 'a', number: 'XXXX 1234' }];
    expect(minimizeVaultDocuments(docs)).toBe(docs);
    const apts = [{ id: 'a', contactNumber: 'XXXXXX3210' }];
    expect(minimizeAppointments(apts)).toBe(apts);
  });

  it('leaves other fields alone', () => {
    const out = minimizeVaultDocuments([{ id: 'a', type: 'PAN', number: 'ABCDE1234F', notes: 'n' }]);
    expect(out[0]).toEqual({ id: 'a', type: 'PAN', number: 'XXXX 234F', notes: 'n' });
  });
});

describe('vault storage never keeps full numbers', () => {
  it('masks a new document before saving', () => {
    saveDocument({ type: 'Passport', category: 'Identity', number: 'Z1234567' });
    expect(localStorage.getItem('civicbridge_vault_docs')).not.toContain('Z1234567');
    expect(getDocuments()[0].number).toBe('XXXX 4567');
  });

  it('masks an edited document', () => {
    getDocuments();
    saveDocument({ id: 'doc-1', number: '9999 8888 7777' });
    expect(localStorage.getItem('civicbridge_vault_docs')).not.toContain('9999 8888');
    expect(getDocuments().find((d) => d.id === 'doc-1').number).toBe('XXXX 7777');
  });

  it('masks full numbers saved before this change, once', () => {
    localStorage.setItem(
      'civicbridge_vault_docs',
      JSON.stringify([{ id: 'old', type: 'Aadhaar Card', number: '1234 5678 9012' }])
    );
    expect(getDocuments()[0].number).toBe('XXXX 9012');
    expect(localStorage.getItem('civicbridge_vault_docs')).not.toContain('5678');
  });

  it('masks numbers coming from an imported backup, and the export has none', () => {
    const backup = JSON.stringify({ documents: [{ id: 'imp', type: 'PAN Card', number: 'ABCDE1234F' }] });
    expect(importVaultData(backup).success).toBe(true);
    expect(localStorage.getItem('civicbridge_vault_docs')).not.toContain('ABCDE1234F');
    expect(exportVaultData()).not.toContain('ABCDE1234F');
  });

  it('still detects a duplicate against a masked stored number', () => {
    const stored = [{ id: 'a', type: 'Passport', number: 'XXXX 4567' }];
    expect(isDuplicateDocument({ type: 'passport', number: 'Z1234567' }, stored)).toBe(true);
    expect(isDuplicateDocument({ type: 'passport', number: 'Z1239999' }, stored)).toBe(false);
  });
});

describe('appointments never keep the full mobile number', () => {
  it('masks the number when booking', () => {
    const booked = bookOfficeAppointment({
      officeId: 'o1',
      officeName: 'Office',
      serviceName: 'Service',
      applicantName: 'A Citizen',
      contactNumber: '9876543210',
      appointmentDate: '2026-11-01',
      timeSlot: '09:30',
    });
    expect(booked.contactNumber).toBe('XXXXXX3210');
    expect(localStorage.getItem('civicbridge_office_tokens')).not.toContain('9876543210');
  });

  it('masks bookings made before this change', () => {
    localStorage.setItem('civicbridge_office_tokens', JSON.stringify([{ id: 'x', contactNumber: '9876543210' }]));
    expect(getOfficeAppointments()[0].contactNumber).toBe('XXXXXX3210');
    expect(localStorage.getItem('civicbridge_office_tokens')).not.toContain('9876543210');
  });
});

describe('clearing', () => {
  it('removes the vault and appointment keys but not unrelated site data', () => {
    saveDocument({ type: 'Passport', number: 'Z1234567' });
    bookOfficeAppointment({
      officeId: 'o',
      officeName: 'O',
      serviceName: 'S',
      applicantName: 'A',
      contactNumber: '9876543210',
    });
    localStorage.setItem('some_other_site_key', 'keep');
    clearUserData({ categories: ['vault', 'tracking'], actorId: 'device' });
    expect(localStorage.getItem('civicbridge_vault_docs')).toBeNull();
    expect(localStorage.getItem('civicbridge_office_tokens')).toBeNull();
    expect(localStorage.getItem('some_other_site_key')).toBe('keep');
  });
});

describe('SharedDeviceNotice', () => {
  it('says records may be visible on a shared device and links to clearing', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SharedDeviceNotice what="tracked applications" />
      </MemoryRouter>
    );
    expect(html).toContain('tracked applications');
    expect(html).toContain('other people use this device');
    expect(html).toContain('href="/privacy"');
  });
});
