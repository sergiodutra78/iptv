import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Tv, Film, PlayCircle, Heart, Settings as SettingsIcon, Search, User, Play, Info, Bell, X, Minus, Square } from 'lucide-react';
import LiveTV from './pages/LiveTV';
import Settings from './pages/Settings';
import Movies from './pages/Movies';
import Series from './pages/Series';
import MovieCard from './components/MovieCard';
import CachedImage from './components/CachedImage';
import { type Channel } from './services/m3uParser';
import { getActivePlaylistUrl } from './config/iptv';
import VideoPlayer from './components/VideoPlayer';
import { DataService } from './services/dataService';
import HorizontalScroll from './components/HorizontalScroll';

// Custom TitleBar for Windows Electron
const TitleBar = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () => document.removeEventListener('fullscreenchange', handleFullscreen);
  }, []);

  if (isFullscreen) return null;

  return (
    <div className="h-8 bg-black flex items-center justify-between px-4 select-none z-[100] border-b border-zinc-900/50" style={{ WebkitAppRegion: 'drag' } as any}>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-sm bg-primary flex items-center justify-center">
          <span className="text-[10px] font-black text-white italic">K</span>
        </div>
        <span className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">KinetiQ Premium IPTV</span>
      </div>
      <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          onClick={() => (window as any).electronAPI?.windowMinimize()}
          className="h-full px-4 hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-white"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => (window as any).electronAPI?.windowMaximize()}
          className="h-full px-4 hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-white"
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => (window as any).electronAPI?.windowClose()}
          className="h-full px-4 hover:bg-red-600 transition-colors text-zinc-500 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

// Logo Component
const Logo = ({ size = "md", animate = false }: { size?: "sm" | "md" | "lg", animate?: boolean }) => {
  const isLarge = size === "lg";
  const isSmall = size === "sm";

  return (
    <div className={`flex items-center ${isLarge ? 'flex-col gap-6' : 'gap-3'}`}>
      <div className={`relative group ${animate ? 'animate-netflix-intro' : ''}`}>
        <div className={`absolute -inset-1 bg-gradient-to-r from-primary to-red-600 rounded-lg blur opacity-25 ${isLarge ? 'opacity-50' : ''} group-hover:opacity-100 transition duration-1000 group-hover:duration-200`}></div>
        <div className={`relative ${isLarge ? 'w-32 h-32 text-6xl' : isSmall ? 'w-8 h-8 text-lg' : 'w-10 h-10 text-xl'} bg-black border border-zinc-800 rounded-lg flex items-center justify-center font-black text-primary tracking-tighter shadow-2xl overflow-hidden`}>
          <span className={animate ? 'animate-pulse' : ''}>K</span>
          {animate && (
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent animate-scan-line"></div>
          )}
        </div>
      </div>
      <div className={`${isSmall ? 'flex' : 'hidden lg:flex'} flex-col ${isLarge ? 'items-center text-center' : ''}`}>
        <span className={`${isLarge ? 'text-6xl animate-fade-in-up' : 'text-xl'} font-black tracking-tighter italic leading-none text-white`}>KINETIQ</span>
        <span className={`${isLarge ? 'text-sm' : 'text-[10px]'} font-bold tracking-[0.4em] text-primary uppercase leading-tight mt-1 ${isLarge ? 'animate-fade-in-up' : ''}`} style={{ animationDelay: '200ms' }}>PREMIUM IPTV</span>
      </div>
    </div>
  );
};

