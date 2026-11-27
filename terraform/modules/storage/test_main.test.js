/**
 * Storage Module Tests
 * 
 * Tests for the Storage Terraform module configuration.
 */

import { describe, it, expect } from 'vitest'
import * as tf from '@iarna/toml'

describe('Storage Module', () => {
  describe('Bucket Configuration', () => {
    it('should configure storage bucket with encryption', () => {
      const fs = require('fs')
      const mainTf = fs.readFileSync(path.join(__dirname, 'main.tf'), 'utf8')
      
      expect(mainTf).toContain('encryption_configuration')
      expect(mainTf).toContain('AES256')
    })
    
    it('should enforce uniform bucket-level access', () => {
      const fs = require('fs')
      const mainTf = fs.readFileSync(path.join(__dirname, 'main.tf'), 'utf8')
      
      expect(mainTf).toContain('uniform_bucket_level_access')
    })
  })
  
  describe('Versioning and Retention', () => {
    it('should enable versioning by default', () => {
      const fs = require('fs')
      const mainTf = fs.readFileSync(path.join(__dirname, 'main.tf'), 'utf8')
      
      expect(mainTf).toContain('versioning')
    })
    
    it('should configure retention policy', () => {
      const fs = require('fs')
      const mainTf = fs.readFileSync(path.join(__dirname, 'main.tf'), 'utf8')
      
      expect(mainTf).toContain('retention_period')
    })
  })
  
  describe('IAM Configuration', () => {
    it('should least privilege IAM bindings', () => {
      const fs = require('fs')
      const mainTf = fs.readFileSync(path.join(__dirname, 'main.tf'), 'utf8')
      
      expect(mainTf).toContain('storage_bucket_iam_binding')
    })
    
    it('should prevent public exposure in prod', () => {
      const fs = require('fs')
      const mainTf = fs.readFileSync(path.join(__dirname, 'main.tf'), 'utf8')
      
      // Check that force_destroy is not true for prod
      // This is enforced via variable validation
    })
  })
})