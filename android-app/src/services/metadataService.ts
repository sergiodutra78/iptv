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
    backdropUrl?: string;
    genres?: string[];
    status?: string;
}

// Caché en RAM para no bombardear las APIs públicas
const metadataCache = new Map<string, MediaMetadata>();

export class MetadataService {

    /**
     * Busca información de una Serie usando TVMaze (100% Pública y gratuita)
     */
    static async getSeriesMetadata(title: string): Promise<MediaMetadata | null> {
        if (!title) return null;

        // Limpieza robusta del título para Series
        // Elimina: (Año), [Tag], S01EXX, T1 EXX, Cap, Filtros por tags latino/castellano
        let cleanTitle = title
            .replace(/\s*\((\d{4})\)\s*/g, ' ') // quita (2024)
            .replace(/\[.*?\]/g, ' ') // quita [ESPAÑA]
            .replace(/\s+([sS]\d+|[tT]\d+|\d+x|Temporada|Season|Episodio|Episode|Capitulo|Part|Parte| - | \d+$)/i, ' ') // quita tags de episodio
            .replace(/\s+(latino|castellano|subtitulada|hd|fhd|4k|1080p|720p)/i, ' ') // quita tags de idioma/calidad
            .replace(/\s+/g, ' ')
            .trim();

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
                    posterUrl: data.image?.medium || undefined,
                    backdropUrl: data.image?.original || undefined, // original como backdrop
                    genres: data.genres || [],
                    status: data.status || undefined
                };
                
                console.log(`[Metadata] SerieMatch: ${cleanTitle} | Fuente: TVMaze | Poster: ${result.posterUrl ? "TVMaze" : "Fallback"} | Desc: ${result.description ? "SÍ" : "NO"}`);
                
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
     * Busca información de una Película usando Proveedor (Xtream) o YTS API como Fallback
     */
    static async getMovieMetadata(title: string, movie?: any): Promise<MediaMetadata | null> {
        if (!title) return null;

        let cleanTitle = title.replace(/\s*\((\d{4})\)\s*/g, '').trim();
        cleanTitle = cleanTitle.replace(/\[.*?\]/g, '').trim();

        const cacheKey = `movie_${cleanTitle.toLowerCase()}`;
        if (metadataCache.has(cacheKey)) {
            return metadataCache.get(cacheKey)!;
        }

        // --- PRIORIDAD 1: Provider Metadata (Xtream Codes) ---
        if (movie && movie.url) {
            try {
                const matchStream = movie.url.match(/\/movie\/[^/]+\/[^/]+\/([^/.]+)/);
                const streamId = matchStream ? matchStream[1] : null;

                const storedConfig = localStorage.getItem('iptv_config');
                if (streamId && storedConfig) {
                    const config = JSON.parse(storedConfig);
                    const xc = config.xtreamCodes;
                    if (xc && xc.username && xc.password && xc.baseUrl && xc.baseUrl !== "TU_HOST_AQUI") {
                        const cleanBase = xc.baseUrl.endsWith('/') ? xc.baseUrl.slice(0, -1) : xc.baseUrl;
                        const vodUrl = `${cleanBase}/player_api.php?username=${xc.username}&password=${xc.password}&action=get_vod_info&stream_id=${streamId}`;
                        
                        const vodRes = await fetch(vodUrl);
                        if (vodRes.ok) {
                            const vodData = await vodRes.json();
                            const info = vodData.info;
                            if (info) {
                                const result: MediaMetadata = {
                                    rating: info.rating ? parseFloat(info.rating) : null,
                                    year: info.year ? info.year.toString() : undefined,
                                    description: info.plot || info.description || undefined,
                                    posterUrl: info.cover || info.movie_image || undefined,
                                    backdropUrl: info.backdrop_path && info.backdrop_path.length > 0 ? info.backdrop_path[0] : undefined,
                                    genres: info.genre ? info.genre.split(',').map((g: string) => g.trim()) : [],
                                    status: info.released_date || undefined
                                };

                                // --- ENRIQUECIMIENTO EXTRA (SINOPSIS EN ESPAÑOL) SI FALTA ---
                                if (!result.description || result.description.trim() === "") {
                                    try {
                                        const ddgRes = await fetch(`https://api.duckduckgo.com/?q=pelicula%20${encodeURIComponent(cleanTitle)}&format=json`);
                                        if (ddgRes.ok) {
                                            const ddgData = await ddgRes.json();
                                            if (ddgData.AbstractText && ddgData.AbstractText.length > 20) {
                                                result.description = ddgData.AbstractText;
                                            }
                                        }
                                    } catch (e) {}
                                }
                                
                                console.log(`[Metadata] MovieMatch: ${cleanTitle} | Fuente: Provider (Xtream) | Poster: ${result.posterUrl ? "SÍ" : "NO"} | Desc: ${result.description ? "SÍ" : "NO"}`);
                                metadataCache.set(cacheKey, result);
                                return result;
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn(`[Xtream] Error obteniendo info para movie ${cleanTitle}:`, e);
            }
        }

        // --- PRIORIDAD 2: Fallback a YTS ---
        try {
            const res = await fetch(`https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(cleanTitle)}&limit=1`);
            if (!res.ok) return null;

            const data = await res.json();
            if (data?.data?.movies && data.data.movies.length > 0) {
                const item = data.data.movies[0];
                const result: MediaMetadata = {
                    rating: item.rating > 0 ? item.rating : null,
                    year: item.year?.toString() || undefined,
                    description: item.summary || item.synopsis || undefined,
                    posterUrl: item.medium_cover_image || undefined
                };

                // --- SINOPSIS EN ESPAÑOL DUCKDUCKGOFallback ---
                if (!result.description || result.description.length < 50) {
                    try {
                        const ddgRes = await fetch(`https://api.duckduckgo.com/?q=pelicula%20${encodeURIComponent(cleanTitle)}&format=json`);
                        if (ddgRes.ok) {
                            const ddgData = await ddgRes.json();
                            if (ddgData.AbstractText && ddgData.AbstractText.length > 20) {
                                result.description = ddgData.AbstractText;
                            }
                        }
                    } catch (e) {}
                }

                console.log(`[Metadata] MovieMatch: ${cleanTitle} | Fuente: YTS (Fallback) | Poster: ${result.posterUrl ? "SÍ" : "NO"} | Desc: ${result.description ? "SÍ" : "NO"}`);
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
