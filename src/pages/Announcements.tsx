import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ANNOUNCEMENT_LEVEL_STYLES, type AnnouncementLevel } from '@/constants/announcementLevels';

const levelOptions: AnnouncementLevel[] = ['info', 'warn', 'critical'];

const LevelBadge: React.FC<{ level: AnnouncementLevel }> = ({ level }) => (
  <span className={`inline-flex items-center gap-2 uppercase text-xs font-medium px-2 py-1 rounded border ${ANNOUNCEMENT_LEVEL_STYLES[level].badge}`}>
    <span className={`h-2.5 w-2.5 rounded-full ${ANNOUNCEMENT_LEVEL_STYLES[level].dot}`} />
    {level}
  </span>
);

const LevelPreviewHint: React.FC<{ level: AnnouncementLevel }> = ({ level }) => (
  <div className="flex items-center gap-3 text-xs text-muted-foreground">
    <LevelBadge level={level} />
    <span className={ANNOUNCEMENT_LEVEL_STYLES[level].text}>Ticker preview</span>
  </div>
);

interface AnnouncementRow {
  id: string;
  message: string;
  level: AnnouncementLevel;
  active: boolean;
  created_at: string;
  created_by: string | null;
}

export default function Announcements() {
  useRoleGuard(['admin','management']);
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AnnouncementRow[]>([]);

  // New announcement form
  const [newMsg, setNewMsg] = useState('');
  const [newLevel, setNewLevel] = useState<AnnouncementLevel>('info');
  const [newActive, setNewActive] = useState(true);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState('');
  const [editLevel, setEditLevel] = useState<AnnouncementLevel>('info');

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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Announcements (Ticker)</h1>
          <p className="text-muted-foreground">Messages shown in the wallboard ticker. Newest first. Toggle Active to show/hide.</p>
        </div>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link to="/management/wallboard-presets">Configure wallboards</Link>
        </Button>
      </div>

      <div className="border rounded-md p-4 space-y-3">
        <div className="text-lg font-medium">Add Announcement</div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
          <div className="md:col-span-3">
            <Input
              placeholder="Message"
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
            />
          </div>
          <div>
            <div className="space-y-2">
              <Select value={newLevel} onValueChange={v => setNewLevel(v as AnnouncementLevel)}>
                <SelectTrigger>
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  {levelOptions.map(level => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <LevelPreviewHint level={newLevel} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={newActive} onCheckedChange={setNewActive} />
            <span className="text-sm">Active</span>
          </div>
          <div className="md:col-span-1">
            <Button className="w-full" onClick={createAnnouncement} disabled={!newMsg.trim()}>Add</Button>
          </div>
        </div>
      </div>

      <div className="border rounded-md">
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
                    <div className="space-y-2">
                      <Select value={editLevel} onValueChange={v => setEditLevel(v as AnnouncementLevel)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {levelOptions.map(level => (
                            <SelectItem key={level} value={level}>{level}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <LevelPreviewHint level={editLevel} />
                    </div>
                  ) : (
                    <LevelBadge level={r.level} />
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
      </div>
    </div>
  );
}