const SplashLoading = ({ progress }: { progress: number }) => (
  <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-10 overflow-hidden text-center">
    {/* Animated Background Gradients */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 blur-[150px] rounded-full animate-pulse"></div>
    <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-primary/10 blur-[100px] rounded-full"></div>
    <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary/5 blur-[100px] rounded-full"></div>

    <div className="relative flex flex-col items-center gap-16 max-w-md w-full z-10">
      <Logo size="lg" animate={true} />

      <div className="w-full flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-end">
            <span className="text-[10px] font-black tracking-[0.3em] text-zinc-500 uppercase">
              {progress < 30 ? 'Iniciando servicios...' : progress < 70 ? 'Sincronizando biblioteca...' : progress < 100 ? 'Finalizando configuración...' : '¡Listo para disfrutar!'}
            </span>
            <span className="text-xl font-black text-primary italic tracking-tighter">{progress}%</span>
          </div>
          <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden p-[1px]">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out shadow-[0_0_20px_rgba(229,9,20,0.6)]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[12px] text-white font-black italic tracking-tight uppercase">
            Experiencia Cinematográfica Premium
          </p>
          <p className="text-[9px] text-zinc-600 font-bold tracking-widest uppercase">
            Cargando canales, películas y series
          </p>
        </div>
      </div>
    </div>
  </div>
);

// components
const Sidebar = () => {
  const location = useLocation();

  const menuItems = [
    { icon: <Home size={22} />, label: 'Inicio', path: '/' },
    { icon: <Tv size={22} />, label: 'TV en Vivo', path: '/tv' },
    { icon: <Film size={22} />, label: 'Películas', path: '/movies' },
    { icon: <PlayCircle size={22} />, label: 'Series', path: '/series' },
    { icon: <Heart size={22} />, label: 'Favoritos', path: '/favorites' },
    { icon: <SettingsIcon size={22} />, label: 'Ajustes', path: '/settings' },
  ];

  return (
    <div className="w-20 lg:w-72 bg-black h-screen border-r border-zinc-900 flex flex-col transition-all duration-300 z-30">
      <div className="p-8 hover:scale-105 transition-transform cursor-pointer">
        <Logo />
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group ${isActive
                ? 'bg-primary/15 text-white shadow-[inset_0_0_20px_rgba(229,9,20,0.1)] border border-primary/20'
                : 'text-zinc-500 hover:text-white hover:bg-zinc-900/50'
                }`}
            >
              <div className={`${isActive ? 'text-primary' : 'group-hover:text-white transition-colors'}`}>
                {item.icon}
              </div>
              <span className={`hidden lg:block font-bold text-sm tracking-wide ${isActive ? 'text-white' : ''}`}>{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(229,9,20,0.8)] hidden lg:block"></div>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-6 border-t border-zinc-900 mx-4 mb-4">
        <div className="bg-zinc-900/50 rounded-2xl p-4 flex items-center gap-3 border border-zinc-800/50">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center border border-zinc-700 overflow-hidden">
            <User size={20} className="text-zinc-400" />
          </div>
          <div className="hidden lg:block overflow-hidden">
            <p className="text-xs font-bold text-white truncate">Sergio Dutra</p>
            <p className="text-[10px] text-primary font-bold uppercase tracking-tighter">Plan Premium</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    const mainContainer = document.querySelector('.main-content-area');
    const handleScroll = () => {
      setScrolled((mainContainer?.scrollTop || 0) > 20);
    };
    mainContainer?.addEventListener('scroll', handleScroll);
    return () => mainContainer?.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`h-20 flex items-center justify-between px-10 sticky top-0 z-40 transition-all duration-500 ${scrolled ? 'bg-black/95 backdrop-blur-xl border-b border-zinc-900 shadow-2xl' : 'bg-gradient-to-b from-black/80 to-transparent'}`}>
      <div className="flex-1 max-w-2xl">
        <div className={`relative group flex items-center transition-all duration-500 ${isSearchFocused ? 'w-full' : 'w-72'}`}>
          <Search className={`absolute left-4 z-10 transition-colors duration-300 ${isSearchFocused ? 'text-primary' : 'text-zinc-500'}`} size={18} />
          <input
            type="text"
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Películas, series, canales..."
            className={`w-full bg-zinc-900/40 hover:bg-zinc-900/60 h-11 pl-12 pr-6 rounded-full border border-zinc-800/50 focus:border-primary/50 focus:bg-zinc-900/80 focus:outline-none transition-all placeholder:text-zinc-600 text-sm font-bold tracking-tight shadow-inner`}
          />
          {isSearchFocused && (
            <div className="absolute right-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest animate-pulse">
              Presiona Enter
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="hidden md:flex items-center gap-6 text-zinc-400">
          <button className="hover:text-white transition-all transform hover:scale-110 relative group">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-black group-hover:animate-ping"></span>
          </button>
          <Link to="/settings" className="hover:text-white transition-all transform hover:scale-110">
            <SettingsIcon size={20} />
          </Link>
        </div>

        <div className="flex items-center gap-4 bg-zinc-900/40 p-1.5 pr-4 rounded-full border border-zinc-800/50 hover:bg-zinc-800/60 transition-all cursor-pointer group">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary via-red-800 to-black p-[2px] shadow-lg group-hover:shadow-primary/20 transition-all">
            <div className="w-full h-full bg-black rounded-full flex items-center justify-center overflow-hidden border border-white/5">
              <User size={18} className="text-zinc-400 group-hover:text-white transition-colors" />
            </div>
          </div>
          <div className="hidden lg:block text-right">
            <p className="text-[11px] font-black tracking-wider text-white uppercase group-hover:text-primary transition-colors">Sergio Dutra</p>
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[9px] font-black text-primary tracking-[0.2em] uppercase">Live Server</span>
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_5px_rgba(229,9,20,0.8)]"></div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

const Inicio = () => {
  const navigate = useNavigate();
  const [heroMovie, setHeroMovie] = useState<Channel | null>(null);
  const [recentMovies, setRecentMovies] = useState<Channel[]>([]);
  const [recentSeries, setRecentSeries] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Channel | null>(null);

  useEffect(() => {
    const initContent = () => {
      if (DataService.hasData()) {
        const movies = DataService.getMoviesSync();
        // Categorización de películas
        const priorityCategories = ['ultimos titulos', 'ultimos titulo', 'estrenos', 'recien agregadas', 'peliculas 2024', 'peliculas 2025'];
        const priorityMovies = movies.filter(m =>
          priorityCategories.some(cat => m.group.toLowerCase().includes(cat))
        );
        const otherMovies = movies.filter(m =>
          !priorityCategories.some(cat => m.group.toLowerCase().includes(cat))
        );

        const allRecentMovies = [...priorityMovies, ...otherMovies.reverse()].slice(0, 50);
        setRecentMovies(allRecentMovies);

        // Usamos los datos agrupados de series de DataService
        const groupedSeriesList = DataService.getGroupedSeriesSync();
        const recentGroups = [...groupedSeriesList].reverse().slice(0, 50);
        setRecentSeries(recentGroups as any);

        // Logic for Hero Recommendation
        if (allRecentMovies.length > 0) {
          const top10 = allRecentMovies.slice(0, 10);
          let history: string[] = [];
          try {
            history = JSON.parse(localStorage.getItem('kinetiq_recommendation_history') || '[]');
          } catch (e) {
            console.error('Error reading recommendation history', e);
          }

          let selectedHero = top10.find(m => !history.includes(m.id));
          if (!selectedHero) {
            // All top 10 have been recommended recently, reset history and pick the first
            selectedHero = top10[0];
            history = [];
          }

          setHeroMovie(selectedHero);

          // Update history
          history.push(selectedHero.id);
          // Keep only the last 10 entries
          if (history.length > 10) {
            history = history.slice(history.length - 10);
          }
          localStorage.setItem('kinetiq_recommendation_history', JSON.stringify(history));
        }

        setLoading(false);
      }
    };

    const loadData = async () => {
      if (DataService.hasData()) {
        initContent();
        return;
      }

      setLoading(true);
      const url = getActivePlaylistUrl() || "/uruguay.m3u";
      try {
        await DataService.getChannels(url);
        initContent();
      } catch (err) {
        console.error("Error loading home data", err);
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (selectedItem) {
    return (
      <div className="absolute inset-0 z-50 bg-black">
        <VideoPlayer url={selectedItem.url} type={selectedItem.type} onClose={() => setSelectedItem(null)} />
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Featured Hero Section */}
      <section className="relative h-[60vh] px-10 flex flex-col justify-center overflow-hidden mb-10">
        <div className="absolute inset-0 bg-black">
          {heroMovie && heroMovie.logo && (
            <>
              {/* Blurred background to fill the hero area gracefully */}
              <div
                className="absolute inset-0 opacity-20 blur-3xl scale-125"
                style={{
                  backgroundImage: `url(${heroMovie.logo})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center 20%'
                }}
              />
              {/* Gradients to blend smoothly with text and background */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent z-10 w-full md:w-3/4"></div>

              {/* Sharp poster aligned to the right side, maintaining its real aspect ratio */}
              <div className="absolute inset-0 z-10 flex justify-end items-center pr-10 lg:pr-24 pointer-events-none hidden md:flex">
                <div className="h-[80%] aspect-[2/3] relative z-20 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 pointer-events-auto transform transition-transform duration-700 hover:scale-105">
                  <CachedImage
                    src={heroMovie.logo}
                    alt="Featured Poster"
                    className="w-full h-full object-cover bg-zinc-900/50"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative z-20 max-w-2xl">
          <div className="flex items-center gap-2 text-primary font-bold text-xs tracking-[0.3em] uppercase mb-4">
            <Film size={14} /> Recomendación de hoy
          </div>
          <h1 className="text-6xl font-black italic tracking-tighter mb-6 uppercase leading-none">
            {heroMovie ? heroMovie.name : "Tu próxima aventura comienza aquí"}
          </h1>
          <p className="text-zinc-400 text-lg mb-8 line-clamp-3">
            Disfruta de la mejor calidad 4K y sonido envolvente. Explora miles de canales en vivo, películas y series exclusivas solo en KinetiQ Premium.
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => heroMovie && setSelectedItem(heroMovie)}
              className="px-8 py-4 bg-primary text-white font-black rounded-xl hover:scale-105 transition-all shadow-xl shadow-primary/20 flex items-center gap-3 uppercase tracking-wider"
            >
              <Play size={20} fill="currentColor" /> Reproducir
            </button>
            <button className="px-8 py-4 bg-zinc-800/80 backdrop-blur-md text-white font-black rounded-xl hover:bg-zinc-700 transition-all flex items-center gap-3 uppercase tracking-wider">
              <Info size={20} /> Más Info
            </button>
          </div>
        </div>
      </section>

      {/* Movies Row */}
      <section className="mt-12">
        {loading ? (
          <div className="px-10">
            <div className="w-1/3 h-8 bg-zinc-900/50 rounded-lg animate-pulse mb-6"></div>
            <div className="flex items-center gap-4 py-10 overflow-hidden">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="w-[200px] aspect-[2/3] bg-zinc-900/50 animate-pulse rounded-xl"></div>
              ))}
            </div>
          </div>
        ) : (
          <HorizontalScroll title="RECIÉN AGREGADAS (PELÍCULAS)" onViewAll={() => navigate('/movies')}>
            {recentMovies.map(movie => (
              <div key={movie.id + movie.url} className="min-w-[200px] w-[200px] snap-start">
                <MovieCard
                  movie={movie}
                  onClick={(m) => setSelectedItem(m)}
                />
              </div>
            ))}
          </HorizontalScroll>
        )}
      </section>

      {/* Series Row */}
      <section className="mt-12">
        {loading ? (
          <div className="px-10">
            <div className="w-1/3 h-8 bg-zinc-900/50 rounded-lg animate-pulse mb-6"></div>
            <div className="flex items-center gap-4 py-10 overflow-hidden">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="w-[200px] aspect-[2/3] bg-zinc-900/50 animate-pulse rounded-xl"></div>
              ))}
            </div>
          </div>
        ) : (
          <HorizontalScroll title="SERIES TENDENCIA" onViewAll={() => navigate('/series')}>
            {recentSeries.map(item => (
              <div key={item.id + item.url} className="min-w-[200px] w-[200px] snap-start">
                <MovieCard
                  movie={item}
                  onClick={(m) => setSelectedItem(m)}
                />
              </div>
            ))}
          </HorizontalScroll>
        )}
      </section>

      {/* Live TV Section */}
      <section className="px-10 mt-16 space-y-8">
        <h2 className="text-2xl font-black italic tracking-tighter flex items-center gap-3">
          <span className="w-1.5 h-8 bg-primary rounded-full"></span>
          LO MÁS VISTO EN TV
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="aspect-video bg-zinc-900/40 rounded-2xl overflow-hidden relative group cursor-pointer border border-zinc-900/50 hover:border-primary/50 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent flex flex-col justify-end p-6 z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                  <span className="text-[10px] text-primary font-black uppercase tracking-[0.1em]">Deportes • En Vivo</span>
                </div>
                <h3 className="font-black text-xl italic tracking-tight">CANAL {i} PREMIUM</h3>
              </div>
              <div className="absolute top-6 right-6 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="p-3 bg-primary rounded-full shadow-2xl">
                  <Play size={18} fill="white" className="ml-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

