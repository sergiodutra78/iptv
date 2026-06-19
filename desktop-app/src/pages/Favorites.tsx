import { useState } from 'react';
import { Heart } from 'lucide-react';
import { type Channel } from '../services/m3uParser';
import { FavoritesService } from '../services/FavoritesService';
import MovieCard from '../components/MovieCard';
import VideoPlayer from '../components/VideoPlayer';

const Favorites = () => {
    const [favorites, setFavorites] = useState<Channel[]>(() => FavoritesService.getAll());
    const [selected, setSelected] = useState<Channel | null>(null);

    // Refresca la lista (por si se quitó alguno desde las tarjetas)
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
        <div className="p-8" onClick={refresh}>
            <div className="mb-10">
                <h1 className="text-4xl font-black italic tracking-tighter mb-2 flex items-center gap-3">
                    <Heart className="text-primary" fill="currentColor" size={32} /> FAVORITOS
                </h1>
                <p className="text-zinc-500">Tu contenido guardado para ver más tarde.</p>
            </div>

            {favorites.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-6">
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
                        Pasa el cursor sobre cualquier película, serie o canal y toca el corazón para guardarlo aquí.
                    </p>
                </div>
            )}
        </div>
    );
};

export default Favorites;
