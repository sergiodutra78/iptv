import { useState, useEffect } from 'react';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
}

const CachedImage = ({ src, alt, className, ...props }: CachedImageProps) => {
    const [displaySrc, setDisplaySrc] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        let objectUrl: string | null = null;

        // Reset loading state for new src
        setIsLoading(true);

        // Limpiar la URL de posibles espacios o caracteres raros
        let cleanSrc = src?.trim() || "";

        // Handle protocol-relative URLs (//example.com/image.png)
        if (cleanSrc.startsWith('//')) {
            cleanSrc = 'https:' + cleanSrc;
        }

        const loadImage = async () => {
            if (!cleanSrc) {
                if (isMounted) setIsLoading(false);
                return;
            }

            try {
                // Verificar si la Cache API está disponible
                if ('caches' in window) {
                    const cache = await caches.open('kinetiq-images');
                    const cacheResponse = await cache.match(cleanSrc);

                    if (cacheResponse) {
                        const blob = await cacheResponse.blob();
                        if (isMounted) {
                            objectUrl = URL.createObjectURL(blob);
                            setDisplaySrc(objectUrl);
                        }
                        return;
                    }

                    // No está en caché con timeout para que no se quede colgado eternamente
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos de timeout

                        const networkResponse = await fetch(cleanSrc, { signal: controller.signal });
                        clearTimeout(timeoutId);

                        if (networkResponse.ok) {
                            cache.put(cleanSrc, networkResponse.clone());
                            const blob = await networkResponse.blob();
                            if (isMounted) {
                                objectUrl = URL.createObjectURL(blob);
                                setDisplaySrc(objectUrl);
                            }
                            return;
                        }
                    } catch (fetchError) {
                        console.warn('Error capturando imagen para caché:', cleanSrc, fetchError);
                    }
                }

                // Fallback: Si caches no existe o el fetch/caché falló
                if (isMounted) {
                    setDisplaySrc(cleanSrc);
                }
            } catch (error) {
                console.error("Error global en caché de imagen:", error);
                if (isMounted) {
                    setDisplaySrc(cleanSrc);
                }
            }
        };

        loadImage();

        return () => {
            isMounted = false;
            // IMPORTANTE: Liberar memoria
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [src]);

    const handleError = () => {
        setIsLoading(false);
    };

    const handleLoad = () => {
        setIsLoading(false);
    };

    const imageObjectFit = className?.includes('object-cover') ? 'object-cover' : className?.includes('object-contain') ? 'object-contain' : '';

    return (
        <div className={`relative overflow-hidden bg-zinc-900/50 ${className || ''}`}>
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 z-10 transition-opacity duration-300">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
            {displaySrc && (
                <img
                    src={displaySrc}
                    alt={alt}
                    className={`w-full h-full transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'} ${imageObjectFit}`}
                    onLoad={handleLoad}
                    onError={handleError}
                    {...props}
                />
            )}
        </div>
    );
};

export default CachedImage;

