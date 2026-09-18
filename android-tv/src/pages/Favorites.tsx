import { useState } from 'react';
import { Heart } from 'lucide-react';
import { type Channel } from '../services/m3uParser';
import { FavoritesService } from '../services/FavoritesService';
import MovieCard from '../components/MovieCard';
import VideoPlayer from '../components/VideoPlayer';

const Favorites = () => {
    const [favorites, setFavorites] = useState<Channel[]>(() => FavoritesService.getAll());
    const [selected, setSelected] = useState<Channel | null>(null);

    const refresh = () => setFavorites([...FavoritesService.getAll()]);

    if (selected) {
        return (
            <div className="fixed inset-0 z-50 bg-black">
                <VideoPlayer
                    url={selected.url}
                    title={selected.name}
                    type={selected.type}
                    onClose={() => { setSelected(null); refresh(); }}
                />
            </div>
        );
    }

    return (
        <div className="p-5" onClick={refresh}>
            <div className="mb-8">
                <h1 className="text-3xl font-black italic tracking-tighter mb-1 flex items-center gap-3">
                    <Heart className="text-primary" fill="currentColor" size={28} /> FAVORITOS
                </h1>
                <p className="text-zinc-500 text-sm">Tu contenido guardado para ver más tarde.</p>
            </div>

            {favorites.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {favorites.map(item => (
                        <MovieCard
                            key={item.id + item.url}
                            movie={item}
                            onClick={(m) => setSelected(m)}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                    <Heart size={64} className="text-zinc-800 mb-4" />
                    <h3 className="text-xl font-bold">No tienes favoritos aún</h3>
                    <p className="text-zinc-500 mt-2 max-w-xs">
                        Toca el corazón en cualquier película, serie o canal para guardarlo aquí.
                    </p>
                </div>
            )}
        </div>
    );
};

export default Favorites;
