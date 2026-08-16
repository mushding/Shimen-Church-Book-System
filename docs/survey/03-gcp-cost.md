# 03 - GCP Hosting 成本調查（石門教會場地預約系統）

> **報價基準日：2026-08-15**
> 所有單價皆為 **US$**，region **asia-east1（台灣，彰化）**，不含稅。
> TWD 換算以 **1 USD = 32 TWD** 概算。
> 月費一律以 **730 小時/月** 計算（GCP 官方 monthly 欄位慣例為 730h；cluster fee 的 free tier credit 則以 744h 為上限）。

## 0. 資料來源與可信度

本文的單價**不是**從部落格或二手整理來的。除了少數註明處，全部直接查 **Google Cloud Billing Catalog API**（`cloudbilling.googleapis.com/v1/services/{id}/skus`），該 API 回傳的就是計費系統實際使用的 SKU 價目，本次查詢到的 SKU `effectiveTime` 為 `2026-08-15T07:00:00Z`，即當日生效價。

搭配的官方文件頁面：

- VM 價格：<https://cloud.google.com/compute/vm-instance-pricing>
- Disk / image 價格：<https://cloud.google.com/compute/disks-image-pricing>
- 網路（external IP、egress、Load Balancing）：<https://cloud.google.com/vpc/network-pricing>
- GKE：<https://cloud.google.com/kubernetes-engine/pricing>
- Cloud Run：<https://cloud.google.com/run/pricing>
- Cloud SQL：<https://cloud.google.com/sql/pricing>
- Always Free 額度：<https://cloud.google.com/free/docs/free-cloud-features>
- Sustained use discounts：<https://docs.cloud.google.com/compute/docs/sustained-use-discounts>
- Committed use discounts：<https://docs.cloud.google.com/compute/docs/instances/signing-up-committed-use-discounts>
- 交叉驗證（第三方，資料日期 2026-08-09）：<https://gcloud-compute.com/e2-medium.html>、<https://gcloud-compute.com/e2-small.html>

---

## 1. 摘要表

| # | 方案 | US$/月 | NT$/月 | 關鍵 caveat |
|---|------|-------:|-------:|-------------|
| **A-1** | 單 VM **e2-small** + k3s（prod+staging namespace） | **20.92** | 669 | 2 GB RAM 要塞 k3s + Postgres + 6 容器，非常吃緊，不建議 |
| **A-2** | 單 VM **e2-medium** + k3s（on-demand） | **35.08** | 1,123 | **E2 沒有 sustained use discount**，這就是實付價 |
| **A-3** | 同上，買 **1 年 CUD** | **24.60** | 787 | 綁約 1 年；E2 shared-core 可買 CUD（f1/g1-micro 不行）|
| **A-4** | 同上，買 **3 年 CUD** | **19.50** | 624 | 綁 3 年，對教會小專案風險偏高 |
| **B** | 同一台 VM 改用 **docker compose** | **與 A 完全相同** | — | 基礎設施費用 **零差異**，差別只在維運心智與 k8s 學習價值 |
| **C** | **GKE Autopilot** 1 cluster（prod+staging pods）+ 外部 ALB | **113.91** | 3,645 | cluster fee 被 free tier 吃掉，但 **pod CPU 就 US$75** |
| **D-1** | **GKE Standard** 1 zonal cluster + **1×e2-medium** node + ALB | **55.49** | 1,776 | 這台 node **裝不下**題目給的 2 vCPU requests（見 §5）|
| **D-2** | 同上但 **2×e2-medium**（實際可跑） | **89.46** | 2,863 | 真正能跑起來的 GKE Standard 價位 |
| **E-1** | **Cloud Run** ×4 services + **Cloud SQL db-f1-micro**（1 台共用兩環境） | **11.04** | 353 | 需自訂網域的話 +18.41（見 §7）；DB 無 SLA |
| **E-2** | 同上但 **prod/staging 各一台 Cloud SQL** | **20.96** | 671 | 環境隔離較乾淨 |
| **E-3** | **Cloud Run** + **Supabase Free**（Tokyo）或 **Neon Free**（Singapore） | **1.11** | 36 | Supabase 免費版 7 天無流量會 pause；Neon **沒有台灣/東京** |
| — | **DigitalOcean 現況 baseline** | **12.00** | 384 | 題目給定值（2 GB droplet，備份走 GitLab） |

