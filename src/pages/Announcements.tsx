import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

type Level = 'info' | 'warn' | 'critical';

interface AnnouncementRow {
  id: string;
  message: string;
  level: Level;
  active: boolean;
  created_at: string;
  created_by: string | null;
}

export default function Announcements() {
  useRoleGuard(['admin','management']);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AnnouncementRow[]>([]);

  // New announcement form
  const [newMsg, setNewMsg] = useState('');
  const [newLevel, setNewLevel] = useState<Level>('info');
  const [newActive, setNewActive] = useState(true);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState('');
  const [editLevel, setEditLevel] = useState<Level>('info');

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('announcements')
      .select('id, message, level, active, created_at, created_by')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('Load announcements error', error);
      toast({ title: 'Failed to load', description: error.message, variant: 'destructive' });
    } else {
      setRows(data as AnnouncementRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const createAnnouncement = async () => {
    if (!newMsg.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const created_by = userData.user?.id ?? null;
    const { error } = await supabase
      .from('announcements')
      .insert({ message: newMsg.trim(), level: newLevel, active: newActive, created_by });
    if (error) {
      toast({ title: 'Create failed', description: error.message, variant: 'destructive' });
    } else {
      setNewMsg('');
      setNewLevel('info');
      setNewActive(true);
      fetchAll();
      toast({ title: 'Announcement added' });
    }
  };

  const startEdit = (row: AnnouncementRow) => {
    setEditingId(row.id);
    setEditMsg(row.message);
    setEditLevel(row.level);
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase
      .from('announcements')
      .update({ message: editMsg, level: editLevel })
      .eq('id', id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    } else {
      setEditingId(null);
      fetchAll();
      toast({ title: 'Announcement updated' });
    }
  };

  const setActive = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from('announcements')
      .update({ active })
      .eq('id', id);
    if (error) {
      toast({ title: 'Toggle failed', description: error.message, variant: 'destructive' });
    } else {
      setRows(rs => rs.map(r => r.id === id ? { ...r, active } : r));
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      setRows(rs => rs.filter(r => r.id !== id));
      toast({ title: 'Announcement deleted' });
    }
  };

  return (
    <div className="space-y-6 px-4 md:px-0">
      {/* Sticky header on mobile */}
      <div className={`${isMobile ? 'sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4' : ''}`}>
        <h1 className="text-xl md:text-2xl font-semibold">Announcements (Ticker)</h1>
        <p className="text-sm md:text-base text-muted-foreground">Messages shown in the wallboard ticker. Newest first.</p>
      </div>

      {/* Add announcement form with sticky on mobile */}
      <Card className={`${isMobile ? 'sticky top-16 z-10' : ''}`}>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Add Announcement</CardTitle>
          <CardDescription className="text-sm">Create a new announcement for the wallboard ticker</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3">
            <Input
              placeholder="Message"
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select value={newLevel} onValueChange={v => setNewLevel(v as Level)}>
                <SelectTrigger>
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">info</SelectItem>
                  <SelectItem value="warn">warn</SelectItem>
                  <SelectItem value="critical">critical</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch checked={newActive} onCheckedChange={setNewActive} />
                <span className="text-sm">Active</span>
              </div>
            </div>
            <Button className="w-full" onClick={createAnnouncement} disabled={!newMsg.trim()}>
              Add Announcement
            </Button>
          </div>
        </CardContent>
      </Card>

      {isMobile ? (
        <div className="space-y-3">
          {rows.map(r => (
            <Card key={r.id}>
              <CardContent className="pt-6 space-y-3">
                {editingId === r.id ? (
                  <>
                    <Input value={editMsg} onChange={e => setEditMsg(e.target.value)} />
                    <Select value={editLevel} onValueChange={v => setEditLevel(v as Level)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">info</SelectItem>
                        <SelectItem value="warn">warn</SelectItem>
                        <SelectItem value="critical">critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <>
                    <div className="break-words">{r.message}</div>
                    <div className="flex items-center gap-2">
                      <span className="uppercase text-xs px-2 py-1 rounded bg-secondary">{r.level}</span>
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={r.active} onCheckedChange={(v)=>setActive(r.id, v)} />
                    <span className="text-sm">Active</span>
                  </div>
                  <div className="flex gap-2">
                    {editingId === r.id ? (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                        <Button size="sm" onClick={() => saveEdit(r.id)} disabled={!editMsg.trim()}>Save</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => startEdit(r)}>Edit</Button>
                        <Button size="sm" variant="destructive" onClick={() => remove(r.id)}>Delete</Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {rows.length === 0 && (
            <Card>
              <CardContent className="py-6 text-center text-muted-foreground">
                {loading ? 'Loading…' : 'No announcements yet'}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Message</TableHead>
              <TableHead className="w-[120px]">Level</TableHead>
              <TableHead className="w-[100px]">Active</TableHead>
              <TableHead className="w-[160px]">Created</TableHead>
              <TableHead className="w-[160px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  {editingId === r.id ? (
                    <Input value={editMsg} onChange={e => setEditMsg(e.target.value)} />
                  ) : (
                    <div className="truncate max-w-[600px]" title={r.message}>{r.message}</div>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === r.id ? (
                    <Select value={editLevel} onValueChange={v => setEditLevel(v as Level)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">info</SelectItem>
                        <SelectItem value="warn">warn</SelectItem>
                        <SelectItem value="critical">critical</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="uppercase text-xs px-2 py-1 rounded bg-secondary">{r.level}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Switch checked={r.active} onCheckedChange={(v)=>setActive(r.id, v)} />
                </TableCell>
                <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-right space-x-2">
                  {editingId === r.id ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button size="sm" onClick={() => saveEdit(r.id)} disabled={!editMsg.trim()}>Save</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => startEdit(r)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => remove(r.id)}>Delete</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  {loading ? 'Loading…' : 'No announcements yet'}
                </TableCell>
              </TableRow>
            )}
            </TableBody>
            </Table>
            </CardContent>
            </Card>
            )}
            </div>
            );
            }

