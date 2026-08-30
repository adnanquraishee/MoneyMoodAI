#!/bin/bash

# FinQorp Startup Script
# This script starts both the backend (FastAPI) and frontend (React) servers

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "🚀 Starting FinQorp Application..."
echo ""

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "⚠️  tmux is not installed. Installing via brew..."
    brew install tmux
fi

# Kill existing FinQorp session if it exists
tmux kill-session -t finqorp 2>/dev/null

# Create new tmux session
tmux new-session -d -s finqorp

# Split window horizontally
tmux split-window -h -t finqorp

# Run backend in left pane
tmux send-keys -t finqorp:0.0 "cd '$DIR'" C-m
tmux send-keys -t finqorp:0.0 'source .venv/bin/activate' C-m
tmux send-keys -t finqorp:0.0 'echo "🔧 Starting Backend (FastAPI)..."' C-m
tmux send-keys -t finqorp:0.0 '.venv/bin/python -m uvicorn api:app --reload --port 6150' C-m

# Run frontend in right pane
tmux send-keys -t finqorp:0.1 "cd '$DIR/frontend'" C-m
tmux send-keys -t finqorp:0.1 'echo "⚛️  Starting Frontend (React + Vite)..."' C-m
tmux send-keys -t finqorp:0.1 'npm run dev' C-m

echo "✅ FinQorp started in tmux session 'finqorp'"
echo ""
echo "📍 Backend API:  http://localhost:6150"
echo "📍 Frontend App: http://localhost:6100"
echo "📍 API Docs:     http://localhost:6150/docs"
echo ""
echo "To view the servers, run: tmux attach -t finqorp"
echo "To detach from tmux, press: Ctrl+B then D"
echo "To stop all servers, run: tmux kill-session -t finqorp"
echo ""
