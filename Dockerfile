# --- 1) Build do frontend (React) ---
FROM node:20-alpine AS frontend
WORKDIR /app
RUN corepack enable
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY frontend/ ./
# Vazio = a API é chamada no mesmo domínio que serve o site
ENV REACT_APP_BACKEND_URL=""
RUN yarn build

# --- 2) Backend (FastAPI) servindo a API e o build do frontend ---
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend /app/build ./static
EXPOSE 8000
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
