import { useState, useEffect, useMemo, useRef } from 'react';
import { type Channel } from '../services/m3uParser';
import { getActivePlaylistUrl } from '../config/iptv';
import MovieCard from '../components/MovieCard';
import VideoPlayer from '../components/VideoPlayer';
import { Search, Film, Loader2, PlayCircle, ChevronLeft, Star, LayoutGrid, List } from 'lucide-react';
import { DataService } from '../services/dataService';
import { MetadataService, type MediaMetadata } from '../services/metadataService';

const ITEMS_PER_PAGE = 40;

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
                <div className="w-16 h-24 sm:w-20 sm:h-28 flex-shrink-0 bg-black rounded-lg overflow-hidden relative shadow-lg">
                    <img src={metadata?.posterUrl || item.logo!} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x300?text=No+Image' }} />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                </div>
            ) : (
                <div className="w-16 h-24 sm:w-20 sm:h-28 flex-shrink-0 bg-zinc-800 rounded-lg flex items-center justify-center">
                    <PlayCircle size={32} className="text-zinc-600" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-primary transition-colors truncate">{item.name}</h3>
                </div>
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
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-zinc-800/50 text-zinc-300 rounded uppercase tracking-wider">Película</span>
                </div>
            </div>
            <div className="hidden sm:flex items-center justify-center w-10 h-10 bg-white/5 group-hover:bg-primary rounded-full transition-colors mr-2 flex-shrink-0">
                <PlayCircle size={20} className="text-zinc-400 group-hover:text-white transition-colors" />
            </div>
        </div>
    );
};

