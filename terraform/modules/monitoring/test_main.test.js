/**
 * Monitoring Module Tests
 * 
 * Tests for the Monitoring Terraform module configuration.
 */

import { describe, it, expect } from 'vitest'

describe('Monitoring Module', () => {
  describe('Alert Policies', () => {
    it('should create policy drift alert', () => {
      const fs = require('fs')
      const mainTf = fs.readFileSync(path.join(__dirname, 'main.tf'), 'utf8')
      
      expect(mainTf).toContain('alert_policy')
      expect(mainTf).toContain('policy_drift')
    })
    
    it('should create public exposure alert', () => {
      const fs = require('fs')
      const mainTf = fs.readFileSync(path.join(__dirname, 'main.tf'), 'utf8')
      
      expect(mainTf).toContain('public_exposure')
    })
  })
  
  describe('Custom Metrics', () => {
    it('should define policy_drift metric', () => {
      const fs = require('fs')
      const mainTf = fs.readFileSync(path.join(__dirname, 'main.tf'), 'utf8')
      
      expect(mainTf).toContain('policy_drift')
    })
    
    it('should define storage_public_access metric', () => {
      const fs = require('fs')
      const mainTf = fs.readFileSync(path.join(__dirname, 'main.tf'), 'utf8')
      
      expect(mainTf).toContain('storage_public_access')
    })
  })
})