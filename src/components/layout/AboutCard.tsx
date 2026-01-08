import { useState, useEffect } from "react"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Info, Edit3, Save, X, Clock, Plus, Trash2, Bell } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

// Get the version from Vite's env variables
const defaultVersion = import.meta.env.VITE_APP_VERSION || "dev"

// An array of image URLs to choose from
const images = [
  { src: "/lovable-uploads/7bd0c1d7-3226-470d-bea4-5cd7222e3248.png", width: 972, height: 835 },
  { src: "/lovable-uploads/77dcfa7b-e05a-48e3-b662-03242aa8e853.png", width: 512, height: 512 },
  { src: "/lovable-uploads/642b8d57-4a23-490e-b7c6-fe8de9eafc63.png", width: 512, height: 512 },
  { src: "/lovable-uploads/5624e847-e131-4bdf-b4a9-2058fe294ead.png", width: 512, height: 512 },
  { src: "/lovable-uploads/44b5a76b-8a09-4270-b439-9e7976926b18.png", width: 512, height: 512 },
  { src: "/lovable-uploads/3c5cf97c-840a-48fd-b781-098c27729d90.png", width: 512, height: 512 },
  { src: "/lovable-uploads/39daae92-fbe9-4d38-ae04-8e929d2b1e6f.png", width: 512, height: 512 },
  { src: "/lovable-uploads/14f2fcca-4286-46dc-8d87-4aad90d42e27.png", width: 512, height: 512 },
  { src: "/lovable-uploads/8466df54-7094-4c62-b9b7-0fef374409f4.png", width: 512, height: 512 },
  { src: "/lovable-uploads/d6d934d3-85f4-4e22-8c5e-bb25acfae3a3.png", width: 512, height: 512 },
  { src: "/lovable-uploads/f795edb1-b35c-4b89-9d0a-be90d35833ec.png", width: 512, height: 512 },
  { src: "/lovable-uploads/fb2052e9-73ee-4e18-bc9e-933669280d89.png", width: 512, height: 512 },
  { src: "/lovable-uploads/044c8ba4-6679-4cee-8382-05a73a7c8d63.png", width: 512, height: 512 },
  { src: "/lovable-uploads/14ea7bcf-97c7-4625-bc03-d096da7250ca.png", width: 512, height: 512 },
  { src: "/lovable-uploads/ad11634a-0d49-487b-830f-f78c308989aa.png", width: 512, height: 512 },
  { src: "/lovable-uploads/b2a0dcfd-7da0-43e8-a27f-25db4c89c8e2.png", width: 512, height: 512 },
  { src: "/lovable-uploads/be8e98ed-c0bb-49d3-bed1-9cb76f19c3b1.png", width: 512, height: 512 },
  { src: "/lovable-uploads/c582372d-4e74-45db-833e-29b8f557a4ba.png", width: 512, height: 512 },
] as const

// Define changelog entry interface
interface ChangelogEntry {
  id: string
  version: string
  date: string
  content: string
  lastUpdated: string
}

// Define an interface that includes the userRole prop.
interface AboutCardProps {
  userRole?: string
  userEmail?: string
  autoOpen?: boolean
  onAutoOpenHandled?: () => void
}

const filterRecentEntries = (entries: ChangelogEntry[]) => {
  const now = new Date()
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())

  return entries.filter(entry => {
    // Parse YYYY-MM-DD format to avoid timezone issues
    const match = entry.date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return true // Keep entries with invalid dates

    const [, year, month, day] = match
    const entryDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))

    return entryDate >= cutoff
  })
}

