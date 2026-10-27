@echo off
cd /d "%~dp0"
start "" http://localhost:8642
node tools\serve.js 8642
