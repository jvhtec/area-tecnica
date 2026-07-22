/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";

import type { SoundVisionFile } from "@/hooks/useSoundVisionFiles";
import { useVenues } from "@/hooks/useVenues";
import { isManagementRole } from "@/utils/permissions";
import { dataLayerClient } from "@/services/dataLayerClient";
import type { VenueGroup } from "@/components/soundvision/soundVisionMapModel";

type Options = {
  activeVenueId: string | null;
  city: string;
  country: string;
  drawerHeight: "collapsed" | "half" | "full";
  fileType: string;
  files: SoundVisionFile[];
  isLoading: boolean;
  profileRole?: string | null;
  refetch: () => Promise<unknown>;
  searchTerm: string;
  selectedFile: SoundVisionFile | null;
  setActiveVenueId: (value: string | null) => void;
  setCity: (value: string) => void;
  setCountry: (value: string) => void;
  setFileType: (value: string) => void;
  setSearchTerm: (value: string) => void;
  setSelectedFile: (value: SoundVisionFile | null) => void;
  setStateRegion: (value: string) => void;
  stateRegion: string;
  showFilters: boolean;
  venueGeoJson: any;
  venueGroups: Map<string, VenueGroup>;
  venueIdToFeatureId: Map<string, number>;
  venueList: VenueGroup[];
};

export const useSoundVisionMap = ({ activeVenueId, city, country, drawerHeight, fileType, files, isLoading, profileRole, refetch, searchTerm, selectedFile, setActiveVenueId, setCity, setCountry, setFileType, setSearchTerm, setSelectedFile, setStateRegion, showFilters, stateRegion, venueGeoJson, venueGroups, venueIdToFeatureId, venueList }: Options) => {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const activeVenueIdRef = useRef<string | null>(null);
    const [venueDetailOpen, setVenueDetailOpen] = useState(false);
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
    const isManagement = isManagementRole(profileRole);

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
    }, [files, selectedFile, setSelectedFile]);

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

            closePopup({ preserveSelection: true });

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
        [closePopup, setActiveVenueId, venueGroups]
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
        [centerOn, closePopup, openVenuePopup, setActiveVenueId]
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

                const { data, error: tokenError } = await dataLayerClient.functions.invoke('get-mapbox-token');

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
    }, [closePopup]);

    // Venue clustering + marker rendering (Mapbox layers, not DOM markers)
    useEffect(() => {
        if (!mapLoaded || !map.current || !mapboxglRef.current) return;

        const mapInstance: any = map.current;
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

    return {
      activeVenueGroup,
      canOpenReviews,
      cities,
      countries,
      drawerRef,
      handleClearFilters,
      handleRefresh,
      hasActiveFilters,
      isManagement,
      isRefreshing,
      mapContainer,
      mapError,
      mapLoading,
      setVenueDetailOpen,
      stateRegions,
      toggleVenueSelection,
      venueDetailOpen,
    };
};