export const AboutCard = ({ userRole, userEmail, autoOpen, onAutoOpenHandled }: AboutCardProps) => {
  const [isOpen, setIsOpen] = useState(false)

  // Handle autoOpen prop
  useEffect(() => {
    if (autoOpen && !isOpen) {
      setIsOpen(true)
      onAutoOpenHandled?.()
    }
  }, [autoOpen, isOpen, onAutoOpenHandled])
  const [currentImage, setCurrentImage] = useState<(typeof images)[number]>(images[0])
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([])
  const [displayVersion, setDisplayVersion] = useState(defaultVersion)
  const [editingEntry, setEditingEntry] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [editVersion, setEditVersion] = useState("")
  const [editDate, setEditDate] = useState("")
  const [sendBroadcast, setSendBroadcast] = useState(false)
  const [hasRecentUpdate, setHasRecentUpdate] = useState(false)
  const { toast } = useToast()

  // Allow editing for management/admin or Javier by email
  const canEditChangelog = (userRole === "management" || userRole === "admin") || (userEmail?.toLowerCase() === 'sonido@sector-pro.com')

  // REMOVED: The early return that was hiding the component for management users
  // if (userRole === "management") {
  //   return null;
  // }

  // Check for recent updates (within last 24 hours)
  useEffect(() => {
    const now = new Date()
    const hasRecent = changelog.some(entry => {
      const lastUpdate = new Date(entry.lastUpdated)
      const timeDiff = now.getTime() - lastUpdate.getTime()
      return timeDiff < 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    })
    setHasRecentUpdate(hasRecent)
  }, [changelog])

  // Fetch changelog entries when the card opens
  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('app_changelog')
          .select('id, version, entry_date, content, last_updated')
          .order('entry_date', { ascending: false })
          .order('last_updated', { ascending: false })
        if (error) throw error
        const mapped: ChangelogEntry[] = (data || []).map((row: any) => ({
          id: row.id,
          version: row.version,
          date: row.entry_date, // yyyy-mm-dd
          content: row.content,
          lastUpdated: row.last_updated
        }))
        setChangelog(filterRecentEntries(mapped))
      } catch (e: any) {
        console.warn('Failed to load changelog', e?.message || e)
      }
    }
    if (isOpen) void load()
  }, [isOpen])

  useEffect(() => {
    if (changelog.length > 0) {
      setDisplayVersion(changelog[0].version)
    } else {
      setDisplayVersion(defaultVersion)
    }
  }, [changelog, defaultVersion])

  // Selects a random image from the images array.
  const selectRandomImage = () => {
    const randomIndex = Math.floor(Math.random() * images.length)
    return images[randomIndex]
  }

  // When the card is opened, update the image to a random one.
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      setCurrentImage(selectRandomImage())
    }
  }

  // Start editing a changelog entry
  const startEditing = (entryId: string, currentContent: string, currentVersion: string, currentDate: string) => {
    setEditingEntry(entryId)
    setEditContent(currentContent)
    setEditVersion(currentVersion)
    const isoDate = /\d{4}-\d{2}-\d{2}/.test(currentDate) ? currentDate : new Date(currentDate).toISOString().slice(0,10)
    setEditDate(isoDate)
    setSendBroadcast(false)
  }

  // Save changelog entry (persist)
  const saveEntry = async () => {
    if (!editingEntry) return
    try {
      const dateStr = (editDate || '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        toast({ title: 'Invalid date', description: 'Use format YYYY-MM-DD', variant: 'destructive' })
        return
      }
      const { data, error } = await supabase
        .from('app_changelog')
        .update({ content: editContent, version: editVersion || defaultVersion, entry_date: dateStr })
        .eq('id', editingEntry)
        .select('id, version, entry_date, content, last_updated')
        .maybeSingle()
      if (error) throw error
      if (data) {
        setChangelog(prev => filterRecentEntries(prev.map(entry =>
          entry.id === editingEntry
            ? { id: data.id, version: data.version, date: data.entry_date, content: data.content, lastUpdated: data.last_updated }
            : entry
        )))

        // Send push notification about changelog update if broadcast is enabled
        if (sendBroadcast) {
          void supabase.functions.invoke('push', {
            body: {
              action: 'broadcast',
              type: 'changelog.updated',
              version: data.version,
              content: data.content
            }
          })
        }
      }
      setEditingEntry(null)
      setEditContent("")
      setEditVersion("")
      setEditDate("")
      setSendBroadcast(false)
      toast({ title: sendBroadcast ? 'Changelog updated & broadcast sent' : 'Changelog updated' })
    } catch (e: any) {
      toast({ title: 'Failed to save', description: e?.message || String(e), variant: 'destructive' })
    }
  }

  const deleteEntry = async (id: string) => {
    if (!id) return
    const proceed = window.confirm('Delete this changelog entry?')
    if (!proceed) return
    try {
      const { error } = await supabase
        .from('app_changelog')
        .delete()
        .eq('id', id)
      if (error) throw error
      setChangelog(prev => filterRecentEntries(prev.filter(e => e.id !== id)))
      if (editingEntry === id) {
        setEditingEntry(null)
        setEditContent('')
        setEditVersion('')
        setEditDate('')
      }
      toast({ title: 'Entry deleted' })
    } catch (e: any) {
      toast({ title: 'Failed to delete', description: e?.message || String(e), variant: 'destructive' })
    }
  }

  const addEntry = async () => {
    try {
      const today = new Date()
      const yyyy_mm_dd = today.toISOString().slice(0,10)
      const ver = String(defaultVersion)
      const { data, error } = await supabase
        .from('app_changelog')
        .insert({ version: ver, entry_date: yyyy_mm_dd, content: '' })
        .select('id, version, entry_date, content, last_updated')
        .maybeSingle()
      if (error) throw error
      if (data) {
        const newEntry: ChangelogEntry = {
          id: data.id, version: data.version, date: data.entry_date, content: data.content, lastUpdated: data.last_updated
        }
        setChangelog(prev => filterRecentEntries([newEntry, ...prev]))
        setEditingEntry(newEntry.id)
        setEditContent('')
        setEditVersion(newEntry.version)
        setEditDate(newEntry.date)
        toast({ title: 'Entry created' })
      }
    } catch (e: any) {
      toast({ title: 'Failed to add entry', description: e?.message || String(e), variant: 'destructive' })
    }
  }

  // Cancel editing
  const cancelEditing = () => {
    setEditingEntry(null)
    setEditContent("")
    setSendBroadcast(false)
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <HoverCard open={isOpen} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 relative"
          onClick={() => setIsOpen(true)}
        >
          <Info className="h-4 w-4" />
          <span>About</span>
          {hasRecentUpdate && (
            <Badge variant="secondary" className="ml-auto h-5 w-5 p-0 flex items-center justify-center">
              <Clock className="h-3 w-3" />
            </Badge>
          )}
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-96">
        <div className="flex flex-col gap-4">
          <img
            src={currentImage.src}
            alt="About Image"
            width={currentImage.width}
            height={currentImage.height}
            loading="lazy"
            decoding="async"
            className="rounded-lg w-full h-auto"
          />
          <div className="space-y-2">
            <p className="text-sm text-center text-muted-foreground">
              Created by JVH
            </p>
            <p className="text-xs text-center text-muted-foreground">
              v{displayVersion}
            </p>
          </div>
          
          {/* Changelog Section */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold">Changelog</h3>
              {canEditChangelog && (
                <Button variant="outline" size="sm" className="h-6 px-2 ml-auto" onClick={addEntry}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              )}
              {hasRecentUpdate && (
                <Badge variant="outline" className="text-xs">
                  Updated
                </Badge>
              )}
            </div>
            
            <div className="space-y-3">
              {changelog.map((entry) => (
                <div key={entry.id} className="border-l-2 border-muted pl-3 pb-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">v{entry.version}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(entry.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {canEditChangelog && editingEntry !== entry.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => startEditing(entry.id, entry.content, entry.version, entry.date)}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      )}
                      {userRole === 'admin' && editingEntry !== entry.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-600"
                          onClick={() => deleteEntry(entry.id)}
                          title="Delete entry"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {editingEntry === entry.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-muted-foreground mb-1">Version</label>
                          <input
                            value={editVersion}
                            onChange={(e) => setEditVersion(e.target.value)}
                            className="w-full text-xs p-2 border rounded"
                            placeholder="e.g., 1.2.3"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted-foreground mb-1">Date</label>
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="w-full text-xs p-2 border rounded"
                          />
                        </div>
                      </div>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full text-xs p-2 border rounded resize-none"
                        rows={3}
                        placeholder="Enter changelog content..."
                      />
                      <div className="flex items-center gap-2 py-1 border-t border-dashed">
                        <Checkbox
                          id={`broadcast-${entry.id}`}
                          checked={sendBroadcast}
                          onCheckedChange={(checked) => setSendBroadcast(checked === true)}
                        />
                        <label
                          htmlFor={`broadcast-${entry.id}`}
                          className="text-[10px] text-muted-foreground cursor-pointer flex items-center gap-1"
                        >
                          <Bell className="h-3 w-3" />
                          Broadcast push notification
                        </label>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={saveEntry}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={cancelEditing}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                        {userRole === 'admin' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-6 px-2 ml-auto"
                            onClick={() => deleteEntry(entry.id)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {entry.content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