**一句話**：GCP 沒有任何方案能便宜過現有的 DO US$12。最接近的是 Cloud Run + 免費 Postgres（US$1.11，但架構完全不同），而「保留 k8s 學習價值又最便宜」的是 **A-3：單台 e2-medium + k3s + 1 年 CUD = US$24.60/月**。

---

## 2. 共用單價表（asia-east1，2026-08-15）

| 項目 | 單價 (USD) | 來源 |
|------|-----------:|------|
| E2 vCPU（on-demand） | 0.02525538 / vCPU-hr | Billing Catalog `E2 Instance Core running in APAC` |
| E2 RAM（on-demand） | 0.00338514 / GiB-hr | Billing Catalog `E2 Instance Ram running in APAC` |
| E2 vCPU / RAM（1 yr CUD） | 0.015910889 / 0.002132638 | `Commitment v1: E2 Cpu/Ram in APAC for 1 Year` |
| E2 vCPU / RAM（3 yr CUD） | 0.011364921 / 0.001523313 | `Commitment v1: E2 Cpu/Ram in APAC for 3 Year` |
| E2 vCPU / RAM（Spot） | 0.01191 / 0.001597 | `Spot Preemptible E2 Instance Core/Ram running in APAC` |
| pd-balanced | 0.10 / GiB-月 | `Balanced PD Capacity`（asia-east1 與 us-central1 同價）|
| pd-standard | 0.04 / GiB-月 | `Storage PD Capacity` |
| External IP（掛在 standard VM 上） | 0.005 / hr | VPC network pricing |
| Internet egress 台灣 → 亞太（不含韓、印尼） | 0.12 / GiB（前 1 GiB 免費） | `Network Internet Data Transfer Out from Taiwan to Apac...` |
| GKE cluster management fee | 0.10 / cluster-hr | GKE pricing |
| GKE free tier credit | **-74.40 / 月 / billing account** | GKE pricing |
| Autopilot pod CPU | 0.0000515 / mCPU-hr（= **0.0515 / vCPU-hr**） | `Autopilot Pod mCPU Requests (asia-east1)` |
| Autopilot pod memory | 0.0056998 / GiB-hr | `Autopilot Pod Memory Requests (asia-east1)` |
| Autopilot pod ephemeral storage | 0.0000635 / GiB-hr | `Autopilot Pod Ephemeral Storage Requests (asia-east1)` |
| Autopilot PD Balanced **premium** | 0.013895 / GiB-月（**疊加**在 0.10 之上） | `Autopilot PD Balanced Premium (asia-east1)` |
| Global forwarding rule（前 5 條） | 0.025 / hr | VPC network pricing |
| Regional external ALB forwarding rule（台灣） | 0.025 / hr | `Regional External Application Load Balancer Forwarding Rule Minimum for Taiwan` |
| LB data processing（台灣，進與出各計） | 0.008 / GiB | `Global/Regional External ALB In/Outbound Data Processing for Taiwan` |
| Cloud Run CPU（request-based） | 0.000024 / vCPU-秒 | `Services CPU (Request-based billing)` |
| Cloud Run Memory（request-based） | 0.0000025 / GiB-秒 | `Services Memory (Request-based billing)` |
| Cloud Run CPU / Mem（instance-based, asia-east1） | 0.000018 / 0.000002 | `Services CPU/Memory (Instance-based billing) in asia-east1` |
| Cloud Run requests | 前 200 萬免費，之後 0.40 / 百萬 | `Requests` SKU |
| Cloud SQL PostgreSQL zonal **Micro**（db-f1-micro） | 0.0105 / hr | `Cloud SQL for PostgreSQL: Zonal - Micro instance in APAC` |
| Cloud SQL PostgreSQL zonal **Small**（db-g1-small） | 0.035 / hr | `...Zonal - Small instance in APAC` |
| Cloud SQL PostgreSQL zonal vCPU / RAM | 0.0413 / hr、0.007 / GiB-hr | `...Zonal - vCPU / RAM in APAC` |
| Cloud SQL SSD storage | 0.17 / GiB-月 | `...Zonal - Standard storage in APAC` |
| Cloud SQL backups | 0.08 / GiB-月 | `Cloud SQL: Backups in APAC` |
| Cloud Storage Standard（asia-east1） | 0.02 / GiB-月 | `Standard Storage Asia Regional` |

### 2.1 由單價推導出的 E2 機型月費

E2 shared-core 機型的計費 vCPU 與規格 vCPU 不同：e2-micro 記 0.25 vCPU、e2-small 記 0.5 vCPU、e2-medium 記 1 vCPU。

