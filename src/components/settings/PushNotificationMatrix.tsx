import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

type RecipientType = 'management_user' | 'department' | 'broadcast' | 'natural' | 'assigned_technicians';

type RouteRow = {
  id: string;
  event_code: string;
  recipient_type: RecipientType;
  target_id: string | null;
  include_natural_recipients: boolean;
};

type EventInfo = { code: string; label: string };

type ManagementUser = {
  id: string;
  name: string;
  email: string;
  department?: string | null;
};

const DEPARTMENTS: Array<{ id: string; label: string }> = [
  { id: 'sound', label: 'Sound' },
  { id: 'lights', label: 'Lights' },
  { id: 'video', label: 'Video' },
  { id: 'logistics', label: 'Logistics' },
  { id: 'production', label: 'Production' },
];

const FALLBACK_EVENTS: EventInfo[] = [
  { code: 'job.created', label: 'Job created' },
  { code: 'job.updated', label: 'Job updated' },
  { code: 'job.status.confirmed', label: 'Job confirmed' },
  { code: 'job.status.cancelled', label: 'Job cancelled' },
  { code: 'job.assignment.confirmed', label: 'Assignment confirmed' },
  { code: 'job.assignment.direct', label: 'Direct job assignment' },
  { code: 'job.type.changed', label: 'Job type changed' },
  { code: 'job.type.changed.single', label: 'Job changed to Single' },
  { code: 'job.type.changed.tour', label: 'Job changed to Tour' },
  { code: 'job.type.changed.festival', label: 'Job changed to Festival' },
  { code: 'job.type.changed.dryhire', label: 'Job changed to Dry Hire' },
  { code: 'job.type.changed.tourdate', label: 'Job changed to Tour Date' },
  { code: 'document.uploaded', label: 'Document uploaded' },
  { code: 'document.deleted', label: 'Document deleted' },
  { code: 'document.tech_visible.enabled', label: 'Document visible to technicians' },
  { code: 'document.tech_visible.disabled', label: 'Document hidden from technicians' },
  { code: 'staffing.availability.sent', label: 'Availability requested' },
  { code: 'staffing.availability.confirmed', label: 'Availability confirmed' },
  { code: 'staffing.availability.declined', label: 'Availability declined' },
  { code: 'staffing.availability.cancelled', label: 'Availability cancelled' },
  { code: 'staffing.offer.sent', label: 'Offer sent' },
  { code: 'staffing.offer.confirmed', label: 'Offer accepted' },
  { code: 'staffing.offer.declined', label: 'Offer declined' },
  { code: 'task.assigned', label: 'Task assigned' },
  { code: 'task.updated', label: 'Task updated' },
  { code: 'task.completed', label: 'Task completed' },
  { code: 'logistics.transport.requested', label: 'Transport requested' },
  { code: 'logistics.event.created', label: 'Logistics event created' },
  { code: 'logistics.event.updated', label: 'Logistics event updated' },
  { code: 'logistics.event.cancelled', label: 'Logistics event cancelled' },
  { code: 'flex.folders.created', label: 'Flex folders created' },
  { code: 'flex.tourdate_folder.created', label: 'Tour date folder created' },
  { code: 'message.received', label: 'Message received' },
  { code: 'tourdate.created', label: 'Tour date created' },
  { code: 'tourdate.updated', label: 'Tour date updated' },
  { code: 'tourdate.deleted', label: 'Tour date deleted' },
  { code: 'tourdate.type.changed', label: 'Tour date type changed' },
  { code: 'tourdate.type.changed.show', label: 'Tour date changed to Show' },
  { code: 'tourdate.type.changed.rehearsal', label: 'Tour date changed to Rehearsal' },
  { code: 'tourdate.type.changed.travel', label: 'Tour date changed to Travel' },
  { code: 'tourdate.type.changed.setup', label: 'Tour date changed to Setup' },
  { code: 'tourdate.type.changed.off', label: 'Tour date changed to Day Off' },
  { code: 'jobdate.type.changed', label: 'Job date type changed' },
  { code: 'jobdate.type.changed.show', label: 'Job date changed to Show' },
  { code: 'jobdate.type.changed.rehearsal', label: 'Job date changed to Rehearsal' },
  { code: 'jobdate.type.changed.travel', label: 'Job date changed to Travel' },
  { code: 'jobdate.type.changed.setup', label: 'Job date changed to Setup' },
  { code: 'jobdate.type.changed.off', label: 'Job date changed to Day Off' },
  { code: 'soundvision.file.uploaded', label: 'SoundVision file uploaded' },
  { code: 'soundvision.file.downloaded', label: 'SoundVision file downloaded' },
];

