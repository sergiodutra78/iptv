import { useState, useEffect, useMemo, useRef } from 'react';
import { type Channel } from '../services/m3uParser';
import { getActivePlaylistUrl } from '../config/iptv';
import MovieCard from '../components/MovieCard';
import VideoPlayer from '../components/VideoPlayer';
import { Search, Film, Loader2 } from 'lucide-react';
import { DataService } from '../services/dataService';

const ITEMS_PER_PAGE = 40;

const shuffleArray = <T,>(array: T[]): T[] => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
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
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

    const loaderRef = useRef<HTMLDivElement>(null);

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

    if (selectedMovie) {
        return (
            <div className="fixed inset-0 z-50 bg-black">
                <VideoPlayer
                    url={selectedMovie.url}
                    title={selectedMovie.name}
                    type={selectedMovie.type}
                    onClose={() => setSelectedMovie(null)}
                />
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
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 size={48} className="text-primary animate-spin" />
                    <p className="text-zinc-500 font-medium">Cargando biblioteca de películas...</p>
                </div>
            ) : displayMovies.length > 0 ? (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-6">
                        {displayMovies.map(movie => (
                            <MovieCard
                                key={movie.id + movie.url}
                                movie={movie}
                                onClick={(m) => setSelectedMovie(m)}
                            />
                        ))}
                    </div>

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

