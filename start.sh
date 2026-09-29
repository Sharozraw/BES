#!/bin/bash
# BES Quick Start Script
# Run: chmod +x start.sh && ./start.sh

set -e

echo "🏛️  BES — Bid Evaluation System"
echo "================================"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v)"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL not found. Install from https://postgresql.org"
    exit 1
fi
echo "✅ PostgreSQL found"

# Setup backend
echo ""
echo "📦 Installing backend dependencies..."
cd backend
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  Created backend/.env — please update DB_PASSWORD before continuing"
    echo "   Press ENTER to continue with defaults, or Ctrl+C to edit first..."
    read
fi

npm install --silent

echo "🗄️  Running database migrations..."
node src/config/migrate.js

echo "🌱 Seeding database..."
node src/config/seed.js

echo "🚀 Starting backend on port 5000..."
npm run dev &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend
sleep 3

# Setup frontend
echo ""
echo "📦 Installing frontend dependencies..."
cd ../frontend

if [ ! -f .env ]; then
    echo "REACT_APP_API_URL=http://localhost:5000/api" > .env
fi

npm install --silent

echo "🎨 Starting frontend on port 3000..."
npm start &
FRONTEND_PID=$!

echo ""
echo "================================"
echo "✅ BES is starting up!"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend:  http://localhost:5000"
echo "❤️  Health:   http://localhost:5000/health"
echo ""
echo "👤 Admin:     admin@bes.gov.lk / Admin@1234"
echo "👤 Evaluator: evaluator@bes.gov.lk / Eval@1234"
echo ""
echo "Press Ctrl+C to stop all services"
echo "================================"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
