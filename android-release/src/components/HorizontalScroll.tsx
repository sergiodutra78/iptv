import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HorizontalScrollProps {
    children: React.ReactNode;
    title?: string;
    onViewAll?: () => void;
}

const HorizontalScroll = ({ children, title, onViewAll }: HorizontalScrollProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);

    const updateArrows = () => {
        if (scrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
            setShowLeftArrow(scrollLeft > 50); // Mínimo 50px de movimiento para mostrar izquierda
            setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 50);
        }
    };

    useEffect(() => {
        // Delay para asegurar que el DOM y las imágenes se rendericen
        const timer = setTimeout(updateArrows, 1000);
        window.addEventListener('resize', updateArrows);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updateArrows);
        };
    }, [children]);

    const slide = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const scrollAmount = scrollRef.current.clientWidth * 0.7; // Un poco menos de una pantalla
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
            // Pequeño retardo para actualizar flechas después del scroll suave
            setTimeout(updateArrows, 600);
        }
    };

    return (
        <div className="relative group/slider w-full py-4 overflow-visible">
            {title && (
                <div className="flex items-center justify-between px-10 mb-6">
                    <h2 className="text-2xl font-black italic tracking-tighter flex items-center gap-3">
                        <span className="w-1.5 h-8 bg-primary rounded-full shadow-[0_0_10px_rgba(229,9,20,0.5)]"></span>
                        {title}
                    </h2>
                    {onViewAll && (
                        <button onClick={onViewAll} className="text-sm font-bold text-zinc-500 hover:text-primary transition-colors flex items-center gap-1 group">
                            Ver todas <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    )}
                </div>
            )}

            <div className="relative overflow-visible px-10">
                {/* Flecha Izquierda - Flecha nítida con fondo sólido para que se vea sí o sí */}
                {showLeftArrow && (
                    <button
                        onClick={() => slide('left')}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-[100] h-[70%] w-14 bg-black/80 hover:bg-black border-r border-zinc-800 flex items-center justify-center transition-all duration-300 opacity-100 shadow-[20px_0_40px_rgba(0,0,0,0.9)] rounded-r-xl"
                    >
                        <ChevronLeft size={48} className="text-white drop-shadow-[0_0_10px_rgba(229,9,20,0.5)]" />
                    </button>
                )}

                {/* Contenedor scrolleable */}
                <div
                    ref={scrollRef}
                    onScroll={updateArrows}
                    className="flex gap-5 overflow-x-auto scrollbar-hide snap-x snap-mandatory py-4 -my-4 pr-10"
                    style={{ scrollBehavior: 'smooth' }}
                >
                    {children}
                </div>

                {/* Flecha Derecha - Aparece primero como quieres */}
                {showRightArrow && (
                    <button
                        onClick={() => slide('right')}
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-[100] h-[70%] w-14 bg-black/80 hover:bg-black border-l border-zinc-800 flex items-center justify-center transition-all duration-300 opacity-100 shadow-[-20px_0_40px_rgba(0,0,0,0.9)] rounded-l-xl"
                    >
                        <ChevronRight size={48} className="text-white drop-shadow-[0_0_10px_rgba(229,9,20,0.5)]" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default HorizontalScroll;
