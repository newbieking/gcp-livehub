# Cloud Run 一键部署脚本
# 采用源码部署模式（Google Cloud Buildpack 会自动在云端构建镜像，本地无需启动 Docker）

$SERVICE_NAME = "livehub"
$REGION = "us-central1"

Write-Host ">>> 准备部署 $SERVICE_NAME 到 Google Cloud Run (区域: $REGION)..." -ForegroundColor Cyan

# 自动切换至生产环境配置
node scripts/switch-env.js prod

# 关键参数解释：
# --source .              : 云端自动构建 Dockerfile
# --allow-unauthenticated : 允许匿名公网访问
# --max-instances=1       : 限制最多 1 个实例，保证单实例内存内广播，直接省去 Redis 费用
# --concurrency=250       : 单实例支持最多 250 个长连接
# --timeout=3600          : WebSocket 连接超时上限为 60 分钟（Socket.IO 会在断开后自动平滑重连）
# --session-affinity      : 开启会话保持
# --memory=512Mi --cpu=1  : 规格轻量，处于 Always Free 免费额度保护范围内
# --set-env-vars          : 注入生产环境配置开关 (启用 Firestore 持久化)

gcloud run deploy $SERVICE_NAME `
  --source . `
  --region $REGION `
  --allow-unauthenticated `
  --max-instances=1 `
  --concurrency=250 `
  --timeout=3600 `
  --session-affinity `
  --memory=512Mi `
  --cpu=1 `
  --set-env-vars NODE_ENV=production,APP_ENV=production,STORAGE_DRIVER=firestore,LOG_LEVEL=info

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ 部署成功！你可以在终端上方查看 Cloud Run 分配的公网 HTTPS/WSS 访问链接。" -ForegroundColor Green
} else {
    Write-Host "`n❌ 部署失败，请检查 GCP 账户权限或配额。" -ForegroundColor Red
}
