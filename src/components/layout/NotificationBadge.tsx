import { useEffect, useState, useCallback, useRef } from "react"
import { Bell, BellDot } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useAppBadgeSource } from "@/hooks/useAppBadgeSource"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

interface NotificationBadgeProps {
  userId: string
  userRole: string
  userDepartment: string | null
  display?: "sidebar" | "icon"
  className?: string
}

export const NotificationBadge = ({
  userId,
  userRole,
  userDepartment,
  display = "sidebar",
  className,
}: NotificationBadgeProps) => {
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const refreshQueuedRef = useRef(false)
  const debounceTimerRef = useRef<number | null>(null)
  const navigate = useNavigate()

  const fetchUnreadMessages = useCallback(async () => {
    if (isLoading) {
      refreshQueuedRef.current = true
      return
    }

    try {
      setIsLoading(true)

      let deptQuery = supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("status", "unread")

      if (userRole === "management") {
        deptQuery = deptQuery.eq("department", userDepartment)
      } else if (userRole === "technician") {
        deptQuery = deptQuery.eq("sender_id", userId)
      }

      const directQuery = supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .eq("status", "unread")

      const [deptMessages, directMessages] = await Promise.all([
        deptQuery,
        directQuery,
      ])

      if (deptMessages.error) {
        console.error("Error fetching department messages:", deptMessages.error)
        return
      }

      if (directMessages.error) {
        console.error("Error fetching direct messages:", directMessages.error)
        return
      }

      const departmentCount = deptMessages.count ?? 0
      const directCount = directMessages.count ?? 0
      const totalUnread = departmentCount + directCount

      setUnreadCount(totalUnread)
      setHasUnreadMessages(totalUnread > 0)
    } catch (error) {
      console.error("Error checking unread messages:", error)
    } finally {
      setIsLoading(false)
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false
        Promise.resolve().then(() => fetchUnreadMessages())
      }
    }
  }, [userId, userRole, userDepartment, isLoading])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchUnreadMessages()
    }, 500)

    const handleInvalidate = () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = window.setTimeout(() => {
        fetchUnreadMessages()
      }, 50)
    }

    window.addEventListener("messages_invalidated", handleInvalidate)
    window.addEventListener("direct_messages_invalidated", handleInvalidate)

    const channel = supabase
      .channel("realtime-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          if (debounceTimerRef.current) {
            window.clearTimeout(debounceTimerRef.current)
          }
          debounceTimerRef.current = window.setTimeout(() => {
            fetchUnreadMessages()
          }, 200)
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_messages",
        },
        () => {
          if (debounceTimerRef.current) {
            window.clearTimeout(debounceTimerRef.current)
          }
          debounceTimerRef.current = window.setTimeout(() => {
            fetchUnreadMessages()
          }, 200)
        },
      )
      .subscribe()

    return () => {
      window.clearTimeout(timeoutId)
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      supabase.removeChannel(channel)
      window.removeEventListener("messages_invalidated", handleInvalidate)
      window.removeEventListener("direct_messages_invalidated", handleInvalidate)
    }
  }, [fetchUnreadMessages])

  const handleMessageNotificationClick = () => {
    if (userRole === "management") {
      navigate("/dashboard?showMessages=true")
    } else if (userRole === "technician") {
      navigate("/technician-dashboard?showMessages=true")
    }
  }

  useAppBadgeSource(
    "messages",
    hasUnreadMessages ? { count: unreadCount } : null,
  )

  if (display === "sidebar" && !hasUnreadMessages) {
    return null
  }

  if (display === "icon") {
    const Icon = hasUnreadMessages ? BellDot : Bell
    const readableCount = unreadCount > 9 ? "9+" : unreadCount.toString()

    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleMessageNotificationClick}
        disabled={isLoading}
        className={cn(
          "relative h-9 w-9 rounded-full border border-border/60 bg-background/70 text-muted-foreground shadow-sm transition-colors hover:bg-accent/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          hasUnreadMessages && "text-amber-500",
          className,
        )}
        aria-label={
          hasUnreadMessages
            ? `${unreadCount} mensajes nuevos`
            : "Abrir mensajes"
        }
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
        {hasUnreadMessages && (
          <span className="pointer-events-none absolute -top-1 -right-1 inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[0.7rem] font-semibold text-white shadow">
            {readableCount}
          </span>
        )}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "w-full justify-start gap-2 text-yellow-500",
        className,
      )}
      onClick={handleMessageNotificationClick}
      disabled={isLoading}
    >
      <BellDot className="h-4 w-4" aria-hidden="true" />
      <span>New Messages</span>
    </Button>
  )
}
