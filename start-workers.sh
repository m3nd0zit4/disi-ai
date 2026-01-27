#!/bin/bash

echo "========================================"
echo "Starting DISI AI Workers"
echo "========================================"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "ERROR: node_modules not found!"
    echo "Please run: npm install"
    echo ""
    exit 1
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "ERROR: .env.local not found!"
    echo "Please create .env.local with required environment variables."
    echo "See WORKER_SETUP.md for details."
    echo ""
    exit 1
fi

echo "[1/3] Starting Next.js Dev Server..."
npm run dev &
sleep 3

echo "[2/3] Starting AI Worker..."
npm run worker &
sleep 2

echo "[3/3] Starting File Worker..."
npm run file-worker &
sleep 1

echo ""
echo "========================================"
echo "All workers started successfully!"
echo "========================================"
echo ""
echo "Services running:"
echo "  - Next.js: http://localhost:3000"
echo "  - AI Worker: Processing canvas executions"
echo "  - File Worker: Processing Knowledge Garden uploads"
echo ""
echo "To stop all workers: pkill -f 'node|tsx'"
echo ""
