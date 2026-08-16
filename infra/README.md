# infra — GCP 單 VM + k3s + Flux（Phase 4）

成本紀律：`docs/survey/03` §10。**不開 GCP LB、不開第二台 VM、20GB disk、無 Ops Agent、無 Cloud SQL。**
拓撲：1× e2-medium（asia-east1）→ k3s（Traefik、local-path）→ Flux 拉本 repo `infra/`。
namespace：`smsk`（prod, `book.smsk.church`）、`smsk-staging`（`staging.book.smsk.church`）。每個 ns 各一組 app + Postgres。

```
infra/
  clusters/smsk/      Flux Kustomizations（controllers → apps-staging / apps-prod）
  controllers/        cert-manager/（HelmRelease）→ issuers/（ClusterIssuer letsencrypt, HTTP-01 via Traefik）
  apps/base/          postgres StatefulSet、app Deployment/Service、Ingress+redirect、pg-backup CronJob→GCS
  apps/staging|prod/  namespace、host、image newTag（CI 自動改）、PVC 大小
  gcp/                create.sh（IP/防火牆/bucket/VM）、startup.sh（k3s）
```

## 1. Image / 部署流程
- `.github/workflows/ci.yml`：typecheck + vitest + build + Playwright e2e。
- `.github/workflows/image.yml`：push `main` → `ghcr.io/mushding/shimen-church-book-system:sha-xxxxxxx` 並改 `infra/apps/staging/kustomization.yaml` 的 `newTag`（commit `[skip ci]`）→ Flux 5 分鐘內滾 staging。
  推 tag `v1.2.3` → 同 image tag → 改 `infra/apps/prod` → prod。
- 手動回滾：改 overlay `newTag` 成舊 sha，push。

> GHCR package 第一次建出來預設 private → GitHub Packages 設定改 **public**（k3s 才拉得到，不用 imagePullSecret）。或建 `ghcr` pull secret 並在 Deployment 加 `imagePullSecrets`。

> **狀態（2026-08-16）**：§2–§4 已做完。project `smsk-app`、VM `smsk-k3s` = `104.199.232.239`、Flux 已 bootstrap、secrets 已建。剩 DNS + LINE callback + 第一個 prod tag。

## 2. GCP（一次）
```sh
gcloud auth login
PROJECT=smsk-app ./infra/gcp/create.sh   # project 已建、已綁 billing、compute/storage API 已開        # static IP、fw 80/443、bucket、VM(e2-medium, 20GB pd-standard, k3s)
```
DNS：`book.smsk.church` 與 `staging.book.smsk.church` A 記錄 → 印出的 IP（Cloudflare 上可先 DNS-only；HTTP-01 簽完再開 proxy 也可）。
CUD：Console → Compute → Committed use discounts → 1 年 E2 1 vCPU/4GB asia-east1（US$35 → 24.6/月）。

## 3. Flux bootstrap（一次，從筆電）
```sh
brew install fluxcd/tap/flux
gcloud compute ssh smsk-k3s --zone asia-east1-b -- sudo cat /etc/rancher/k3s/k3s.yaml > ~/.kube/smsk.yaml
sed -i '' "s/127.0.0.1/<VM_IP>/" ~/.kube/smsk.yaml && export KUBECONFIG=~/.kube/smsk.yaml
kubectl get nodes                                        # Ready
export GITHUB_TOKEN=$(gh auth token -u mushding)          # 需 repo scope；flux 會建 deploy key
flux bootstrap github --owner=mushding --repository=Shimen-Church-Book-System --branch=main --path=infra/clusters/smsk --personal
```
（VM 6443 需對筆電開：`gcloud compute firewall-rules create smsk-k8s --allow tcp:6443 --target-tags smsk --source-ranges <你的IP>/32`；或改用 `gcloud compute ssh -- -L 6443:127.0.0.1:6443` 隧道。）

## 4. Secrets（每個 namespace 一次，不進 git）
```sh
for NS in smsk smsk-staging; do
  PW=$(openssl rand -hex 16)
  kubectl -n $NS create secret generic smsk-postgres --from-literal=password=$PW
  kubectl -n $NS create secret generic smsk-app \
    --from-literal=DATABASE_URL="postgres://smsk:$PW@postgres:5432/smsk" \
    --from-literal=BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
    --from-literal=LINE_CHANNEL_ID=2005605761 \
    --from-literal=LINE_CHANNEL_SECRET=<secret>
done
```
（namespace 由 Flux 建；若 Flux 先跑會卡在 secret 缺 → 建完自動好。要 git 化 secrets 再加 SOPS+age。）
LINE console callback 加：`https://book.smsk.church/api/auth/oauth2/callback/line`、`https://staging.book.smsk.church/api/auth/oauth2/callback/line`。

## 5. 驗證
```sh
flux get kustomizations            # controllers / apps-staging / apps-prod Ready
kubectl -n smsk-staging get pods,ing,certificate
curl -I https://staging.book.smsk.church/healthz
```
第一個 admin：`kubectl -n smsk exec -it deploy/app -- ./node_modules/.bin/tsx scripts/set-role.ts <LINE userId> admin`。

## 6. 備份 / 還原
CronJob 每天 03:17 台北 `pg_dump | gzip` → `gs://smsk-book-backups/<ns>/`（bucket lifecycle 30 天）。
還原：`gsutil cp gs://…/smsk-YYYY-MM-DD.sql.gz - | gunzip | kubectl -n smsk exec -i postgres-0 -- psql -U smsk smsk`。
手動觸發：`kubectl -n smsk create job --from=cronjob/pg-backup pg-backup-now`。

## 7. 資源預估（e2-medium 4GB）
k3s ~600MB、flux ~250MB、cert-manager ~120MB、每 ns（app 128–384MB + pg 128–512MB）。兩個 ns 約 2.5GB 峰值 + 1GB swap。緊了就把 staging `replicas: 0`。
