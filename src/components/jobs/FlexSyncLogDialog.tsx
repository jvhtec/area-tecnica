import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { Loader2, RefreshCw } from 'lucide-react';

interface FlexSyncLogDialogProps {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FlexSyncLogDialog: React.FC<FlexSyncLogDialogProps> = ({ jobId, open, onOpenChange }) => {
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const folderIds = useMemo(() => folders.map(f => f.id), [folders]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: f, error: fErr } = await supabase
        .from('flex_folders')
        .select('id, parent_id, current_status')
        .eq('job_id', jobId);
      if (!fErr) setFolders(f || []);

      if (f && f.length) {
        const { data: l, error: lErr } = await supabase
          .from('flex_status_log')
          .select('id, folder_id, previous_status, new_status, action_type, processed_by, processed_at, success, flex_response, error')
          .in('folder_id', f.map((x: any) => x.id))
          .order('processed_at', { ascending: false })
          .limit(200);
        if (!lErr) setLogs(l || []);
      } else {
        setLogs([]);
      }
    } catch {
      // swallow errors for now
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadData();
  }, [open, jobId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Flex Sync Logs</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-muted-foreground">
            {folderIds.length} folder(s) • {logs.length} entries
          </div>
          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
        <ScrollArea className="h-[420px] pr-2">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              Loading...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No logs yet for this job.</div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const details = (() => {
                  const r = log.flex_response;
                  if (r && typeof r === 'object') {
                    try {
                      const msg = r.primaryMessage || r.message || r.error || '';
                      return String(msg);
                    } catch {}
                  }
                  return '';
                })();
                return (
                  <div key={log.id} className="border rounded p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={log.success ? 'default' : 'destructive'}>
                          {log.success ? 'OK' : 'FAIL'}
                        </Badge>
                        <span className="font-medium">{log.previous_status || '—'} → {log.new_status}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(log.processed_at).toLocaleString()}
                      </div>
                    </div>
                    {details && (
                      <div className="mt-2 text-muted-foreground break-words">
                        {details}
                      </div>
                    )}
                    {log.error && (
                      <div className="mt-2 text-red-500 break-words">
                        {log.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

