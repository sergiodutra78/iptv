/**
 * Metadata Service
 * Provee integraciones con APIs públicas y gratuitas (Sin API Keys obligatorias)
 * para obtener ratings y metadata de TV y Cine.
 */

export interface MediaMetadata {
    rating: number | null; // Estrella sobre 10
    year?: string;
    description?: string;
    posterUrl?: string;
}

// Caché en RAM para no bombardear las APIs públicas
const metadataCache = new Map<string, MediaMetadata>();

export class MetadataService {

    /**
     * Busca información de una Serie usando TVMaze (100% Pública y gratuita)
     */
    static async getSeriesMetadata(title: string): Promise<MediaMetadata | null> {
        if (!title) return null;

        // Limpiamos el título de años o corchetes que complican la búsqueda exacta
        let cleanTitle = title.replace(/\s*\((\d{4})\)\s*/g, '').trim(); // quita (2024)
        cleanTitle = cleanTitle.replace(/\[.*?\]/g, '').trim(); // quita [ESPAÑA]

        const cacheKey = `serie_${cleanTitle.toLowerCase()}`;
        if (metadataCache.has(cacheKey)) {
            return metadataCache.get(cacheKey)!;
        }

        try {
            const res = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanTitle)}`);
            if (!res.ok) return null;

            const data = await res.json();
            if (data) {
                const result: MediaMetadata = {
                    rating: data.rating?.average || null,
                    year: data.premiered ? data.premiered.substring(0, 4) : undefined,
                    description: data.summary ? data.summary.replace(/<[^>]*>?/gm, '') : undefined, // Limpia HTML tags
                    posterUrl: data.image?.medium || undefined
                };
                metadataCache.set(cacheKey, result);
                return result;
            }
            return null;
        } catch (error) {
            console.warn(`[TVMaze] Error obteniendo metadata para ${cleanTitle}:`, error);
            return null;
        }
    }

    /**
     * Busca información de una Película usando YTS API (Pública, devuelve rating de IMDB gratis)
     */
    static async getMovieMetadata(title: string): Promise<MediaMetadata | null> {
        if (!title) return null;

        let cleanTitle = title.replace(/\s*\((\d{4})\)\s*/g, '').trim();
        cleanTitle = cleanTitle.replace(/\[.*?\]/g, '').trim();

        const cacheKey = `movie_${cleanTitle.toLowerCase()}`;
        if (metadataCache.has(cacheKey)) {
            return metadataCache.get(cacheKey)!;
        }

        try {
            const res = await fetch(`https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(cleanTitle)}&limit=1`);
            if (!res.ok) return null;

            const data = await res.json();
            if (data?.data?.movies && data.data.movies.length > 0) {
                const movie = data.data.movies[0];
                const result: MediaMetadata = {
                    rating: movie.rating > 0 ? movie.rating : null, // IMDB rating
                    year: movie.year?.toString() || undefined,
                    description: movie.summary || movie.synopsis || undefined,
                    posterUrl: movie.medium_cover_image || undefined
                };
                metadataCache.set(cacheKey, result);
                return result;
            }
            return null;
        } catch (error) {
            console.warn(`[YTS] Error obteniendo metadata para ${cleanTitle}:`, error);
            return null;
        }
    }
}
