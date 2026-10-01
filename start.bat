@echo off
REM Sobe a API e o site do NinWiki em duas janelas (duplo clique, sem PowerShell).
REM Pre-requisitos: Postgres no ar (docker compose up -d em NinWiki.Api), venv da API criado
REM em NinWiki.Api\venv (pip install -r requirements.txt) e npm install feito em NinWiki.Web.

start "NinWiki API" cmd /k "cd /d %~dp0NinWiki.Api && venv\Scripts\activate && python -m uvicorn app.main:app --reload"
start "NinWiki Web" cmd /k "cd /d %~dp0NinWiki.Web && npm run dev"

echo API:  http://localhost:8000/health
echo Site: http://localhost:3000
