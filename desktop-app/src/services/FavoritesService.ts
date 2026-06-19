import { type Channel } from './m3uParser';

const FAVORITES_KEY = 'iptv_favorites';

/**
 * Maneja la lista de favoritos del usuario.
 * Guarda los objetos Channel completos para poder renderizarlos y reproducirlos
 * desde la página de Favoritos sin depender de que la lista esté cargada.
 */
export class FavoritesService {
    private static favorites: Channel[] = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');

    static getAll(): Channel[] {
        return this.favorites;
    }

    static isFavorite(url: string): boolean {
        return this.favorites.some(f => f.url === url);
    }

    static add(channel: Channel): void {
        if (!this.isFavorite(channel.url)) {
            this.favorites = [channel, ...this.favorites];
            this.save();
        }
    }

    static remove(url: string): void {
        this.favorites = this.favorites.filter(f => f.url !== url);
        this.save();
    }

    /** Alterna el estado de favorito y devuelve el nuevo estado (true = ahora es favorito). */
    static toggle(channel: Channel): boolean {
        if (this.isFavorite(channel.url)) {
            this.remove(channel.url);
            return false;
        }
        this.add(channel);
        return true;
    }

    private static save(): void {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(this.favorites));
    }
}
