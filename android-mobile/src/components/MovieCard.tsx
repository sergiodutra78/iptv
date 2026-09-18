import { useState, useEffect, useRef } from 'react';
import { Play, Heart, Star } from 'lucide-react';
import CachedImage from './CachedImage';
import { type Channel } from '../services/m3uParser';
import { MetadataService, type MediaMetadata } from '../services/metadataService';
import { FavoritesService } from '../services/FavoritesService';
import { WatchProgressService } from '../services/WatchProgressService';

interface MovieCardProps {
    movie: Channel;
    onClick: (movie: Channel) => void;
}

const MovieCard = ({ movie, onClick }: MovieCardProps) => {
    const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
    const [isInView, setIsInView] = useState(false);
    const [isFav, setIsFav] = useState(() => FavoritesService.isFavorite(movie.url));
    const [watchProgress] = useState(() => WatchProgressService.getProgress(movie.url));
    const cardRef = useRef<HTMLDivElement>(null);

    const toggleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsFav(FavoritesService.toggle(movie));
    };

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '100px' }
        );

        if (cardRef.current) observer.observe(cardRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isInView) return;

        let isMounted = true;

        const fetchMeta = async () => {
            let data = null;
            if (movie.type === 'series') {
                data = await MetadataService.getSeriesMetadata(movie.name);
            } else if (movie.type === 'movie') {
                data = await MetadataService.getMovieMetadata(movie.name, movie);
            }
            if (isMounted && data) setMetadata(data);
        };

        fetchMeta();
        return () => { isMounted = false; };
    }, [movie.name, movie.type, isInView]);

    return (
        <div
            ref={cardRef}
            className="movie-card group relative cursor-pointer flex flex-col"
            onClick={() => onClick(movie)}
        >
            <div className="aspect-[2/3] bg-zinc-900 rounded-md overflow-hidden border border-zinc-800 transition-all group-hover:border-primary/50">
                {(metadata?.posterUrl || movie.logo) && isInView ? (
                    <div className="absolute inset-0 flex items-center justify-center p-2">
                        <div
                            className="absolute inset-0 opacity-20 blur-xl scale-110"
                            style={{
                                backgroundImage: `url(${metadata?.posterUrl || movie.logo})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                            }}
                        />
                        <CachedImage
                            src={metadata?.posterUrl || movie.logo!}
                            alt={movie.name}
                            className="w-full h-full object-contain relative z-10 group-hover:scale-110 transition-transform duration-500"
                        />
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                        <Play size={40} className="text-zinc-700 mb-2 group-hover:text-primary transition-colors" />
                        <span className="text-xs text-zinc-500 font-medium line-clamp-2">{movie.name}</span>
                    </div>
                )}

                {/* Botón de favorito */}
                <button
                    onClick={toggleFavorite}
                    title={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                    className={`absolute top-2 right-2 z-20 p-2 rounded-full backdrop-blur-md border transition-all ${isFav ? 'bg-primary/90 border-primary text-white' : 'bg-black/40 border-white/10 text-white/80 opacity-0 group-hover:opacity-100 hover:bg-black/60'}`}
                >
                    <Heart size={14} fill={isFav ? 'currentColor' : 'none'} />
                </button>

                {/* Barra de progreso (estilo Netflix) */}
                {watchProgress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700/60 z-30">
                        <div className="h-full bg-primary rounded-r-full" style={{ width: `${watchProgress * 100}%` }} />
                    </div>
                )}

                {/* Overlay con titulo y botones */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-100 group-hover:via-black/40 group-hover:from-black transition-all flex flex-col justify-end p-3">
                    <h4 className="text-[11px] font-black text-white mb-2 leading-tight drop-shadow-lg">
                        {movie.name}
                    </h4>

                    <div className="flex gap-1.5 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                        <button className="flex-1 bg-white text-black py-1.5 rounded text-[10px] font-black flex items-center justify-center gap-1 hover:bg-zinc-200 transition-colors">
                            <Play size={10} fill="black" /> Ver
                        </button>
                        <button
                            onClick={toggleFavorite}
                            className={`p-1.5 rounded transition-colors ${isFav ? 'bg-primary text-white' : 'bg-zinc-800/80 text-white hover:bg-zinc-700'}`}
                        >
                            <Heart size={10} fill={isFav ? 'currentColor' : 'none'} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Metadata (Rating/Year) */}
            <div className="mt-1.5 px-0.5">
                <div className="flex items-center gap-2 min-h-[14px]">
                    {metadata?.rating ? (
                        <div className="flex items-center gap-0.5 text-[9px] font-black text-yellow-500 uppercase tracking-tighter">
                            <Star size={9} fill="currentColor" />
                            <span>{metadata.rating.toFixed(1)}</span>
                        </div>
                    ) : (
                        <div className="h-[14px]"></div>
                    )}
                    {metadata?.year && (
                        <span className="text-[9px] font-black text-zinc-500 border border-zinc-800 rounded px-1 lowercase">
                            {metadata.year}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MovieCard;
