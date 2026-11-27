# Test Terraform configuration for Firestore module

# This test verifies the Firestore module configuration

# Verify Firestore database type
verify "firestore_type_native" {
  value = data.terraform_generator.firestore_type_native
}

# Verify point-in-time recovery
verify "firestore_pitr_enabled" {
  value = data.terraform_generator.firestore_pitr_enabled
}