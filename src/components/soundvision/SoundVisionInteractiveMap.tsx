import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
    Loader2,
    Search,
    ArrowLeft,
    Download,
    Star as StarIcon,
    MapPin,
    User,
    Calendar,
    RefreshCw,
    AlertCircle,
    Filter,
    X,
    ChevronUp,
    ChevronDown,
    MoreVertical,
    Upload,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useSoundVisionFiles, useDownloadSoundVisionFile, SoundVisionFile } from '@/hooks/useSoundVisionFiles';
import { StarRating } from '@/components/soundvision/StarRating';
import { SoundVisionReviewDialog } from '@/components/soundvision/SoundVisionReviewDialog';
import { SoundVisionFileUploader } from '@/components/soundvision/SoundVisionFileUploader';
import { useVenues } from '@/hooks/useVenues';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Map as MapboxMap, Marker as MapboxMarker } from 'mapbox-gl';
import { Theme } from '@/components/technician/types';

export interface SoundVisionInteractiveMapProps {
    theme: Theme;
    isDark: boolean;
    onClose?: () => void;
}

interface VenueGroup {
    venue: NonNullable<SoundVisionFile['venue']>;
    fileCount: number;
    ratingsCount: number;
    ratingTotal: number;
}

interface ContextMenuData {
    x: number;
    y: number;
    venueName: string;
    files: SoundVisionFile[];
}