| 機型 | 計費資源 | On-demand /hr | On-demand /月 | 1yr CUD /月 | 3yr CUD /月 | Spot /月 |
|------|---------|-------------:|-------------:|-----------:|-----------:|--------:|
| e2-micro | 0.25 vCPU + 1 GiB | 0.009699 | **7.08** | 4.46 | 3.19 | 3.34 |
| e2-small | 0.5 vCPU + 2 GiB | 0.019398 | **14.16** | 8.92 | 6.37 | 6.68 |
| **e2-medium** | 1 vCPU + 4 GiB | 0.038796 | **28.32** | **17.84** | 12.74 | 13.36 |
| e2-standard-2 | 2 vCPU + 8 GiB | 0.077592 | 56.64 | 35.68 | 25.49 | 26.72 |

> 交叉驗證：e2-medium 0.0388/hr、1yr CUD 17.84/月 與第三方 gcloud-compute.com（2026-08-09 抓取）數字完全吻合。

### 2.2 三個必須先講清楚的折扣事實

1. **E2 系列沒有 sustained use discount（SUD）。** GCP 官方 SUD 文件的適用清單為 N1 / N2 / N2D / C2 / M1 / M2 等，**E2 不在其中**——Google 的說法是 E2 的牌價本來就已經壓低。因此上表的 on-demand 就是實付價，不會月底自動再打折。這點常被誤算，會讓預估低估 20–30%。
   來源：<https://docs.cloud.google.com/compute/docs/sustained-use-discounts>
2. **E2 shared-core 可以買 CUD。** 官方 CUD 適用表寫的是「General-purpose E2 / vCPUs, Memory / **All E2 machine types**」；被排除的是 **N1 shared-core** 以及 **f1-micro、g1-small**，e2-medium 不受影響。1 年約折 −37%，3 年約 −55%。
   來源：<https://docs.cloud.google.com/compute/docs/instances/signing-up-committed-use-discounts>
3. **Always Free 的 e2-micro 只在美國三區（us-west1 / us-central1 / us-east1），asia-east1 不適用。** 同樣地，Always Free 的 30 GB pd-standard 與 5 GB Cloud Storage 也**僅限美國區**。所以本專案在台灣落地，這些免費額度一毛都用不到；在 asia-east1 開 e2-micro 要付 US$7.08/月。
   來源：<https://cloud.google.com/free/docs/free-cloud-features>

---

## 3. 方案 A：單台 Compute Engine VM + k3s（prod / staging 同 cluster 不同 namespace）

架構：1 台 VM，k3s single-node，prod 與 staging 各一個 namespace，各跑 nginx / Node(Hono) API / Postgres 三個容器（共 6 個 pod）；Traefik 或 cert-manager 在 cluster 內用 Let's Encrypt 簽 TLS，直接綁 VM 的 static IP，**不使用任何 GCP Load Balancer**。

### 3.1 Line items

| 項目 | 計算 | US$/月 |
|------|------|-------:|
| VM e2-medium（on-demand） | 0.038796 × 730 | 28.32 |
| Boot disk 20 GiB pd-balanced | 20 × 0.10 | 2.00 |
| Static external IP（掛在 running VM） | 0.005 × 730 | 3.65 |
| Internet egress 10 GB → 亞太 | (10 − 1) × 0.12 | 1.08 |
| GCS 備份（50 MB/日 × 30 日 = 1.5 GB，Standard asia-east1） | 1.5 × 0.02 | 0.03 |
| Container images（GHCR） | — | 0.00 |
| **合計（e2-medium on-demand）** | | **35.08**（NT$1,123）|
| **合計（e2-medium + 1yr CUD）** | VM 改 17.84 | **24.60**（NT$787）|
| **合計（e2-medium + 3yr CUD）** | VM 改 12.74 | **19.50**（NT$624）|
| **合計（e2-small on-demand）** | VM 改 14.16 | **20.92**（NT$669）|
| **合計（e2-small + 1yr CUD）** | VM 改 8.92 | **15.68**（NT$502）|

### 3.2 固定 vs 用量

- **固定（約 98%）**：VM、boot disk、static IP，共 US$33.97（on-demand）。不管有沒有人用都照收。
- **用量（約 2%）**：egress US$1.08 + GCS US$0.03。<100k req/月 這種量級，用量費基本上是雜訊；就算流量翻 10 倍也只多約 US$11。

### 3.3 e2-small vs e2-medium 的技術判斷

