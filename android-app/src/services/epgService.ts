export interface EPGProgram {
    start: Date;
    stop: Date;
    title: string;
    description: string;
}

export interface EPGData {
    [channelId: string]: EPGProgram[];
}

// Ajuste horario global para sincronizar con Uruguay (+3 horas)
export const EPG_TIME_SHIFT_HOURS: number = 3; 

export class EPGService {
    private static cache: { [url: string]: EPGData } = {};

    static async fetchEPG(url: string): Promise<EPGData> {
        if (this.cache[url]) return this.cache[url];

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error al descargar EPG');

            // XMLTV files can be large, we use Regex for maximum performance and crash-resistance
            const text = await response.text();
            const programs: EPGData = {};

            // 1. Parsear Canales para Mapear display-name a ID
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
            console.log(`[EPG] Parseados ${Object.keys(idToNames).length} canales de referencia de la guía.`);

            const pieces = text.split('</programme>');
            let programCount = 0;

            for (const piece of pieces) {
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

                const title = titleMatch[1].trim();
                const description = descMatch ? descMatch[1].trim() : '';

                const program: EPGProgram = {
                    start: this.parseXmltvDate(startStr),
                    stop: this.parseXmltvDate(stopStr),
                    title: title,
                    description: description
                };

                if (!programs[channelId]) programs[channelId] = [];
                programs[channelId].push(program);
                programCount++;
            }
            console.log(`[EPG] Éxito descargando XMLTV de: ${url}`);
            console.log(`[EPG] Nodos <channel> encontrados: ${Object.keys(idToNames).length}`);
            console.log(`[EPG] Nodos <programme> cargados: ${programCount}`);
            console.log(`[EPG] Canales con guías cargadas: ${Object.keys(programs).length}`);

            // 3. Duplicar referencias para nombres alternativos (alias) y normalizados
            let aliasesCount = 0;
            for (const [id, names] of Object.entries(idToNames)) {
                if (programs[id]) {
                    for (const name of names) {
                        if (!programs[name]) {
                            programs[name] = programs[id];
                            aliasesCount++;
                        }
                        const normName = this.normalizeName(name);
                        if (!programs[normName]) {
                            programs[normName] = programs[id];
                            aliasesCount++;
                        }
                    }
                }
            }
            console.log(`[EPG] Alias de vinculación generados: ${aliasesCount}`);

            this.cache[url] = programs;
            return programs;
        } catch (error) {
            console.error('[EPG] Error parseando XMLTV de:', url, error);
            return {};
        }
    }

    private static normalizeName(name: string): string {
        if (!name) return "";
        return name.toLowerCase()
            // 1. Quitar acentos/diacríticos
            .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
            // 2. Quitar sufijos de calidad y opciones (hd, sd, fhd, 4k, 720p, 1080p, op1, op2, op3)
            .replace(/\b(hd|fhd|sd|4k|720p|1080p|op1|op2|op3|op\d+)\b/g, '')
            // 3. Quitar símbolos sobrantes y paréntesis
            .replace(/[^\w\s]/g, '')
            // 4. Reemplazar dobles espacios y trim
            .replace(/\s+/g, ' ')
            .trim()
            // 5. Quitar todos los espacios para matchear en diccionario (ej: espn2 == espn 2)
            .replace(/\s+/g, '');
    }

    static getPrograms(channel: { epgId?: string, name: string }, data: EPGData): EPGProgram[] {
        if (!data) return [];
        
        // 1. Matchear por epgId si existe
        if (channel.epgId && data[channel.epgId] && data[channel.epgId].length > 0) {
            return data[channel.epgId];
        }

        // 2. Matchear por nombre exacto
        if (data[channel.name] && data[channel.name].length > 0) {
            return data[channel.name];
        }

        // 3. Matchear por nombre normalizado
        const norm = this.normalizeName(channel.name);
        if (data[norm] && data[norm].length > 0) {
            return data[norm];
        }

        // 4. Búsqueda flexible (contiene) - Solo si hay match parcial del nombre base
        for (const [key, progs] of Object.entries(data)) {
            if (key.includes(norm) || norm.includes(key)) {
                if (progs && progs.length > 0) return progs;
            }
        }

        return [];
    }

    private static shortEpgCache: { [streamId: string]: EPGProgram[] } = {};

    static async fetchShortEPG(streamId: string, baseUrl: string, username: string, password: string): Promise<EPGProgram[]> {
        if (this.shortEpgCache[streamId]) return this.shortEpgCache[streamId];

        try {
            const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            const url = `${cleanBase}/player_api.php?username=${username}&password=${password}&action=get_short_epg&stream_id=${streamId}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error al descargar short EPG');

            const data = await response.json();
            if (!data || !data.epg_listings) return [];

            const programs: EPGProgram[] = data.epg_listings.map((item: any) => {
                // El formato de hora suele ser "2026-03-18 10:00:00"
                // O usa timestamps
                const start = item.start_timestamp ? new Date(parseInt(item.start_timestamp) * 1000) : new Date(item.start);
                const stop = item.stop_timestamp ? new Date(parseInt(item.stop_timestamp) * 1000) : new Date(item.end);
                
                // Aplicar ajuste horario si es necesario
                if (EPG_TIME_SHIFT_HOURS !== 0) {
                    start.setHours(start.getHours() + EPG_TIME_SHIFT_HOURS);
                    stop.setHours(stop.getHours() + EPG_TIME_SHIFT_HOURS);
                }
                
                return {
                    start: start,
                    stop: stop,
                    title: atob(item.title) ? decodeURIComponent(escape(atob(item.title))) : item.title, // Algunos vienen en base64
                    description: item.description ? (atob(item.description) ? decodeURIComponent(escape(atob(item.description))) : item.description) : ""
                };
            }).filter((p: any) => p.title);

            // Intentar corregir base64 si falla
            const finalPrograms = programs.map(p => {
                try {
                    // Si title tiene formato base64 válido y parseable
                    if (/^[a-zA-Z0-9+/]+={0,2}$/.test(p.title) && p.title.length > 4) {
                        p.title = decodeURIComponent(escape(atob(p.title)));
                    }
                    if (p.description && /^[a-zA-Z0-9+/]+={0,2}$/.test(p.description) && p.description.length > 4) {
                        p.description = decodeURIComponent(escape(atob(p.description)));
                    }
                } catch (e) { }
                return p;
            });

            this.shortEpgCache[streamId] = finalPrograms;
            return finalPrograms;
        } catch (error) {
            console.warn(`[EPG] Error fetchShortEPG para ${streamId}:`, error);
            return [];
        }
    }

    private static parseXmltvDate(dateStr: string): Date {
        if (!dateStr) return new Date();

        // Exp: "20260318100000 +0300" o "20260318100000"
        const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);
        if (!match) return new Date();

        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        const day = parseInt(match[3]);
        const hour = parseInt(match[4]);
        const min = parseInt(match[5]);
        const sec = match[6] ? parseInt(match[6]) : 0;
        
        let offsetStr = match[7];
        
        // FALLBACK: Si no viene offset, el usuario indica que suele ser de México (-0600)
        // Se usa -0600 por defecto para que la conversión a UTC y luego a local sea correcta.
        if (!offsetStr) {
            offsetStr = "-0600"; 
        }

        const date = new Date(Date.UTC(year, month, day, hour, min, sec));

        if (offsetStr && offsetStr.length >= 5) {
            const sign = offsetStr[0] === '+' ? 1 : -1;
            const offsetHours = parseInt(offsetStr.substring(1, 3));
            const offsetMins = parseInt(offsetStr.substring(3, 5));
            const totalOffsetMin = (offsetHours * 60 + offsetMins) * sign;

            // FIXED: Usar setUTCMinutes
            date.setUTCMinutes(date.getUTCMinutes() - totalOffsetMin);
        }
        
        // Aplicar ajuste horario si es necesario
        if (EPG_TIME_SHIFT_HOURS !== 0) {
            date.setHours(date.getHours() + EPG_TIME_SHIFT_HOURS);
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
