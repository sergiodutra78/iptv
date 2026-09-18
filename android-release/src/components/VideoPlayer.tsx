import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward, List, RotateCcw, RotateCw, Calendar } from 'lucide-react';
import { WatchProgressService } from '../services/WatchProgressService';

interface VideoPlayerProps {
    url: string;
    title?: string;
    subtitle?: string;
    type?: 'live' | 'movie' | 'series';
    onClose?: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    onToggleChannelList?: () => void;
    onToggleEPG?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, title, subtitle, type = 'live', onClose, onNext, onPrev, onToggleChannelList, onToggleEPG }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [showControls, setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [hasError, setHasError] = useState(false);
    const [errorDetails, setErrorDetails] = useState<string>("");

    const controlsTimeout = useRef<any>(null);
    const lastProgressSave = useRef<number>(0);

    const isLive = type === 'live';
    const isMovie = type === 'movie';

    useEffect(() => {
        if (!videoRef.current) return;

        setHasError(false);
        videoRef.current.src = '';

        let streamUrl = url;

        const isHls = streamUrl.toLowerCase().includes('.m3u8') || streamUrl.includes('type=m3u8') || streamUrl.includes('output=m3u8');


        // Native player for Android (Capacitor streaming plugin)
        const plugins = (window as any).plugins;
        if (plugins && plugins.streamingMedia) {
            console.log("Using Native Player for", streamUrl);
            const options = {
                successCallback: () => console.log('Video played'),
                errorCallback: (e: any) => {
                    console.error('Native Player Error', e);
                    setHasError(true);
                    setErrorDetails(`Native Player Error: ${e || 'Error desconocido'}`);
                },
                shouldAutoPlay: true,
                controls: true
            };
            plugins.streamingMedia.playVideo(streamUrl, options);
            return;
        }

        if (isHls && Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                maxBufferLength: 30,
                maxMaxBufferLength: 60
            });

            hls.loadSource(streamUrl);
            hls.attachMedia(videoRef.current);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoRef.current?.play().catch(e => console.error("Auto-play blocked", e));
                if (videoRef.current) {
                    videoRef.current.volume = volume;
                    videoRef.current.muted = isMuted;
                }
                if (isMovie) {
                    const saved = WatchProgressService.get(url);
                    if (saved && saved.position > 30) {
                        setTimeout(() => {
                            if (videoRef.current) videoRef.current.currentTime = saved.position;
                        }, 300);
                    }
                }
            });

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    console.error("HLS Fatal Error", data);
                    setHasError(true);
                    setErrorDetails(`HLS Fatal: ${data.type} - ${data.details}`);
                }
            });

            return () => { hls.destroy(); };
        } else {
            videoRef.current.src = streamUrl;
            videoRef.current.volume = volume;
            videoRef.current.muted = isMuted;
            if (isMovie) {
                const saved = WatchProgressService.get(url);
                if (saved && saved.position > 30) {
                    videoRef.current.addEventListener('loadedmetadata', () => {
                        if (videoRef.current) videoRef.current.currentTime = saved.position;
                    }, { once: true });
                }
            }
            videoRef.current.play().catch(e => {
                console.error("Manual play error", e);
                setHasError(true);
                setErrorDetails(`Manual Play Error: ${e.message || "Unknown"}`);
            });
        }
    }, [url]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            const t = video.currentTime;
            setCurrentTime(t);
            if (isMovie) {
                const now = Date.now();
                if (now - lastProgressSave.current > 5000) {
                    lastProgressSave.current = now;
                    WatchProgressService.save(url, t, video.duration);
                }
            }
        };
        const handleDurationChange = () => setDuration(video.duration);

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('durationchange', handleDurationChange);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('durationchange', handleDurationChange);
        };
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) videoRef.current.pause();
            else videoRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
            videoRef.current.muted = newVolume === 0;
        }
        setIsMuted(newVolume === 0);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const handleSkip = (seconds: number) => {
        if (videoRef.current) {
            const newTime = Math.min(Math.max(videoRef.current.currentTime + seconds, 0), duration);
            videoRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return "00:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const toggleMute = () => {
        if (videoRef.current) {
            const newMuted = !isMuted;
            videoRef.current.muted = newMuted;
            setIsMuted(newMuted);
            if (!newMuted && volume === 0) {
                setVolume(1);
                videoRef.current.volume = 1;
            }
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                console.error(`Error fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
        controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full bg-black group overflow-hidden"
            onMouseMove={handleMouseMove}
            onTouchStart={handleMouseMove}
            onDoubleClick={toggleFullscreen}
        >
            <video
                ref={videoRef}
                className="w-full h-full cursor-pointer"
                onClick={togglePlay}
                onError={() => {
                    setHasError(true);
                    const video = videoRef.current;
                    const err = video?.error;
                    setErrorDetails(`Video Error: Code ${err?.code || 'X'} - ${err?.message || "Format not supported"}`);
                }}
            />

            {hasError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-40 text-white gap-4 pointer-events-auto">
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="absolute top-8 right-8 p-3 bg-white/5 hover:bg-white/15 backdrop-blur-md rounded-full transition-all border border-white/10 z-50 text-white"
                        >
                            ✕
                        </button>
                    )}
                    <VolumeX size={64} className="text-primary animate-pulse" />
                    <h2 className="text-3xl font-black tracking-tighter uppercase italic">Canal Offline</h2>
                    <p className="text-sm text-zinc-400 font-medium">El contenido no está disponible en este momento.</p>
                    <p className="text-xs text-red-500 font-mono max-w-md text-center bg-black/40 p-2 rounded mt-2">{errorDetails}</p>
                </div>
            )}

            <div className={`absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/60 flex flex-col justify-between p-6 transition-opacity duration-500 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex justify-between items-start pointer-events-auto">
                    <div>
                        <h2 className="text-xl font-black tracking-tighter text-white drop-shadow-lg leading-tight uppercase">
                            {title || "Reproduciendo..."}
                        </h2>
                        <p className="text-[10px] text-zinc-300 font-bold flex items-center gap-2 mt-0.5">
                            {isLive && <span className="bg-primary px-1.5 py-0.5 rounded text-[8px] text-white">LIVE</span>}
                            <span className="truncate max-w-[200px]">{isLive ? (subtitle || 'Canal en vivo') : 'Contenido VOD'}</span>
                        </p>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-3 bg-white/5 hover:bg-white/15 backdrop-blur-md rounded-full transition-all border border-white/10"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="flex flex-col gap-4 pointer-events-auto">
                    {!isLive && duration > 0 && (
                        <div className="w-full flex flex-col gap-2">
                            <input
                                type="range"
                                min="0"
                                max={duration}
                                step="1"
                                value={currentTime}
                                onChange={handleSeek}
                                className="w-full h-1.5 netflix-range rounded-full cursor-pointer appearance-none"
                                style={{
                                    background: `linear-gradient(to right, #e50914 0%, #e50914 ${(currentTime / duration) * 100}%, rgba(255, 255, 255, 0.2) ${(currentTime / duration) * 100}%, rgba(255, 255, 255, 0.2) 100%)`
                                }}
                            />
                            <div className="flex justify-between text-xs font-black text-zinc-400 tracking-tighter">
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {onPrev && (
                                <button onClick={onPrev} className="text-zinc-400 hover:text-white transition-colors p-2">
                                    <SkipBack size={24} />
                                </button>
                            )}
                            <button onClick={togglePlay} className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl">
                                {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                            </button>
                            {onNext && (
                                <button onClick={onNext} className="text-zinc-400 hover:text-white transition-colors p-2">
                                    <SkipForward size={24} />
                                </button>
                            )}

                            {!isLive && (
                                <div className="flex items-center gap-1 border-l border-zinc-800 pl-3 h-8">
                                    <button onClick={() => handleSkip(-10)} className="text-zinc-400 hover:text-white transition-colors p-1.5">
                                        <RotateCcw size={20} />
                                    </button>
                                    <button onClick={() => handleSkip(10)} className="text-zinc-400 hover:text-white transition-colors p-1.5">
                                        <RotateCw size={20} />
                                    </button>
                                </div>
                            )}

                            <div className="hidden sm:flex items-center gap-2 border-l border-zinc-800 pl-3 h-8">
                                <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition-colors">
                                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                </button>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={isMuted ? 0 : volume}
                                    onChange={handleVolumeChange}
                                    className="w-20 netflix-range cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, #e50914 0%, #e50914 ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.2) ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.2) 100%)`
                                    }}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {isLive && onToggleEPG && (
                                <button onClick={onToggleEPG} className="p-2.5 bg-white/5 hover:bg-white/15 rounded-full transition-all border border-white/10 text-zinc-400 hover:text-white">
                                    <Calendar size={20} />
                                </button>
                            )}
                            {onToggleChannelList && (
                                <button onClick={onToggleChannelList} className="p-2.5 bg-white/5 hover:bg-white/15 rounded-full transition-all border border-white/10 text-zinc-400 hover:text-white">
                                    <List size={20} />
                                </button>
                            )}
                            <button onClick={toggleFullscreen} className="p-2.5 bg-white text-black rounded-full hover:scale-110 transition-all shadow-xl">
                                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;