function App() {
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const initApp = async () => {
      // Usamos el sistema de caché inteligente de DataService:
      // Se refresca automáticamente cada 24 horas o si la caché falla.
      // Eliminamos el clearCache forzado para mejorar la velocidad al abrir la app.

      const url = getActivePlaylistUrl() || "/uruguay.m3u";
      try {
        // Carga inicial y cacheo
        await DataService.getChannels(url, (p) => setProgress(Math.min(p, 90)));
        setProgress(95);

        // Pequeño delay ampliado para dar tiempo a renderizar la grilla y descargar miniaturas
        setTimeout(() => {
          setProgress(100);
          setTimeout(() => setIsInitialLoading(false), 500);
        }, 2000);
      } catch (err) {
        console.error("Failed to initialize app data", err);
        setIsInitialLoading(false);
      }
    };
    initApp();
  }, []);

  if (isInitialLoading) {
    return <SplashLoading progress={progress} />;
  }

  return (
    <Router>
      <div className="flex flex-col h-screen overflow-hidden bg-black text-white selection:bg-primary/30">
        <TitleBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar main-content-area">
            <Header />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Inicio />} />
                <Route path="/tv" element={<LiveTV />} />
                <Route path="/movies" element={<Movies />} />
                <Route path="/series" element={<Series />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Inicio />} />
              </Routes>
            </main>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
