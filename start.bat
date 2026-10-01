@echo off
title NinWiki - Painel de Controlo
cls

:menu_principal
cls
echo =========================================
echo      NINWIKI - MENU DE INICIALIZACAO
echo =========================================
echo [1] Iniciar em Modo Desenvolvimento (DEV)
echo [2] Iniciar em Modo Producao (PROD)
echo [3] Abrir Consola Master (Backend)
echo [4] Sair
echo =========================================
set /p opcao="Escolhe uma opcao: "

if "%opcao%"=="1" (
    set MODO=DEV
    goto iniciar_servidores
)
if "%opcao%"=="2" (
    set MODO=PROD
    goto iniciar_servidores
)
if "%opcao%"=="3" goto master
if "%opcao%"=="4" goto sair
goto menu_principal

:iniciar_servidores
echo A iniciar o Frontend (%MODO%)...
if "%MODO%"=="DEV" start "NinWiki_Frontend" cmd /k "title NinWiki_Frontend && cd NinWiki.Web && npm run dev"
if "%MODO%"=="PROD" start "NinWiki_Frontend" cmd /k "title NinWiki_Frontend && cd NinWiki.Web && npm run build && npm run start"

:iniciar_backend
echo A iniciar o Backend (%MODO%)...
if "%MODO%"=="DEV" start "NinWiki_Backend" cmd /k "title NinWiki_Backend && cd NinWiki.Api && venv\Scripts\activate && python -m uvicorn app.main:app --reload"
if "%MODO%"=="PROD" start "NinWiki_Backend" cmd /k "title NinWiki_Backend && cd NinWiki.Api && venv\Scripts\activate && python -m uvicorn app.main:app"
goto menu_controlo

:iniciar_frontend
echo A iniciar o Frontend (%MODO%)...
if "%MODO%"=="DEV" start "NinWiki_Frontend" cmd /k "title NinWiki_Frontend && cd NinWiki.Web && npm run dev"
if "%MODO%"=="PROD" start "NinWiki_Frontend" cmd /k "title NinWiki_Frontend && cd NinWiki.Web && npm run build && npm run start"
goto menu_controlo

:menu_controlo
cls
echo =========================================
echo    SERVIDORES A CORRER - MODO: %MODO%
echo =========================================
echo As janelas da API e do Next.js estao abertas.
echo.
echo [1] Atualizar Banco de Dados (Alembic) e Reiniciar API
echo [2] Instalar Pacotes Backend (Requirements) e Reiniciar API
echo [3] Instalar Pacotes Frontend (npm install) e Reiniciar Frontend
echo [4] Atualizar Backend Completo (Pip + Alembic) e Reiniciar API
echo [5] Reprocessar Imagens de Upload (reprocess_uploads.py)
echo [6] Desligar tudo e voltar ao Menu Principal
echo [7] Desligar tudo e Sair
echo =========================================
set /p ctrl_opcao="O que desejas fazer? "

if "%ctrl_opcao%"=="1" goto atualizar_alembic
if "%ctrl_opcao%"=="2" goto atualizar_req
if "%ctrl_opcao%"=="3" goto atualizar_npm
if "%ctrl_opcao%"=="4" goto atualizar_ambos
if "%ctrl_opcao%"=="5" goto reprocessar_imagens
if "%ctrl_opcao%"=="6" goto desligar_tudo
if "%ctrl_opcao%"=="7" goto desligar_sair
goto menu_controlo

:atualizar_alembic
echo A encerrar a API atual...
taskkill /FI "WINDOWTITLE eq *NinWiki_Backend*" /T /F >nul 2>&1
echo A aplicar migracoes do banco de dados...
cmd /c "cd NinWiki.Api && venv\Scripts\activate && alembic upgrade head"
echo Migracoes concluidas!
timeout /t 2 >nul
goto iniciar_backend

:atualizar_req
echo A encerrar a API atual...
taskkill /FI "WINDOWTITLE eq *NinWiki_Backend*" /T /F >nul 2>&1
echo A instalar novas dependencias do Backend...
cmd /c "cd NinWiki.Api && venv\Scripts\activate && pip install -r requirements.txt"
echo Pacotes instalados!
timeout /t 2 >nul
goto iniciar_backend

:atualizar_npm
echo A encerrar o Frontend atual...
taskkill /FI "WINDOWTITLE eq *NinWiki_Frontend*" /T /F >nul 2>&1
echo A instalar dependencias do Frontend (npm install)...
cmd /c "cd NinWiki.Web && npm install"
echo Dependencias do Frontend instaladas!
timeout /t 2 >nul
goto iniciar_frontend

:atualizar_ambos
echo A encerrar a API atual...
taskkill /FI "WINDOWTITLE eq *NinWiki_Backend*" /T /F >nul 2>&1
echo A atualizar pacotes e banco de dados...
cmd /c "cd NinWiki.Api && venv\Scripts\activate && pip install -r requirements.txt && alembic upgrade head"
echo Atualizacoes concluidas!
timeout /t 2 >nul
goto iniciar_backend

:reprocessar_imagens
echo A reprocessar e redimensionar imagens...
cmd /c "cd NinWiki.Api && venv\Scripts\activate && python scripts/reprocess_uploads.py"
echo.
echo Processamento de imagens concluido!
pause
goto menu_controlo

:desligar_tudo
echo A encerrar todos os processos...
taskkill /FI "WINDOWTITLE eq *NinWiki_Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq *NinWiki_Frontend*" /T /F >nul 2>&1
goto menu_principal

:desligar_sair
taskkill /FI "WINDOWTITLE eq *NinWiki_Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq *NinWiki_Frontend*" /T /F >nul 2>&1
exit

:master
start "NinWiki Consola Master" cmd /k "title NinWiki Consola Master && cd NinWiki.Api && venv\Scripts\activate && echo --- Consola Master do Backend ---"
goto menu_principal

:sair
exit