import { M3UParser, type PlaylistData, type Channel } from './m3uParser';
import { withTimeout } from '../utils/withTimeout';

const CACHE_KEY = 'iptv_playlist_cache';
const CACHE_TIME_KEY = 'iptv_cache_timestamp';
const REFRESH_INTERVAL = 1000 * 60 * 60 * 24;

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
            const data = await M3UParser.fetchAndParse(url, (p) => {
                if (onProgress) onProgress(Math.floor(p * 0.3));
            });
            this.processData(data);

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

    private static async preloadTopImages(channels: Channel[], onProgress?: (percent: number) => void): Promise<void> {
        const pick = (type: Channel['type'], limit: number) =>
            channels.filter(c => c.type === type && c.logo).map(c => c.logo!).slice(0, limit);

        const uniqueLogos = Array.from(new Set([
            ...pick('movie', 200),
            ...pick('series', 100),
            ...pick('live', 80),
        ])).map(u => (u.startsWith('//') ? 'https:' + u : u));

        const total = uniqueLogos.length;
        if (total === 0) { if (onProgress) onProgress(100); return; }

        let cache: Cache | null = null;
        try {
            if ('caches' in window) cache = await withTimeout(caches.open('kinetiq-images'), 2000);
        } catch { if (onProgress) onProgress(100); return; }
        if (!cache) { if (onProgress) onProgress(100); return; }

        let loaded = 0;
        let i = 0;
        const CONCURRENCY = 12;

        const worker = async (): Promise<void> => {
            while (i < total) {
                const url = uniqueLogos[i++];
                try {
                    const has = await withTimeout(cache!.match(url), 1500);
                    if (!has) {
                        const res = await withTimeout(fetch(url), 5000);
                        if (res.ok) await withTimeout(cache!.put(url, res), 3000);
                    }
                } catch {}
                loaded++;
                if (onProgress) onProgress(Math.floor((loaded / total) * 100));
            }
        };

        await Promise.all(Array(Math.min(CONCURRENCY, total)).fill(0).map(() => worker()));
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

    static hasData(): boolean { return !!(this.playlistData && this.playlistData.channels.length > 0); }
    static getAllSync(): PlaylistData | null { return this.playlistData; }
    static getLiveSync(): Channel[] { return this.liveChannels; }
    static getMoviesSync(): Channel[] { return this.movies; }
    static getSeriesSync(): Channel[] { return this.series; }
    static getGroupedSeriesSync(): GroupedSeries[] { return this.groupedSeries || []; }

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
