#!/bin/bash

# Script to check PM2 errors and fix them

echo "🔍 Checking PM2 error logs..."
echo ""

# Show error logs
echo "📋 Error Logs:"
pm2 logs sales-app --err --lines 50 --nostream

echo ""
echo "📋 All Logs (last 50 lines):"
pm2 logs sales-app --lines 50 --nostream

echo ""
echo "📊 PM2 Info:"
pm2 show sales-app
