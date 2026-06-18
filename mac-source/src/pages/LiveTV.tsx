import { useState, useEffect, useMemo, useRef } from 'react';
import { type Channel } from '../services/m3uParser';
import VideoPlayer from '../components/VideoPlayer';
import { Tv, Play, Search, LayoutGrid, List, Clock, Loader2 } from 'lucide-react';
import CachedImage from '../components/CachedImage';
import { getActivePlaylistUrl } from '../config/iptv';
import { DataService } from '../services/dataService';
import { EPGService, type EPGData } from '../services/epgService';

const ITEMS_PER_PAGE = 30;

const LiveTV = () => {
    const [channels, setChannels] = useState<Channel[]>(() => DataService.getLiveSync());
    const [categories, setCategories] = useState<string[]>(() => {
        const live = DataService.getLiveSync();
        return ['Todos', ...Array.from(new Set(live.map(c => c.group)))];
    });
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(!DataService.hasData());
    const [epgData, setEpgData] = useState<EPGData>({});
    const [showChannelList, setShowChannelList] = useState(false);
    const [showEPGGrid, setShowEPGGrid] = useState(false);
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

    const loaderRef = useRef<HTMLDivElement>(null);

    // Optimizamos el filtrado con useMemo para evitar renders pesados
    const filteredChannels = useMemo(() => {
        let result = channels;
        if (selectedCategory !== 'Todos') {
            result = result.filter(c => c.group === selectedCategory);
        }
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(c => c.name.toLowerCase().includes(query));
        }
        return result;
    }, [selectedCategory, searchQuery, channels]);

    const displayChannels = useMemo(() => {
        return filteredChannels.slice(0, visibleCount);
    }, [filteredChannels, visibleCount]);

    // Carga la lista Premium si está configurada, o la lista de Uruguay por defecto
    useEffect(() => {
        const urlToLoad = getActivePlaylistUrl() || "/uruguay.m3u";
        loadChannels(urlToLoad);
    }, []);

    const loadChannels = async (url: string) => {
        // Si ya hay datos en el servicio, los usamos
        if (DataService.hasData()) {
            const liveOnly = DataService.getLiveSync();
            if (liveOnly.length > 0) {
                setChannels(liveOnly);
                const cats = ['Todos', ...Array.from(new Set(liveOnly.map(c => c.group)))];
                setCategories(cats);
                setLoading(false);
                return;
            }
        }

        setLoading(true);
        try {
            const playlist = await DataService.getChannels(url);
            const liveOnly = playlist.channels.filter(c => c.type === 'live');
            setChannels(liveOnly);

            const cats = ['Todos', ...Array.from(new Set(liveOnly.map(c => c.group)))];
            setCategories(cats);

            if (playlist.epgUrl) {
                fetchEPG(playlist.epgUrl);
            }
        } catch (error) {
            console.error("Error loading channels", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchEPG = async (url: string) => {
        const data = await EPGService.fetchEPG(url);
        setEpgData(data);
    };

    // Observer for infinite scroll
    useEffect(() => {
        if (loading) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && visibleCount < filteredChannels.length) {
                    setVisibleCount(prev => prev + ITEMS_PER_PAGE);
                }
            },
            { threshold: 0.1 }
        );

        if (loaderRef.current) {
            observer.observe(loaderRef.current);
        }

        return () => observer.disconnect();
    }, [loading, visibleCount, filteredChannels.length]);

    // Reset visible count when category or search changes
    useEffect(() => {
        setVisibleCount(ITEMS_PER_PAGE);
    }, [selectedCategory, searchQuery]);

    if (selectedChannel) {
        // En m3uParser.ts id no siempre existe, mejor buscar solo por url
        const currentProgram = selectedChannel.epgId ? EPGService.getCurrentProgram(epgData[selectedChannel.epgId]) : undefined;
        const fullDayPrograms = selectedChannel.epgId ? epgData[selectedChannel.epgId] || [] : [];

        const handleNext = () => {
            const index = filteredChannels.findIndex(c => c.url === selectedChannel.url);
            if (index < filteredChannels.length - 1) {
                setSelectedChannel(filteredChannels[index + 1]);
            } else if (filteredChannels.length > 0) {
                setSelectedChannel(filteredChannels[0]);
            }
        };

        const handlePrev = () => {
            const index = filteredChannels.findIndex(c => c.url === selectedChannel.url);
            if (index > 0) {
                setSelectedChannel(filteredChannels[index - 1]);
            } else if (filteredChannels.length > 0) {
                setSelectedChannel(filteredChannels[filteredChannels.length - 1]);
            }
        };

        return (
            <div className="fixed inset-0 z-50 overflow-hidden bg-black flex">
                <VideoPlayer
                    url={selectedChannel.url}
                    title={selectedChannel.name}
                    type={selectedChannel.type}
                    onClose={() => { setSelectedChannel(null); setShowChannelList(false); setShowEPGGrid(false); }}
                    onNext={filteredChannels.length > 1 ? handleNext : undefined}
                    onPrev={filteredChannels.length > 1 ? handlePrev : undefined}
                    onToggleChannelList={() => { setShowChannelList(!showChannelList); setShowEPGGrid(false); }}
                    onToggleEPG={() => { setShowEPGGrid(!showEPGGrid); setShowChannelList(false); }}
                />

                {/* EPG Overlay Informative (Mini) */}
                {!showEPGGrid && !showChannelList && (
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none transition-opacity">
                        {currentProgram && (
                            <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 flex flex-col items-center gap-1 shadow-2xl">
                                <span className="text-primary text-[10px] font-bold uppercase tracking-widest">En este momento</span>
                                <h3 className="text-lg font-bold text-white uppercase tracking-tighter italic">{currentProgram.title}</h3>
                                <p className="text-zinc-400 text-xs font-bold">Hasta las {currentProgram.stop.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* FULL EPG GRID */}
                {showEPGGrid && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-xl z-[60] flex flex-col p-10 overflow-hidden scrollbar-hide">
                        <div className="flex justify-between items-center mb-10 border-b border-white/10 pb-6">
                            <div className="flex items-center gap-6">
                                {selectedChannel.logo && <CachedImage src={selectedChannel.logo} className="h-16 object-contain" />}
                                <div>
                                    <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase">{selectedChannel.name}</h2>
                                    <p className="text-primary font-black tracking-widest uppercase text-sm">Guía de Programación</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowEPGGrid(false)}
                                className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center border border-white/10 transition-all"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 pr-4">
                            {fullDayPrograms.length > 0 ? (
                                fullDayPrograms.map((prog, idx) => {
                                    const isCurrent = currentProgram && prog.start.getTime() === currentProgram.start.getTime();
                                    const isPast = prog.stop < new Date();

                                    return (
                                        <div
                                            key={idx}
                                            className={`group p-6 rounded-2xl border transition-all flex items-center gap-6 ${isCurrent
                                                ? 'bg-primary/20 border-primary shadow-[0_0_30px_rgba(229,9,20,0.1)]'
                                                : isPast
                                                    ? 'bg-zinc-900/20 border-zinc-800/30 opacity-40'
                                                    : 'bg-zinc-900/40 border-white/5 hover:border-white/10'
                                                }`}
                                        >
                                            <div className="flex flex-col items-center justify-center min-w-[80px] border-r border-white/5 pr-6">
                                                <span className="text-lg font-black text-white">{prog.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                <span className="text-[10px] font-black text-zinc-500 uppercase">Inicio</span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-1">
                                                    {isCurrent && (
                                                        <span className="bg-primary px-2 py-0.5 rounded text-[8px] font-black text-white uppercase animate-pulse">Ahora</span>
                                                    )}
                                                    <h4 className="text-xl font-black text-white italic tracking-tight uppercase group-hover:text-primary transition-colors">{prog.title}</h4>
                                                </div>
                                                <p className="text-sm text-zinc-400 font-medium line-clamp-2">{prog.description || "Sin descripción disponible."}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-black text-zinc-500 uppercase block mb-1">Finaliza</span>
                                                <span className="text-sm font-bold text-white">{prog.stop.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full opacity-30 gap-4">
                                    <Clock size={64} />
                                    <p className="text-xl font-black italic uppercase tracking-widest">No hay programación disponible para hoy</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {showChannelList && (
                    <div className="absolute top-0 left-0 bottom-0 w-80 bg-black/80 backdrop-blur-md border-r border-white/10 z-50 overflow-y-auto custom-scrollbar flex flex-col pointer-events-auto shadow-2xl">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center sticky top-0 bg-black/50 backdrop-blur-md z-10">
                            <h3 className="font-bold text-white text-lg">Canales ({selectedCategory})</h3>
                            <button onClick={() => setShowChannelList(false)} className="text-zinc-400 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors">✕</button>
                        </div>
                        <div className="flex-1 p-3 space-y-1">
                            {filteredChannels.slice(0, 100).map(c => { // Listado limitado en el overlay por performance
                                const prog = c.epgId ? EPGService.getCurrentProgram(epgData[c.epgId]) : undefined;
                                const isSelected = selectedChannel.url === c.url;
                                return (
                                    <button
                                        key={c.id + c.url}
                                        onClick={() => { setSelectedChannel(c); setShowEPGGrid(false); }}
                                        className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors ${isSelected ? 'bg-primary/20 border border-primary/50' : 'hover:bg-white/10 border border-transparent'}`}
                                    >
                                        {c.logo ? (
                                            <div className="w-12 h-12 bg-black/50 rounded flex-shrink-0 flex items-center justify-center p-1">
                                                <CachedImage src={c.logo} alt={c.name} className="max-w-full max-h-full object-contain" />
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 bg-black/50 rounded flex-shrink-0 flex items-center justify-center">
                                                <Tv size={24} className="text-zinc-500" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-bold truncate ${isSelected ? 'text-primary' : 'text-zinc-200'}`}>{c.name}</p>
                                            {prog && (
                                                <p className="text-[10px] text-zinc-400 truncate mt-0.5">● {prog.title}</p>
                                            )}
                                        </div>
                                        {isSelected && (
                                            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 animate-pulse hidden sm:block"></div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-5rem)]">
            {/* Sidebar de Categorías */}
            <div className="w-64 bg-zinc-950 border-r border-zinc-900 overflow-y-auto p-4 custom-scrollbar">
                <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4 px-2">Categorías</h3>
                <div className="space-y-1">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${selectedCategory === cat ? 'bg-primary text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid de Canales */}
            <div className="flex-1 flex flex-col bg-background">
                <div className="p-6 border-b border-zinc-900 flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar en esta categoría..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-primary text-sm"
                        />
                    </div>
                    <div className="flex gap-2 text-zinc-500 items-center text-xs">
                        <Clock size={16} /> {Object.keys(epgData).length > 0 ? "EPG Cargada" : "Sin EPG"}
                    </div>
                    <div className="flex gap-2">
                        <button className="p-2 bg-zinc-900 rounded-lg text-primary"><LayoutGrid size={20} /></button>
                        <button className="p-2 hover:bg-zinc-900 rounded-lg text-zinc-500"><List size={20} /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4">
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Analizando lista de canales...</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                                {displayChannels.map(channel => {
                                    const prog = channel.epgId ? EPGService.getCurrentProgram(epgData[channel.epgId]) : undefined;
                                    return (
                                        <div
                                            key={channel.id + channel.url}
                                            onClick={() => setSelectedChannel(channel)}
                                            className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden cursor-pointer channel-card-hover group"
                                        >
                                            <div className="aspect-video bg-zinc-800 flex items-center justify-center relative p-3">
                                                {channel.logo ? (
                                                    <CachedImage src={channel.logo} alt={channel.name} className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-500" />
                                                ) : (
                                                    <Tv size={32} className="text-zinc-700" />
                                                )}
                                                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/20 transition-all flex items-center justify-center pointer-events-none">
                                                    <Play className="text-white opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all" fill="currentColor" size={32} />
                                                </div>
                                            </div>
                                            <div className="p-3">
                                                <p className="text-xs font-bold truncate text-zinc-200">{channel.name}</p>
                                                {prog ? (
                                                    <p className="text-[10px] text-primary truncate mt-1 font-bold">● {prog.title}</p>
                                                ) : (
                                                    <p className="text-[10px] text-zinc-500 truncate mt-1">{channel.group}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Loader reference for infinite scroll */}
                            {visibleCount < filteredChannels.length && (
                                <div ref={loaderRef} className="flex justify-center py-10">
                                    <Loader2 size={32} className="text-primary animate-spin" />
                                </div>
                            )}
                        </>
                    )}

                    {!loading && channels.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <Tv size={64} className="text-zinc-800 mb-4" />
                            <h3 className="text-xl font-bold">No hay canales cargados</h3>
                            <p className="text-zinc-500 mt-2 max-w-xs">Ve a Ajustes para añadir tu URL de lista M3U y empezar a ver televisión.</p>
                            <button
                                onClick={() => {
                                    const url = prompt("Introduce una URL de lista M3U para probar:");
                                    if (url) loadChannels(url);
                                }}
                                className="mt-6 px-6 py-2 bg-primary rounded-full font-bold hover:scale-105 transition-transform"
                            >
                                Cargar Lista Ahora
                            </button>
                        </div>
                    ) || null}
                </div>
            </div>
        </div>
    );
};

export default LiveTV;
