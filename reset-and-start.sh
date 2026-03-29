#!/bin/bash
# =====================================================
# Script de réinitialisation complète et démarrage
# =====================================================
echo "🛑 Arrêt des conteneurs existants..."
docker compose down -v --remove-orphans 2>/dev/null || true

echo "🧹 Suppression des images du projet..."
docker rmi bibliotheque-books bibliotheque-authentification bibliotheque-users bibliotheque-loans bibliotheque-frontend 2>/dev/null || true
docker rmi bibliotheque-numerique-books-service bibliotheque-numerique-authentification-service bibliotheque-numerique-users-service \
            bibliotheque-numerique-loans-service bibliotheque-numerique-frontend 2>/dev/null || true

echo "🔨 Build et démarrage..."
docker compose up -d --build

echo ""
echo "⏳ Attente de MySQL (30s)..."
sleep 30

echo ""
echo "🔍 Vérification des services..."
curl -sf http://localhost:3000/health && echo "✅ Authentification OK" || echo "❌ Authentification KO"
curl -sf http://localhost:3001/health && echo "✅ Books OK" || echo "❌ Books KO"
curl -sf http://localhost:3002/health && echo "✅ Users OK" || echo "❌ Users KO"
curl -sf http://localhost:3003/health && echo "✅ Loans OK" || echo "❌ Loans KO"

echo ""
echo "============================================"
echo "✅ Application disponible sur http://localhost:8084"
echo "============================================"
