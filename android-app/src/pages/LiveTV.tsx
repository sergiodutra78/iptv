import { useState, useEffect, useMemo, useRef } from 'react';
import { type Channel } from '../services/m3uParser';
import VideoPlayer from '../components/VideoPlayer';
import { Tv, Play, Search, LayoutGrid, List, Clock, Loader2 } from 'lucide-react';
import CachedImage from '../components/CachedImage';
import { getActivePlaylistUrl, IPTV_CONFIG } from '../config/iptv';
import { DataService } from '../services/dataService';
import { EPGService, type EPGData } from '../services/epgService';

const ITEMS_PER_PAGE = 30;

const ChannelItem = ({ channel, epgData, viewMode, onSelect, isSelected, configToUse, epgLoading }: {
    channel: Channel,
    epgData: EPGData,
    viewMode: 'grid' | 'list',
    onSelect: (c: Channel) => void,
    isSelected: boolean,
    configToUse: any,
    epgLoading: boolean,
}) => {
    const [localProgs, setLocalProgs] = useState<any[]>([]);

    useEffect(() => {
        const progs = EPGService.getPrograms(channel, epgData);
        if (progs.length > 0) { setLocalProgs(progs); return; }
        if (epgLoading) return;

        const match = channel.url.match(/\/live\/[^/]+\/[^/]+\/(\d+)\.(ts|m3u8)/i);
        const streamId = match ? match[1] : null;
        const xc = configToUse?.xtreamCodes;

        if (streamId && xc?.baseUrl && xc.username) {
            EPGService.fetchShortEPG(streamId, xc.baseUrl, xc.username, xc.password)
                .then(shorts => { if (shorts.length > 0) setLocalProgs(shorts); })
                .catch(() => {});
        }
    }, [channel, epgData, epgLoading, configToUse]);

    const prog = EPGService.getCurrentProgram(localProgs);
    const progress = EPGService.getProgramProgress(prog);

    if (viewMode === 'grid') {
        return (
            <div
                onClick={() => onSelect(channel)}
                className={`bg-zinc-900/50 border ${isSelected ? 'border-primary' : 'border-zinc-800'} rounded-xl overflow-hidden cursor-pointer group flex flex-col active:scale-95 transition-transform`}
            >
                <div className="aspect-video bg-zinc-800 flex items-center justify-center relative p-3">
                    {channel.logo ? (
                        <CachedImage src={channel.logo} alt={channel.name} className="max-h-full max-w-full object-contain" />
                    ) : (
                        <Tv size={28} className="text-zinc-700" />
                    )}
                    <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/20 transition-all flex items-center justify-center pointer-events-none">
                        <Play className="text-white opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all" fill="currentColor" size={28} />
                    </div>
                </div>
                <div className="p-2 flex-1 flex flex-col">
                    <p className="text-xs font-bold truncate text-zinc-200">{channel.name}</p>
                    {prog ? (
                        <p className="text-[9px] text-primary truncate mt-0.5 font-bold">● {prog.title}</p>
                    ) : (
                        <p className="text-[9px] text-zinc-500 truncate mt-0.5">{channel.group}</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={() => onSelect(channel)}
            className={`bg-zinc-900/50 border ${isSelected ? 'border-primary' : 'border-zinc-800/80'} rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all group active:scale-95`}
        >
            <div className="w-12 h-12 bg-black/40 rounded-lg flex-shrink-0 flex items-center justify-center p-1 border border-zinc-800">
                {channel.logo ? (
                    <CachedImage src={channel.logo} alt={channel.name} className="max-w-full max-h-full object-contain" />
                ) : (
                    <Tv size={20} className="text-zinc-600" />
                )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h4 className="text-sm font-bold text-white truncate">{channel.name}</h4>
                {prog ? (
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{prog.title}</p>
                ) : (
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{channel.group}</p>
                )}
                {prog && (
                    <div className="w-full h-1 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }}></div>
                    </div>
                )}
            </div>
            <Play size={16} className="text-zinc-600 flex-shrink-0" />
        </div>
    );
};

const ChannelPlayerOverlay = ({
    channel, epgData, configToUse, filteredChannels, onClose, onNext, onPrev,
    showChannelList, setShowChannelList, showEPGGrid, setShowEPGGrid, setSelectedChannel, selectedCategory
}: {
    channel: Channel, epgData: EPGData, configToUse: any, filteredChannels: Channel[],
    onClose: () => void, onNext?: () => void, onPrev?: () => void,
    showChannelList: boolean, setShowChannelList: (b: boolean) => void,
    showEPGGrid: boolean, setShowEPGGrid: (b: boolean) => void,
    setSelectedChannel: (c: Channel | null) => void, selectedCategory: string
}) => {
    const [fullDayPrograms, setFullDayPrograms] = useState<any[]>([]);
    const [loadingShort, setLoadingShort] = useState(false);

    useEffect(() => {
        const progs = EPGService.getPrograms(channel, epgData);
        if (progs && progs.length > 0) { setFullDayPrograms(progs); return; }

        const match = channel.url.match(/\/live\/[^\/]+\/[^\/]+\/(\d+)\.(ts|m3u8)/i);
        const streamId = match ? match[1] : null;

        if (streamId && configToUse?.xtreamCodes?.baseUrl && configToUse?.xtreamCodes?.username) {
            setLoadingShort(true);
            EPGService.fetchShortEPG(streamId, configToUse.xtreamCodes.baseUrl, configToUse.xtreamCodes.username, configToUse.xtreamCodes.password)
                .then(shorts => { if (shorts && shorts.length > 0) setFullDayPrograms(shorts); })
                .finally(() => setLoadingShort(false));
        }
    }, [channel, epgData, configToUse]);

    const currentProgram = EPGService.getCurrentProgram(fullDayPrograms);

    const todayPrograms = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);

        return [...fullDayPrograms]
            .filter(prog => (prog.start >= startOfToday && prog.start <= endOfToday) || (prog.stop >= startOfToday && prog.stop <= endOfToday) || (prog.start <= startOfToday && prog.stop >= endOfToday))
            .sort((a, b) => a.start.getTime() - b.start.getTime());
    }, [fullDayPrograms]);

    return (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black flex">
            <VideoPlayer
                url={channel.url}
                title={channel.name}
                subtitle={currentProgram ? currentProgram.title : undefined}
                type={channel.type}
                onClose={onClose}
                onNext={onNext}
                onPrev={onPrev}
                onToggleChannelList={() => { setShowChannelList(!showChannelList); setShowEPGGrid(false); }}
                onToggleEPG={() => { setShowEPGGrid(!showEPGGrid); setShowChannelList(false); }}
            />

            {showEPGGrid && (
                <div className="absolute right-2 top-12 bottom-2 w-72 bg-black/80 backdrop-blur-xl z-[60] flex flex-col p-4 overflow-hidden border border-white/10 rounded-2xl shadow-2xl">
                    <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-3">
                        <div>
                            <h2 className="text-sm font-black tracking-tight text-white uppercase truncate">{channel.name}</h2>
                            <p className="text-primary font-bold tracking-wider uppercase text-[9px]">Guía EPG</p>
                        </div>
                        <button onClick={() => setShowEPGGrid(false)} className="w-7 h-7 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center border border-white/10 text-xs">✕</button>
                    </div>

                    <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
                        {todayPrograms.length > 0 ? (
                            todayPrograms.map((prog, idx) => {
                                const isCurrent = currentProgram && prog.start.getTime() === currentProgram.start.getTime();
                                const isPast = prog.stop < new Date();
                                return (
                                    <div key={idx} className={`p-2 rounded-xl border flex items-center gap-2 ${isCurrent ? 'bg-primary/20 border-primary/40' : isPast ? 'opacity-30 border-zinc-900/10' : 'bg-zinc-900/30 border-white/5'}`}>
                                        <div className="min-w-[48px] border-r border-white/5 pr-2">
                                            <span className="text-xs font-black text-white">{prog.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {isCurrent && <span className="bg-primary px-1 py-0.5 rounded text-[7px] font-black text-white uppercase mr-1">Ahora</span>}
                                            <span className="text-xs font-bold text-white truncate block">{prog.title}</span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full opacity-30 gap-3">
                                <Clock size={36} />
                                <p className="text-xs font-bold italic uppercase text-center">{loadingShort ? 'Cargando...' : 'Sin programación'}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showChannelList && (
                <div className="absolute top-0 left-0 bottom-0 w-72 bg-black/90 backdrop-blur-md border-r border-white/10 z-50 overflow-y-auto flex flex-col pointer-events-auto">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center sticky top-0 bg-black/70 backdrop-blur-md z-10">
                        <h3 className="font-bold text-white">Canales ({selectedCategory})</h3>
                        <button onClick={() => setShowChannelList(false)} className="text-zinc-400 hover:text-white p-1 rounded-full">✕</button>
                    </div>
                    <div className="flex-1 p-3 space-y-1">
                        {filteredChannels.slice(0, 100).map((c, idx) => {
                            const progs = EPGService.getPrograms(c, epgData);
                            const prog = EPGService.getCurrentProgram(progs);
                            const isSelected = channel.url === c.url;
                            return (
                                <button key={idx} onClick={() => { setSelectedChannel(c); setShowEPGGrid(false); }} className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors ${isSelected ? 'bg-primary/20 border border-primary/50' : 'hover:bg-white/10 border border-transparent'}`}>
                                    {c.logo ? (
                                        <div className="w-10 h-10 bg-black/50 rounded flex-shrink-0 flex items-center justify-center p-1">
                                            <CachedImage src={c.logo} alt={c.name} className="max-w-full max-h-full object-contain" />
                                        </div>
                                    ) : (
                                        <div className="w-10 h-10 bg-black/50 rounded flex-shrink-0 flex items-center justify-center">
                                            <Tv size={20} className="text-zinc-500" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-bold truncate ${isSelected ? 'text-primary' : 'text-zinc-200'}`}>{c.name}</p>
                                        {prog && <p className="text-[10px] text-zinc-400 truncate mt-0.5">● {prog.title}</p>}
                                    </div>
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
    const [epgLoading, setEpgLoading] = useState<boolean>(() => EPGService.getCachedEPG() === null);
    const [showChannelList, setShowChannelList] = useState(false);
    const [showEPGGrid, setShowEPGGrid] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
    const [configToUse, setConfigToUse] = useState<any>(IPTV_CONFIG);

    const loaderRef = useRef<HTMLDivElement>(null);

    const filteredChannels = useMemo(() => {
        let result = channels;
        if (selectedCategory !== 'Todos') result = result.filter(c => c.group === selectedCategory);
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(c => {
                if (c.name.toLowerCase().includes(query)) return true;
                const xmltvProgs = EPGService.getPrograms(c, epgData);
                const currentProg = EPGService.getCurrentProgram(xmltvProgs);
                if (currentProg?.title.toLowerCase().includes(query)) return true;
                const streamMatch = c.url.match(/\/live\/[^/]+\/[^/]+\/(\d+)\.(ts|m3u8)/i);
                if (streamMatch) {
                    const shortProgs = EPGService.getShortCachedPrograms(streamMatch[1]);
                    const shortCurrent = EPGService.getCurrentProgram(shortProgs);
                    if (shortCurrent?.title.toLowerCase().includes(query)) return true;
                }
                return false;
            });
        }
        return result;
    }, [selectedCategory, searchQuery, channels, epgData]);

    const displayChannels = useMemo(() => filteredChannels.slice(0, visibleCount), [filteredChannels, visibleCount]);

    useEffect(() => {
        const urlToLoad = getActivePlaylistUrl() || "/uruguay.m3u";
        loadChannels(urlToLoad);
    }, []);

    const loadChannels = async (url: string) => {
        let currentConfig: any = IPTV_CONFIG;
        const storedConfig = localStorage.getItem('iptv_config');
        if (storedConfig) {
            try { currentConfig = JSON.parse(storedConfig); } catch (e) {}
        }
        setConfigToUse(currentConfig);

        if (DataService.hasData()) {
            const liveOnly = DataService.getLiveSync();
            if (liveOnly.length > 0) {
                setChannels(liveOnly);
                setCategories(['Todos', ...Array.from(new Set(liveOnly.map(c => c.group)))]);
                setLoading(false);
            }
        } else {
            setLoading(true);
            try {
                const playlist = await DataService.getChannels(url);
                const liveOnly = playlist.channels.filter(c => c.type === 'live');
                setChannels(liveOnly);
                setCategories(['Todos', ...Array.from(new Set(liveOnly.map(c => c.group)))]);
            } catch (error) {
                console.error("Error loading channels", error);
            } finally {
                setLoading(false);
            }
        }

        const cachedEpg = EPGService.getCachedEPG();
        if (cachedEpg) { setEpgData(cachedEpg); setEpgLoading(false); return; }

        let epgUrl: string = currentConfig.epgUrl || '';
        if (!epgUrl) {
            const xc = currentConfig.xtreamCodes;
            if (xc?.baseUrl && xc.baseUrl !== 'TU_HOST_AQUI' && xc.username) {
                const cleanBase = xc.baseUrl.replace(/\/$/, '');
                epgUrl = `${cleanBase}/xmltv.php?username=${xc.username}&password=${xc.password}`;
            }
        }

        if (epgUrl) {
            setEpgLoading(true);
            EPGService.fetchEPG(epgUrl)
                .then(data => { if (Object.keys(data).length > 0) setEpgData(data); })
                .catch(() => {})
                .finally(() => setEpgLoading(false));
        } else {
            setEpgLoading(false);
        }
    };

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
        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [loading, visibleCount, filteredChannels.length]);

    useEffect(() => { setVisibleCount(ITEMS_PER_PAGE); }, [selectedCategory, searchQuery]);

    if (selectedChannel) {
        const handleNext = () => {
            const index = filteredChannels.findIndex(c => c.url === selectedChannel.url);
            setSelectedChannel(filteredChannels[index < filteredChannels.length - 1 ? index + 1 : 0]);
        };
        const handlePrev = () => {
            const index = filteredChannels.findIndex(c => c.url === selectedChannel.url);
            setSelectedChannel(filteredChannels[index > 0 ? index - 1 : filteredChannels.length - 1]);
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
        <div className="flex flex-col h-full">
            {/* Búsqueda + controles */}
            <div className="p-4 pb-3">
                <div className="flex items-center gap-3 mb-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar canales o programas..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary text-sm"
                        />
                    </div>
                    <div className="flex gap-1 text-zinc-500 items-center text-[10px]">
                        {epgLoading ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                    </div>
                    <div className="flex gap-1">
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-zinc-800 text-primary' : 'text-zinc-500'}`}><LayoutGrid size={18} /></button>
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-zinc-800 text-primary' : 'text-zinc-500'}`}><List size={18} /></button>
                    </div>
                </div>

                {/* Categorías en scroll horizontal */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${selectedCategory === cat ? 'bg-primary text-white' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Cargando canales...</p>
                    </div>
                ) : (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                                {displayChannels.map(channel => (
                                    <ChannelItem
                                        key={channel.id + channel.url}
                                        channel={channel}
                                        epgData={epgData}
                                        viewMode="grid"
                                        onSelect={setSelectedChannel}
                                        isSelected={selectedChannel ? (selectedChannel as any).url === channel.url : false}
                                        configToUse={configToUse}
                                        epgLoading={epgLoading}
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
                                        viewMode="list"
                                        onSelect={setSelectedChannel}
                                        isSelected={selectedChannel ? (selectedChannel as any).url === channel.url : false}
                                        configToUse={configToUse}
                                        epgLoading={epgLoading}
                                    />
                                ))}
                            </div>
                        )}
                        {visibleCount < filteredChannels.length && (
                            <div ref={loaderRef} className="flex justify-center py-10">
                                <Loader2 size={32} className="text-primary animate-spin" />
                            </div>
                        )}

                        {!loading && channels.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <Tv size={64} className="text-zinc-800 mb-4" />
                                <h3 className="text-xl font-bold">No hay canales cargados</h3>
                                <p className="text-zinc-500 mt-2 max-w-xs">Ve a Ajustes para configurar tu lista M3U.</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default LiveTV;
