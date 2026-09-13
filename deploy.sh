#!/usr/bin/env bash
set -e

echo "=== Pulling latest changes from git ==="
git pull origin main

echo "=== Building updated service containers ==="
docker compose build api worker dashboard

echo "=== Restarting services ==="
docker compose up -d --remove-orphans

echo "=== Cleaning up dangling images ==="
docker image prune -f

echo "=== Deployment complete! ==="
docker compose ps
