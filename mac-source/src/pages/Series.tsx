import { useState, useEffect, useMemo, useRef } from 'react';
import { type Channel } from '../services/m3uParser';
import { type GroupedSeries, DataService } from '../services/dataService';
import { WatchedService } from '../services/WatchedService';
import { getActivePlaylistUrl } from '../config/iptv';
import MovieCard from '../components/MovieCard';
import VideoPlayer from '../components/VideoPlayer';
import { Search, PlayCircle, Loader2, LayoutGrid, List, ChevronLeft, CheckCircle2 } from 'lucide-react';

const ITEMS_PER_PAGE = 40;

const Series = () => {
    const [series, setSeries] = useState<GroupedSeries[]>(() => DataService.getGroupedSeriesSync());
    const [categories, setCategories] = useState<string[]>(() => {
        const all = DataService.getGroupedSeriesSync();
        return ['Todos', ...Array.from(new Set(all.map(s => s.group)))];
    });
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [loading, setLoading] = useState(!DataService.hasData());
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSeries, setSelectedSeries] = useState<GroupedSeries | null>(null);
    const [selectedEpisode, setSelectedEpisode] = useState<Channel | null>(null);
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [, setUpdateTrigger] = useState(0); // To force re-render when watched status changes

    const loaderRef = useRef<HTMLDivElement>(null);

    const filteredSeries = useMemo(() => {
        let result = series;
        if (selectedCategory !== 'Todos') {
            result = result.filter(s => s.group === selectedCategory);
        }
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(s => s.name.toLowerCase().includes(query));
        }
        return result;
    }, [series, selectedCategory, searchQuery]);

    const displaySeries = useMemo(() => {
        return filteredSeries.slice(0, visibleCount);
    }, [filteredSeries, visibleCount]);

    useEffect(() => {
        const loadContent = async () => {
            if (DataService.hasData() && series.length > 0) {
                setLoading(false);
                if (categories.length <= 1) {
                    const all = DataService.getGroupedSeriesSync();
                    setCategories(['Todos', ...Array.from(new Set(all.map(s => s.group)))]);
                }
                return;
            }

            const url = getActivePlaylistUrl() || "/uruguay.m3u";
            try {
                await DataService.getChannels(url);
                const allGrouped = DataService.getGroupedSeriesSync();
                setSeries(allGrouped);
                setCategories(['Todos', ...Array.from(new Set(allGrouped.map(s => s.group)))]);
            } catch (error) {
                console.error("Error loading series", error);
            } finally {
                setLoading(false);
            }
        };
        loadContent();
    }, []);

    // Observer for infinite scroll
    useEffect(() => {
        if (loading || selectedSeries) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && visibleCount < filteredSeries.length) {
                    setVisibleCount(prev => prev + ITEMS_PER_PAGE);
                }
            },
            { threshold: 0.1 }
        );

        if (loaderRef.current) {
            observer.observe(loaderRef.current);
        }

        return () => observer.disconnect();
    }, [loading, visibleCount, filteredSeries.length, selectedSeries]);

    // Reset visible count when category or search changes
    useEffect(() => {
        setVisibleCount(ITEMS_PER_PAGE);
    }, [selectedCategory, searchQuery]);

    const handlePlayEpisode = (episode: Channel) => {
        WatchedService.markAsWatched(episode.url);
        setSelectedEpisode(episode);
        setUpdateTrigger(prev => prev + 1);
    };

    if (selectedEpisode) {
        return (
            <div className="fixed inset-0 z-50 bg-black">
                <VideoPlayer
                    url={selectedEpisode.url}
                    title={selectedEpisode.name}
                    type={selectedEpisode.type}
                    onClose={() => setSelectedEpisode(null)}
                />
            </div>
        );
    }

    if (selectedSeries) {
        return (
            <div className="flex flex-col h-[calc(100vh-5rem)] bg-zinc-950 overflow-hidden">
                {/* Header Series Detail */}
                <div className="relative h-64 sm:h-80 w-full overflow-hidden flex-shrink-0">
                    <img src={selectedSeries.logo} alt={selectedSeries.name} className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-30" />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />

                    <div className="relative h-full flex items-end p-8 gap-8 max-w-7xl mx-auto w-full">
                        <div className="flex-shrink-0 w-32 h-48 sm:w-40 sm:h-60 rounded-xl overflow-hidden shadow-2xl border border-zinc-800">
                            <img src={selectedSeries.logo} alt={selectedSeries.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 pb-4">
                            <button
                                onClick={() => setSelectedSeries(null)}
                                className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4 transition-colors group"
                            >
                                <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                                <span className="text-sm font-bold uppercase tracking-wider">Volver a Series</span>
                            </button>
                            <h1 className="text-4xl sm:text-6xl font-black italic tracking-tighter mb-2 uppercase">{selectedSeries.name}</h1>
                            <div className="flex items-center gap-3">
                                <span className="px-3 py-1 bg-primary/20 text-primary text-xs font-bold rounded-full border border-primary/20 uppercase tracking-widest">{selectedSeries.group}</span>
                                <span className="text-zinc-500 text-sm font-medium">{selectedSeries.episodes.length} Episodios</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Episode List */}
                <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
                    <div className="max-w-7xl mx-auto">
                        <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-6 px-2">Capítulos Disponibles</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {selectedSeries.episodes.map((ep, index) => {
                                const watched = WatchedService.isWatched(ep.url);
                                return (
                                    <div
                                        key={ep.url + index}
                                        onClick={() => handlePlayEpisode(ep)}
                                        className="flex items-center gap-4 p-4 bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800/50 hover:border-primary/50 rounded-xl cursor-pointer transition-all group"
                                    >
                                        <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 group-hover:bg-primary transition-colors overflow-hidden relative">
                                            {watched ? (
                                                <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                                                    <CheckCircle2 size={24} className="text-green-500" />
                                                </div>
                                            ) : (
                                                <PlayCircle size={24} className="text-zinc-500 group-hover:text-white" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className={`font-bold truncate ${watched ? 'text-zinc-400 font-medium' : 'text-white'}`}>
                                                {ep.name}
                                            </h3>
                                            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">Click para reproducir</p>
                                        </div>
                                        {watched && (
                                            <span className="text-[10px] px-2 py-0.5 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full font-bold uppercase">Visto</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
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

            <div className="flex-1 flex flex-col bg-background">
                <div className="p-8 pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                        <div>
                            <h1 className="text-4xl font-black italic tracking-tighter mb-2 uppercase">SERIES</h1>
                            <p className="text-zinc-500 text-sm">Biblioteca de series organizada por temporadas.</p>
                        </div>
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar series..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary transition-all text-sm"
                            />
                        </div>
                        <div className="flex gap-2 bg-zinc-900 p-1 rounded-lg">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-primary text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
                            >
                                <LayoutGrid size={20} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-primary text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
                            >
                                <List size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-8 pb-8 scrollbar-hide">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4">
                            <Loader2 size={48} className="text-primary animate-spin" />
                            <p className="text-zinc-500 font-medium">Cargando biblioteca de series...</p>
                        </div>
                    ) : displaySeries.length > 0 ? (
                        <>
                            {viewMode === 'grid' ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-6">
                                    {displaySeries.map(item => (
                                        <MovieCard
                                            key={item.id}
                                            movie={item}
                                            onClick={() => setSelectedSeries(item)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {displaySeries.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => setSelectedSeries(item)}
                                            className="flex items-center gap-4 p-4 bg-zinc-900/40 hover:bg-zinc-800/80 border border-zinc-800/50 hover:border-primary/50 rounded-xl cursor-pointer transition-all group"
                                        >
                                            {item.logo ? (
                                                <div className="w-16 h-24 sm:w-20 sm:h-28 flex-shrink-0 bg-black rounded-lg overflow-hidden relative">
                                                    <img src={item.logo} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x300?text=No+Image' }} />
                                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                                                </div>
                                            ) : (
                                                <div className="w-16 h-24 sm:w-20 sm:h-28 flex-shrink-0 bg-zinc-800 rounded-lg flex items-center justify-center">
                                                    <PlayCircle size={32} className="text-zinc-600" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-primary transition-colors truncate">{item.name}</h3>
                                                    <span className="text-[10px] px-2 py-0.5 bg-zinc-800 text-zinc-500 rounded font-bold uppercase">{item.episodes.length} EP</span>
                                                </div>
                                                <p className="text-sm text-zinc-400 capitalize mb-2">{item.group}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] sm:text-xs font-bold px-2 py-1 bg-zinc-800 text-zinc-300 rounded uppercase tracking-wider">Series</span>
                                                </div>
                                            </div>
                                            <div className="hidden sm:flex items-center justify-center w-12 h-12 bg-white/5 group-hover:bg-primary rounded-full transition-colors mr-2">
                                                <PlayCircle size={24} className="text-zinc-400 group-hover:text-white transition-colors" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Loader reference for infinite scroll */}
                            {visibleCount < filteredSeries.length && (
                                <div ref={loaderRef} className="flex justify-center py-10">
                                    <Loader2 size={32} className="text-primary animate-spin" />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <PlayCircle size={64} className="text-zinc-800 mb-4" />
                            <h3 className="text-xl font-bold">No se encontraron series</h3>
                            <p className="text-zinc-500 mt-2">Prueba con otra búsqueda o categoría.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Series;

