import { useState, useEffect, useMemo, useRef } from 'react';
import { type Channel } from '../services/m3uParser';
import VideoPlayer from '../components/VideoPlayer';
import { Tv, Play, Search, LayoutGrid, List, Clock, Loader2 } from 'lucide-react';
import CachedImage from '../components/CachedImage';
import { getActivePlaylistUrl, IPTV_CONFIG } from '../config/iptv';
import { DataService } from '../services/dataService';
import { EPGService, type EPGData } from '../services/epgService';

const ITEMS_PER_PAGE = 30;

// Componente para renderizar la tarjeta o fila de canal con carga asíncrona de Short EPG
const ChannelItem = ({ channel, epgData, configToUse, viewMode, onSelect, isSelected }: { 
    channel: Channel, 
    epgData: EPGData, 
    configToUse: any, 
    viewMode: 'grid' | 'list', 
    onSelect: (c: Channel) => void,
    isSelected: boolean
}) => {
    const [localProgs, setLocalProgs] = useState<any[]>([]);
    const [loadingShort, setLoadingShort] = useState(false);

    useEffect(() => {
        const progs = EPGService.getPrograms(channel, epgData);
        if (progs && progs.length > 0) {
            setLocalProgs(progs);
            return;
        }

        // Intento de Fallback con Short EPG (Xtream Codes)
        const match = channel.url.match(/\/live\/[^\/]+\/[^\/]+\/(\d+)\.(ts|m3u8)/i);
        const streamId = match ? match[1] : null;

        if (streamId && configToUse?.xtreamCodes?.baseUrl && configToUse?.xtreamCodes?.username) {
            setLoadingShort(true);
            EPGService.fetchShortEPG(
                streamId, 
                configToUse.xtreamCodes.baseUrl, 
                configToUse.xtreamCodes.username, 
                configToUse.xtreamCodes.password
            ).then(shorts => {
                if (shorts && shorts.length > 0) {
                    setLocalProgs(shorts);
                }
            }).finally(() => setLoadingShort(false));
        }
    }, [channel, epgData, configToUse]);

    const prog = EPGService.getCurrentProgram(localProgs);
    const progress = EPGService.getProgramProgress(prog);

    if (viewMode === 'grid') {
        return (
            <div
                onClick={() => onSelect(channel)}
                className={`bg-zinc-900/50 border ${isSelected ? 'border-primary' : 'border-zinc-800'} rounded-xl overflow-hidden cursor-pointer channel-card-hover group flex flex-col`}
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
                <div className="p-3 flex-1 flex flex-col">
                    <p className="text-xs font-bold truncate text-zinc-200">{channel.name}</p>
                    {prog ? (
                        <p className="text-[10px] text-primary truncate mt-1 font-bold">● {prog.title}</p>
                    ) : (
                        <p className="text-[10px] text-zinc-500 truncate mt-1">{loadingShort ? 'Cargando guía...' : channel.group}</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div 
            onClick={() => onSelect(channel)}
            className={`bg-zinc-900/50 hover:bg-zinc-900 border ${isSelected ? 'border-primary' : 'border-zinc-800/80'} rounded-xl p-3 flex items-center gap-4 cursor-pointer transition-all group relative overflow-hidden`}
        >
            <div className="w-14 h-14 bg-black/40 rounded-lg flex-shrink-0 flex items-center justify-center p-1 border border-zinc-800">
                {channel.logo ? (
                    <CachedImage src={channel.logo} alt={channel.name} className="max-w-full max-h-full object-contain" />
                ) : (
                    <Tv size={24} className="text-zinc-600" />
                )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h4 className="text-sm font-bold text-white truncate group-hover:text-primary transition-colors">{channel.name}</h4>
                {prog ? (
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{prog.title}</p>
                ) : (
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{loadingShort ? 'Cargando EPG...' : channel.group}</p>
                )}
                {prog && (
                    <div className="w-full h-1 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                )}
            </div>
            <div className="text-zinc-600 group-hover:text-white transition-colors">
                <Play size={18} />
            </div>
        </div>
    );
};

// Componente para manejar el reproductor y los overlays EPG asociados
const ChannelPlayerOverlay = ({ 
    channel, 
    epgData, 
    configToUse, 
    filteredChannels, 
    onClose, 
    onNext, 
    onPrev,
    showChannelList,
    setShowChannelList,
    showEPGGrid,
    setShowEPGGrid,
    setSelectedChannel,
    selectedCategory
}: {
    channel: Channel,
    epgData: EPGData,
    configToUse: any,
    filteredChannels: Channel[],
    onClose: () => void,
    onNext?: () => void,
    onPrev?: () => void,
    showChannelList: boolean,
    setShowChannelList: (b: boolean) => void,
    showEPGGrid: boolean,
    setShowEPGGrid: (b: boolean) => void,
    setSelectedChannel: (c: Channel | null) => void,
    selectedCategory: string
}) => {
    const [fullDayPrograms, setFullDayPrograms] = useState<any[]>([]);
    const [loadingShort, setLoadingShort] = useState(false);

    useEffect(() => {
        const progs = EPGService.getPrograms(channel, epgData);
        if (progs && progs.length > 0) {
            setFullDayPrograms(progs);
            return;
        }

        const match = channel.url.match(/\/live\/[^\/]+\/[^\/]+\/(\d+)\.(ts|m3u8)/i);
        const streamId = match ? match[1] : null;

        if (streamId && configToUse?.xtreamCodes?.baseUrl && configToUse?.xtreamCodes?.username) {
            setLoadingShort(true);
            EPGService.fetchShortEPG(
                streamId, 
                configToUse.xtreamCodes.baseUrl, 
                configToUse.xtreamCodes.username, 
                configToUse.xtreamCodes.password
            ).then(shorts => {
                if (shorts && shorts.length > 0) setFullDayPrograms(shorts);
            }).finally(() => setLoadingShort(false));
        }
    }, [channel, epgData, configToUse]);

    const currentProgram = EPGService.getCurrentProgram(fullDayPrograms);

    const todayPrograms = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);

        return [...fullDayPrograms]
            .filter(prog => {
                return (prog.start >= startOfToday && prog.start <= endOfToday) ||
                       (prog.stop >= startOfToday && prog.stop <= endOfToday) ||
                       (prog.start <= startOfToday && prog.stop >= endOfToday);
            })
            .sort((a, b) => a.start.getTime() - b.start.getTime());
    }, [fullDayPrograms]);

    return (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black flex">
            <VideoPlayer
                url={channel.url}
                title={channel.name}
                subtitle={currentProgram ? `${currentProgram.title}` : undefined}
                type={channel.type}
                onClose={onClose}
                onNext={onNext}
                onPrev={onPrev}
                onToggleChannelList={() => { setShowChannelList(!showChannelList); setShowEPGGrid(false); }}
                onToggleEPG={() => { setShowEPGGrid(!showEPGGrid); setShowChannelList(false); }}
            />

            {/* Bloque En este momento eliminado por limpia visual */}

            {showEPGGrid && (
                <div className="absolute right-4 top-14 bottom-4 w-80 max-w-[30%] bg-black/60 backdrop-blur-xl z-[60] flex flex-col p-4 overflow-hidden border border-white/10 rounded-2xl shadow-2xl animate-fade-in">
                    <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3">
                            {channel.logo && <CachedImage src={channel.logo} className="h-8 w-8 object-contain" />}
                            <div className="min-w-0">
                                <h2 className="text-sm font-black tracking-tight text-white uppercase truncate">{channel.name}</h2>
                                <p className="text-primary font-bold tracking-wider uppercase text-[9px]">Guía EPG</p>
                            </div>
                        </div>
                        <button onClick={() => setShowEPGGrid(false)} className="w-8 h-8 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center border border-white/10 transition-all text-xs">✕</button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-2">
                        {todayPrograms.length > 0 ? (
                            todayPrograms.map((prog, idx) => {
                                const isCurrent = currentProgram && prog.start.getTime() === currentProgram.start.getTime();
                                const isPast = prog.stop < new Date();

                                return (
                                    <div key={idx} className={`group p-2.5 rounded-xl border transition-all flex items-center gap-3 ${isCurrent ? 'bg-primary/20 border-primary/40 shadow-[0_0_15px_rgba(229,9,20,0.05)]' : isPast ? 'bg-zinc-900/10 border-zinc-900/10 opacity-30' : 'bg-zinc-900/30 border-white/5 hover:border-white/10'}`}>
                                        <div className="flex flex-col items-center justify-center min-w-[55px] border-r border-white/5 pr-3">
                                            <span className="text-xs font-black text-white">{prog.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                {isCurrent && <span className="bg-primary px-1 py-0.5 rounded text-[7px] font-black text-white uppercase">Ahora</span>}
                                                <h4 className="text-xs font-bold text-white tracking-tight truncate group-hover:text-primary transition-colors">{prog.title}</h4>
                                            </div>
                                            {prog.description && <p className="text-[9px] text-zinc-500 font-medium truncate">{prog.description}</p>}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full opacity-30 gap-3">
                                <Clock size={40} />
                                <p className="text-xs font-bold italic uppercase tracking-wider text-center">{loadingShort ? 'Cargando...' : 'Sin programación'}</p>
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
                        {filteredChannels.slice(0, 100).map((c, idx) => {
                            const progs = EPGService.getPrograms(c, epgData);
                            const prog = EPGService.getCurrentProgram(progs);
                            const isSelected = channel.url === c.url;
                            return (
                                <button key={idx} onClick={() => { setSelectedChannel(c); setShowEPGGrid(false); }} className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors ${isSelected ? 'bg-primary/20 border border-primary/50' : 'hover:bg-white/10 border border-transparent'}`}>
                                    {c.logo ? (
                                        <div className="w-12 h-12 bg-black/50 rounded flex-shrink-0 flex items-center justify-center p-1"><CachedImage src={c.logo} alt={c.name} className="max-w-full max-h-full object-contain" /></div>
                                    ) : (
                                        <div className="w-12 h-12 bg-black/50 rounded flex-shrink-0 flex items-center justify-center"><Tv size={24} className="text-zinc-500" /></div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-bold truncate ${isSelected ? 'text-primary' : 'text-zinc-200'}`}>{c.name}</p>
                                        {prog && <p className="text-[10px] text-zinc-400 truncate mt-0.5">● {prog.title}</p>}
                                    </div>
                                    {isSelected && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 animate-pulse hidden sm:block"></div>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

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
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
    const [configToUse, setConfigToUse] = useState<any>(IPTV_CONFIG);

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
        const storedConfig = localStorage.getItem('iptv_config');
        if (storedConfig) {
            try {
                setConfigToUse(JSON.parse(storedConfig));
            } catch (e) { }
        }
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

            // --- LÓGICA DE CARGA DE EPG ---
            const currentConfig = configToUse; // Usar el estado actual

            let epgUrlToFetch = currentConfig.epgUrl;

            if (!epgUrlToFetch || epgUrlToFetch === "") {
                if (playlist.epgUrl) {
                    epgUrlToFetch = playlist.epgUrl;
                } else if (currentConfig.xtreamCodes && currentConfig.xtreamCodes.username && currentConfig.xtreamCodes.password && currentConfig.xtreamCodes.baseUrl) {
                    const base = currentConfig.xtreamCodes.baseUrl;
                    if (base && base !== "TU_HOST_AQUI") {
                        const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
                        epgUrlToFetch = `${cleanBase}/xmltv.php?username=${currentConfig.xtreamCodes.username}&password=${currentConfig.xtreamCodes.password}`;
                    }
                }
            }

            if (epgUrlToFetch && epgUrlToFetch !== "") {
                fetchEPG(epgUrlToFetch);
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
            <ChannelPlayerOverlay 
                channel={selectedChannel}
                epgData={epgData}
                configToUse={configToUse}
                filteredChannels={filteredChannels}
                onClose={() => { setSelectedChannel(null); setShowChannelList(false); setShowEPGGrid(false); }}
                onNext={filteredChannels.length > 1 ? handleNext : undefined}
                onPrev={filteredChannels.length > 1 ? handlePrev : undefined}
                showChannelList={showChannelList}
                setShowChannelList={setShowChannelList}
                showEPGGrid={showEPGGrid}
                setShowEPGGrid={setShowEPGGrid}
                setSelectedChannel={setSelectedChannel}
                selectedCategory={selectedCategory}
            />
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
                        <button 
                            onClick={() => setViewMode('grid')} 
                            className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-zinc-900 text-primary' : 'hover:bg-zinc-900 text-zinc-500'}`}
                        ><LayoutGrid size={20} /></button>
                        <button 
                            onClick={() => setViewMode('list')} 
                            className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-zinc-900 text-primary' : 'hover:bg-zinc-900 text-zinc-500'}`}
                        ><List size={20} /></button>
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
                            {viewMode === 'grid' ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                                    {displayChannels.map(channel => (
                                        <ChannelItem 
                                            key={channel.id + channel.url}
                                            channel={channel}
                                            epgData={epgData}
                                            configToUse={configToUse}
                                            viewMode="grid"
                                            onSelect={setSelectedChannel}
                                            isSelected={selectedChannel ? (selectedChannel as any).url === channel.url : false}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {displayChannels.map(channel => (
                                        <ChannelItem 
                                            key={channel.id + channel.url}
                                            channel={channel}
                                            epgData={epgData}
                                            configToUse={configToUse}
                                            viewMode="list"
                                            onSelect={setSelectedChannel}
                                            isSelected={selectedChannel ? (selectedChannel as any).url === channel.url : false}
                                        />
                                    ))}
                                </div>
                            )}
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
