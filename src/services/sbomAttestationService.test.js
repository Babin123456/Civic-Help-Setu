import { describe, it, expect } from 'vitest';
import {
  parsePackageComponents,
  evaluateLicenseCompliance,
  isValidSriIntegrity,
  generateBuildProvenance,
  SbomAttestationManager,
  PERMITTED_LICENSES,
  RESTRICTED_LICENSES
} from './sbomAttestationService.js';

describe('sbomAttestationService', () => {
  describe('parsePackageComponents', () => {
    it('extracts standardized library components and purls from dependencies', () => {
      const deps = {
        react: '^19.0.0',
        lucide_react: '~1.16.0'
      };

      const components = parsePackageComponents(deps, 'production');
      expect(components.length).toBe(2);
      expect(components[0].name).toBe('react');
      expect(components[0].version).toBe('19.0.0');
      expect(components[0].purl).toBe('pkg:npm/react@19.0.0');
      expect(components[0].scope).toBe('production');
    });

    it('handles empty or missing dependencies gracefully', () => {
      expect(parsePackageComponents(null)).toEqual([]);
      expect(parsePackageComponents({})).toEqual([]);
    });
  });

  describe('evaluateLicenseCompliance', () => {
    it('approves permitted permissive open-source licenses', () => {
      for (const lic of PERMITTED_LICENSES) {
        const result = evaluateLicenseCompliance(lic);
        expect(result.compliant).toBe(true);
      }
    });

    it('rejects copyleft and prohibited licenses', () => {
      for (const lic of RESTRICTED_LICENSES) {
        const result = evaluateLicenseCompliance(lic);
        expect(result.compliant).toBe(false);
        expect(result.reason).toContain('copyleft');
      }
    });

    it('flags unknown licenses for manual review', () => {
      const result = evaluateLicenseCompliance('Custom-Proprietary-99');
      expect(result.compliant).toBe(false);
      expect(result.reason).toContain('manual maintainer legal review');
    });
  });

  describe('isValidSriIntegrity', () => {
    it('validates genuine SHA-512 SRI hashes accurately', () => {
      const validSha512 = 'sha512-v4Z5qY8m10sA74rV74e62P7vG5b736T3+3487532984572938457293845729384572938457293845729384572938457293845729384572938457293==';
      expect(isValidSriIntegrity(validSha512)).toBe(true);
      expect(isValidSriIntegrity('md5-badhash')).toBe(false);
      expect(isValidSriIntegrity('')).toBe(false);
      expect(isValidSriIntegrity(null)).toBe(false);
    });
  });

  describe('generateBuildProvenance', () => {
    it('creates in-toto / SLSA v0.2 statement with commit and build metadata', () => {
      const statement = generateBuildProvenance({
        repository: 'https://github.com/GoldRay19/Civic-Help-Setu',
        commitSha: 'e25f1fe0123456789abcdef0123456789abcdef0',
        builderId: 'https://github.com/actions/runner'
      });

      expect(statement._type).toBe('https://in-toto.io/Statement/v0.1');
      expect(statement.predicateType).toBe('https://slsa.dev/provenance/v0.2');
      expect(statement.subject[0].digest.sha256).toBe('e25f1fe0123456789abcdef0123456789abcdef0');
      expect(statement.predicate.builder.id).toBe('https://github.com/actions/runner');
    });

    it('throws error when mandatory commit SHA is missing', () => {
      expect(() => {
        generateBuildProvenance({ repository: 'https://github.com/repo' });
      }).toThrow(/requires valid repository and commit SHA/);
    });
  });

  describe('SbomAttestationManager', () => {
    it('compiles valid CycloneDX SBOM manifest from package configuration', () => {
      const manager = new SbomAttestationManager();
      const mockPkg = {
        name: 'civic-help-setu',
        version: '2.4.0',
        dependencies: { react: '19.0.0' },
        devDependencies: { vitest: '3.0.0' }
      };

      const sbom = manager.compileSbom(mockPkg);
      expect(sbom.bomFormat).toBe('CycloneDX');
      expect(sbom.specVersion).toBe('1.4');
      expect(sbom.components.length).toBe(2);
      expect(sbom.components.some(c => c.name === 'react')).toBe(true);
      expect(sbom.components.some(c => c.name === 'vitest')).toBe(true);
    });
  });
});
