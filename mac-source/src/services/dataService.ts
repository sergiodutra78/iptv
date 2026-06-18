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
                        if (onProgress) onProgress(40);

                        await new Promise(resolve => setTimeout(resolve, 100));
                        this.processData(data);

                        await this.preloadTopImages(data.channels, onProgress);

                        if (onProgress) onProgress(100);
                        return this.playlistData!;
                    } catch (e) {
                        console.error("Error parsing cached playlist", e);
                    }
                }
            }
        }

        try {
            const data = await M3UParser.fetchAndParse(url, (p) => {
                if (onProgress) onProgress(p * 0.5);
            });
            this.processData(data);

            await this.preloadTopImages(data.channels, (p) => {
                if (onProgress) onProgress(50 + p * 0.5);
            });

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

    private static async preloadTopImages(channels: Channel[], onProgress?: (percent: number) => void) {
        if (!('caches' in window)) return;

        try {
            const cache = await caches.open('kinetiq-images');
            const live = channels.filter(c => c.type === 'live' && c.logo).map(c => c.logo!);
            const others = channels.filter(c => c.type !== 'live' && c.logo).map(c => c.logo!);
            const uniqueLogos = Array.from(new Set([...live.slice(0, 100), ...others.slice(0, 50)]));

            let loaded = 0;
            const total = uniqueLogos.length;
            const CONCURRENCY = 10;
            let i = 0;

            const worker = async () => {
                while (i < total) {
                    const url = uniqueLogos[i++];
                    let cleanSrc = url;
                    if (cleanSrc.startsWith('//')) cleanSrc = 'https:' + cleanSrc;

                    try {
                        const has = await cache.match(cleanSrc);
                        if (!has) {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 4000);
                            const res = await fetch(cleanSrc, { signal: controller.signal });
                            clearTimeout(timeoutId);
                            if (res.ok) await cache.put(cleanSrc, res);
                        }
                    } catch (e) { }
                    loaded++;
                    if (onProgress) onProgress(Math.floor((loaded / total) * 100));
                }
            };

            const workers = Array(Math.min(CONCURRENCY, total)).fill(0).map(worker);
            await Promise.all(workers);
            const allLogos = Array.from(new Set(channels.map(c => c.logo).filter(l => !!l))) as string[];
            this.preloadRestInBackground(allLogos, uniqueLogos);
        } catch (e) {
            console.warn("Error preloading images", e);
        }
    }

    private static async preloadRestInBackground(allLogos: string[], skipLogos: string[]) {
        if (!('caches' in window)) return;
        setTimeout(async () => {
            try {
                const cache = await caches.open('kinetiq-images');
                const skipSet = new Set(skipLogos);
                const toLoad = allLogos.filter(l => !skipSet.has(l));

                for (let i = 0; i < toLoad.length; i++) {
                    const url = toLoad[i];
                    let cleanSrc = url;
                    if (cleanSrc.startsWith('//')) cleanSrc = 'https:' + cleanSrc;

                    try {
                        const has = await cache.match(cleanSrc);
                        if (!has) {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 4000);
                            const res = await fetch(cleanSrc, { signal: controller.signal });
                            clearTimeout(timeoutId);
                            if (res.ok) await cache.put(cleanSrc, res);
                        }
                    } catch (e) { }
                    await new Promise(r => setTimeout(r, 100));
                }
            } catch (e) { }
        }, 3000);
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
