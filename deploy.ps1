# Cloud Run 一键部署脚本
# 采用源码部署模式（Google Cloud Buildpack 会自动在云端构建镜像，本地无需启动 Docker）

$SERVICE_NAME = "livehub"
$REGION = "asia-east1"

Write-Host ">>> 准备部署 $SERVICE_NAME 到 Google Cloud Run (区域: $REGION [中国台湾机房])..." -ForegroundColor Cyan

# 自动切换至生产环境配置
node scripts/switch-env.js prod

# 关键参数解释：
# --source .              : 云端自动构建 Dockerfile (基于 Cloud Build)
# --region asia-east1     : 亚洲区域节点（低延迟）
# --allow-unauthenticated : 允许匿名公网访问
# --max-instances=1       : 限制最多 1 个实例，单实例承载所有 WebSocket，免除 Redis
# --concurrency=250       : 单实例最多 250 个并发长连接
# --timeout=3600          : WebSocket 保持时长最大 60 分钟
# --session-affinity      : 开启会话粘性
# --memory=512Mi --cpu=1  : 轻量规格，处于免费额度保护范围内
# --set-env-vars          : 注入生产配置

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
  --set-env-vars "NODE_ENV=production,APP_ENV=production,STORAGE_DRIVER=file,LOG_LEVEL=info"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ 部署成功！你可以在终端上方查看 Cloud Run 分配的公网 HTTPS/WSS 访问链接。" -ForegroundColor Green
} else {
    Write-Host "`n❌ 部署失败，请检查 GCP 账户权限或配额。" -ForegroundColor Red
}