e2-small 只有 **2 GB RAM**，要同時跑 k3s control plane（server 本身約 500 MB）＋ 2 套 Postgres ＋ 2 個 Node API ＋ 2 個 nginx，實務上會 OOM 或被迫關掉 staging。**建議 e2-medium（4 GB）**；差價 on-demand US$14.16/月、CUD 後 US$8.92/月，買的是「staging 真的能開著」。

### 3.4 維運註記

- **HA：無。** 單台 VM，Google 做 live migration 所以計畫性維護不會停機，但 host 故障、OS 升級重開、k3s 自己掛掉都是完整 downtime。對每週幾十次預約的教會系統可以接受。
- **備份：** pg_dump → GCS（US$0.03/月，便宜到可以忽略）。**注意 Postgres 跑在 in-cluster PVC（hostPath / local-path），VM 整台死掉時 boot disk 上的資料會一起死**，所以 GCS 的 daily dump 是唯一的救命繩，務必驗證 restore。可另外加 PD snapshot（asia-east1 標準 snapshot 另計）。
- **k8s 學習價值：高。** k3s 提供完整的 Kubernetes API（Deployment / Service / Ingress / PVC / Secret / HPA），Flux GitOps 流程與正式 GKE 一模一樣。除了 cloud-provider 專屬資源（GCP LoadBalancer type Service、GCE PD CSI、Workload Identity）之外，學到的東西完全可轉移。

---

## 4. 方案 B：同一台 VM 改用 docker compose

**基礎設施成本與方案 A 完全相同，差異為 US$0.00。**

計費的是 VM、disk、IP、egress 這幾個 SKU，GCP 完全不知道也不在乎你在 VM 裡跑的是 k3s、docker compose、還是裸 systemd。唯一可量化的差別是 **k3s 自己吃掉約 300–500 MB RAM 與少量 CPU**，換句話說 docker compose 在同一台 e2-medium 上會多出約 0.5 GB 可用記憶體給應用程式——這是「同價錢下多拿到的資源」，不是省下的錢。

| 面向 | k3s | docker compose |
|------|-----|----------------|
| 月費 | 35.08 | 35.08 |
| 可用 RAM（e2-medium 4 GB） | 約 3.3 GB | 約 3.8 GB |
| GitOps（Flux） | 原生支援 | 需自幹（watch git + `docker compose up -d`）|
| k8s 學習價值 | 高 | 無 |
| 維運複雜度 | 中（要懂 PVC、Ingress、CRD 除錯） | 低 |

**結論：如果「學 k8s」是這個專案的目標之一，B 沒有任何成本優勢可以拿來當放棄 k3s 的理由。**

---

## 5. 方案 C：GKE Autopilot

架構：1 個 Autopilot cluster，prod 與 staging 各一組 pods（frontend 0.25 vCPU / 0.5 GiB、api 0.25 vCPU / 0.5 GiB、postgres 0.5 vCPU / 1 GiB），合計 **2.0 vCPU + 4.0 GiB requests**；對外走 Gateway / Ingress（一條 global external ALB forwarding rule，兩個 hostname 共用）；Postgres 各掛 10 GiB PVC。

> Pod 尺寸檢查：Autopilot general-purpose compute class 的最小值是 250 mCPU / 512 MiB，且 CPU:Memory 比需在 1:1 ~ 1:6.5 之間。題目給的 0.25:0.5（1:2）與 0.5:1（1:2）**都合規，不會被 Autopilot 自動往上調**。

### 5.1 Line items

| 項目 | 計算 | US$/月 |
|------|------|-------:|
| Cluster management fee | 0.10 × 730 = 73.00 | 73.00 |
| **GKE free tier credit** | 上限 −74.40 | **−73.00** |
| Autopilot pod CPU（2.0 vCPU） | 2 × 0.0515 × 730 | **75.19** |
| Autopilot pod memory（4.0 GiB） | 4 × 0.0056998 × 730 | **16.64** |
| Autopilot pod ephemeral storage（6 pod × 1 GiB 預設） | 6 × 0.0000635 × 730 | 0.28 |
| Postgres PVC 2 × 10 GiB（pd-balanced 0.10 + Autopilot premium 0.013895） | 20 × 0.113895 | 2.28 |
| Global external ALB forwarding rule | 0.025 × 730 | **18.25** |
| LB data processing（10 GiB 進 + 10 GiB 出） | 20 × 0.008 | 0.16 |
| Internet egress 10 GB → 亞太 | (10 − 1) × 0.12 | 1.08 |
| GCS 備份 1.5 GB | 1.5 × 0.02 | 0.03 |
| **合計** | | **113.91**（NT$3,645）|

