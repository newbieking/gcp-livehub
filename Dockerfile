# 使用官方轻量 Node.js 镜像
FROM node:22-slim

# 设置工作目录
WORKDIR /usr/src/app

# 设置生产环境变量
ENV NODE_ENV=production
ENV PORT=8080

# 优先拷贝依赖清单，利用 Docker 缓存层
COPY package*.json ./

# 仅安装生产依赖
RUN npm ci --omit=dev

# 拷贝源代码
COPY . .

# 暴露端口 (Cloud Run 运行时动态注入 PORT)
EXPOSE 8080

# 启动服务
CMD ["npm", "start"]
