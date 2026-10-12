# HelaLoka: satu kontainer berisi backend FastAPI yang juga menyajikan build frontend.
# Build:  docker build -t helaloka .
# Jalan:  docker run -p 8000:8000 --env-file backend/.env helaloka

FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UDARASIAGA_OFFLINE=0 FRONTEND_DIST=/app/frontend/dist
WORKDIR /app/backend
RUN apt-get update && apt-get install -y --no-install-recommends libexpat1 && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt python-dotenv gunicorn
COPY backend/ ./
COPY --from=web /web/dist /app/frontend/dist
EXPOSE 8000
# 2 worker: setiap worker punya cache FIRMS/MAGMA sendiri; simulasi dibatasi 2 per worker.
# PORT dan WEB_CONCURRENCY bisa diatur oleh host (Render, Fly, dll).
CMD ["sh", "-c", "exec gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w ${WEB_CONCURRENCY:-2} -b 0.0.0.0:${PORT:-8000} --timeout 180"]