### 5.2 固定 vs 用量

- **固定（約 99%）**：pod requests 是**按 request 而非實際使用量**計費，min replica = 1 的話 24×7 全額計價；forwarding rule 也是純時間費。US$112.6 是打死的。
- **用量（約 1%）**：egress + data processing 約 US$1.24。

### 5.3 關鍵發現

1. **免費的是 cluster fee，不是 compute。** free tier credit US$74.40/月 剛好覆蓋一個 cluster 的 730–744 小時管理費，但官方明講「credit 只能抵 zonal 與 Autopilot cluster 的管理費，不能抵任何其他 SKU」。真正的錢在 pod CPU。
2. **Autopilot 的 CPU 貴得離譜。** US$0.0515/vCPU-hr vs Compute Engine E2 的 US$0.02526/vCPU-hr，是 **2.04 倍**。Memory 則是 0.0056998 vs 0.00338514，1.68 倍。你為「不用管 node」付了一倍溢價。
3. **Autopilot 不收 node 的 external IP 費**（pod-based billing 不看底層 node），這點比 GKE Standard 好；官方也明確說 unmodified system DaemonSet、OS overhead、未配置空間都不計費。
4. **兩個環境共用一條 forwarding rule** 才是 US$18.25；如果 prod / staging 各開一條 Ingress 就變 US$36.50。

### 5.4 維運註記

- **HA：最好。** 控制平面 SLA 99.95%，pod 跨 zone SLA 99.9%，node 完全託管、自動升級修補。
- **備份：** PVC 可用 PD snapshot 或 GKE Backup for GKE（另計費）。但**在 k8s 裡自營 Postgres 本來就是反模式**——花 US$114/月 買到託管的 node，卻還是自己扛 DB 的 failover 與 PITR，價值配置很奇怪。
- **k8s 學習價值：中。** Autopilot 擋掉 node、DaemonSet、privileged pod、部分 CRD 與 hostPath，你學到的是「被限制版的 k8s」。想學 node pool、taint/toleration、CNI 這些，Autopilot 反而學不到。

---

## 6. 方案 D：GKE Standard（1 zonal cluster）

架構：1 個 **zonal**（非 regional，才吃得到 free tier credit）Standard cluster，node pool 用 e2-medium，同樣一條 external ALB。

### 6.1 容量現實檢查（重要）

e2-medium 是 2 vCPU / 4 GB，但 **GKE 會保留一部分給 kubelet 與系統元件**，e2-medium 的 allocatable 大約是 **940 mCPU / 約 2.8 GiB**。題目給的 pods 合計 **2000 mCPU requests**——**一台 e2-medium 裝不下**，會有 pod 卡在 Pending。

實際可行的配置是 **2 × e2-medium** 或 **1 × e2-standard-2**（兩者計費資源都是 2 vCPU + 8 GiB，月費同為 US$56.64）。以下兩個版本都列出來。

### 6.2 Line items

| 項目 | 計算 | D-1：1×e2-medium | D-2：2×e2-medium |
|------|------|----------------:|----------------:|
| Cluster management fee（zonal） | 0.10 × 730 | 73.00 | 73.00 |
| GKE free tier credit | 上限 −74.40 | −73.00 | −73.00 |
| Node（Compute Engine E2 計價） | 28.32 × N | 28.32 | 56.64 |
| Node boot disk 20 GiB pd-balanced × N | 20 × 0.10 × N | 2.00 | 4.00 |
| Node external IP × N | 0.005 × 730 × N | 3.65 | 7.30 |
| Postgres PVC 2 × 10 GiB pd-balanced | 20 × 0.10 | 2.00 | 2.00 |
| Global external ALB forwarding rule | 0.025 × 730 | 18.25 | 18.25 |
| LB data processing | 20 × 0.008 | 0.16 | 0.16 |
| Internet egress 10 GB | (10−1) × 0.12 | 1.08 | 1.08 |
| GCS 備份 | 1.5 × 0.02 | 0.03 | 0.03 |
| **合計** | | **55.49**（NT$1,776）| **89.46**（NT$2,863）|

> Node boot disk 預設是 **100 GiB pd-balanced（US$10/月/node）**，一定要在 node pool 建立時改成 20–30 GiB，否則每台多付約 US$8。
> Node 若改成 private（無 external IP）就得配 Cloud NAT（gateway US$0.0014/hr/VM + NAT IP US$0.005/hr + US$0.045/GiB 處理費），對這種規模不但沒省還更貴，維持 public node 即可。

