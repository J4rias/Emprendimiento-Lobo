#!/bin/bash

# Get token
echo "=== Login ==="
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Error: No se pudo obtener el token"
  exit 1
fi

echo "Token obtenido: ${TOKEN:0:20}..."

# Test products endpoint
echo ""
echo "=== Obtener lista de productos ==="
curl -s -X GET "http://localhost:5000/api/products?limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | head -50

echo ""
echo ""
echo "=== Prueba completada ==="