function routeKey(event: string, type: RecipientType, target: string | null) {
  return `${event}|${type}|${target ?? ''}`;
}

export function PushNotificationMatrix() {
  const { userRole } = useOptimizedAuth();
  const isManagement = ['admin', 'management'].includes(userRole || '');
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [users, setUsers] = useState<ManagementUser[]>([]);
  const [routesByEvent, setRoutesByEvent] = useState<Record<string, RouteRow[]>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);

  const pendingCount = pending.size;

  const sortedUsers = useMemo(() => {
    return users.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const hasRoute = (ev: string, type: RecipientType, target: string | null) => {
    const list = routesByEvent[ev] || [];
    return list.some(r => r.recipient_type === type && (r.target_id ?? '') === (target ?? ''));
  };

  const isAssignedTechRelevant = (code: string) => {
    return (
      code.startsWith('job.') ||
      code.startsWith('document.') ||
      code.startsWith('staffing.') ||
      code.startsWith('jobdate.') ||
      code === 'flex.folders.created'
    );
  };

  const hasNatural = (ev: string) => {
    const list = routesByEvent[ev] || [];
    return list.some(r => r.recipient_type === 'natural' || r.include_natural_recipients === true);
  };

  const setRoutePresentOptimistic = (ev: string, type: RecipientType, target: string | null, present: boolean) => {
    setRoutesByEvent((prev) => {
      const copy = { ...prev };
      const current = (copy[ev] || []).slice();
      const idx = current.findIndex(r => r.recipient_type === type && (r.target_id ?? '') === (target ?? ''));
      if (present) {
        if (idx === -1) {
          current.push({
            id: `temp-${Math.random().toString(36).slice(2)}`,
            event_code: ev,
            recipient_type: type,
            target_id: target,
            include_natural_recipients: type === 'natural',
          });
        }
      } else {
        if (idx !== -1) current.splice(idx, 1);
      }
      copy[ev] = current;
      return copy;
    });
  };

  const setNaturalOptimistic = (ev: string, present: boolean) => {
    setRoutesByEvent((prev) => {
      const copy = { ...prev };
      let current = (copy[ev] || []).slice();
      if (present) {
        // ensure a dedicated 'natural' row exists
        const exists = current.some(r => r.recipient_type === 'natural');
        if (!exists) {
          current.push({
            id: `temp-${Math.random().toString(36).slice(2)}`,
            event_code: ev,
            recipient_type: 'natural',
            target_id: null,
            include_natural_recipients: true,
          });
        }
      } else {
        // remove all natural markers and clear include_natural flags client-side
        current = current
          .filter(r => r.recipient_type !== 'natural')
          .map(r => ({ ...r, include_natural_recipients: false }));
      }
      copy[ev] = current;
      return copy;
    });
  };

  const toggleRoute = async (ev: string, type: RecipientType, target: string | null, next: boolean) => {
    const key = routeKey(ev, type, target);
    setPending(prev => new Set(prev).add(key));
    const revert = () => setPending(prev => { const n = new Set(prev); n.delete(key); return n; });

    // optimistic
    setRoutePresentOptimistic(ev, type, target, next);

    try {
      if (next) {
        // create if not present
        const { error } = await supabase.from('push_notification_routes').insert({
          event_code: ev,
          recipient_type: type,
          target_id: target,
          include_natural_recipients: type === 'natural',
        });
        if (error) throw error;
        toast({ title: 'Saved', description: 'Routing updated.' });
      } else {
        // delete matching rows
        let q = supabase
          .from('push_notification_routes')
          .delete()
          .eq('event_code', ev)
          .eq('recipient_type', type);
        if (target === null) {
          q = q.is('target_id', null);
        } else {
          q = q.eq('target_id', target);
        }
        const { error } = await q;
        if (error) throw error;
        toast({ title: 'Removed', description: 'Routing removed.' });
      }
    } catch (e: any) {
      // revert optimistic change
      setRoutePresentOptimistic(ev, type, target, !next);
      toast({ title: 'Save failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      revert();
    }
  };

  const toggleNatural = async (ev: string, next: boolean) => {
    const key = routeKey(ev, 'natural', '*');
    setPending(prev => new Set(prev).add(key));
    const revert = () => setPending(prev => { const n = new Set(prev); n.delete(key); return n; });

    setNaturalOptimistic(ev, next);

    try {
      if (next) {
        const { error } = await supabase.from('push_notification_routes').insert({
          event_code: ev,
          recipient_type: 'natural',
          target_id: null,
          include_natural_recipients: true,
        });
        if (error) throw error;
        toast({ title: 'Enabled', description: 'Natural recipients will be included.' });
      } else {
        // remove any 'natural' rows and also clear include_natural flags on other rows for this event
        const { error: delErr } = await supabase
          .from('push_notification_routes')
          .delete()
          .eq('event_code', ev)
          .eq('recipient_type', 'natural');
        if (delErr) throw delErr;
        // best-effort: set include_natural_recipients=false on remaining rows
        await supabase
          .from('push_notification_routes')
          .update({ include_natural_recipients: false })
          .eq('event_code', ev);
        toast({ title: 'Disabled', description: 'Natural recipients excluded for this event.' });
      }
    } catch (e: any) {
      setNaturalOptimistic(ev, !next);
      toast({ title: 'Save failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      revert();
    }
  };

  const load = async () => {
    setRefreshing(true);
    try {
      const [usersRes, eventsRes, routesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name, nickname, email, department, role')
          .in('role', ['admin', 'management']),
        supabase
          .from('activity_catalog')
          .select('code, label')
          .order('code', { ascending: true }),
        supabase
          .from('push_notification_routes')
          .select('id, event_code, recipient_type, target_id, include_natural_recipients'),
      ]);

      // users
      const uData = (usersRes.data || []).map((u: any) => ({
        id: u.id as string,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || (u.nickname as string) || (u.email as string),
        email: u.email as string,
        department: (u as any).department ?? null,
      })) as ManagementUser[];
      setUsers(uData);

      // events
      // Merge catalog with fallback so important push codes always appear
      const catalog: EventInfo[] = Array.isArray(eventsRes.data)
        ? (eventsRes.data as any[]).map((r) => ({ code: r.code as string, label: (r.label as string) || (r.code as string) }))
        : [];
      const byCode = new Map<string, EventInfo>();
      for (const e of FALLBACK_EVENTS) byCode.set(e.code, e);
      for (const e of catalog) byCode.set(e.code, e); // prefer catalog label when present
      const merged = Array.from(byCode.values()).sort((a, b) => a.code.localeCompare(b.code));
      setEvents(merged);

      // routes
      const byEvent: Record<string, RouteRow[]> = {};
      for (const r of (routesRes.data || []) as RouteRow[]) {
        byEvent[r.event_code] = byEvent[r.event_code] || [];
        byEvent[r.event_code].push(r);
      }
      setRoutesByEvent(byEvent);
    } catch (e: any) {
      toast({ title: 'Load failed', description: e?.message || 'Unknown error', variant: 'destructive' });
      // fallback minimal state
      if (events.length === 0) setEvents(FALLBACK_EVENTS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (isMobile) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-30">
        <Card className="rounded-t-lg rounded-b-none border-x-0 border-b-0 shadow-lg">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">Push Routing Matrix</CardTitle>
                  <CardDescription className="text-xs">
                    {isOpen ? 'Configure notification routing' : 'Tap to configure notifications'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {pendingCount > 0 && (
                    <span className="text-xs text-muted-foreground">Saving {pendingCount}…</span>
                  )}
                  {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="max-h-[60vh] overflow-y-auto pt-0">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading…</div>
              ) : (
                <div>
                  <div className="flex justify-end mb-3">
                    <Button variant="outline" size="sm" onClick={() => void load()} disabled={refreshing}>
                      {refreshing ? 'Refreshing…' : 'Refresh'}
                    </Button>
                  </div>
                  <div className="space-y-4">
                {events.map((ev) => (
                  <div key={ev.code} className="rounded-md border p-3">
                    <div className="mb-2">
                      <div className="font-medium leading-tight">{ev.label}</div>
                      <div className="text-xs text-muted-foreground break-all">{ev.code}</div>
                    </div>
                    <div className="space-y-2">
                      {/* Natural recipients */}
                      <div className="flex items-center justify-between">
                        <div className="text-sm">Natural recipients</div>
                        <Checkbox
                          checked={hasNatural(ev.code)}
                          onCheckedChange={(val) => isManagement && toggleNatural(ev.code, Boolean(val))}
                          disabled={!isManagement || pending.has(routeKey(ev.code, 'natural', '*'))}
                        />
                      </div>
                      {/* Broadcast to management */}
                      <div className="flex items-center justify-between">
                        <div className="text-sm">Broadcast to management</div>
                        <Checkbox
                          checked={hasRoute(ev.code, 'broadcast', null)}
                          onCheckedChange={(val) => isManagement && toggleRoute(ev.code, 'broadcast', null, Boolean(val))}
                          disabled={!isManagement || pending.has(routeKey(ev.code, 'broadcast', null))}
                        />
                      </div>
                      {/* Assigned technicians */}
                      {isAssignedTechRelevant(ev.code) && (
                        <div className="flex items-center justify-between">
                          <div className="text-sm">Assigned technicians</div>
                          <Checkbox
                            checked={hasRoute(ev.code, 'assigned_technicians', null)}
                            onCheckedChange={(val) => isManagement && toggleRoute(ev.code, 'assigned_technicians', null, Boolean(val))}
                            disabled={!isManagement || pending.has(routeKey(ev.code, 'assigned_technicians', null))}
                          />
                        </div>
                      )}
                      {/* Departments */}
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Departments</div>
                        <div className="grid grid-cols-2 gap-2">
                          {DEPARTMENTS.map((d) => (
                            <label key={`${ev.code}|${d.id}`} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                              <span>{d.label}</span>
                              <Checkbox
                                checked={hasRoute(ev.code, 'department', d.id)}
                                onCheckedChange={(val) => isManagement && toggleRoute(ev.code, 'department', d.id, Boolean(val))}
                                disabled={!isManagement || pending.has(routeKey(ev.code, 'department', d.id))}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                      {/* Individual management users */}
                      {sortedUsers.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">Management users</div>
                          <div className="space-y-2">
                            {sortedUsers.map((u) => (
                              <label key={`${ev.code}|${u.id}`} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                                <span className="min-w-0 truncate pr-2">{u.name}</span>
                                <Checkbox
                                  checked={hasRoute(ev.code, 'management_user', u.id)}
                                  onCheckedChange={(val) => isManagement && toggleRoute(ev.code, 'management_user', u.id, Boolean(val))}
                                  disabled={!isManagement || pending.has(routeKey(ev.code, 'management_user', u.id))}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!isManagement && (
              <p className="mt-3 text-xs text-muted-foreground">Viewing only — editing requires management role.</p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
    );
  }

  // Desktop view
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
          <div>
            <CardTitle>Push Routing Matrix</CardTitle>
            <CardDescription>
              Configure which management users, departments, and assigned technicians receive each event. Natural recipients toggle preserves default recipients.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm min-w-0">
            {pendingCount > 0 && (
              <span className="text-muted-foreground">Saving {pendingCount}…</span>
            )}
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div>
            <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px] sticky left-0 z-10 bg-background">Event</TableHead>
                      <TableHead className="min-w-[120px]">Natural</TableHead>
                      <TableHead className="min-w-[120px]">Broadcast</TableHead>
                      <TableHead className="min-w-[180px]">Assigned technicians</TableHead>
                      {DEPARTMENTS.map((d) => (
                        <TableHead key={d.id} className="min-w-[140px]">{d.label}</TableHead>
                      ))}
                      {sortedUsers.map((u) => (
                        <TableHead key={u.id} className="min-w-[180px]">{u.name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((ev) => {
                      return (
                        <TableRow key={ev.code}>
                          <TableCell className="sticky left-0 z-10 bg-background">
                            <div className="flex flex-col">
                              <span className="font-medium">{ev.label}</span>
                              <span className="text-xs text-muted-foreground">{ev.code}</span>
                            </div>
                          </TableCell>
                          {/* Natural recipients */}
                          <TableCell>
                            <Checkbox
                              checked={hasNatural(ev.code)}
                              onCheckedChange={(val) => isManagement && toggleNatural(ev.code, Boolean(val))}
                              disabled={!isManagement || pending.has(routeKey(ev.code, 'natural', '*'))}
                            />
                          </TableCell>
                          {/* Broadcast to management */}
                          <TableCell>
                            <Checkbox
                              checked={hasRoute(ev.code, 'broadcast', null)}
                              onCheckedChange={(val) => isManagement && toggleRoute(ev.code, 'broadcast', null, Boolean(val))}
                              disabled={!isManagement || pending.has(routeKey(ev.code, 'broadcast', null))}
                            />
                          </TableCell>
                          {/* Assigned technicians */}
                          <TableCell>
                            <Checkbox
                              checked={hasRoute(ev.code, 'assigned_technicians', null)}
                              onCheckedChange={(val) => isManagement && toggleRoute(ev.code, 'assigned_technicians', null, Boolean(val))}
                              disabled={!isManagement || !isAssignedTechRelevant(ev.code) || pending.has(routeKey(ev.code, 'assigned_technicians', null))}
                            />
                          </TableCell>
                          {/* Departments */}
                          {DEPARTMENTS.map((d) => (
                            <TableCell key={`${ev.code}|${d.id}`}>
                              <Checkbox
                                checked={hasRoute(ev.code, 'department', d.id)}
                                onCheckedChange={(val) => isManagement && toggleRoute(ev.code, 'department', d.id, Boolean(val))}
                                disabled={!isManagement || pending.has(routeKey(ev.code, 'department', d.id))}
                              />
                            </TableCell>
                          ))}
                          {/* Individual management users */}
                          {sortedUsers.map((u) => (
                            <TableCell key={`${ev.code}|${u.id}`}>
                              <Checkbox
                                checked={hasRoute(ev.code, 'management_user', u.id)}
                                onCheckedChange={(val) => isManagement && toggleRoute(ev.code, 'management_user', u.id, Boolean(val))}
                                disabled={!isManagement || pending.has(routeKey(ev.code, 'management_user', u.id))}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
          </div>
        )}
        {!isManagement && (
          <p className="mt-3 text-xs text-muted-foreground">Viewing only — editing requires management role.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default PushNotificationMatrix;
