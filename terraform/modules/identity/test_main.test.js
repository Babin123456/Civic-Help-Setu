/**
 * Identity Module Tests
 * 
 * Tests for the Identity (Clerk) Terraform module configuration.
 */

import { describe, it, expect } from 'vitest'

describe('Identity Module', () => {
  describe('Clerk Configuration', () => {
    it('should have clerk API key configured', () => {
      const fs = require('fs')
      const variablesTf = fs.readFileSync(path.join(__dirname, 'variables.tf'), 'utf8')
      
      expect(variablesTf).toContain('clerk_api_key')
    })
    
    it('should enforce least privilege IAM', () => {
      const fs = require('fs')
      const mainTf = fs.readFileSync(path.join(__dirname, 'main.tf'), 'utf8')
      
      expect(mainTf).toContain('least_privilege')
    })
  })
  
  describe('DLP Inspection', () => {
    it('should enable DLP inspection for PII', () => {
      const fs = require('fs')
      const mainTf = fs.readFileSync(path.join(__dirname, 'main.tf'), 'utf8')
      
      expect(mainTf).toContain('dlp_inspect_template')
    })
  })
})