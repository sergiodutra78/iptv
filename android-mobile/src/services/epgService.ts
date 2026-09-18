export interface EPGProgram {
    start: Date;
    stop: Date;
    title: string;
    description: string;
}

export interface EPGData {
    [channelId: string]: EPGProgram[];
}

export const EPG_TIME_SHIFT_HOURS: number = 3;

export class EPGService {
    private static cache: { [url: string]: EPGData } = {};
    private static fetchInProgress: { [url: string]: Promise<EPGData> } = {};

    static async fetchEPG(url: string): Promise<EPGData> {
        if (this.cache[url]) return this.cache[url];
        if (url in this.fetchInProgress) return this.fetchInProgress[url];

        const promise = this._doFetchEPG(url);
        this.fetchInProgress[url] = promise;
        try {
            return await promise;
        } finally {
            delete this.fetchInProgress[url];
        }
    }

    static isEPGLoading(): boolean {
        return Object.keys(this.fetchInProgress).length > 0;
    }

    private static async _doFetchEPG(url: string): Promise<EPGData> {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error al descargar EPG');

            const text = await response.text();
            const programs: EPGData = {};

            const idToNames: { [id: string]: string[] } = {};
            const channelPieces = text.split('</channel>');
            for (const piece of channelPieces) {
                const match = piece.match(/<channel([^>]+)>/);
                if (!match) continue;

                const attrText = match[1];
                const content = piece.substring(match.index! + match[0].length);
                const id = attrText.match(/id="([^"]*)"/)?.[1] || "";

                const names = content.matchAll(/<display-name[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/display-name>/gi);
                const nameList: string[] = [];
                for (const nm of names) {
                    const n = nm[1].trim();
                    if (n) nameList.push(n);
                }
                idToNames[id] = nameList;
            }

            const pieces = text.split('</programme>');
            for (let pi = 0; pi < pieces.length; pi++) {
                const piece = pieces[pi];
                if (pi % 2000 === 0) await new Promise(resolve => setTimeout(resolve, 0));

                const match = piece.match(/<programme([^>]+)>/);
                if (!match) continue;

                const attrText = match[1];
                const content = piece.substring(match.index! + match[0].length);

                const startStr = attrText.match(/start="([^"]+)"/)?.[1];
                const stopStr = attrText.match(/stop="([^"]+)"/)?.[1];
                const channelId = attrText.match(/channel="([^"]+)"/)?.[1];

                if (!startStr || !stopStr || !channelId) continue;

                const titleMatch = content.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
                const descMatch = content.match(/<desc[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/desc>/i);

                if (!titleMatch) continue;

                const program: EPGProgram = {
                    start: this.parseXmltvDate(startStr),
                    stop: this.parseXmltvDate(stopStr),
                    title: titleMatch[1].trim(),
                    description: descMatch ? descMatch[1].trim() : ''
                };

                if (!programs[channelId]) programs[channelId] = [];
                programs[channelId].push(program);
            }

            for (const [id, names] of Object.entries(idToNames)) {
                if (programs[id]) {
                    for (const name of names) {
                        if (!programs[name]) programs[name] = programs[id];
                        const normName = this.normalizeName(name);
                        if (!programs[normName]) programs[normName] = programs[id];
                    }
                }
            }

            this.cache[url] = programs;
            return programs;
        } catch (error) {
            console.error('[EPG] Error parseando XMLTV:', url, error);
            return {};
        }
    }

    private static normalizeName(name: string): string {
        if (!name) return "";
        return name.toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, "")
            .replace(/\b(hd|fhd|sd|4k|720p|1080p|op1|op2|op3|op\d+)\b/g, '')
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\s+/g, '');
    }

    static getPrograms(channel: { epgId?: string, name: string }, data: EPGData): EPGProgram[] {
        if (!data) return [];

        if (channel.epgId && data[channel.epgId]?.length > 0) return data[channel.epgId];
        if (data[channel.name]?.length > 0) return data[channel.name];

        const norm = this.normalizeName(channel.name);
        if (data[norm]?.length > 0) return data[norm];

        for (const [key, progs] of Object.entries(data)) {
            if (key.includes(norm) || norm.includes(key)) {
                if (progs?.length > 0) return progs;
            }
        }

        return [];
    }

    private static shortEpgCache: { [streamId: string]: EPGProgram[] } = {};

    static getCachedEPG(): EPGData | null {
        const keys = Object.keys(this.cache);
        return keys.length > 0 ? this.cache[keys[0]] : null;
    }

    static getShortCachedPrograms(streamId: string): EPGProgram[] {
        return this.shortEpgCache[streamId] ?? [];
    }

    static async fetchShortEPG(streamId: string, baseUrl: string, username: string, password: string): Promise<EPGProgram[]> {
        if (this.shortEpgCache[streamId]) return this.shortEpgCache[streamId];

        try {
            const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            const url = `${cleanBase}/player_api.php?username=${username}&password=${password}&action=get_short_epg&stream_id=${streamId}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Error al descargar short EPG');

            const data = await response.json();
            if (!data || !data.epg_listings) return [];

            const safeB64 = (str: string): string => {
                if (!str) return str;
                try { return decodeURIComponent(escape(atob(str))); } catch { return str; }
            };

            const finalPrograms: EPGProgram[] = data.epg_listings.map((item: any) => {
                const hasTs = !!(item.start_timestamp);
                const start = hasTs ? new Date(parseInt(item.start_timestamp) * 1000) : new Date(item.start);
                const stop = item.stop_timestamp ? new Date(parseInt(item.stop_timestamp) * 1000) : new Date(item.end);

                if (!hasTs && EPG_TIME_SHIFT_HOURS !== 0) {
                    start.setHours(start.getHours() + EPG_TIME_SHIFT_HOURS);
                    stop.setHours(stop.getHours() + EPG_TIME_SHIFT_HOURS);
                }

                return {
                    start,
                    stop,
                    title: safeB64(item.title),
                    description: item.description ? safeB64(item.description) : "",
                };
            }).filter((p: any) => p.title);

            this.shortEpgCache[streamId] = finalPrograms;
            return finalPrograms;
        } catch (error) {
            console.warn(`[EPG] Error fetchShortEPG para ${streamId}:`, error);
            return [];
        }
    }

    private static parseXmltvDate(dateStr: string): Date {
        if (!dateStr) return new Date();

        const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);
        if (!match) return new Date();

        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        const day = parseInt(match[3]);
        const hour = parseInt(match[4]);
        const min = parseInt(match[5]);
        const sec = match[6] ? parseInt(match[6]) : 0;

        let offsetStr = match[7];
        if (!offsetStr) offsetStr = "-0600";

        const date = new Date(Date.UTC(year, month, day, hour, min, sec));

        if (offsetStr && offsetStr.length >= 5) {
            const sign = offsetStr[0] === '+' ? 1 : -1;
            const offsetHours = parseInt(offsetStr.substring(1, 3));
            const offsetMins = parseInt(offsetStr.substring(3, 5));
            const totalOffsetMin = (offsetHours * 60 + offsetMins) * sign;
            date.setUTCMinutes(date.getUTCMinutes() - totalOffsetMin);
        }

        return date;
    }

    static getProgramProgress(program: EPGProgram | undefined): number {
        if (!program) return 0;
        const now = new Date();
        const total = program.stop.getTime() - program.start.getTime();
        const elapsed = now.getTime() - program.start.getTime();
        return Math.min(Math.max((elapsed / total) * 100, 0), 100);
    }

    static getCurrentProgram(programs: EPGProgram[] | undefined): EPGProgram | undefined {
        if (!programs) return undefined;
        const now = new Date();
        return programs.find(p => p.start <= now && p.stop > now);
    }
}
