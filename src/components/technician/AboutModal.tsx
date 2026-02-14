import React, { useState, useEffect } from 'react';
import { X, Info, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Theme } from './types';

// Get the version from Vite's env variables
const defaultVersion = import.meta.env.VITE_APP_VERSION || 'dev';

interface ChangelogEntry {
  id: string;
  version: string;
  date: string;
  content: string;
  lastUpdated: string;
}

interface AboutModalProps {
  theme: Theme;
  isDark: boolean;
  onClose: () => void;
}

// An array of image URLs to choose from
const images = [
  { src: '/lovable-uploads/7bd0c1d7-3226-470d-bea4-5cd7222e3248.png', width: 972, height: 835 },
  { src: '/lovable-uploads/77dcfa7b-e05a-48e3-b662-03242aa8e853.png', width: 512, height: 512 },
  { src: '/lovable-uploads/642b8d57-4a23-490e-b7c6-fe8de9eafc63.png', width: 512, height: 512 },
  { src: '/lovable-uploads/5624e847-e131-4bdf-b4a9-2058fe294ead.png', width: 512, height: 512 },
  { src: '/lovable-uploads/44b5a76b-8a09-4270-b439-9e7976926b18.png', width: 512, height: 512 },
  { src: '/lovable-uploads/3c5cf97c-840a-48fd-b781-098c27729d90.png', width: 512, height: 512 },
  { src: '/lovable-uploads/39daae92-fbe9-4d38-ae04-8e929d2b1e6f.png', width: 512, height: 512 },
  { src: '/lovable-uploads/14f2fcca-4286-46dc-8d87-4aad90d42e27.png', width: 512, height: 512 },
] as const;

const filterRecentEntries = (entries: ChangelogEntry[]) => {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

  return entries.filter(entry => {
    const match = entry.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return true;

    const [, year, month, day] = match;
    const entryDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

    return entryDate >= cutoff;
  });
};

export const AboutModal = ({ theme, isDark, onClose }: AboutModalProps) => {
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [displayVersion, setDisplayVersion] = useState(defaultVersion);
  const [hasRecentUpdate, setHasRecentUpdate] = useState(false);
  const [currentImage] = useState(() => images[Math.floor(Math.random() * images.length)]);

  // Fetch changelog entries
  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('app_changelog')
          .select('id, version, entry_date, content, last_updated')
          .order('entry_date', { ascending: false })
          .order('last_updated', { ascending: false });
        if (error) throw error;
        const mapped: ChangelogEntry[] = (data || []).map((row: any) => ({
          id: row.id,
          version: row.version,
          date: row.entry_date,
          content: row.content,
          lastUpdated: row.last_updated
        }));
        setChangelog(filterRecentEntries(mapped));
      } catch (e: any) {
        console.warn('Failed to load changelog', e?.message || e);
      }
    };
    void load();
  }, []);

  // Update display version from changelog
  useEffect(() => {
    if (changelog.length > 0) {
      setDisplayVersion(changelog[0].version);
    } else {
      setDisplayVersion(defaultVersion);
    }
  }, [changelog]);

  // Check for recent updates (within last 24 hours)
  useEffect(() => {
    const now = new Date();
    const hasRecent = changelog.some(entry => {
      const lastUpdate = new Date(entry.lastUpdated);
      const timeDiff = now.getTime() - lastUpdate.getTime();
      return timeDiff < 24 * 60 * 60 * 1000;
    });
    setHasRecentUpdate(hasRecent);
  }, [changelog]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className={`fixed inset-0 z-[70] flex items-center justify-center ${theme.modalOverlay} px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200`}>
      <div className={`w-full max-w-md max-h-[90vh] ${isDark ? 'bg-[#0f1219]' : 'bg-white'} rounded-2xl border ${theme.divider} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col`}>
        {/* Header */}
        <div className={`p-4 border-b ${theme.divider} flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500 text-white">
              <Info size={18} />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${theme.textMain}`}>Acerca de</h2>
              <p className={`text-xs ${theme.textMuted}`}>v{displayVersion}</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 ${theme.textMuted} hover:${theme.textMain} rounded-full transition-colors`}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Image */}
          <div className="mb-4">
            <img
              src={currentImage.src}
              alt="About"
              width={currentImage.width}
              height={currentImage.height}
              loading="lazy"
              decoding="async"
              className="rounded-lg w-full h-auto max-h-40 object-contain"
            />
          </div>

          <p className={`text-sm text-center mb-4 ${theme.textMuted}`}>
            Created by JVH
          </p>

          {/* Changelog Section */}
          <div className={`border-t pt-4 ${theme.divider}`}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className={`text-sm font-semibold ${theme.textMain}`}>Changelog</h3>
              {hasRecentUpdate && (
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Actualizado
                </Badge>
              )}
            </div>

            <div className="space-y-3">
              {changelog.length === 0 ? (
                <p className={`text-xs ${theme.textMuted}`}>No hay entradas recientes.</p>
              ) : (
                changelog.map((entry) => (
                  <div key={entry.id} className={`border-l-2 pl-3 pb-2 ${isDark ? 'border-blue-500/30' : 'border-blue-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium ${theme.textMain}`}>v{entry.version}</span>
                      <span className={`text-xs ${theme.textMuted}`}>
                        {formatDate(entry.date)}
                      </span>
                    </div>
                    <p className={`text-xs ${theme.textMuted} leading-relaxed whitespace-pre-wrap`}>
                      {entry.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className={`p-4 border-t ${theme.divider} shrink-0`}>
          <Button
            variant="outline"
            className="w-full"
            onClick={onClose}
          >
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};
