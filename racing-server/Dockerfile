# Velocity Rush race server. Build from the repository root:
#   docker build -f racing-server/Dockerfile -t velocity-rush-server .
#   docker run -p 8787:8787 -v vr-data:/data velocity-rush-server
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
# Only the shared game rules and the server are needed at runtime.
COPY src/racing/shared ./src/racing/shared
COPY racing-server/server.ts ./racing-server/server.ts
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8787
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "racing-server/server.ts"]
