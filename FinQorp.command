#!/bin/bash

# FinQorp Launch Script
# Double-click this file to start FinQorp

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down FinQorp..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

# Trap Ctrl+C and other termination signals
trap cleanup SIGINT SIGTERM

echo "🚀 Starting FinQorp Application..."
echo ""
echo "📂 Working directory: $DIR"
echo ""

# Start Backend (FastAPI)
echo "🔧 Starting Backend (FastAPI)..."
.venv/bin/python -m uvicorn api:app --reload --port 6150 > backend.log 2>&1 &
BACKEND_PID=$!
echo "   ✓ Backend started (PID: $BACKEND_PID)"

# Wait for backend to start
sleep 3

# Start Frontend (React + Vite)
echo "⚛️  Starting Frontend (React + Vite)..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
echo "   ✓ Frontend started (PID: $FRONTEND_PID)"

# Wait for frontend to start
sleep 5

echo ""
echo "✅ FinQorp is now running!"
echo ""
echo "📍 Backend API:  http://localhost:6150"
echo "📍 Frontend App: http://localhost:6100"
echo "📍 API Docs:     http://localhost:6150/docs"
echo ""

# Open the application in default browser
echo "🌐 Opening FinQorp in your browser..."
sleep 2
open http://localhost:6100

echo ""
echo "📝 Logs are being written to:"
echo "   - Backend: $DIR/backend.log"
echo "   - Frontend: $DIR/frontend.log"
echo ""
echo "⚠️  Keep this window open while using FinQorp"
echo "🛑 Press Ctrl+C to stop all servers and exit"
echo ""

# Keep the script running
wait $BACKEND_PID $FRONTEND_PID
