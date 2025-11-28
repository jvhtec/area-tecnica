import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface ServiceWorkerInfo {
    hasController: boolean;
    registration: boolean;
    buildVersion: string;
    buildTimestamp: string;
    lastUpdateCheck?: string;
}

/**
 * Version Display Component for Testing iOS PWA Updates
 * 
 * This component displays:
 * - Current app build version
 * - Build timestamp
 * - Service worker registration status
 * - Last update check time
 * 
 * Useful for verifying that updates are being detected and applied
 */
export function VersionDisplay() {
    const [info, setInfo] = useState<ServiceWorkerInfo>({
        hasController: false,
        registration: false,
        buildVersion: import.meta.env.VITE_APP_VERSION || 'N/A',
        buildTimestamp: import.meta.env.VITE_BUILD_TIMESTAMP || 'N/A',
    });

    useEffect(() => {
        const updateInfo = async () => {
            const hasController = !!navigator.serviceWorker?.controller;
            const reg = await navigator.serviceWorker?.getRegistration('/');

            setInfo(prev => ({
                ...prev,
                hasController,
                registration: !!reg,
                lastUpdateCheck: new Date().toLocaleTimeString(),
            }));
        };

        if ('serviceWorker' in navigator) {
            updateInfo();

            // Update info when SW state changes
            navigator.serviceWorker.addEventListener('controllerchange', updateInfo);

            return () => {
                navigator.serviceWorker.removeEventListener('controllerchange', updateInfo);
            };
        }
    }, []);

    const buildDate = info.buildTimestamp !== 'N/A'
        ? new Date(parseInt(info.buildTimestamp)).toLocaleString()
        : 'N/A';

    return (
        <Card className="max-w-md">
            <CardContent className="pt-6 space-y-2 text-sm">
                <div className="font-semibold text-base mb-3">App Version Info</div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">Build Version:</div>
                    <div className="font-mono text-xs">{info.buildVersion.slice(0, 19)}</div>

                    <div className="text-muted-foreground">Build Date:</div>
                    <div className="text-xs">{buildDate}</div>

                    <div className="text-muted-foreground">SW Registered:</div>
                    <div className={info.registration ? 'text-green-600' : 'text-red-600'}>
                        {info.registration ? '✓ Yes' : '✗ No'}
                    </div>

                    <div className="text-muted-foreground">SW Active:</div>
                    <div className={info.hasController ? 'text-green-600' : 'text-red-600'}>
                        {info.hasController ? '✓ Yes' : '✗ No'}
                    </div>

                    {info.lastUpdateCheck && (
                        <>
                            <div className="text-muted-foreground">Last Check:</div>
                            <div className="text-xs">{info.lastUpdateCheck}</div>
                        </>
                    )}
                </div>

                <div className="pt-2 text-xs text-muted-foreground border-t mt-3">
                    Refresh this page after deployment to verify new version
                </div>
            </CardContent>
        </Card>
    );
}
