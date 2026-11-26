import { describe, it, expect, beforeEach } from 'vitest';
import {
  PublicWorksAttestationTrailService,
  computeAttestationHash
} from './publicWorksAttestationTrailService.js';

describe('publicWorksAttestationTrailService', () => {
  describe('computeAttestationHash', () => {
    it('computes deterministic hash prefixed with att_', () => {
      const att = {
        projectId: 'proj_metro_line',
        milestoneIndex: 0,
        milestoneName: 'Foundation Piling Complete',
        authority: 'BMRCL',
        evidenceDigest: 'sha256_evidence_1',
        timestamp: '2026-01-01T00:00:00Z'
      };

      const h1 = computeAttestationHash(att, 'genesis');
      const h2 = computeAttestationHash(att, 'genesis');
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^att_[a-f0-9]{8}$/);
    });
  });

  describe('PublicWorksAttestationTrailService', () => {
    let service;

    beforeEach(() => {
      service = new PublicWorksAttestationTrailService();
    });

    it('appends sequential milestone attestations and links previous hashes', () => {
      const m1 = service.appendMilestoneAttestation({
        projectId: 'proj_bridge_7',
        milestoneName: 'Pillar Construction',
        authority: 'PWD Karnataka',
        evidenceDigest: 'sha256_ev1'
      });

      const m2 = service.appendMilestoneAttestation({
        projectId: 'proj_bridge_7',
        milestoneName: 'Deck Slab Casting',
        authority: 'PWD Karnataka',
        evidenceDigest: 'sha256_ev2'
      });

      expect(m1.milestoneIndex).toBe(0);
      expect(m1.previousHash).toBe('genesis');
      expect(m2.milestoneIndex).toBe(1);
      expect(m2.previousHash).toBe(m1.attestationHash);
    });

    it('verifies untampered project trail and includes legal disclaimer', () => {
      service.appendMilestoneAttestation({
        projectId: 'proj_school_up',
        milestoneName: 'Classroom Roofing Complete',
        authority: 'Basic Shiksha Parishad',
        evidenceDigest: 'digest_roof_1'
      });

      const verdict = service.verifyProjectTrail('proj_school_up');
      expect(verdict.valid).toBe(true);
      expect(verdict.length).toBe(1);
      expect(verdict.disclaimer).toContain('certifies that records and evidence hashes were published');
      expect(verdict.disclaimer).toContain('does not certify physical on-site construction quality');
    });

    it('detects tampering or altered evidence digest in the chain', () => {
      service.appendMilestoneAttestation({
        projectId: 'proj_road_9',
        milestoneName: 'Asphalt Layer 1',
        authority: 'NHAI',
        evidenceDigest: 'digest_clean'
      });

      // Tamper with record
      const trail = service.projectTrails.get('proj_road_9');
      trail[0].evidenceDigest = 'digest_altered_malicious';

      const verdict = service.verifyProjectTrail('proj_road_9');
      expect(verdict.valid).toBe(false);
      expect(verdict.reason).toContain('Attestation hash mismatch');
    });

    it('exports portable proof bundle with audit check', () => {
      service.appendMilestoneAttestation({
        projectId: 'proj_park_1',
        milestoneName: 'Fencing Installed',
        authority: 'Municipal Corp',
        evidenceDigest: 'digest_fence'
      });

      const bundle = service.exportProofBundle('proj_park_1');
      expect(bundle.projectId).toBe('proj_park_1');
      expect(bundle.trail.length).toBe(1);
      expect(bundle.auditCheck.valid).toBe(true);
    });
  });
});
