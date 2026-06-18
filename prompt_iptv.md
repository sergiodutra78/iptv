You are a senior software architect specializing in streaming platforms, IPTV systems, and AI integrations.

Your task is to design a **professional IPTV desktop application for Windows** with a **scalable architecture capable of integrating artificial intelligence services**, including **real-time audio translation from English to Spanish**.

The application must support **M3U playlists** as the main source of channels.

The entire user interface must be **in Spanish**.

The system must be designed for **future scalability**, allowing integration with additional AI services, APIs, and advanced streaming features.

---

PHASE 1 — SYSTEM ARCHITECTURE

Design a modular system composed of the following layers:

CLIENT APPLICATION

Desktop application for Windows built using:

Electron
React
TypeScript

Video playback engine:

LibVLC or FFmpeg based player.

Architecture:

Clean architecture
Service-based modules
Scalable design

The application must include the following sections:

Inicio
Televisión en Vivo
Categorías
Favoritos
Buscar
Configuración
Funciones IA

---

CORE FEATURES

The application must support:

Loading IPTV playlists (M3U format)
Automatic channel categorization
Channel logos
Search channels
Favorites management
Fast channel switching

---

M3U PLAYLIST SUPPORT

Users must be able to enter a playlist URL during initial configuration.

Example:

https://example.com/playlist.m3u

The system must parse standard IPTV playlist format.

Example:

#EXTM3U
#EXTINF:-1 tvg-id="channel1" tvg-name="Channel 1" group-title="News",Channel 1
http://stream.example.com/channel1.m3u8

Extract the following fields:

Channel name
Channel logo
Category
Stream URL

The parser must support very large playlists (1000+ channels).

---

VIDEO PLAYER

Use LibVLC or FFmpeg for video playback.

The player must support:

HLS streams (.m3u8)
MPEGTS streams (.ts)

Player features must include:

Fullscreen playback
Play/Pause
Volume control
Buffer management
Automatic reconnect on stream failure
Audio track switching
Subtitle support (future feature)

---

BACKEND SERVICES

Design a backend architecture using microservices.

Core services:

API Gateway
Playlist Service
Channel Metadata Service
EPG Service
AI Services

Recommended technologies:

FastAPI or NodeJS
PostgreSQL
Redis cache
Docker containers

---

PHASE 2 — USER INTERFACE DESIGN

Design a modern interface inspired by:

Netflix
Tivimate
Modern streaming platforms

Requirements:

Dark theme
Large channel logos
Smooth animations
High readability
Responsive desktop layout

Home screen must include:

Recommended channels
Recent channels
Categories

Live TV screen must include:

Channel categories sidebar
Channel grid
Live preview when selecting channels

Player overlay must include:

Channel name
Program information (EPG ready)
Audio options
AI translation toggle

---

PHASE 3 — AI TRANSLATION MICRO-SERVICE

Design a microservice capable of translating **English audio streams into Spanish in real time**.

Architecture pipeline:

1 Capture audio from IPTV stream
2 Extract audio frames
3 Send audio to speech recognition engine
4 Translate recognized text
5 Generate Spanish audio
6 Send translated audio to player

Recommended AI stack:

Speech-to-Text:

Whisper
Vosk

Translation:

Meta NLLB
MarianMT

Text-to-Speech:

Piper TTS
Coqui TTS

---

AI MODULE ARCHITECTURE

Create modular AI components:

Audio Capture Module
Speech Recognition Module
Translation Module
Speech Synthesis Module

The architecture must allow future AI integrations such as:

AI subtitles
Automatic program summaries
Voice assistant
Content recommendations

---

PERFORMANCE REQUIREMENTS

The system must:

Cache playlists locally
Handle very large channel lists efficiently
Use asynchronous processing
Avoid blocking the UI thread

---

ERROR HANDLING

Handle the following cases:

Invalid playlist URL
Network failures
Stream playback errors
AI translation errors

All user messages must be displayed in Spanish.

---

PROJECT OUTPUT

Generate:

Complete Electron project
React UI components
Video player module
M3U parser module
Backend microservice architecture
Database schema
AI microservice architecture
Project folder structure

Code must be production-ready and modular.
