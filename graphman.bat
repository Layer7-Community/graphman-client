@echo off

if "%GRAPHMAN_HOME%"=="" (
  echo GRAPHMAN_HOME environment variable is not defined
  goto :end
)

node "%GRAPHMAN_HOME%\modules\main.js" %*

: end
