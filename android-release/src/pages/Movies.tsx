import { useState, useEffect, useMemo, useRef } from 'react';
import { type Channel } from '../services/m3uParser';
import { getActivePlaylistUrl } from '../config/iptv';
import MovieCard from '../components/MovieCard';
import VideoPlayer from '../components/VideoPlayer';
import { Search, Film, Loader2, PlayCircle, ChevronLeft, Star, LayoutGrid, List, RotateCcw } from 'lucide-react';
import { DataService } from '../services/dataService';
import { MetadataService, type MediaMetadata } from '../services/metadataService';
import { WatchProgressService } from '../services/WatchProgressService';

const formatProgressTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const ITEMS_PER_PAGE = 40;

const IMG_FALLBACK = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='200'%20height='300'%3E%3Crect%20width='200'%20height='300'%20fill='%2318181b'/%3E%3Ctext%20x='100'%20y='150'%20font-family='sans-serif'%20font-size='14'%20fill='%2371717a'%20text-anchor='middle'%3ESin%20imagen%3C/text%3E%3C/svg%3E";

const shuffleArray = <T,>(array: T[]): T[] => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
};

const MovieListItem = ({ item, onClick }: { item: any, onClick: () => void }) => {
    const [metadata, setMetadata] = useState<MediaMetadata | null>(null);

    useEffect(() => {
        let isMounted = true;
        MetadataService.getMovieMetadata(item.name, item).then(data => {
            if (isMounted) setMetadata(data);
        });
        return () => { isMounted = false; };
    }, [item.name, item.url]);

    return (
        <div
            onClick={onClick}
            className="flex items-center gap-4 p-4 bg-zinc-900/40 hover:bg-zinc-800/80 border border-zinc-800/50 hover:border-primary/50 rounded-xl cursor-pointer transition-all group"
        >
            {(metadata?.posterUrl || item.logo) ? (
                <div className="w-16 h-24 flex-shrink-0 bg-black rounded-lg overflow-hidden relative shadow-lg">
                    <img src={metadata?.posterUrl || item.logo!} alt={item.name} className="w-full h-full object-cover" onError={(e) => { const t = e.target as HTMLImageElement; if (t.src !== IMG_FALLBACK) t.src = IMG_FALLBACK; }} />
                </div>
            ) : (
                <div className="w-16 h-24 flex-shrink-0 bg-zinc-800 rounded-lg flex items-center justify-center">
                    <PlayCircle size={32} className="text-zinc-600" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white group-hover:text-primary transition-colors truncate">{item.name}</h3>
                <p className="text-[11px] text-zinc-400 capitalize mb-1">{item.group}</p>
                <div className="flex items-center gap-2">
                    {metadata?.rating && (
                        <div className="flex items-center gap-0.5 text-xs font-black text-yellow-500">
                            <Star size={11} fill="currentColor" />
                            <span>{metadata.rating.toFixed(1)}</span>
                        </div>
                    )}
                    {metadata?.year && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 bg-zinc-800/80 text-zinc-400 rounded-md border border-zinc-700">{metadata.year}</span>
                    )}
                </div>
            </div>
            <PlayCircle size={20} className="text-zinc-600 group-hover:text-primary transition-colors flex-shrink-0" />
        </div>
    );
};

const Movies = () => {
    const [movies, setMovies] = useState<Channel[]>(() => {
        const allMovies = DataService.getMoviesSync();
        const priorityCategories = ['ultimos titulos', 'ultimos titulo', 'estrenos', 'recien agregadas', 'peliculas 2024', 'peliculas 2025'];
        const priority = allMovies.filter(m => priorityCategories.some(cat => m.group.toLowerCase().includes(cat)));
        const other = allMovies.filter(m => !priorityCategories.some(cat => m.group.toLowerCase().includes(cat)));
        return [...shuffleArray(priority), ...other.reverse()];
    });
    const [loading, setLoading] = useState(!DataService.hasData());
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMovie, setSelectedMovie] = useState<Channel | null>(null);
    const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
        return (localStorage.getItem('moviesView') as 'grid' | 'list') || 'grid';
    });
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
    const loaderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        localStorage.setItem('moviesView', viewMode);
    }, [viewMode]);

    useEffect(() => {
        if (!selectedMovie) { setMetadata(null); setIsPlaying(false); return; }
        let isMounted = true;
        MetadataService.getMovieMetadata(selectedMovie.name, selectedMovie).then(data => {
            if (isMounted && data) setMetadata(data);
        });
        return () => { isMounted = false; };
    }, [selectedMovie]);

    const filteredMovies = useMemo(() => {
        return movies.filter(m =>
            m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.group.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [movies, searchQuery]);

    const displayMovies = useMemo(() => filteredMovies.slice(0, visibleCount), [filteredMovies, visibleCount]);

    useEffect(() => {
        const loadContent = async () => {
            if (DataService.hasData() && movies.length > 0) { setLoading(false); return; }
            const url = getActivePlaylistUrl() || "/uruguay.m3u";
            try {
                const playlist = await DataService.getChannels(url);
                const allMovies = playlist.channels.filter(c => c.type === 'movie');
                const priorityCategories = ['ultimos titulos', 'ultimos titulo', 'estrenos', 'recien agregadas', 'peliculas 2024', 'peliculas 2025'];
                const priority = allMovies.filter(m => priorityCategories.some(cat => m.group.toLowerCase().includes(cat)));
                const other = allMovies.filter(m => !priorityCategories.some(cat => m.group.toLowerCase().includes(cat)));
                setMovies([...shuffleArray(priority), ...other.reverse()]);
            } catch (error) {
                console.error("Error loading movies", error);
            } finally {
                setLoading(false);
            }
        };
        loadContent();
    }, []);

    useEffect(() => {
        if (loading) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && visibleCount < filteredMovies.length) {
                    setVisibleCount(prev => prev + ITEMS_PER_PAGE);
                }
            },
            { threshold: 0.1 }
        );
        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [loading, visibleCount, filteredMovies.length]);

    useEffect(() => { setVisibleCount(ITEMS_PER_PAGE); }, [searchQuery]);

    if (isPlaying && selectedMovie) {
        return (
            <div className="fixed inset-0 z-50 bg-black">
                <VideoPlayer
                    url={selectedMovie.url}
                    title={selectedMovie.name}
                    type={selectedMovie.type}
                    onClose={() => setIsPlaying(false)}
                />
            </div>
        );
    }

    if (selectedMovie) {
        return (
            <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
                <div className="relative h-64 sm:h-96 w-full flex-shrink-0">
                    <div className="absolute inset-0">
                        <img src={metadata?.backdropUrl || selectedMovie.logo} alt={selectedMovie.name} className="absolute inset-0 w-full h-full object-cover blur-md opacity-30 scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
                    </div>

                    <div className="relative h-full flex items-end p-6 gap-6 max-w-7xl mx-auto w-full">
                        <div className="hidden sm:block flex-shrink-0 w-36 h-52 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800/50">
                            <img src={metadata?.posterUrl || selectedMovie.logo} alt={selectedMovie.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 pb-4 flex flex-col justify-end">
                            <button
                                onClick={() => setSelectedMovie(null)}
                                className="flex items-center gap-2 text-zinc-400 hover:text-white mb-3 transition-colors group w-fit"
                            >
                                <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                                <span className="text-sm font-bold uppercase tracking-wider">Volver</span>
                            </button>

                            <h1 className="text-2xl sm:text-4xl font-black italic tracking-tighter mb-2 uppercase leading-none text-white">{selectedMovie.name}</h1>

                            <div className="flex items-center flex-wrap gap-2 text-xs font-bold text-zinc-300 mt-2">
                                {metadata?.rating && (
                                    <div className="flex items-center gap-1 text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">
                                        <Star size={12} fill="currentColor" />
                                        <span>{metadata.rating.toFixed(1)}</span>
                                    </div>
                                )}
                                {metadata?.year && <span className="bg-white/10 px-2 py-1 rounded">{metadata.year}</span>}
                                <span className="bg-primary/20 text-primary px-2 py-1 rounded uppercase tracking-wider">Película</span>
                            </div>

                            {metadata?.genres && metadata.genres.length > 0 && (
                                <div className="flex items-center flex-wrap gap-1 mt-3">
                                    {metadata.genres.map((g: string) => (
                                        <span key={g} className="text-[10px] font-semibold px-2 py-0.5 bg-zinc-800/80 text-zinc-400 rounded-full border border-zinc-700/50">{g}</span>
                                    ))}
                                </div>
                            )}

                            <div className="mt-5 flex items-center gap-3 flex-wrap">
                                {(() => {
                                    const saved = selectedMovie ? WatchProgressService.get(selectedMovie.url) : null;
                                    if (saved && saved.position > 30) {
                                        return (
                                            <>
                                                <button
                                                    onClick={() => setIsPlaying(true)}
                                                    className="flex items-center gap-3 bg-primary hover:bg-primary/90 text-white font-black py-3 px-6 rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                                                >
                                                    <PlayCircle size={22} fill="white" />
                                                    <span>CONTINUAR · {formatProgressTime(saved.position)}</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (selectedMovie) WatchProgressService.clear(selectedMovie.url);
                                                        setIsPlaying(true);
                                                    }}
                                                    className="flex items-center gap-2 text-zinc-400 hover:text-white font-bold py-3 px-4 rounded-full border border-zinc-700 hover:border-zinc-500 transition-all text-sm"
                                                >
                                                    <RotateCcw size={16} />
                                                    <span>Desde el inicio</span>
                                                </button>
                                            </>
                                        );
                                    }
                                    return (
                                        <button
                                            onClick={() => setIsPlaying(true)}
                                            className="flex items-center gap-3 bg-primary hover:bg-primary/90 text-white font-black py-3 px-6 rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                                        >
                                            <PlayCircle size={22} fill="white" />
                                            <span>REPRODUCIR</span>
                                        </button>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 max-w-7xl mx-auto w-full">
                    <div className="bg-zinc-900/40 border border-zinc-800/20 p-5 rounded-2xl">
                        <h3 className="text-lg font-black italic mb-3 text-white tracking-tight">SINOPSIS</h3>
                        <p className="text-zinc-400 text-sm leading-relaxed max-w-3xl">
                            {metadata?.description || "Sin descripción disponible."}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black italic tracking-tighter mb-1">PELÍCULAS</h1>
                    <p className="text-zinc-500 text-sm">Catálogo de cine a la carta.</p>
                </div>
                <div className="flex gap-3 items-center w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar películas..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-full pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary transition-all text-sm"
                        />
                    </div>
                    <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-zinc-500 hover:text-white'}`}
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'text-zinc-500 hover:text-white'}`}
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 size={48} className="text-primary animate-spin" />
                    <p className="text-zinc-500 font-medium">Cargando biblioteca de películas...</p>
                </div>
            ) : displayMovies.length > 0 ? (
                <>
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                            {displayMovies.map(movie => (
                                <MovieCard key={movie.id + movie.url} movie={movie} onClick={(m) => setSelectedMovie(m)} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {displayMovies.map(movie => (
                                <MovieListItem key={movie.id + movie.url} item={movie} onClick={() => setSelectedMovie(movie)} />
                            ))}
                        </div>
                    )}
                    {visibleCount < filteredMovies.length && (
                        <div ref={loaderRef} className="flex justify-center py-10">
                            <Loader2 size={32} className="text-primary animate-spin" />
                        </div>
                    )}
                </>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Film size={64} className="text-zinc-800 mb-4" />
                    <h3 className="text-xl font-bold">No se encontraron películas</h3>
                    <p className="text-zinc-500 mt-2">Prueba con otra búsqueda.</p>
                </div>
            )}
        </div>
    );
};

export default Movies;
