import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createQueryKey } from '@/lib/optimized-react-query';
import { supabase } from '@/integrations/supabase/client';
import {
    Loader2,
    Search,
    ArrowLeft,
    Download,
    Star as StarIcon,
    RefreshCw,
    AlertCircle,
    Filter,
    X,
    ChevronUp,
    ChevronDown,
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
import type { Map as MapboxMap } from 'mapbox-gl';
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

// (context menu removed; selection is handled via activeVenueId)

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

    // Single-selection state (map + list)
    const [activeVenueId, setActiveVenueId] = useState<string | null>(null);
    const activeVenueIdRef = useRef<string | null>(null);
    const [venueDetailOpen, setVenueDetailOpen] = useState(false);

    // Map state
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapboxglRef = useRef<any>(null);
    const map = useRef<MapboxMap | null>(null);
    const popupRef = useRef<any>(null);
    const manualPopupDismissRef = useRef(false);
    const prevActiveVenueFeatureIdRef = useRef<number | null>(null);
    const programmaticMoveRef = useRef(false);
    const drawerRef = useRef<HTMLDivElement>(null);

    const [mapLoading, setMapLoading] = useState(true);
    const [mapError, setMapError] = useState<string | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [drawerPx, setDrawerPx] = useState(0);

    // Get current user profile for permissions
    const { data: profile } = useQuery({
        queryKey: createQueryKey.profiles.currentUser,
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

    const { venueGroups, venueList, filesByVenueId, venueGeoJson, venueIdToFeatureId } = useMemo(() => {
        const groups = new Map<string, VenueGroup>();
        const byVenueId = new Map<string, SoundVisionFile[]>();

        files.forEach((file) => {
            const venue = file.venue;
            if (!venue?.id || !venue.coordinates) return;

            if (!byVenueId.has(venue.id)) byVenueId.set(venue.id, []);
            byVenueId.get(venue.id)!.push(file);

            const fileRatingsCount = file.ratings_count ?? 0;
            const fileRatingTotal = file.rating_total ?? 0;

            const existing = groups.get(venue.id);
            if (!existing) {
                groups.set(venue.id, {
                    venue,
                    fileCount: 1,
                    ratingsCount: fileRatingsCount,
                    ratingTotal: fileRatingTotal,
                });
            } else {
                existing.fileCount++;
                existing.ratingsCount += fileRatingsCount;
                existing.ratingTotal += fileRatingTotal;
            }
        });

        const list = Array.from(groups.values()).sort((a, b) => {
            // Prefer higher density, then alphabetically
            if (b.fileCount !== a.fileCount) return b.fileCount - a.fileCount;
            return (a.venue.name || '').localeCompare(b.venue.name || '');
        });

        const idMap = new Map<string, number>();
        let nextId = 1;

        const featureCollection = {
            type: 'FeatureCollection',
            features: list
                .filter((g) => g.venue.coordinates)
                .map((g) => {
                    const { lat, lng } = g.venue.coordinates!;
                    const avg = g.ratingsCount > 0 ? g.ratingTotal / g.ratingsCount : null;
                    const featureId = nextId++;
                    idMap.set(g.venue.id, featureId);
                    return {
                        type: 'Feature',
                        id: featureId,
                        properties: {
                            featureId,
                            venueId: g.venue.id,
                            name: g.venue.name,
                            city: g.venue.city,
                            country: g.venue.country,
                            state_region: g.venue.state_region,
                            fileCount: g.fileCount,
                            averageRating: avg,
                            ratingsCount: g.ratingsCount,
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: [lng, lat],
                        },
                    };
                }),
        } as any;

        return {
            venueGroups: groups,
            venueList: list,
            filesByVenueId: byVenueId,
            venueGeoJson: featureCollection,
            venueIdToFeatureId: idMap,
        };
    }, [files]);

    const activeVenueFeatureId = useMemo(() => {
        if (!activeVenueId) return null;
        return venueIdToFeatureId.get(activeVenueId) ?? null;
    }, [activeVenueId, venueIdToFeatureId]);

    const activeVenueGroup = useMemo(() => {
        if (!activeVenueId) return null;
        return venueGroups.get(activeVenueId) ?? null;
    }, [activeVenueId, venueGroups]);

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

    // Keep drawer height in px for map padding calculations
    useEffect(() => {
        const update = () => {
            const rect = drawerRef.current?.getBoundingClientRect();
            setDrawerPx(rect?.height ?? 0);
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [drawerHeight, isLoading, showFilters, venueList.length]);

    // (context menu removed)

    // Keep refs in sync
    useEffect(() => {
        activeVenueIdRef.current = activeVenueId;
    }, [activeVenueId]);

    // Update selected file when files change
    useEffect(() => {
        if (!selectedFile) return;
        const updated = files.find((file) => file.id === selectedFile.id);
        if (updated && updated !== selectedFile) {
            setSelectedFile(updated);
        }
    }, [files, selectedFile]);

    const closePopup = useCallback((opts?: { preserveSelection?: boolean }) => {
        if (opts?.preserveSelection) {
            manualPopupDismissRef.current = true;
        }
        try {
            popupRef.current?.remove?.();
        } catch {
            // ignore
        }
        popupRef.current = null;
        // Allow the popup close handler to run normally next time
        if (opts?.preserveSelection) {
            setTimeout(() => {
                manualPopupDismissRef.current = false;
            }, 0);
        }
    }, []);

    const centerOn = useCallback(
        (lng: number, lat: number) => {
            if (!map.current) return;
            programmaticMoveRef.current = true;
            map.current.easeTo({
                center: [lng, lat],
                duration: 250,
                padding: {
                    top: 90,
                    bottom: Math.min(drawerPx + 30, window.innerHeight * 0.85),
                    left: 30,
                    right: 30,
                },
            });
        },
        [drawerPx]
    );

    const openVenuePopup = useCallback(
        (venueId: string, lng: number, lat: number) => {
            const mapboxgl = mapboxglRef.current;
            const mapInstance = map.current;
            const group = venueGroups.get(venueId);
            if (!mapboxgl || !mapInstance || !group) return;

            closePopup();

            const avg = group.ratingsCount > 0 ? group.ratingTotal / group.ratingsCount : null;

            const container = document.createElement('div');
            container.style.padding = '10px';
            container.style.minWidth = '220px';
            container.style.color = '#fff';
            container.style.background = '#1a1a2e';
            container.style.borderRadius = '10px';

            const title = document.createElement('div');
            title.textContent = group.venue.name;
            title.style.fontWeight = '700';
            title.style.fontSize = '14px';
            title.style.marginBottom = '4px';

            const subtitle = document.createElement('div');
            subtitle.textContent = [group.venue.city, group.venue.state_region, group.venue.country]
                .filter(Boolean)
                .join(', ');
            subtitle.style.fontSize = '12px';
            subtitle.style.color = '#9ca3af';
            subtitle.style.marginBottom = '10px';

            const meta = document.createElement('div');
            meta.style.display = 'flex';
            meta.style.justifyContent = 'space-between';
            meta.style.gap = '10px';
            meta.style.fontSize = '12px';
            meta.style.color = '#cbd5e1';

            const filesEl = document.createElement('div');
            filesEl.textContent = `${group.fileCount} ${group.fileCount === 1 ? 'archivo' : 'archivos'}`;

            const ratingEl = document.createElement('div');
            ratingEl.textContent = avg != null ? `${avg.toFixed(1)} ⭐ (${group.ratingsCount})` : 'Sin reseñas';

            meta.appendChild(filesEl);
            meta.appendChild(ratingEl);

            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '8px';
            actions.style.marginTop = '12px';

            const openBtn = document.createElement('button');
            openBtn.textContent = 'Abrir';
            openBtn.style.flex = '1';
            openBtn.style.background = '#2563eb';
            openBtn.style.color = '#fff';
            openBtn.style.border = '0';
            openBtn.style.borderRadius = '8px';
            openBtn.style.padding = '8px 10px';
            openBtn.style.cursor = 'pointer';
            openBtn.onclick = () => {
                setVenueDetailOpen(true);
            };

            const navBtn = document.createElement('button');
            navBtn.textContent = 'Navegar';
            navBtn.style.flex = '1';
            navBtn.style.background = 'rgba(255,255,255,0.08)';
            navBtn.style.color = '#fff';
            navBtn.style.border = '1px solid rgba(255,255,255,0.12)';
            navBtn.style.borderRadius = '8px';
            navBtn.style.padding = '8px 10px';
            navBtn.style.cursor = 'pointer';
            navBtn.onclick = () => {
                const url = `https://www.google.com/maps?q=${lat},${lng}`;
                window.open(url, '_blank', 'noopener,noreferrer');
            };

            actions.appendChild(openBtn);
            actions.appendChild(navBtn);

            container.appendChild(title);
            container.appendChild(subtitle);
            container.appendChild(meta);
            container.appendChild(actions);

            const popup = new mapboxgl.Popup({
                offset: 20,
                closeButton: true,
                closeOnClick: false,
                className: 'soundvision-popup',
            })
                .setLngLat([lng, lat])
                .setDOMContent(container)
                .addTo(mapInstance);

            popup.on('close', () => {
                if (manualPopupDismissRef.current) return;
                setActiveVenueId(null);
            });

            popupRef.current = popup;
        },
        [closePopup, venueGroups]
    );

    const toggleVenueSelection = useCallback(
        (venueId: string, lng: number, lat: number, opts?: { openPopup?: boolean }) => {
            const openPopup = opts?.openPopup ?? true;
            const current = activeVenueIdRef.current;
            const next = current === venueId ? null : venueId;

            setActiveVenueId(next);

            if (next) {
                centerOn(lng, lat);
                if (openPopup) openVenuePopup(venueId, lng, lat);
            } else {
                closePopup();
                setVenueDetailOpen(false);
            }
        },
        [centerOn, closePopup, openVenuePopup]
    );

    // Clear selection on filter/search changes
    useEffect(() => {
        setActiveVenueId(null);
        setVenueDetailOpen(false);
        closePopup();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, city, country, stateRegion, fileType]);

    // Ensure detail dialog doesn't stay open without a venue
    useEffect(() => {
        if (venueDetailOpen && !activeVenueGroup) {
            setVenueDetailOpen(false);
        }
    }, [venueDetailOpen, activeVenueGroup]);

    const toggleVenueSelectionRef = useRef(toggleVenueSelection);
    useEffect(() => {
        toggleVenueSelectionRef.current = toggleVenueSelection;
    }, [toggleVenueSelection]);

    // Keep feature-state updated for the active venue
    useEffect(() => {
        if (!mapLoaded || !map.current) return;
        const mapInstance: any = map.current;

        const sourceId = 'soundvision-venues';
        const prev = prevActiveVenueFeatureIdRef.current;
        if (prev != null) {
            try {
                mapInstance.setFeatureState({ source: sourceId, id: prev }, { active: false });
            } catch {
                // ignore
            }
        }

        if (activeVenueFeatureId != null) {
            try {
                mapInstance.setFeatureState({ source: sourceId, id: activeVenueFeatureId }, { active: true });
            } catch {
                // ignore
            }
        }

        prevActiveVenueFeatureIdRef.current = activeVenueFeatureId;
    }, [activeVenueFeatureId, mapLoaded]);

    // Sync map selection -> list scroll
    useEffect(() => {
        if (!activeVenueId) return;
        const el = document.getElementById(`venue-card-${activeVenueId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [activeVenueId]);

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

                // Close popup on manual map pan (keep selection)
                mapInstance.on('movestart', () => {
                    if (programmaticMoveRef.current) return;
                    // Close the visual popup but keep selection
                    closePopup({ preserveSelection: true });
                });
                mapInstance.on('moveend', () => {
                    programmaticMoveRef.current = false;
                });

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
            try {
                popupRef.current?.remove?.();
            } catch {
                // ignore
            }
            popupRef.current = null;
            map.current?.remove();
            map.current = null;
            mapboxglRef.current = null;
        };
    }, []);

    // Venue clustering + marker rendering (Mapbox layers, not DOM markers)
    useEffect(() => {
        if (!mapLoaded || !map.current || !mapboxglRef.current) return;

        const mapInstance: any = map.current;
        const mapboxgl: any = mapboxglRef.current;

        const SOURCE_ID = 'soundvision-venues';
        const LAYER_CLUSTER = 'soundvision-clusters';
        const LAYER_CLUSTER_COUNT = 'soundvision-cluster-count';
        const LAYER_HALO = 'soundvision-venue-halo';
        const LAYER_POINT = 'soundvision-venue-point';
        const LAYER_POINT_COUNT = 'soundvision-venue-point-count';

        const ensureLayers = () => {
            if (mapInstance.getSource(SOURCE_ID)) return;

            mapInstance.addSource(SOURCE_ID, {
                type: 'geojson',
                data: venueGeoJson,
                promoteId: 'featureId',
                cluster: true,
                clusterMaxZoom: 14,
                clusterRadius: 55,
            });

            mapInstance.addLayer({
                id: LAYER_CLUSTER,
                type: 'circle',
                source: SOURCE_ID,
                filter: ['has', 'point_count'],
                paint: {
                    'circle-color': [
                        'step',
                        ['get', 'point_count'],
                        'rgba(37, 99, 235, 0.55)',
                        10,
                        'rgba(37, 99, 235, 0.70)',
                        25,
                        'rgba(37, 99, 235, 0.85)',
                    ],
                    'circle-radius': [
                        'step',
                        ['get', 'point_count'],
                        18,
                        10,
                        24,
                        25,
                        30,
                    ],
                    'circle-stroke-width': 2,
                    'circle-stroke-color': 'rgba(255,255,255,0.65)',
                },
            });

            mapInstance.addLayer({
                id: LAYER_CLUSTER_COUNT,
                type: 'symbol',
                source: SOURCE_ID,
                filter: ['has', 'point_count'],
                layout: {
                    'text-field': ['get', 'point_count_abbreviated'],
                    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                    'text-size': 12,
                },
                paint: {
                    'text-color': '#ffffff',
                },
            });

            // Halo for selected venue (and high-density venues)
            mapInstance.addLayer({
                id: LAYER_HALO,
                type: 'circle',
                source: SOURCE_ID,
                filter: ['!', ['has', 'point_count']],
                paint: {
                    'circle-color': 'rgba(37, 99, 235, 0.30)',
                    'circle-blur': 0.8,
                    'circle-radius': [
                        'case',
                        ['boolean', ['feature-state', 'active'], false],
                        [
                            '+',
                            [
                                'case',
                                ['>=', ['get', 'fileCount'], 6],
                                18,
                                ['>=', ['get', 'fileCount'], 3],
                                14,
                                12,
                            ],
                            10,
                        ],
                        ['>=', ['get', 'fileCount'], 6],
                        26,
                        0,
                    ],
                    'circle-opacity': [
                        'case',
                        ['boolean', ['feature-state', 'active'], false],
                        1,
                        ['>=', ['get', 'fileCount'], 6],
                        0.8,
                        0,
                    ],
                },
            });

            mapInstance.addLayer({
                id: LAYER_POINT,
                type: 'circle',
                source: SOURCE_ID,
                filter: ['!', ['has', 'point_count']],
                paint: {
                    'circle-color': 'hsl(217, 91%, 60%)',
                    'circle-stroke-width': 2.5,
                    'circle-stroke-color': '#ffffff',
                    'circle-radius': [
                        'case',
                        ['>=', ['get', 'fileCount'], 6],
                        ['case', ['boolean', ['feature-state', 'active'], false], 20, 18],
                        ['>=', ['get', 'fileCount'], 3],
                        ['case', ['boolean', ['feature-state', 'active'], false], 16, 14],
                        ['case', ['boolean', ['feature-state', 'active'], false], 13, 11],
                    ],
                },
            });

            mapInstance.addLayer({
                id: LAYER_POINT_COUNT,
                type: 'symbol',
                source: SOURCE_ID,
                filter: ['!', ['has', 'point_count']],
                layout: {
                    'text-field': ['to-string', ['get', 'fileCount']],
                    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                    'text-size': 11,
                },
                paint: {
                    'text-color': '#ffffff',
                },
            });

            // Cluster interaction: zoom into cluster (no popup)
            mapInstance.on('click', LAYER_CLUSTER, (e: any) => {
                const features = mapInstance.queryRenderedFeatures(e.point, {
                    layers: [LAYER_CLUSTER],
                });
                const clusterFeature = features?.[0];
                if (!clusterFeature) return;

                const clusterId = clusterFeature.properties?.cluster_id;
                const source: any = mapInstance.getSource(SOURCE_ID);
                if (!source || clusterId == null) return;

                source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
                    if (err) return;
                    programmaticMoveRef.current = true;
                    mapInstance.easeTo({
                        center: clusterFeature.geometry.coordinates,
                        zoom,
                        duration: 250,
                    });
                });
            });

            // Venue interaction: single selection + popup
            mapInstance.on('click', LAYER_POINT, (e: any) => {
                const feature = e.features?.[0];
                if (!feature) return;
                const venueId = feature.properties?.venueId;
                const coords = feature.geometry?.coordinates;
                if (!venueId || !coords) return;
                const [lng, lat] = coords;
                toggleVenueSelectionRef.current(String(venueId), Number(lng), Number(lat), { openPopup: true });
            });

            mapInstance.on('mouseenter', LAYER_CLUSTER, () => {
                mapInstance.getCanvas().style.cursor = 'pointer';
            });
            mapInstance.on('mouseleave', LAYER_CLUSTER, () => {
                mapInstance.getCanvas().style.cursor = '';
            });
            mapInstance.on('mouseenter', LAYER_POINT, () => {
                mapInstance.getCanvas().style.cursor = 'pointer';
            });
            mapInstance.on('mouseleave', LAYER_POINT, () => {
                mapInstance.getCanvas().style.cursor = '';
            });
        };

        ensureLayers();

        const source: any = mapInstance.getSource(SOURCE_ID);
        if (source?.setData) {
            source.setData(venueGeoJson);
        }

    }, [mapLoaded, venueGeoJson]);

    // Fit bounds for the current dataset (only if nothing is selected)
    useEffect(() => {
        if (!mapLoaded || !map.current || !mapboxglRef.current) return;
        if (activeVenueId) return;
        if (venueList.length === 0) return;

        const mapInstance: any = map.current;
        const mapboxgl: any = mapboxglRef.current;

        const bounds = new mapboxgl.LngLatBounds();
        venueList.forEach((g) => {
            const coords = g.venue.coordinates;
            if (!coords) return;
            bounds.extend([coords.lng, coords.lat]);
        });
        if (bounds.isEmpty()) return;

        programmaticMoveRef.current = true;
        mapInstance.fitBounds(bounds, {
            padding: {
                top: 90,
                bottom: Math.min(drawerPx + 30, window.innerHeight * 0.85),
                left: 50,
                right: 50,
            },
            maxZoom: 12,
            duration: 280,
        });
    }, [mapLoaded, venueList, drawerPx, activeVenueId]);

    const filesWithCoordinates = files.filter((f) => f.venue?.coordinates);
    const venuesWithCoordinates = venueList.length;
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
                        className="absolute top-[calc(1.5rem+env(safe-area-inset-top))] left-[calc(1.5rem+env(safe-area-inset-left))] z-20 p-3 bg-black/60 text-white rounded-full backdrop-blur-md border border-white/10 hover:bg-black/80 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}

                {/* File count badge */}
                {!mapLoading && !mapError && (
                    <div className="absolute top-[calc(1.5rem+env(safe-area-inset-top))] right-[calc(1.5rem+env(safe-area-inset-right))] z-20 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10">
                        <span className="text-white text-sm font-medium">
                            {venuesWithCoordinates} {venuesWithCoordinates === 1 ? 'recinto' : 'recintos'}
                        </span>
                    </div>
                )}

                {/* Upload button (available to anyone with SoundVision access; access is enforced upstream) */}
                {!mapLoading && !mapError && (
                    <button
                        type="button"
                        onClick={() => setUploadOpen(true)}
                        aria-label="Subir archivo"
                        className="absolute top-[calc(5rem+env(safe-area-inset-top))] right-[calc(1.5rem+env(safe-area-inset-right))] z-20 p-3 bg-black/60 text-white rounded-full backdrop-blur-md border border-white/10 hover:bg-black/80 transition-colors"
                        title="Subir nuevo archivo"
                    >
                        <Upload size={20} />
                    </button>
                )}
            </div>

            {/* (context menu removed; use single-venue popup + Abrir) */}

            {/* Drawer */}
            <div
                ref={drawerRef}
                className={`absolute bottom-0 w-full ${isDark ? 'bg-[#0f1219]' : 'bg-white'} border-t ${theme.divider} rounded-t-3xl shadow-2xl flex flex-col transition-all duration-500 z-30 pb-[max(0px,env(safe-area-inset-bottom))]`}
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
                    ) : venueList.length === 0 ? (
                        <div className={`text-center py-8 ${theme.textMuted}`}>
                            <p className="text-lg mb-2">No se encontraron recintos</p>
                            <p className="text-sm">Intenta ajustar los filtros</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {venueList.map((group) => {
                                const coords = group.venue.coordinates;
                                const isActive = activeVenueId === group.venue.id;
                                const avg = group.ratingsCount > 0 ? group.ratingTotal / group.ratingsCount : null;

                                return (
                                    <div
                                        key={group.venue.id}
                                        id={`venue-card-${group.venue.id}`}
                                        className={`p-4 rounded-2xl border ${theme.divider} ${isDark ? 'bg-white/5' : 'bg-slate-50'} ${isActive ? 'ring-2 ring-blue-500/60' : ''}`}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => {
                                            if (!coords) return;
                                            toggleVenueSelection(group.venue.id, coords.lng, coords.lat, { openPopup: true });
                                        }}
                                        onKeyDown={(e) => {
                                            if (!coords) return;
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                if (e.key === ' ') e.preventDefault();
                                                toggleVenueSelection(group.venue.id, coords.lng, coords.lat, { openPopup: true });
                                            }
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-semibold truncate ${theme.textMain}`}>{group.venue.name}</p>
                                                <p className={`text-xs mt-1 truncate ${theme.textMuted}`}>
                                                    {[group.venue.city, group.venue.state_region, group.venue.country].filter(Boolean).join(', ')}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                <div className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                    {group.fileCount}
                                                </div>
                                                <div className={`text-[10px] ${theme.textMuted}`}>arch.</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <StarRating value={avg ?? 0} readOnly size="sm" />
                                                <span className={`text-xs ${theme.textMuted}`}>
                                                    {avg != null ? `${avg.toFixed(1)} (${group.ratingsCount})` : 'Sin reseñas'}
                                                </span>
                                            </div>

                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant={isActive ? 'secondary' : 'outline'}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (coords) {
                                                            const willBeActive = !isActive;
                                                            toggleVenueSelection(group.venue.id, coords.lng, coords.lat, { openPopup: false });
                                                            if (willBeActive) setVenueDetailOpen(true);
                                                        } else {
                                                            setActiveVenueId(group.venue.id);
                                                            setVenueDetailOpen(true);
                                                        }
                                                    }}
                                                    className="text-xs"
                                                >
                                                    Abrir
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!coords) return;
                                                        const url = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
                                                        window.open(url, '_blank', 'noopener,noreferrer');
                                                    }}
                                                    className="text-xs"
                                                >
                                                    Navegar
                                                </Button>
                                            </div>
                                        </div>

                                        {!coords && (
                                            <div className={`mt-2 flex items-center gap-2 text-xs ${theme.textMuted}`}>
                                                <AlertCircle size={12} />
                                                <span>Sin coordenadas</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Venue Detail Dialog */}
            <Dialog open={venueDetailOpen} onOpenChange={setVenueDetailOpen}>
                <DialogContent
                    className={`w-[95vw] max-w-3xl ${isDark ? 'bg-[#0f1219] border-[#1f232e]' : 'bg-white'} ${theme.textMain} !z-[70]`}
                >
                    <DialogHeader>
                        <DialogTitle>{activeVenueGroup?.venue.name || 'Recinto'}</DialogTitle>
                        <DialogDescription>
                            {activeVenueGroup?.venue
                                ? [activeVenueGroup.venue.city, activeVenueGroup.venue.state_region, activeVenueGroup.venue.country]
                                      .filter(Boolean)
                                      .join(', ')
                                : ''}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className={`text-sm ${theme.textMuted}`}>
                            {activeVenueGroup ? (
                                <span>
                                    {activeVenueGroup.fileCount} {activeVenueGroup.fileCount === 1 ? 'archivo' : 'archivos'}
                                </span>
                            ) : null}
                        </div>

                        <ScrollArea className="max-h-[60vh] pr-2">
                            <div className="space-y-2">
                                {(activeVenueId ? filesByVenueId.get(activeVenueId) || [] : []).map((file) => (
                                    <div
                                        key={file.id}
                                        className={`p-3 rounded-xl border ${theme.divider} ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className={`font-semibold truncate ${theme.textMain}`}>{file.file_name}</div>
                                                <div className={`text-xs mt-1 ${theme.textMuted}`}>
                                                    Subido {formatDistanceToNow(new Date(file.uploaded_at), { addSuffix: true, locale: es })}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => downloadFile.mutate(file)}
                                                    disabled={downloadFile.isPending}
                                                    className="text-xs"
                                                >
                                                    <Download size={14} className="mr-1" />
                                                    Descargar
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant={file.hasReviewed ? 'secondary' : 'outline'}
                                                    onClick={() => setSelectedFile(file)}
                                                    disabled={!canOpenReviews(file)}
                                                    className="text-xs"
                                                >
                                                    <StarIcon size={14} className="mr-1" />
                                                    Reseñas
                                                </Button>
                                            </div>
                                        </div>

                                        {!canOpenReviews(file) && (
                                            <div className={`mt-2 text-xs ${theme.textMuted}`}>
                                                Descarga el archivo para dejar una reseña
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {(activeVenueId ? (filesByVenueId.get(activeVenueId) || []).length : 0) === 0 && (
                                    <div className={`text-center py-8 ${theme.textMuted}`}>
                                        No hay archivos en este recinto.
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Upload Dialog */}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent
                    className={`w-[95vw] max-w-3xl ${isDark ? 'bg-[#0f1219] border-[#1f232e]' : 'bg-white'} ${theme.textMain} !z-[70]`}
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

        /* Safe areas (iOS notch / home indicator) */
        .mapboxgl-ctrl-top-left {
          top: env(safe-area-inset-top);
          left: env(safe-area-inset-left);
        }
        .mapboxgl-ctrl-top-right {
          top: env(safe-area-inset-top);
          right: env(safe-area-inset-right);
        }
        .mapboxgl-ctrl-bottom-left {
          left: env(safe-area-inset-left);
          bottom: env(safe-area-inset-bottom);
        }
        .mapboxgl-ctrl-bottom-right {
          right: env(safe-area-inset-right);
          bottom: env(safe-area-inset-bottom);
        }
      `}</style>
        </div>
    );
};