export const SoundVisionInteractiveMap = ({ theme, isDark, onClose }: SoundVisionInteractiveMapProps) => {
    const queryClient = useQueryClient();
    const [drawerHeight, setDrawerHeight] = useState<'collapsed' | 'half' | 'full'>('half');
    const [uploadOpen, setUploadOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('');
    const [stateRegion, setStateRegion] = useState('');
    const [fileType, setFileType] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedFile, setSelectedFile] = useState<SoundVisionFile | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);

    // Map state
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapboxglRef = useRef<any>(null);
    const map = useRef<MapboxMap | null>(null);
    const markers = useRef<MapboxMarker[]>([]);
    const [mapLoading, setMapLoading] = useState(true);
    const [mapError, setMapError] = useState<string | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);

    // Get current user profile for permissions
    const { data: profile } = useQuery({
        queryKey: ['current-user-profile'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;
            const { data } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();
            return data;
        },
    });

    // Fetch SoundVision files using the proper hook
    const { data: files = [], isLoading, refetch } = useSoundVisionFiles({
        searchTerm: searchTerm || undefined,
        city: city && city !== 'all' ? city : undefined,
        country: country && country !== 'all' ? country : undefined,
        stateRegion: stateRegion && stateRegion !== 'all' ? stateRegion : undefined,
        fileType: fileType && fileType !== 'all' ? fileType : undefined,
    });

    const downloadFile = useDownloadSoundVisionFile();

    // Get venues for filter dropdowns
    const { data: venues } = useVenues();
    const cities = [...new Set(venues?.map((v) => v.city).filter(Boolean))].sort();
    const countries = [...new Set(venues?.map((v) => v.country).filter(Boolean))].sort();
    const stateRegions = [...new Set(venues?.map((v) => v.state_region).filter(Boolean))].sort();

    const hasActiveFilters = city || country || stateRegion || fileType || searchTerm;
    const isManagement = profile?.role === 'admin' || profile?.role === 'management';

    const canOpenReviews = (file: SoundVisionFile) =>
        isManagement || file.hasDownloaded || file.hasReviewed;

    const handleClearFilters = () => {
        setSearchTerm('');
        setCity('');
        setCountry('');
        setStateRegion('');
        setFileType('');
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await refetch();
        } finally {
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };

    // Close context menu on global click/map move
    useEffect(() => {
        const closeMenu = () => setContextMenu(null);
        window.addEventListener('click', closeMenu);
        window.addEventListener('resize', closeMenu);
        return () => {
            window.removeEventListener('click', closeMenu);
            window.removeEventListener('resize', closeMenu);
        };
    }, []);

    // Update selected file when files change
    useEffect(() => {
        if (!selectedFile) return;
        const updated = files.find((file) => file.id === selectedFile.id);
        if (updated && updated !== selectedFile) {
            setSelectedFile(updated);
        }
    }, [files, selectedFile]);

    // Initialize Mapbox
    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        let isMounted = true;

        const initMap = async () => {
            try {
                setMapLoading(true);
                setMapError(null);

                const { data, error: tokenError } = await supabase.functions.invoke('get-mapbox-token');

                if (tokenError) {
                    throw new Error(`Error al obtener el token de Mapbox: ${tokenError.message}`);
                }

                if (!data?.token) {
                    throw new Error('No se encontró el token de Mapbox en la respuesta');
                }

                const [{ default: mapboxgl }] = await Promise.all([
                    import('mapbox-gl'),
                    import('mapbox-gl/dist/mapbox-gl.css'),
                ]);

                if (!isMounted) return;
                mapboxglRef.current = mapboxgl;

                mapboxgl.accessToken = data.token;

                const mapInstance = new mapboxgl.Map({
                    container: mapContainer.current!,
                    style: 'mapbox://styles/mapbox/dark-v11',
                    center: [0, 20],
                    zoom: 1.5,
                    projection: 'globe' as any,
                });

                map.current = mapInstance;

                mapInstance.addControl(
                    new mapboxgl.NavigationControl({ visualizePitch: true }),
                    'top-right'
                );

                mapInstance.on('style.load', () => {
                    mapInstance.setFog({
                        color: 'rgb(10, 10, 20)',
                        'high-color': 'rgb(30, 30, 50)',
                        'horizon-blend': 0.1,
                    });
                });

                mapInstance.on('load', () => {
                    if (!isMounted) return;
                    setMapLoading(false);
                    setMapLoaded(true);
                    mapInstance.resize();
                });

                // Close context menu on map interaction
                mapInstance.on('movestart', () => setContextMenu(null));
                mapInstance.on('click', () => setContextMenu(null));

                mapInstance.on('error', (event) => {
                    if (!isMounted) return;
                    console.error('Mapbox error:', event.error);
                    setMapError('No se pudieron cargar los datos del mapa.');
                    setMapLoading(false);
                });
            } catch (err) {
                if (!isMounted) return;
                console.error('Error initializing map:', err);
                setMapError('No se pudo cargar el mapa. Revisa tu conexión.');
                setMapLoading(false);
            }
        };

        initMap();

        return () => {
            isMounted = false;
            markers.current.forEach((marker) => marker.remove());
            markers.current = [];
            map.current?.remove();
            map.current = null;
            mapboxglRef.current = null;
        };
    }, []);

    // Update markers when files change
    useEffect(() => {
        if (!mapLoaded || !map.current) return;

        const venueMap = new Map<string, VenueGroup>();
        const filesByVenueKey = new Map<string, SoundVisionFile[]>();

        files.forEach((file) => {
            if (!file.venue?.coordinates) return;

            const { lat, lng } = file.venue.coordinates;
            const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;

            // Group files by location key
            if (!filesByVenueKey.has(key)) {
                filesByVenueKey.set(key, []);
            }
            filesByVenueKey.get(key)!.push(file);

            const fileRatingsCount = file.ratings_count ?? 0;
            const fileRatingTotal = file.rating_total ?? 0;

            if (!venueMap.has(key)) {
                venueMap.set(key, {
                    venue: file.venue!,
                    fileCount: 1,
                    ratingsCount: fileRatingsCount,
                    ratingTotal: fileRatingTotal,
                });
            } else {
                const existing = venueMap.get(key)!;
                existing.fileCount++;
                existing.ratingsCount += fileRatingsCount;
                existing.ratingTotal += fileRatingTotal;
            }
        });

        // Clear existing markers
        markers.current.forEach((marker) => marker.remove());
        markers.current = [];

        const mapboxgl = mapboxglRef.current;
        if (!mapboxgl) return;

        const bounds = new mapboxgl.LngLatBounds();

        venueMap.forEach(({ venue, fileCount, ratingsCount, ratingTotal }, key) => {
            if (!venue.coordinates) return;

            const { lat, lng } = venue.coordinates;
            bounds.extend([lng, lat]);

            const el = document.createElement('div');
            el.className = 'custom-marker';
            el.style.width = '28px';
            el.style.height = '28px';
            el.style.borderRadius = '50%';
            el.style.backgroundColor = 'hsl(217, 91%, 60%)';
            el.style.border = '3px solid white';
            el.style.cursor = 'pointer';
            el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.color = 'white';
            el.style.fontSize = '11px';
            el.style.fontWeight = 'bold';
            el.innerHTML = `${fileCount}`;

            // Add right-click listener
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const venueFiles = filesByVenueKey.get(key) || [];

                setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    venueName: venue.name,
                    files: venueFiles
                });
            });

            const averageRating = ratingsCount > 0 ? ratingTotal / ratingsCount : null;
            const ratingLine = ratingsCount > 0
                ? `<p style="font-size: 0.8rem; color: #888; margin-top: 6px;">Valoración: <strong>${averageRating?.toFixed(1)}</strong> ⭐ (${ratingsCount} ${ratingsCount === 1 ? 'reseña' : 'reseñas'})</p>`
                : `<p style="font-size: 0.8rem; color: #888; margin-top: 6px;">Sin reseñas</p>`;

            const popupContent = `
        <div style="padding: 8px; min-width: 180px; color: #fff; background: #1a1a2e; border-radius: 8px;">
          <h3 style="font-weight: bold; margin-bottom: 4px; font-size: 0.95rem;">${venue.name}</h3>
          <p style="font-size: 0.8rem; color: #888; margin-bottom: 8px;">
            ${[venue.city, venue.state_region, venue.country].filter(Boolean).join(', ')}
          </p>
          <p style="font-size: 0.8rem; color: #888;">
            <strong>${fileCount}</strong> ${fileCount === 1 ? 'archivo' : 'archivos'}
          </p>
          ${ratingLine}
          <p style="font-size: 0.7rem; color: #666; margin-top: 8px; font-style: italic;">
            Click derecho para opciones
          </p>
        </div>
      `;

            const popup = new mapboxgl.Popup({
                offset: 25,
                closeButton: true,
                closeOnClick: false,
                className: 'soundvision-popup',
            }).setHTML(popupContent);

            const marker = new mapboxgl.Marker(el)
                .setLngLat([lng, lat])
                .setPopup(popup)
                .addTo(map.current!);

            markers.current.push(marker);
        });

        if (!bounds.isEmpty() && venueMap.size > 0) {
            map.current!.fitBounds(bounds, { padding: 80, maxZoom: 12, duration: 800 });
        }
    }, [files, mapLoaded]);

    const filesWithCoordinates = files.filter((f) => f.venue?.coordinates);
    const filesWithoutCoordinates = files.length - filesWithCoordinates.length;

    const getDrawerStyle = () => {
        switch (drawerHeight) {
            case 'collapsed':
                return { height: '80px' };
            case 'half':
                return { height: '55%' };
            case 'full':
                return { height: 'calc(100% - 60px)' };
        }
    };

    const cycleDrawerHeight = () => {
        if (drawerHeight === 'collapsed') setDrawerHeight('half');
        else if (drawerHeight === 'half') setDrawerHeight('full');
        else setDrawerHeight('collapsed');
    };

    const handleUploadComplete = async () => {
        // Refresh file list + venues so filters/markers update.
        await queryClient.invalidateQueries({ queryKey: ['soundvision-files'] });
        await queryClient.invalidateQueries({ queryKey: ['venues'] });
        await refetch();
        setUploadOpen(false);
    };

    return (
        <div className="relative w-full h-full bg-black overflow-hidden">
            {/* Map Layer */}
            <div className="absolute inset-0">
                {mapLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            <span className="text-sm text-gray-400">Cargando mapa...</span>
                        </div>
                    </div>
                )}
                {mapError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                        <div className="text-center p-6">
                            <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
                            <p className="text-red-400 font-medium mb-2">Error del mapa</p>
                            <p className="text-sm text-gray-500">{mapError}</p>
                        </div>
                    </div>
                )}
                <div ref={mapContainer} className="h-full w-full" />

                {/* Back button - Only show if onClose provided */}
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Volver"
                        className="absolute top-6 left-6 z-20 p-3 bg-black/60 text-white rounded-full backdrop-blur-md border border-white/10 hover:bg-black/80 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}

                {/* File count badge */}
                {!mapLoading && !mapError && (
                    <div className="absolute top-6 right-6 z-20 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10">
                        <span className="text-white text-sm font-medium">
                            {filesWithCoordinates.length} {filesWithCoordinates.length === 1 ? 'ubicación' : 'ubicaciones'}
                        </span>
                    </div>
                )}

                {/* Upload button (available to anyone with SoundVision access; access is enforced upstream) */}
                {!mapLoading && !mapError && (
                    <button
                        type="button"
                        onClick={() => setUploadOpen(true)}
                        aria-label="Subir archivo"
                        className="absolute top-20 right-6 z-20 p-3 bg-black/60 text-white rounded-full backdrop-blur-md border border-white/10 hover:bg-black/80 transition-colors"
                        title="Subir nuevo archivo"
                    >
                        <Upload size={20} />
                    </button>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className={`fixed z-50 min-w-[280px] max-w-[320px] rounded-lg shadow-xl overflow-hidden border ${theme.divider} ${isDark ? 'bg-[#1a1a2e]' : 'bg-white'}`}
                    style={{
                        left: Math.min(contextMenu.x, window.innerWidth - 320),
                        top: Math.min(contextMenu.y, window.innerHeight - (contextMenu.files.length * 60 + 50))
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className={`p-3 border-b ${theme.divider} ${isDark ? 'bg-black/20' : 'bg-slate-50'}`}>
                        <h3 className={`font-semibold text-sm ${theme.textMain}`}>{contextMenu.venueName}</h3>
                        <p className={`text-xs ${theme.textMuted}`}>{contextMenu.files.length} archivos disponibles</p>
                    </div>
                    <ScrollArea className="max-h-[300px]">
                        <div className="p-1">
                            {contextMenu.files.map(file => (
                                <div key={file.id} className={`p-2 hover:${isDark ? 'bg-white/5' : 'bg-slate-50'} rounded flex items-center justify-between gap-3 group transition-colors`}>
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-sm font-medium truncate ${theme.textMain}`}>{file.file_name}</p>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <StarIcon size={10} className={file.average_rating ? "text-yellow-500 fill-yellow-500" : theme.textMuted} />
                                            <span className={`text-xs ${theme.textMuted}`}>
                                                {file.average_rating ? file.average_rating.toFixed(1) : '-'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-blue-500 hover:text-blue-400 hover:bg-blue-500/10"
                                            onClick={() => downloadFile.mutate(file)}
                                            title="Descargar"
                                        >
                                            <Download size={14} />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className={`h-8 w-8 ${file.hasReviewed ? 'text-yellow-500 hover:text-yellow-400' : theme.textMuted} hover:bg-yellow-500/10`}
                                            onClick={() => {
                                                setSelectedFile(file);
                                                setContextMenu(null);
                                            }}
                                            disabled={!canOpenReviews(file)}
                                            title={canOpenReviews(file) ? "Reseñas" : "Descarga para reseñar"}
                                        >
                                            <StarIcon size={14} />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            )}

            {/* Drawer */}
            <div
                className={`absolute bottom-0 w-full ${isDark ? 'bg-[#0f1219]' : 'bg-white'} border-t ${theme.divider} rounded-t-3xl shadow-2xl flex flex-col transition-all duration-500 z-30`}
                style={getDrawerStyle()}
            >
                {/* Drawer handle */}
                <div
                    onClick={cycleDrawerHeight}
                    className="w-full h-8 flex items-center justify-center cursor-pointer shrink-0"
                >
                    <div className="flex items-center gap-2">
                        <div className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-gray-600' : 'bg-slate-300'}`} />
                        {drawerHeight === 'collapsed' ? (
                            <ChevronUp size={16} className={theme.textMuted} />
                        ) : drawerHeight === 'full' ? (
                            <ChevronDown size={16} className={theme.textMuted} />
                        ) : null}
                    </div>
                </div>

                {/* Header */}
                <div className={`px-4 pb-3 border-b ${theme.divider} shrink-0`}>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className={`text-xl font-bold ${theme.textMain}`}>SoundVision DB</h2>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                                className={showFilters ? 'bg-blue-500/20 text-blue-400' : ''}
                            >
                                <Filter size={16} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                            >
                                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                            </Button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className={`absolute left-3 top-3 ${theme.textMuted}`} size={16} />
                        <Input
                            type="text"
                            placeholder="Buscar recinto o archivo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full rounded-xl py-3 pl-10 pr-4 text-sm ${theme.input} h-11`}
                        />
                    </div>

                    {/* Filters */}
                    {showFilters && (
                        <div className="mt-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <Select value={fileType} onValueChange={setFileType}>
                                    <SelectTrigger className={`text-xs ${theme.input}`}>
                                        <SelectValue placeholder="Tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los tipos</SelectItem>
                                        <SelectItem value=".xmlp">.xmlp (Proyecto)</SelectItem>
                                        <SelectItem value=".xmls">.xmls (Escena)</SelectItem>
                                        <SelectItem value=".xmlc">.xmlc (Config)</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select value={city} onValueChange={setCity}>
                                    <SelectTrigger className={`text-xs ${theme.input}`}>
                                        <SelectValue placeholder="Ciudad" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas las ciudades</SelectItem>
                                        {cities.map((c) => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={country} onValueChange={setCountry}>
                                    <SelectTrigger className={`text-xs ${theme.input}`}>
                                        <SelectValue placeholder="País" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los países</SelectItem>
                                        {countries.map((c) => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={stateRegion} onValueChange={setStateRegion}>
                                    <SelectTrigger className={`text-xs ${theme.input}`}>
                                        <SelectValue placeholder="Región" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas las regiones</SelectItem>
                                        {stateRegions.map((s) => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {hasActiveFilters && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClearFilters}
                                    className="w-full text-xs"
                                >
                                    <X size={14} className="mr-1" />
                                    Limpiar filtros
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Info about files without coordinates */}
                    {filesWithoutCoordinates > 0 && (
                        <div className={`mt-2 flex items-center gap-2 text-xs ${theme.textMuted}`}>
                            <AlertCircle size={12} />
                            <span>
                                {filesWithoutCoordinates} {filesWithoutCoordinates === 1 ? 'archivo sin' : 'archivos sin'} coordenadas
                            </span>
                        </div>
                    )}
                </div>

                {/* File List */}
                <ScrollArea className="flex-1 p-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                        </div>
                    ) : files.length === 0 ? (
                        <div className={`text-center py-8 ${theme.textMuted}`}>
                            <p className="text-lg mb-2">No se encontraron archivos</p>
                            <p className="text-sm">Intenta ajustar los filtros</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {files.map((file) => (
                                <div
                                    key={file.id}
                                    className={`p-4 rounded-2xl border ${theme.divider} ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}
                                >
                                    {/* File header */}
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className={`font-semibold truncate ${theme.textMain}`}>
                                                    {file.venue?.name || 'Sin recinto'}
                                                </p>
                                                {!file.venue?.coordinates && (
                                                    <AlertCircle size={14} className={theme.textMuted} />
                                                )}
                                            </div>
                                            <p className={`text-xs mt-1 truncate ${theme.textMuted}`}>
                                                {file.file_name}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <StarRating value={file.average_rating ?? 0} readOnly size="sm" />
                                            {file.ratings_count > 0 && (
                                                <span className={`text-xs ${theme.textMuted}`}>
                                                    ({file.ratings_count})
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* File details */}
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div className={`flex items-center gap-2 text-xs ${theme.textMuted}`}>
                                            <MapPin size={12} />
                                            <span className="truncate">
                                                {file.venue?.city}, {file.venue?.country}
                                            </span>
                                        </div>
                                        <div className={`flex items-center gap-2 text-xs ${theme.textMuted}`}>
                                            <User size={12} />
                                            <span className="truncate">
                                                {file.uploader?.first_name} {file.uploader?.last_name}
                                            </span>
                                        </div>
                                        <div className={`flex items-center gap-2 text-xs ${theme.textMuted} col-span-2`}>
                                            <Calendar size={12} />
                                            <span>
                                                {formatDistanceToNow(new Date(file.uploaded_at), {
                                                    addSuffix: true,
                                                    locale: es,
                                                })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* User's review indicator */}
                                    {file.hasReviewed && file.current_user_review && (
                                        <div className="mb-3 text-xs text-emerald-500 font-medium">
                                            Tu valoración: {file.current_user_review.rating} ⭐
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant={file.hasReviewed ? 'secondary' : 'outline'}
                                            onClick={() => setSelectedFile(file)}
                                            disabled={!canOpenReviews(file)}
                                            className="flex-1 text-xs"
                                        >
                                            <StarIcon size={14} className="mr-1" />
                                            Reseñas
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => downloadFile.mutate(file)}
                                            disabled={downloadFile.isPending}
                                            className="flex-1 text-xs"
                                        >
                                            <Download size={14} className="mr-1" />
                                            Descargar
                                        </Button>
                                    </div>

                                    {/* Download hint */}
                                    {!canOpenReviews(file) && (
                                        <p className={`mt-2 text-xs ${theme.textMuted}`}>
                                            Descarga el archivo para dejar una reseña
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Upload Dialog */}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent
                    className={`w-[95vw] max-w-3xl ${isDark ? 'bg-[#0f1219] border-[#1f232e]' : 'bg-white'} ${theme.textMain}`}
                >
                    <DialogHeader>
                        <DialogTitle>Subir nuevo archivo SoundVision</DialogTitle>
                        <DialogDescription>
                            Añade un archivo a la base de datos. Se asociará al recinto que indiques.
                        </DialogDescription>
                    </DialogHeader>
                    <SoundVisionFileUploader onUploadComplete={handleUploadComplete} />
                </DialogContent>
            </Dialog>

            {/* Review Dialog */}
            {selectedFile && (
                <SoundVisionReviewDialog
                    file={selectedFile}
                    open={Boolean(selectedFile)}
                    onOpenChange={(open) => {
                        if (!open) setSelectedFile(null);
                    }}
                    currentUserRole={profile?.role ?? null}
                />
            )}

            {/* Mapbox popup styles */}
            <style>{`
        .soundvision-popup .mapboxgl-popup-content {
          background: transparent;
          padding: 0;
          box-shadow: none;
        }
        .soundvision-popup .mapboxgl-popup-close-button {
          color: white;
          font-size: 18px;
          right: 8px;
          top: 4px;
        }
        .soundvision-popup .mapboxgl-popup-tip {
          border-top-color: #1a1a2e;
        }
      `}</style>
        </div>
    );
};
