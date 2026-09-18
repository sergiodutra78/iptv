export interface IElectronAPI {
    getCachedImage: (url: string) => Promise<string>;
}

declare global {
    interface Window {
        electronAPI: IElectronAPI;
    }
}
