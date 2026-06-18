import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward, List, RotateCcw, RotateCw, Calendar } from 'lucide-react';

interface VideoPlayerProps {
    url: string;
    title?: string;
    type?: 'live' | 'movie' | 'series';
    onClose?: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    onToggleChannelList?: () => void;
    onToggleEPG?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, title, type = 'live', onClose, onNext, onPrev, onToggleChannelList, onToggleEPG }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [showControls, setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const controlsTimeout = useRef<any>(null);

    const isLive = type === 'live';

    useEffect(() => {
        if (!videoRef.current) return;

        // Limpiar src previo
        videoRef.current.src = '';

        let streamUrl = url;
        if (url.includes('latinchannel.tv:8080') && import.meta.env.DEV) {
            if (url.includes('/get.php')) {
                streamUrl = url.replace('http://latinchannel.tv:8080', '/api/xtream');
            } else {
                streamUrl = url.replace('http://latinchannel.tv:8080', '');
            }
        }

        const isHls = streamUrl.toLowerCase().includes('.m3u8') || streamUrl.includes('type=m3u8') || streamUrl.includes('output=m3u8');

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
            });

            return () => {
                hls.destroy();
            };
        } else {
            // Reproducción directa para MP4, MKV, etc.
            videoRef.current.src = streamUrl;
            videoRef.current.play().catch(e => console.error("Manual play error", e));
            videoRef.current.volume = volume;
            videoRef.current.muted = isMuted;
        }
    }, [url]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => setCurrentTime(video.currentTime);
        const handleDurationChange = () => setDuration(video.duration);

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('durationchange', handleDurationChange);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('durationchange', handleDurationChange);
        };
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    // OCR logic removed for performance

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
        const electron = (window as any).electronAPI;
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().then(() => {
                if (electron) electron.setFullscreen(true);
            }).catch(err => {
                console.error(`Error al intentar entrar en fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen().then(() => {
                if (electron) electron.setFullscreen(false);
            });
        }
    };

    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
        controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    };

    const handleDoubleClick = () => {
        toggleFullscreen();
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full bg-black group overflow-hidden"
            onMouseMove={handleMouseMove}
            onDoubleClick={handleDoubleClick}
        >
            <video
                ref={videoRef}
                className="w-full h-full cursor-pointer shadow-[0_0_100px_rgba(0,0,0,0.5)]"
                onClick={togglePlay}
            />

            {/* OCR Elements removed */}

            {/* Custom Overlay Controls */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/60 flex flex-col justify-between p-8 transition-opacity duration-500 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex justify-between items-start pointer-events-auto">
                    <div>
                        <h2 className="text-2xl font-black tracking-tighter text-white drop-shadow-lg leading-tight uppercase">
                            {title || (url.split('/').pop()?.split('?')[0].replace(/%20/g, ' ') || "Reproduciendo...")}
                        </h2>
                        <p className="text-xs text-zinc-300 font-bold flex items-center gap-2 mt-0.5 drop-shadow-md">
                            {isLive && <span className="bg-primary px-1.5 py-0.5 rounded text-[8px] text-white">LIVE</span>}
                            <span>{isLive ? 'Canal en vivo' : 'Contenido VOD'}</span>
                            {!title && <span className="text-[10px] text-zinc-500 opacity-50 truncate max-w-[200px] font-medium border-l border-white/10 pl-2 ml-1">{url.split('/').pop()?.split('?')[0]}</span>}
                        </p>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-3 bg-white/5 hover:bg-white/15 backdrop-blur-md rounded-full transition-all border border-white/10 hover:border-white/20"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="flex flex-col gap-6 pointer-events-auto">
                    {/* Progress Bar (Only for non-live) */}
                    {!isLive && duration > 0 && (
                        <div className="w-full flex flex-col gap-2">
                            <input
                                type="range"
                                min="0"
                                max={duration}
                                step="1"
                                value={currentTime}
                                onChange={handleSeek}
                                className="w-full h-1.5 netflix-range rounded-full cursor-pointer appearance-none hover:h-2 transition-all shadow-lg"
                                style={{
                                    background: `linear-gradient(to right, #e50914 0%, #e50914 ${(currentTime / duration) * 100}%, rgba(255, 255, 255, 0.2) ${(currentTime / duration) * 100}%, rgba(255, 255, 255, 0.2) 100%)`
                                }}
                            />
                            <div className="flex justify-between text-xs font-black text-zinc-400 tracking-tighter">
                                <span>{formatTime(currentTime)}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-zinc-600">|</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 sm:gap-8">
                            <div className="flex items-center gap-4">
                                {onPrev && (
                                    <button onClick={onPrev} className="text-zinc-400 hover:text-white transition-colors p-2">
                                        <SkipBack size={28} />
                                    </button>
                                )}
                                <button onClick={togglePlay} className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl">
                                    {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                                </button>
                                {onNext && (
                                    <button onClick={onNext} className="text-zinc-400 hover:text-white transition-colors p-2">
                                        <SkipForward size={28} />
                                    </button>
                                )}
                            </div>

                            {!isLive && (
                                <div className="flex items-center gap-2 border-l border-zinc-800 pl-8 h-8">
                                    <button
                                        onClick={() => handleSkip(-10)}
                                        className="text-zinc-400 hover:text-white transition-colors p-2"
                                        title="Retroceder 10s"
                                    >
                                        <RotateCcw size={22} />
                                    </button>
                                    <button
                                        onClick={() => handleSkip(10)}
                                        className="text-zinc-400 hover:text-white transition-colors p-2"
                                        title="Adelantar 10s"
                                    >
                                        <RotateCw size={22} />
                                    </button>
                                </div>
                            )}

                            <div className="flex items-center gap-3 border-l border-zinc-800 pl-8 h-8">
                                <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition-colors">
                                    {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                                </button>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={isMuted ? 0 : volume}
                                    onChange={handleVolumeChange}
                                    className="w-20 sm:w-28 netflix-range cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, #e50914 0%, #e50914 ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.2) ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.2) 100%)`
                                    }}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-4">
                            {/* OCR Controls removed */}

                            {isLive && onToggleEPG && (
                                <button onClick={onToggleEPG} className="p-3 bg-white/5 hover:bg-white/15 rounded-full transition-all border border-white/10 hover:border-white/20 text-zinc-400 hover:text-white">
                                    <Calendar size={22} />
                                </button>
                            )}

                            <button onClick={onToggleChannelList} className="p-3 bg-white/5 hover:bg-white/15 rounded-full transition-all border border-white/10 hover:border-white/20 text-zinc-400 hover:text-white">
                                <List size={22} />
                            </button>

                            <button onClick={toggleFullscreen} className="p-3 bg-white text-black rounded-full hover:scale-110 transition-all shadow-xl">
                                {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;
