# =============================================================================
# Flight Booking — Terraform Variables
# be-flight-booking/infrastructure/terraform/variables.tf
# =============================================================================

variable "do_token" {
  description = "DigitalOcean API Token"
  type        = string
  sensitive   = true
}

variable "ssh_private_key_path" {
  description = "Path to SSH private key"
  type        = string
  default     = "~/.ssh/id_rsa"
}

variable "ssh_public_key_path" {
  description = "Path to SSH public key"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "trusted_ip" {
  description = "Your home/office IP for SSH access"
  type        = string
  default     = "0.0.0.0/0"
}

variable "domain" {
  description = "Your domain name"
  type        = string
  default     = "yourdomain.com"
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "sgp1"
}

variable "staging_size" {
  description = "Staging droplet size"
  type        = string
  default     = "s-2vcpu-4gb"
}

variable "production_size" {
  description = "Production droplet size"
  type        = string
  default     = "s-4vcpu-8gb"
}