### 6.3 可以砍掉 LB 嗎？

可以。若不使用 GCP L7 LB，改在 cluster 內跑 ingress-nginx + cert-manager，用 `Service type=NodePort` 加上 node 的 static IP 對外，就能省下 **US$18.41/月**（D-1 降到 US$37.08、D-2 降到 US$71.05）。代價是失去 GCP LB 的健康檢查與跨 node 容錯——但這也正好說明：**如果最後要靠自架 ingress 來省錢，那跟方案 A 的 k3s 差別就只剩「多付 node 與 cluster 的錢」而已。**

### 6.4 維運註記

- **HA：中。** Zonal cluster 的控制平面 SLA 只有 99.5%，且**單一 zone 故障 = 全掛**。要 99.95% 得用 regional cluster，但 regional 的管理費**不能用 free tier credit**（官方明列），會直接多 US$73/月，且 node 數量通常要 ×3。
- **備份：** 同 C。
- **k8s 學習價值：最高。** node pool、autoscaling、taint、DaemonSet、PD CSI、Workload Identity 全都碰得到，是最接近「業界標準 GKE」的環境。

---

## 7. 方案 E：Cloud Run + 外部 Postgres

架構：4 個 Cloud Run services（prod-frontend、prod-api、stg-frontend、stg-api），全部 `min-instances=0`。

### 7.1 Cloud Run 本身：這個量級是 US$0

Cloud Run Always Free 每月額度（per billing account）：**200 萬 requests、180,000 vCPU-秒、360,000 GiB-秒**。

以 100k requests/月、每次平均 300 ms、1 vCPU / 512 MiB 估算：

| 項目 | 計算 | 用量 | 免費額度 | 應付 |
|------|------|-----:|--------:|-----:|
| Requests | 100,000 | 100 K | 2 M | **0.00** |
| vCPU-秒 | 100,000 × 0.3 × 1 | 30,000 | 180,000 | **0.00** |
| GiB-秒 | 100,000 × 0.3 × 0.5 | 15,000 | 360,000 | **0.00** |

**Cloud Run compute 費用 = US$0.00**，而且離免費上限還有 6 倍空間。`min-instances=0` 是關鍵——設成 1 的話 idle instance 會用 `Services Min Instance CPU` SKU（US$0.0000025/vCPU-秒 ≈ US$6.57/月/instance）計價，4 個 service 就是約 US$26/月，免費額度直接破功。

### 7.2 自訂網域的隱藏成本

Cloud Run 的 **domain mapping 在 asia-east1 有支援，但官方標示為 preview / limited availability，並明講「有 latency 問題，不建議用於 production」**。生產環境的官方建議是：

- **Global external ALB**：+US$18.25 forwarding rule + US$0.16 data processing = **+18.41/月**，或
- **Firebase Hosting**：免費方案即含自訂網域與託管 TLS，可 rewrite 到 Cloud Run，**+US$0**（此專案流量遠低於 Spark 方案額度）。

來源：<https://docs.cloud.google.com/run/docs/mapping-custom-domains>

**建議走 Firebase Hosting**，成本 0 且順便把 nginx 靜態前端整個換掉（連 frontend service 都不用開）。

### 7.3 Postgres 選項比較

| DB 選項 | US$/月 | 說明 |
|---------|------:|------|
| **Cloud SQL db-f1-micro**（zonal, asia-east1）| **9.93** | 0.0105×730 = 7.67 + 10 GiB SSD ×0.17 = 1.70 + 備份 7 GiB ×0.08 = 0.56 |
| Cloud SQL db-g1-small | 27.81 | 0.035×730 = 25.55 + storage 1.70 + backup 0.56 |
| Cloud SQL Enterprise 最小自訂（1 vCPU + 3.75 GiB） | 51.57 | (0.0413 + 3.75×0.007)×730 = 49.31 + storage/backup 2.26 |
| **Supabase Free**（Tokyo `ap-northeast-1` 或 Singapore） | **0.00** | 500 MB DB；**連續 7 天無流量會 pause**，教會系統平日低流量要小心 |
| **Neon Free**（**最近只有 Singapore `ap-southeast-1`，無台灣/東京**） | **0.00** | 0.5 GB storage、100 compute-hr/月；台灣→新加坡 RTT 約 40–60 ms |

