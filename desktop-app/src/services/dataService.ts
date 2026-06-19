import { M3UParser, type PlaylistData, type Channel } from './m3uParser';

const CACHE_KEY = 'iptv_playlist_cache';
const CACHE_TIME_KEY = 'iptv_cache_timestamp';
const REFRESH_INTERVAL = 1000 * 60 * 60 * 24; // 24 hours

export interface GroupedSeries extends Channel {
    episodes: Channel[];
}

export class DataService {
    private static playlistData: PlaylistData | null = null;
    private static liveChannels: Channel[] = [];
    private static movies: Channel[] = [];
    private static series: Channel[] = [];
    private static groupedSeries: GroupedSeries[] = [];

    static async getChannels(url: string, onProgress?: (percent: number) => void, forceRefresh = false): Promise<PlaylistData> {
        if (this.playlistData && this.playlistData.channels.length > 0 && !forceRefresh) {
            if (onProgress) onProgress(100);
            return this.playlistData;
        }

        if (!forceRefresh) {
            const cached = localStorage.getItem(CACHE_KEY);
            const timestamp = localStorage.getItem(CACHE_TIME_KEY);

            if (cached && timestamp) {
                const now = Date.now();
                if (now - parseInt(timestamp) < REFRESH_INTERVAL) {
                    try {
                        if (onProgress) onProgress(10);
                        await new Promise(resolve => setTimeout(resolve, 100));

                        const data = JSON.parse(cached);
                        if (onProgress) onProgress(30);

                        await new Promise(resolve => setTimeout(resolve, 100));
                        this.processData(data);

                        // Precarga de imágenes (la barra avanza 30→100% mientras descarga)
                        await this.preloadTopImages(data.channels, (p) => {
                            if (onProgress) onProgress(30 + Math.floor(p * 0.7));
                        });

                        if (onProgress) onProgress(100);
                        return this.playlistData!;
                    } catch (e) {
                        console.error("Error parsing cached playlist", e);
                    }
                }
            }
        }

        try {
            // Descarga + parseo del M3U: avanza la barra 0→30%
            const data = await M3UParser.fetchAndParse(url, (p) => {
                if (onProgress) onProgress(Math.floor(p * 0.3));
            });
            this.processData(data);

            // Precarga de imágenes: avanza la barra 30→100%
            await this.preloadTopImages(data.channels, (p) => {
                if (onProgress) onProgress(30 + Math.floor(p * 0.7));
            });
            if (onProgress) onProgress(100);

            setTimeout(() => {
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
                    localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
                } catch (e) {
                    console.warn("Could not save to localStorage", e);
                }
            }, 0);

            return data;
        } catch (error) {
            console.error("DataService error:", error);
            throw error;
        }
    }

    /**
     * Precarga las imágenes principales para que aparezcan al instante al abrir la app.
     *
     * Usa `new Image()` (NO la Cache API, que se cuelga en Electron empaquetado vía
     * file://). Chromium guarda cada imagen en su caché de disco automáticamente.
     * Cada imagen tiene un timeout para que una URL muerta no trabe la barra de carga.
     */
    private static preloadTopImages(channels: Channel[], onProgress?: (percent: number) => void): Promise<void> {
        return new Promise((resolve) => {
            const pick = (type: Channel['type'], limit: number) =>
                channels.filter(c => c.type === type && c.logo).map(c => c.logo!).slice(0, limit);

            // Scope "medio": inicio + películas + series destacadas + algunos canales
            const uniqueLogos = Array.from(new Set([
                ...pick('movie', 200),
                ...pick('series', 100),
                ...pick('live', 80),
            ]));

            const total = uniqueLogos.length;
            if (total === 0) {
                if (onProgress) onProgress(100);
                resolve();
                return;
            }

            let loaded = 0;
            let i = 0;
            const CONCURRENCY = 16;
            const PER_IMAGE_TIMEOUT = 4000;

            const loadNext = () => {
                if (i >= total) return;
                const raw = uniqueLogos[i++];
                let src = raw;
                if (src.startsWith('//')) src = 'https:' + src;

                const img = new Image();
                let settled = false;
                const finish = () => {
                    if (settled) return;
                    settled = true;
                    loaded++;
                    if (onProgress) onProgress(Math.floor((loaded / total) * 100));
                    if (loaded >= total) {
                        resolve();
                    } else {
                        loadNext();
                    }
                };

                const timer = setTimeout(finish, PER_IMAGE_TIMEOUT);
                img.onload = () => { clearTimeout(timer); finish(); };
                img.onerror = () => { clearTimeout(timer); finish(); };
                img.src = src;
            };

            for (let k = 0; k < Math.min(CONCURRENCY, total); k++) {
                loadNext();
            }
        });
    }

    private static processData(data: PlaylistData) {
        if (!data || !data.channels) return;
        this.playlistData = data;

        this.liveChannels = [];
        this.movies = [];
        this.series = [];
        this.groupedSeries = [];

        const seriesMap = new Map<string, GroupedSeries>();

        for (const channel of data.channels) {
            if (channel.type === 'live') {
                const nameLower = channel.name.toLowerCase();
                const groupLower = channel.group.toLowerCase();
                // Si es un canal en vivo de series o 24/7 lo movemos a categoría especial
                if (
                    groupLower.includes('series') ||
                    nameLower.includes('24/7') ||
                    nameLower.includes('24 horas') ||
                    nameLower.includes('24hs') ||
                    nameLower.includes('24 hs') ||
                    nameLower.includes('series 24/7')
                ) {
                    channel.group = 'CANALES DE SERIES 24/7';
                }
                this.liveChannels.push(channel);
            } else if (channel.type === 'movie') {
                this.movies.push(channel);
            } else if (channel.type === 'series') {
                this.series.push(channel);

                // Agrupación de series (S01E01 -> Sherlock)
                const baseName = channel.name.split(/\s+([sS]\d+|[tT]\d+|\d+x|Temporada|Season|Episodio|Episode|Capitulo|Part|Parte| - | \d+$)/i)[0].trim();

                if (!seriesMap.has(baseName)) {
                    seriesMap.set(baseName, {
                        ...channel,
                        id: 'series-' + baseName.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'),
                        name: baseName,
                        episodes: [],
                    });
                }
                seriesMap.get(baseName)!.episodes.push(channel);
            }
        }

        this.groupedSeries = Array.from(seriesMap.values());
    }

    static hasData(): boolean {
        return !!(this.playlistData && this.playlistData.channels.length > 0);
    }

    static getAllSync(): PlaylistData | null {
        return this.playlistData;
    }

    static getLiveSync(): Channel[] {
        return this.liveChannels;
    }

    static getMoviesSync(): Channel[] {
        return this.movies;
    }

    static getSeriesSync(): Channel[] {
        return this.series;
    }

    static getGroupedSeriesSync(): GroupedSeries[] {
        return this.groupedSeries || [];
    }

    static clearCache() {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(CACHE_TIME_KEY);
        this.playlistData = null;
        this.liveChannels = [];
        this.movies = [];
        this.series = [];
        this.groupedSeries = [];
    }
}