const Movies = () => {
    const [movies, setMovies] = useState<Channel[]>(() => {
        const allMovies = DataService.getMoviesSync();
        const priorityCategories = ['ultimos titulos', 'ultimos titulo', 'estrenos', 'recien agregadas', 'peliculas 2024', 'peliculas 2025'];
        const priority = allMovies.filter(m =>
            priorityCategories.some(cat => m.group.toLowerCase().includes(cat))
        );
        const other = allMovies.filter(m =>
            !priorityCategories.some(cat => m.group.toLowerCase().includes(cat))
        );
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

    useEffect(() => {
        localStorage.setItem('moviesView', viewMode);
    }, [viewMode]);

    const loaderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!selectedMovie) {
            setMetadata(null);
            setIsPlaying(false);
            return;
        }

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

    const displayMovies = useMemo(() => {
        return filteredMovies.slice(0, visibleCount);
    }, [filteredMovies, visibleCount]);

    useEffect(() => {
        const loadContent = async () => {
            if (DataService.hasData() && movies.length > 0) {
                setLoading(false);
                return;
            }

            const url = getActivePlaylistUrl() || "/uruguay.m3u";
            try {
                const playlist = await DataService.getChannels(url);
                const allMovies = playlist.channels.filter(c => c.type === 'movie');

                const priorityCategories = ['ultimos titulos', 'ultimos titulo', 'estrenos', 'recien agregadas', 'peliculas 2024', 'peliculas 2025'];
                const priority = allMovies.filter(m =>
                    priorityCategories.some(cat => m.group.toLowerCase().includes(cat))
                );
                const other = allMovies.filter(m =>
                    !priorityCategories.some(cat => m.group.toLowerCase().includes(cat))
                );

                setMovies([...shuffleArray(priority), ...other.reverse()]);
            } catch (error) {
                console.error("Error loading movies", error);
            } finally {
                setLoading(false);
            }
        };
        loadContent();
    }, []);

    // Observer for infinite scroll
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

        if (loaderRef.current) {
            observer.observe(loaderRef.current);
        }

        return () => observer.disconnect();
    }, [loading, visibleCount, filteredMovies.length]);

    // Reset visible count when search changes
    useEffect(() => {
        setVisibleCount(ITEMS_PER_PAGE);
    }, [searchQuery]);

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
            <div className="flex flex-col h-[calc(100vh-5rem)] bg-zinc-950 overflow-y-auto custom-scrollbar">
                {/* Header Movie Detail */}
                <div className="relative h-72 sm:h-96 w-full flex-shrink-0">
                    <div className="absolute inset-0">
                        <img src={metadata?.backdropUrl || selectedMovie.logo} alt={selectedMovie.name} className="absolute inset-0 w-full h-full object-cover blur-md opacity-30 scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
                    </div>

                    <div className="relative h-full flex items-end p-8 gap-8 max-w-7xl mx-auto w-full">
                        <div className="hidden sm:block flex-shrink-0 w-44 h-64 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800/50 relative group">
                            <img src={metadata?.posterUrl || selectedMovie.logo} alt={selectedMovie.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        </div>
                        <div className="flex-1 pb-4 flex flex-col justify-end">
                            <button
                                onClick={() => setSelectedMovie(null)}
                                className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4 transition-colors group w-fit"
                            >
                                <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                                <span className="text-sm font-bold uppercase tracking-wider">Volver</span>
                            </button>
                            
                            <h1 className="text-3xl sm:text-5xl font-black italic tracking-tighter mb-2 uppercase leading-none text-white">{selectedMovie.name}</h1>
                            
                            {/* Metadata Row */}
                            <div className="flex items-center flex-wrap gap-2 text-xs font-bold text-zinc-300 mt-2">
                                {metadata?.rating && (
                                    <div className="flex items-center gap-1 text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">
                                        <Star size={12} fill="currentColor" />
                                        <span>{metadata.rating.toFixed(1)}</span>
                                    </div>
                                )}
                                {metadata?.year && (
                                    <span className="bg-white/10 px-2 py-1 rounded">{metadata.year}</span>
                                )}
                                <span className="bg-primary/20 text-primary px-2 py-1 rounded uppercase tracking-wider">Película</span>
                            </div>

                            {/* Genres */}
                            {metadata?.genres && metadata.genres.length > 0 && (
                                <div className="flex items-center flex-wrap gap-1 mt-3">
                                    {metadata.genres.map((g: string) => (
                                        <span key={g} className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 bg-zinc-800/80 text-zinc-400 rounded-full border border-zinc-700/50">{g}</span>
                                    ))}
                                </div>
                            )}

                            {/* Play Button */}
                            <div className="mt-6">
                                <button 
                                    onClick={() => setIsPlaying(true)}
                                    className="flex items-center gap-3 bg-primary hover:bg-primary/90 text-white font-black py-3 px-8 rounded-full shadow-lg shadow-primary/20 hover:scale-105 transition-transform duration-200"
                                >
                                    <PlayCircle size={24} fill="white" />
                                    <span>REPRODUCIR</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info and Description */}
                <div className="p-8 max-w-7xl mx-auto w-full">
                    <div className="bg-zinc-900/40 border border-zinc-800/20 p-6 rounded-2xl">
                        <h3 className="text-xl font-black italic mb-4 text-white tracking-tight">SINOPSIS</h3>
                        <p className="text-zinc-400 text-sm leading-relaxed max-w-3xl">
                            {metadata?.description || "Sin descripción disponible."}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-4xl font-black italic tracking-tighter mb-2">PELÍCULAS</h1>
                    <p className="text-zinc-500">Explora nuestro catálogo de cine a la carta.</p>
                </div>
                <div className="flex gap-4 items-center w-full md:w-auto">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar películas..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-full pl-12 pr-4 py-3 focus:outline-none focus:border-primary transition-all"
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

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 size={48} className="text-primary animate-spin" />
                    <p className="text-zinc-500 font-medium">Cargando biblioteca de películas...</p>
                </div>
            ) : displayMovies.length > 0 ? (
                <>
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-6">
                            {displayMovies.map(movie => (
                                <MovieCard
                                    key={movie.id + movie.url}
                                    movie={movie}
                                    onClick={(m) => setSelectedMovie(m)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {displayMovies.map(movie => (
                                <MovieListItem
                                    key={movie.id + movie.url}
                                    item={movie}
                                    onClick={() => setSelectedMovie(movie)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Loader reference for infinite scroll */}
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
                    <p className="text-zinc-500 mt-2">Prueba con otra búsqueda o revisa tu lista de canales.</p>
                </div>
            )}
        </div>
    );
};

export default Movies;