> 兩家免費方案的地區清單：Supabase <https://supabase.com/docs/guides/platform/regions>；Neon 免費層目前為 us-east-1/2、us-west-2、eu-central-1、**ap-southeast-1**、il-central-1。

### 7.4 合計

| 組合 | Cloud Run | DB | Egress | GCS | 自訂網域 | **合計** |
|------|---------:|---:|------:|----:|--------:|--------:|
| **E-1** Cloud Run + Cloud SQL f1-micro（單台，prod/stg 兩個 database） | 0.00 | 9.93 | 1.08 | 0.03 | 0（Firebase）| **11.04**（NT$353）|
| **E-2** Cloud Run + Cloud SQL f1-micro ×2（環境各一台） | 0.00 | 19.85 | 1.08 | 0.03 | 0 | **20.96**（NT$671）|
| **E-3** Cloud Run + Supabase/Neon Free | 0.00 | 0.00 | 1.08 | 0.03 | 0 | **1.11**（NT$36）|
| E-1 但改用 global ALB 而非 Firebase | 0.00 | 9.93 | 1.08 | 0.03 | 18.41 | 29.45 |

### 7.5 固定 vs 用量

**這是唯一「用量為主」的方案。** E-3 幾乎全部是用量費（而用量落在免費層 → US$0）；E-1 的固定成本只有 Cloud SQL 的 US$9.93。流量歸零時帳單也趨近歸零，這是 A/C/D 都做不到的。

### 7.6 維運註記

- **HA：** Cloud Run 本身區域內多 zone、自動擴縮，可用性最好；但 **db-f1-micro 是 shared-core 且無 SLA**（Cloud SQL SLA 只涵蓋 2 vCPU 以上的 HA 配置）。
- **Cold start：** `min-instances=0` 表示閒置後第一個請求要等容器啟動。Node/Hono 通常 300 ms–1.5 s。教會場地預約每天零星使用，使用者**會**常態遇到 cold start。這是 US$0 的真實代價。
- **備份：** Cloud SQL 自動備份內建（已計入 US$0.56）；Supabase/Neon 免費層備份能力有限，需自行 pg_dump 到 GCS。
- **k8s 學習價值：零。** 這條路完全繞開 Kubernetes、繞開 Flux、也繞開容器編排。若專案目標包含「學 k8s / GitOps」，E 方案等於直接放棄該目標。

---

## 8. 與 DigitalOcean 現況（baseline）比較

| | DO 現況 | GCP A-2（e2-medium on-demand） | GCP A-3（+1yr CUD） | GCP C（Autopilot） |
|---|---:|---:|---:|---:|
| 月費 US$ | 12.00 | 35.08 | 24.60 | 113.91 |
| 月費 NT$ | 384 | 1,123 | 787 | 3,645 |
| 相對 DO | 1.0× | **2.9×** | **2.1×** | **9.5×** |
| 年費 US$ | 144 | 421 | 295 | 1,367 |

DO 的 US$12 droplet（2 GB RAM / 1 vCPU / 50 GB SSD）**已含 50 GB 磁碟與 2 TB 流量**，而 GCP 這三項全部另計：同等的 GCP 組合（e2-small 2 GB + 50 GB pd-balanced + IP）是 14.16 + 5.00 + 3.65 = **US$22.81**，還沒算 egress。

**純以價格論，GCP 打不贏 DO，這是結構性的**——GCP 對 external IP（US$3.65/月）與 egress（US$0.12/GiB，DO 給 2 TB 免費）分開收費，而 DO 是打包價。搬到 GCP 的理由只能是「想在履歷/技能上累積 GCP 與 k8s 經驗」或「要用 GCP 生態的其他服務」，不會是省錢。

---

## 9. 結論：GKE 完整方案 vs 單 VM 差多少？

