#!/bin/bash

echo "========================================"
echo "Starting DISI AI"
echo "========================================"
echo ""
echo "AI and file processing run via Inngest (no separate worker processes)."
echo ""

if [ ! -d "node_modules" ]; then
    echo "ERROR: node_modules not found! Run: npm install"
    exit 1
fi

if [ ! -f ".env.local" ]; then
    echo "ERROR: .env.local not found!"
    exit 1
fi

echo "Starting Next.js Dev Server..."
npm run dev
