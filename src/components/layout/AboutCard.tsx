import { useState, useEffect } from "react"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Info, Edit3, Save, X, Clock } from "lucide-react"
import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || "",
  process.env.REACT_APP_SUPABASE_ANON_KEY || ""
)

// Get the version from Vite's env variables
const version = import.meta.env.VITE_APP_VERSION || "dev"

// An array of image URLs to choose from
const images = [
  "/lovable-uploads/7bd0c1d7-3226-470d-bea4-5cd7222e3248.png",
  "/lovable-uploads/77dcfa7b-e05a-48e3-b662-03242aa8e853.png",
  "/lovable-uploads/642b8d57-4a23-490e-b7c6-fe8de9eafc63.png",
  "/lovable-uploads/5624e847-e131-4bdf-b4a9-2058fe294ead.png",
  "/lovable-uploads/44b5a76b-8a09-4270-b439-9e7976926b18.png",
  "/lovable-uploads/3c5cf97c-840a-48fd-b781-098c27729d90.png",
  "/lovable-uploads/39daae92-fbe9-4d38-ae04-8e929d2b1e6f.png",
  "/lovable-uploads/14f2fcca-4286-46dc-8d87-4aad90d42e27.png",
  "/lovable-uploads/8466df54-7094-4c62-b9b7-0fef374409f4.png",
  "/lovable-uploads/d6d934d3-85f4-4e22-8c5e-bb25acfae3a3.png",
  "/lovable-uploads/f795edb1-b35c-4b89-9d0a-be90d35833ec.png",
  "/lovable-uploads/fb2052e9-73ee-4e18-bc9e-933669280d89.png",
  "/lovable-uploads/044c8ba4-6679-4cee-8382-05a73a7c8d63.png",
  "/lovable-uploads/14ea7bcf-97c7-4625-bc03-d096da7250ca.png",
  "/lovable-uploads/ad11634a-0d49-487b-830f-f78c308989aa.png",
  "/lovable-uploads/b2a0dcfd-7da0-43e8-a27f-25db4c89c8e2.png",
  "/lovable-uploads/be8e98ed-c0bb-49d3-bed1-9cb76f19c3b1.png",
  "/lovable-uploads/c582372d-4e74-45db-833e-29b8f557a4ba.png",
]

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
  userName?: string // Add userName to identify Javier Vadillo
}

export const AboutCard = ({ userRole, userName }: AboutCardProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [currentImage, setCurrentImage] = useState(images[0])
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([
    {
      id: "1",
      version: "1.2.0",
      date: "2024-12-01",
      content: "Added changelog functionality with editing capabilities for authorized users",
      lastUpdated: new Date().toISOString()
    },
    {
      id: "2", 
      version: "1.1.0",
      date: "2024-11-15",
      content: "Improved UI with random image selection and better hover interactions",
      lastUpdated: "2024-11-15T10:00:00Z"
    }
  ])
  const [editingEntry, setEditingEntry] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [hasRecentUpdate, setHasRecentUpdate] = useState(false)

  // Check if user is Javier Vadillo (case insensitive)
  const isJavierVadillo = userName?.toLowerCase().includes("javier vadillo") || false

  // Only allow management-level users to see the carousel.
  if (userRole === "management") {
    return null;
  }

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
  const startEditing = (entryId: string, currentContent: string) => {
    setEditingEntry(entryId)
    setEditContent(currentContent)
  }

  // Save changelog entry
  const saveEntry = () => {
    if (editingEntry) {
      setChangelog(prev => prev.map(entry => 
        entry.id === editingEntry 
          ? { ...entry, content: editContent, lastUpdated: new Date().toISOString() }
          : entry
      ))
      setEditingEntry(null)
      setEditContent("")
    }
  }

  // Cancel editing
  const cancelEditing = () => {
    setEditingEntry(null)
    setEditContent("")
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
            src={currentImage}
            alt="About Image"
            className="rounded-lg w-full h-auto"
          />
          <div className="space-y-2">
            <p className="text-sm text-center text-muted-foreground">
              Created by JVH
            </p>
            <p className="text-xs text-center text-muted-foreground">
              v{version}
            </p>
          </div>
          
          {/* Changelog Section */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold">Changelog</h3>
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
                    {isJavierVadillo && editingEntry !== entry.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => startEditing(entry.id, entry.content)}
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  {editingEntry === entry.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full text-xs p-2 border rounded resize-none"
                        rows={3}
                        placeholder="Enter changelog content..."
                      />
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