**差 US$79–89 / 月，也就是 3.2 到 4.6 倍。** 具體來說：GKE Autopilot 完整方案（方案 C）是 **US$113.91/月**，單台 e2-medium 跑 k3s（方案 A-2）是 **US$35.08/月**，差 **US$78.83/月（NT$2,522）**，一年差 **US$946（NT$30,272）**；若單 VM 再買 1 年 CUD 壓到 US$24.60，差距擴大到 **US$89.31/月、4.6 倍**。GKE Standard 真正跑得動的配置（方案 D-2，2×e2-medium）是 US$89.46/月，比單 VM 仍多 US$54.38/月。錢花在哪裡很清楚：cluster management fee 其實是免費的（free tier credit US$74.40/月剛好抵掉一個 zonal 或 Autopilot cluster），真正的差額來自兩個地方——**Autopilot 的 pod CPU 單價 US$0.0515/vCPU-hr 是 Compute Engine E2 的 2.04 倍**（2 vCPU requests 就吃掉 US$75.19，而同樣的 2 vCPU 直接開 VM 只要 US$28.32），以及**一條 external ALB forwarding rule 固定 US$18.25/月**（單 VM 用 Let's Encrypt + Traefik 在 VM 上自簽自代理，這條就是 US$0）。換句話說，這個每月 10 萬請求、50 個尖峰使用者的教會系統，付給 GKE 的 US$79 差額買到的是「託管控制平面 + 自動修補 node + 多 zone SLA」，而它換來的可用性提升，對一個平日幾乎沒流量、掛掉半小時也沒人會注意的內部預約系統來說，很難說值得。若目的是**學 Kubernetes**，k3s 提供的 API 表面與 Flux GitOps 流程和 GKE 幾乎一致，這 US$946/年 買到的增量學習價值主要是 node pool 與 cloud-provider 整合這幾項。

---

## 10. 如何把「e2-medium + k3s + Flux」控制在 US$30/月以內

目標達成路徑（**買 1 年 CUD 就直接達標**）：

| 動作 | 節省 | 達標後月費 |
|------|-----:|----------:|
| 基準：e2-medium on-demand 全套 | — | 35.08 |
| **① 買 1 年 E2 resource-based CUD（1 vCPU + 4 GiB，asia-east1）** | **−10.48** | **24.60 ✅** |
| ② Boot disk 從 pd-balanced 20 GiB 改 pd-standard 20 GiB | −1.20 | 23.40 |
| ③ 前面掛 Cloudflare 免費 CDN，靜態資源不走 GCP egress | 約 −1.00 | 22.40 |

**必守的紀律（做錯任何一項就會爆表）：**

1. **絕對不要建立任何 GCP Load Balancer。** 一條 forwarding rule 就是 US$18.25/月，會讓月費從 24.60 跳到 43.01，直接超標 43%。TLS 用 k3s 內建的 Traefik 或 cert-manager 打 Let's Encrypt，直接綁 VM 的 static IP。
2. **不要開第二台 VM 給 staging。** prod 與 staging 用 namespace 隔離，共用同一個 k3s。開第二台 e2-medium 是 +US$28.32 + IP US$3.65 + disk US$2.00 = **+US$33.97**。
3. **Boot disk 開 20 GiB，不要用預設值。** GCE 預設 boot disk 常被設成 10–100 GiB，100 GiB pd-balanced 是 US$10/月。
4. **不要安裝 Ops Agent。** 預設不裝的話 Cloud Logging / Monitoring 幾乎不產生費用；裝了之後 log ingestion 會開始計價。
5. **不要用 Cloud SQL。** Postgres 留在 cluster 內（PVC），最便宜的 Cloud SQL db-f1-micro 也要 +US$9.93/月，會讓 CUD 後的 24.60 變成 34.53，超標。
6. **不要期待 sustained use discount。** E2 沒有 SUD，帳單不會月底自動變便宜（見 §2.2）。
7. **egress 要留意。** 10 GB/月 只要 US$1.08，但若之後放照片、影片或做無節制的 API polling，100 GB/月 就是 US$11.88。掛 Cloudflare 是便宜的保險。
8. **備份用 Cloud Storage Standard 就好。** 1.5 GB = US$0.03/月。不要用 Nearline/Coldline——30 天保留期會撞到 Nearline 的 30 天最短計費期，反而不划算。

**若不想綁約 1 年**，退路是接受 US$35.08/月（超標 17%），或改用 e2-small（US$20.92）並把 staging 改成「要用才開、平常 scale 到 0」。不建議用 Spot VM 跑 prod（e2-medium spot 僅 US$13.36/月，但可能隨時被回收）。

### 待驗證項目

- **External IP 的實際計費**：官方 VPC network pricing 文件寫「掛在 standard VM 上的 static/ephemeral IP 免費額度**僅一小時/月/帳號**」，但 Billing Catalog 的 `External IP Charge on a Standard VM` SKU 實際編碼的是 **前 744 小時 = US$0**、之後才 US$0.005/hr。兩者矛盾。本文一律以**保守的 US$3.65/月**入帳；**請在第一期帳單確認**，若實際為 0，上述所有含 VM 的方案再減 US$3.65（A-3 會降到 **US$20.95**）。
