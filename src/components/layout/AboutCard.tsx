import { useState } from "react"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Button } from "@/components/ui/button"
import { Info } from "lucide-react"

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

// Define an interface that includes the userRole prop.
interface AboutCardProps {
  userRole?: string; // e.g. "management", "admin", etc.
}

export const AboutCard = ({ userRole }: AboutCardProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [currentImage, setCurrentImage] = useState(images[0])

  // Only allow management-level users to see the carousel.
  if (userRole === "management") {
    return null;
  }

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

  return (
    <HoverCard open={isOpen} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={() => setIsOpen(true)}
        >
          <Info className="h-4 w-4" />
          <span>About</span>
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
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
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}