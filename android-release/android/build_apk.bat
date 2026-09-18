@echo off
set "JAVA_HOME=c:\Sergio\KinetiQ\iptv\android-app\java_jdk_21\jdk-21.0.10+7"
set "PATH=%JAVA_HOME%\bin;%PATH%"
echo Usando JAVA_HOME = %JAVA_HOME%
call gradlew.bat assembleDebug > gradle_build_output.txt 2>&1
