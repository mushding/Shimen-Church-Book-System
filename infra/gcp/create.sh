#!/usr/bin/env bash
# One-shot GCP setup for the smsk k3s VM. Idempotent-ish (re-running skips what exists).
# Cost discipline (docs/survey/03 §10): e2-medium, 20GB pd-standard, no LB, no Ops Agent, no Cloud SQL, storage Standard.
set -euo pipefail
PROJECT=${PROJECT:?set PROJECT=<gcp-project-id>}
ZONE=${ZONE:-asia-east1-b}
VM=${VM:-smsk-k3s}
BUCKET=${BUCKET:-smsk-book-backups}
gcloud config set project "$PROJECT" >/dev/null

# static IP (bind DNS A records book.smsk.church + staging.book.smsk.church to it)
gcloud compute addresses describe smsk-ip --region "${ZONE%-*}" >/dev/null 2>&1 \
  || gcloud compute addresses create smsk-ip --region "${ZONE%-*}"
IP=$(gcloud compute addresses describe smsk-ip --region "${ZONE%-*}" --format='value(address)')

# firewall: only 80/443 (+22 for ssh)
gcloud compute firewall-rules describe smsk-web >/dev/null 2>&1 \
  || gcloud compute firewall-rules create smsk-web --allow tcp:80,tcp:443 --target-tags smsk

# backup bucket, Standard class, 30-day lifecycle
gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1 \
  || gcloud storage buckets create "gs://$BUCKET" --location asia-east1 --default-storage-class STANDARD --uniform-bucket-level-access
printf '{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}' > /tmp/lc.json
gcloud storage buckets update "gs://$BUCKET" --lifecycle-file=/tmp/lc.json

# VM: k3s installed by startup script; VM's default SA gets storage-rw scope so the backup CronJob can gsutil cp
gcloud compute instances describe "$VM" --zone "$ZONE" >/dev/null 2>&1 \
  || gcloud compute instances create "$VM" --zone "$ZONE" \
      --machine-type e2-medium --image-family debian-12 --image-project debian-cloud \
      --boot-disk-size 20GB --boot-disk-type pd-standard \
      --address "$IP" --tags smsk --scopes storage-rw \
      --metadata-from-file startup-script="$(dirname "$0")/startup.sh"

echo "VM $VM ready at $IP — point DNS here, then follow infra/README.md §3 (flux bootstrap)."
