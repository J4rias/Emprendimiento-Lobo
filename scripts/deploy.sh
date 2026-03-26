#!/bin/bash
# Deploy script — usage: ./scripts/deploy.sh [empresa1|empresa2]
set -e

EMPRESA=${1:-empresa1}
COMPOSE_FILE="docker-compose.${EMPRESA}.yml"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "❌ No se encontró $COMPOSE_FILE"
  exit 1
fi

echo "========================================"
echo "🚀 Deploying: $EMPRESA"
echo "========================================"
echo ""

# Pull latest code
echo "📥 Pulling latest code from main..."
if ! git pull origin main; then
  echo ""
  echo "❌ git pull falló — posible conflicto de merge."
  echo ""
  echo "Estado actual del repositorio:"
  git status
  echo ""
  echo "Para resolver:"
  echo "  1. Revisa los conflictos:  git status"
  echo "  2. Resuélvelos manualmente en los archivos marcados"
  echo "  3. Confirma:               git add . && git commit -m 'resolve merge conflict'"
  echo "  4. Vuelve a ejecutar:      bash scripts/deploy.sh $EMPRESA"
  echo ""
  echo "⚠️  Los contenedores NO fueron actualizados."
  exit 1
fi
echo ""

# Build containers
echo "🔨 Building containers..."
docker compose -p "$EMPRESA" -f "$COMPOSE_FILE" build
echo ""

# Start containers
echo "▶️  Starting containers..."
docker compose -p "$EMPRESA" -f "$COMPOSE_FILE" up -d
echo ""

# Wait for backend to initialize
echo "⏳ Waiting for backend to start (15s)..."
sleep 15

# Health check with retries
MAX_RETRIES=6
RETRY=0
BACKEND_PORT=5000

echo "🔍 Running health check..."
until curl -sf "http://localhost:${BACKEND_PORT}/health" > /dev/null 2>&1; do
  RETRY=$((RETRY + 1))
  if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
    echo "❌ Health check failed after ${MAX_RETRIES} intentos"
    echo ""
    echo "📋 Últimos logs del backend:"
    docker compose -p "$EMPRESA" -f "$COMPOSE_FILE" logs --tail=40 backend
    exit 1
  fi
  echo "  Intento $RETRY/$MAX_RETRIES — esperando 5s..."
  sleep 5
done

echo "✅ Health check passed"
echo ""

# Show health details
echo "📊 Estado del sistema:"
curl -s "http://localhost:${BACKEND_PORT}/health" | python3 -m json.tool 2>/dev/null || \
  curl -s "http://localhost:${BACKEND_PORT}/health"
echo ""

# Show recent logs
echo "📋 Últimos logs:"
docker compose -p "$EMPRESA" -f "$COMPOSE_FILE" logs --tail=15 --no-log-prefix
echo ""
echo "========================================"
echo "✅ $EMPRESA deployed exitosamente!"
echo "========================================"
