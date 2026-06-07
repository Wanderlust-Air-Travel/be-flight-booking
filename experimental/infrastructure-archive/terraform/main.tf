# =============================================================================
# Flight Booking — Terraform Infrastructure Configuration
# be-flight-booking/infrastructure/terraform/main.tf
# =============================================================================

terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
  required_version = ">= 1.5.0"

  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "digitalocean" {
  token = var.do_token
}

# =============================================================================
# SSH Key
# =============================================================================
resource "digitalocean_ssh_key" "deploy_key" {
  name       = "flight-booking-deploy"
  public_key = file(var.ssh_public_key_path)
}

# =============================================================================
# Firewall
# =============================================================================
resource "digitalocean_firewall" "flight_booking" {
  name = "flight-booking-firewall"

  # Allow Cloudflare tunnel traffic (HTTPS only)
  dynamic "inbound_rule" {
    for_each = toset([
      "173.245.48.0/20",
      "103.21.244.0/22",
      "103.22.200.0/22",
      "103.31.4.0/22",
      "141.101.64.0/18",
      "108.162.192.0/18",
      "190.93.240.0/20",
      "188.114.96.0/20",
      "197.234.240.0/22",
      "198.41.128.0/17",
      "162.158.0.0/15",
      "104.16.0.0/13",
      "104.24.0.0/14",
      "172.64.0.0/13",
      "131.0.72.0/22"
    ])
    content {
      protocol         = "tcp"
      port_range       = "443"
      source_addresses = [inbound_rule.value]
    }
  }

  # SSH only from trusted IP
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = [var.trusted_ip]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "443"
    destination_addresses = ["0.0.0.0/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "80"
    destination_addresses = ["0.0.0.0/0"]
  }

  inbound_rule {
    protocol         = "icmp"
    source_addresses = ["0.0.0.0/0"]
  }

  droplet_ids = [
    digitalocean_droplet.staging.id,
    digitalocean_droplet.production.id,
    digitalocean_droplet.monitoring.id
  ]
}

# =============================================================================
# Staging Droplet
# =============================================================================
resource "digitalocean_droplet" "staging" {
  name     = "flight-booking-staging"
  size     = var.staging_size
  image    = "ubuntu-22-04-x64"
  region   = var.region
  ssh_keys = [digitalocean_ssh_key.deploy_key.id]

  connection {
    host        = self.ipv4_address
    user        = "root"
    private_key = file(var.ssh_private_key_path)
    timeout     = "2m"
  }

  provisioner "file" {
    source      = "../ansible/inventory.ini"
    destination = "/tmp/inventory.ini"
  }

  provisioner "remote-exec" {
    inline = [
      "echo 'Staging server provisioned at ${self.ipv4_address}' >> /tmp/provision.log",
      "timedatectl set-timezone Asia/Ho_Chi_Minh"
    ]
  }

  lifecycle {
    create_before_destroy = true
  }
}

# =============================================================================
# Production Droplet
# =============================================================================
resource "digitalocean_droplet" "production" {
  name     = "flight-booking-production"
  size     = var.production_size
  image    = "ubuntu-22-04-x64"
  region   = var.region
  ssh_keys = [digitalocean_ssh_key.deploy_key.id]

  connection {
    host        = self.ipv4_address
    user        = "root"
    private_key = file(var.ssh_private_key_path)
    timeout     = "2m"
  }

  provisioner "remote-exec" {
    inline = [
      "echo 'Production server provisioned at ${self.ipv4_address}' >> /tmp/provision.log",
      "timedatectl set-timezone Asia/Ho_Chi_Minh"
    ]
  }

  lifecycle {
    create_before_destroy = true
  }
}

# =============================================================================
# Monitoring Droplet (Prometheus + Grafana)
# =============================================================================
resource "digitalocean_droplet" "monitoring" {
  name     = "flight-booking-monitoring"
  size     = "s-2vcpu-4gb"
  image    = "ubuntu-22-04-x64"
  region   = var.region
  ssh_keys = [digitalocean_ssh_key.deploy_key.id]

  connection {
    host        = self.ipv4_address
    user        = "root"
    private_key = file(var.ssh_private_key_path)
    timeout     = "2m"
  }

  provisioner "remote-exec" {
    inline = [
      "timedatectl set-timezone Asia/Ho_Chi_Minh"
    ]
  }

  lifecycle {
    create_before_destroy = true
  }
}

# =============================================================================
# Floating IP for Production (static IP)
# =============================================================================
resource "digitalocean_floating_ip" "prod_static" {
  region = var.region
}

resource "digitalocean_floating_ip_assignment" "prod_static" {
  ip_address = digitalocean_floating_ip.prod_static.ip_address
  droplet_id = digitalocean_droplet.production.id
}

# =============================================================================
# DNS Records (if using DigitalOcean DNS)
# =============================================================================
resource "digitalocean_record" "staging_api" {
  domain = var.domain
  type   = "A"
  name   = "api-staging"
  value  = digitalocean_droplet.staging.ipv4_address
  ttl    = 300
}

resource "digitalocean_record" "staging_frontend" {
  domain = var.domain
  type   = "A"
  name   = "staging"
  value  = digitalocean_droplet.staging.ipv4_address
  ttl    = 300
}

resource "digitalocean_record" "prod_api" {
  domain = var.domain
  type   = "A"
  name   = "api"
  value  = digitalocean_floating_ip.prod_static.ip_address
  ttl    = 300
}

resource "digitalocean_record" "prod_frontend" {
  domain = var.domain
  type   = "A"
  name   = "www"
  value  = digitalocean_floating_ip.prod_static.ip_address
  ttl    = 300
}

resource "digitalocean_record" "monitoring" {
  domain = var.domain
  type   = "A"
  name   = "monitoring"
  value  = digitalocean_droplet.monitoring.ipv4_address
  ttl    = 300
}

# =============================================================================
# Outputs
# =============================================================================
output "staging_ip" {
  description = "Staging server IP address"
  value       = digitalocean_droplet.staging.ipv4_address
}

output "production_ip" {
  description = "Production server static IP"
  value       = digitalocean_floating_ip.prod_static.ip_address
}

output "monitoring_ip" {
  description = "Monitoring server IP address"
  value       = digitalocean_droplet.monitoring.ipv4_address
}

output "ssh_connection_staging" {
  description = "SSH command for staging"
  value       = "ssh -i ${var.ssh_private_key_path} root@${digitalocean_droplet.staging.ipv4_address}"
}

output "ssh_connection_production" {
  description = "SSH command for production"
  value       = "ssh -i ${var.ssh_private_key_path} root@${digitalocean_floating_ip.prod_static.ip_address}"
}
