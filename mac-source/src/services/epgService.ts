export interface EPGProgram {
    start: Date;
    stop: Date;
    title: string;
    description: string;
}

export interface EPGData {
    [channelId: string]: EPGProgram[];
}

export class EPGService {
    private static cache: { [url: string]: EPGData } = {};

    static async fetchEPG(url: string): Promise<EPGData> {
        if (this.cache[url]) return this.cache[url];

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error al descargar EPG');

            // XMLTV files can be large, we use DOMParser here as it's built-in
            const text = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");

            const programs: EPGData = {};
            const programmeNodes = xmlDoc.getElementsByTagName('programme');

            for (let i = 0; i < programmeNodes.length; i++) {
                const node = programmeNodes[i];
                const channelId = node.getAttribute('channel');
                if (!channelId) continue;

                const startStr = node.getAttribute('start');
                const stopStr = node.getAttribute('stop');
                const titleNode = node.getElementsByTagName('title')[0];
                const descNode = node.getElementsByTagName('desc')[0];

                if (!startStr || !stopStr || !titleNode) continue;

                const program: EPGProgram = {
                    start: this.parseXmltvDate(startStr),
                    stop: this.parseXmltvDate(stopStr),
                    title: titleNode.textContent || '',
                    description: descNode ? descNode.textContent || '' : ''
                };

                if (!programs[channelId]) programs[channelId] = [];
                programs[channelId].push(program);
            }

            this.cache[url] = programs;
            return programs;
        } catch (error) {
            console.error('EPG Fetch error:', error);
            return {};
        }
    }

    private static parseXmltvDate(dateStr: string): Date {
        // Format: YYYYMMDDHHmmSS +0000
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        const hour = parseInt(dateStr.substring(8, 10));
        const min = parseInt(dateStr.substring(10, 12));
        const sec = parseInt(dateStr.substring(12, 14));

        // Handle timezone offset if present
        return new Date(Date.UTC(year, month, day, hour, min, sec));
    }

    static getCurrentProgram(programs: EPGProgram[] | undefined): EPGProgram | undefined {
        if (!programs) return undefined;
        const now = new Date();
        return programs.find(p => p.start <= now && p.stop > now);
    }
}
