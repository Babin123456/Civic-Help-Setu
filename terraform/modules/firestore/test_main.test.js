/**
 * Firestore Module Tests
 * 
 * Tests for the Firestore Terraform module configuration.
 * Uses Vitest for unit testing of Terraform configuration.
 */

import { describe, it, expect } from 'vitest'
import * as tf from '@iarna/toml'

describe('Firestore Module', () => {
  describe('Database Configuration', () => {
    it('should set Firestore to native mode', () => {
      // Read the main.tf and verify native mode
      const fs = require('fs')
      const path = require('path')
      const mainTf = fs.readFileSync(path.join(__dirname, 'main.tf'), 'utf8')
      
      // Verify FIRESTORE_NATIVE type is used
      expect(mainTf).toContain('FIRESTORE_NATIVE')
    })
    
    it('should enable point-in-time recovery', () => {
      const fs = require('fs')
      const mainTf = fs.readFileSync(path.join(__dirname, 'main.tf'), 'utf8')
      
      expect(mainTf).toContain('point_in_time_recovery')
      expect(mainTf).toContain('enable_point_in_time_recovery')
    })
  })
  
  describe('Index Configuration', () => {
    it('should accept custom indexes', () => {
      const fs = require('fs')
      const mainTf = fs.readFileSync(path.join(__dirname, 'main.tf'), 'utf8')
      
      expect(mainTf).toContain('custom_indexes')
    })
  })
})