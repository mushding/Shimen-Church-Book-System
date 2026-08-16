#!/usr/bin/env bash
# GCE startup script: install k3s (Traefik + local-path bundled) once. Flux is bootstrapped from your laptop (README §3).
set -euo pipefail
if ! command -v k3s >/dev/null; then
  curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server --write-kubeconfig-mode 644" sh -
fi
# small swap: e2-medium has 4GB; k3s + postgres + flux + cert-manager fit, swap is a safety net
if ! swapon --show | grep -q swapfile; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
