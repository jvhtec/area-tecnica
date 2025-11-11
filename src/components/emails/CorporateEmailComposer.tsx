import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, Upload, FileText, Image as ImageIcon, Send, Users } from "lucide-react";
import type {
  SelectedRecipient,
  SendCorporateEmailRequest,
  SendCorporateEmailResponse,
  InlineImage,
  PdfAttachment,
} from "@/types/corporate-email";

export function CorporateEmailComposer() {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<SelectedRecipient[]>([]);
  const [inlineImages, setInlineImages] = useState<InlineImage[]>([]);
  const [pdfAttachments, setPdfAttachments] = useState<PdfAttachment[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientPopoverOpen, setRecipientPopoverOpen] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Fetch profiles for recipient picker
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles", recipientSearch],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, first_name, last_name, email, department, role")
        .not("email", "is", null)
        .order("first_name");

      if (recipientSearch) {
        query = query.or(
          `first_name.ilike.%${recipientSearch}%,last_name.ilike.%${recipientSearch}%,email.ilike.%${recipientSearch}%,department.ilike.%${recipientSearch}%`
        );
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
    enabled: recipientPopoverOpen,
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (request: SendCorporateEmailRequest) => {
      const { data, error } = await supabase.functions.invoke<SendCorporateEmailResponse>(
        "send-corporate-email",
        {
          body: request,
        }
      );

      if (error) throw error;
      if (!data) throw new Error("No response from server");
      if (!data.success) throw new Error(data.error || "Failed to send email");

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Email sent successfully",
        description: `Sent to ${data.sentCount} recipient${data.sentCount !== 1 ? "s" : ""}`,
      });

      // Reset form
      setSubject("");
      setBodyHtml("");
      setSelectedRecipients([]);
      setInlineImages([]);
      setPdfAttachments([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle recipient selection
  const addRecipient = useCallback((recipient: SelectedRecipient) => {
    setSelectedRecipients((prev) => {
      // Avoid duplicates
      if (prev.some((r) => r.id === recipient.id)) {
        return prev;
      }
      return [...prev, recipient];
    });
    setRecipientPopoverOpen(false);
  }, []);

  const removeRecipient = useCallback((recipientId: string) => {
    setSelectedRecipients((prev) => prev.filter((r) => r.id !== recipientId));
  }, []);

  // Handle inline image upload
  const handleImageFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const newImages: InlineImage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file type
        if (!file.type.startsWith("image/")) {
          toast({
            title: "Invalid file type",
            description: `${file.name} is not an image`,
            variant: "destructive",
          });
          continue;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds 5MB limit`,
            variant: "destructive",
          });
          continue;
        }

        try {
          // Convert to base64
          const base64 = await fileToBase64(file);

          // Generate stable CID
          // Note: Backend will upload to Supabase Storage, replace cid: with public URL,
          // send the email, then delete the temporary file
          const cid = `img_${Date.now()}_${i}`;

          newImages.push({
            cid,
            content: base64,
            mimeType: file.type,
            filename: file.name,
          });

          // Insert image tag into body at cursor position
          const imgTag = `<img src="cid:${cid}" alt="${file.name}" style="max-width: 100%; height: auto;" />`;
          setBodyHtml((prev) => prev + imgTag);
        } catch (error) {
          toast({
            title: "Failed to process image",
            description: file.name,
            variant: "destructive",
          });
        }
      }

      setInlineImages((prev) => [...prev, ...newImages]);
      setIsDraggingImage(false);
    },
    [toast]
  );

  // Handle PDF upload
  const handlePdfFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const newPdfs: PdfAttachment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file type
        if (file.type !== "application/pdf") {
          toast({
            title: "Invalid file type",
            description: `${file.name} is not a PDF`,
            variant: "destructive",
          });
          continue;
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds 10MB limit`,
            variant: "destructive",
          });
          continue;
        }

        try {
          // Convert to base64
          const base64 = await fileToBase64(file);

          newPdfs.push({
            content: base64,
            filename: file.name,
            size: file.size,
          });
        } catch (error) {
          toast({
            title: "Failed to process PDF",
            description: file.name,
            variant: "destructive",
          });
        }
      }

      setPdfAttachments((prev) => [...prev, ...newPdfs]);
      setIsDraggingPdf(false);
    },
    [toast]
  );

  // File to base64 conversion
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Drag and drop handlers for images
  const handleImageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImage(true);
  }, []);

  const handleImageDragLeave = useCallback(() => {
    setIsDraggingImage(false);
  }, []);

  const handleImageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleImageFiles(e.dataTransfer.files);
    },
    [handleImageFiles]
  );

  // Drag and drop handlers for PDFs
  const handlePdfDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPdf(true);
  }, []);

  const handlePdfDragLeave = useCallback(() => {
    setIsDraggingPdf(false);
  }, []);

  const handlePdfDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handlePdfFiles(e.dataTransfer.files);
    },
    [handlePdfFiles]
  );

  // Handle form submission
  const handleSend = useCallback(() => {
    // Validation
    if (!subject.trim()) {
      toast({
        title: "Missing subject",
        description: "Please enter an email subject",
        variant: "destructive",
      });
      return;
    }

    if (!bodyHtml.trim()) {
      toast({
        title: "Missing body",
        description: "Please enter email content",
        variant: "destructive",
      });
      return;
    }

    if (selectedRecipients.length === 0) {
      toast({
        title: "No recipients",
        description: "Please select at least one recipient",
        variant: "destructive",
      });
      return;
    }

    // Build recipient criteria
    const profileIds: string[] = [];
    const departments: string[] = [];
    const roles: Array<'admin' | 'management' | 'staff' | 'freelance'> = [];

    selectedRecipients.forEach((recipient) => {
      if (recipient.type === "individual" && recipient.profileId) {
        profileIds.push(recipient.profileId);
      } else if (recipient.type === "department" && recipient.department) {
        departments.push(recipient.department);
      } else if (recipient.type === "role" && recipient.role) {
        roles.push(recipient.role);
      }
    });

    const request: SendCorporateEmailRequest = {
      subject,
      bodyHtml,
      recipients: {
        profileIds: profileIds.length > 0 ? profileIds : undefined,
        departments: departments.length > 0 ? departments : undefined,
        roles: roles.length > 0 ? roles : undefined,
      },
      pdfAttachments: pdfAttachments.length > 0 ? pdfAttachments : undefined,
      inlineImages: inlineImages.length > 0 ? inlineImages : undefined,
    };

    sendEmailMutation.mutate(request);
  }, [subject, bodyHtml, selectedRecipients, pdfAttachments, inlineImages, toast, sendEmailMutation]);

  // Get unique departments and roles for quick selection
  const uniqueDepartments = Array.from(new Set(profiles.map((p) => p.department).filter(Boolean)));
  const roleOptions: Array<{ value: 'admin' | 'management' | 'staff' | 'freelance'; label: string }> = [
    { value: "admin", label: "Administradores" },
    { value: "management", label: "Gestión" },
    { value: "staff", label: "Personal" },
    { value: "freelance", label: "Freelance" },
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Redactar Email Corporativo
        </CardTitle>
        <CardDescription>
          Los correos se enviarán desde tu departamento (ej: "Sonido - Sector-Pro")
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recipient selector */}
        <div className="space-y-2">
          <Label htmlFor="recipients">Destinatarios</Label>
          <p className="text-xs text-muted-foreground">
            Múltiples filtros se combinan con lógica AND (ej: "Sonido" + "Personal" = solo personal de sonido)
          </p>
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedRecipients.map((recipient) => (
              <Badge key={recipient.id} variant="secondary" className="gap-1">
                {recipient.label}
                <button
                  type="button"
                  onClick={() => removeRecipient(recipient.id)}
                  className="ml-1 hover:bg-secondary-foreground/20 rounded-full"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          <Popover open={recipientPopoverOpen} onOpenChange={setRecipientPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                Seleccionar destinatarios...
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Buscar por nombre, email o departamento..."
                  value={recipientSearch}
                  onValueChange={setRecipientSearch}
                />
                <CommandEmpty>No se encontraron resultados</CommandEmpty>

                {/* Quick role selection */}
                <CommandGroup heading="Por rol">
                  {roleOptions.map((role) => (
                    <CommandItem
                      key={role.value}
                      onSelect={() => {
                        addRecipient({
                          id: `role_${role.value}`,
                          label: role.label,
                          type: "role",
                          role: role.value,
                        });
                      }}
                    >
                      {role.label}
                    </CommandItem>
                  ))}
                </CommandGroup>

                {/* Department selection */}
                {uniqueDepartments.length > 0 && (
                  <CommandGroup heading="Por departamento">
                    {uniqueDepartments.slice(0, 5).map((dept) => (
                      <CommandItem
                        key={dept}
                        onSelect={() => {
                          addRecipient({
                            id: `dept_${dept}`,
                            label: `Departamento: ${dept}`,
                            type: "department",
                            department: dept,
                          });
                        }}
                      >
                        {dept}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {/* Individual profiles */}
                <CommandGroup heading="Individuales">
                  {profiles.slice(0, 10).map((profile) => {
                    const name = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
                    return (
                      <CommandItem
                        key={profile.id}
                        onSelect={() => {
                          addRecipient({
                            id: `profile_${profile.id}`,
                            label: name || profile.email || "Sin nombre",
                            type: "individual",
                            profileId: profile.id,
                          });
                        }}
                      >
                        <div className="flex flex-col">
                          <span>{name || "Sin nombre"}</span>
                          <span className="text-xs text-muted-foreground">{profile.email}</span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <Label htmlFor="subject">Asunto</Label>
          <Input
            id="subject"
            placeholder="Asunto del correo..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        {/* Body */}
        <div className="space-y-2">
          <Label htmlFor="body">Mensaje (HTML permitido)</Label>
          <Textarea
            id="body"
            placeholder="Escribe tu mensaje aquí... Puedes usar HTML básico."
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={10}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Tu mensaje será envuelto en la plantilla corporativa con logos de Sector Pro y Área Técnica.
          </p>
        </div>

        {/* Inline image upload zone */}
        <div className="space-y-2">
          <Label>Imágenes (para insertar en el mensaje)</Label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDraggingImage
                ? "border-primary bg-primary/10"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragOver={handleImageDragOver}
            onDragLeave={handleImageDragLeave}
            onDrop={handleImageDrop}
            onClick={() => imageInputRef.current?.click()}
          >
            <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Arrastra imágenes aquí o haz clic para seleccionar
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPEG, GIF (máx. 5MB cada una) · Las imágenes se eliminan automáticamente después del envío
            </p>
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleImageFiles(e.target.files)}
          />
          {inlineImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {inlineImages.map((img) => (
                <Badge key={img.cid} variant="outline" className="gap-1">
                  <ImageIcon className="h-3 w-3" />
                  {img.filename}
                  <button
                    type="button"
                    onClick={() =>
                      setInlineImages((prev) => prev.filter((i) => i.cid !== img.cid))
                    }
                    className="ml-1 hover:bg-secondary-foreground/20 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* PDF attachment upload zone */}
        <div className="space-y-2">
          <Label>Archivos adjuntos (PDF)</Label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDraggingPdf
                ? "border-primary bg-primary/10"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragOver={handlePdfDragOver}
            onDragLeave={handlePdfDragLeave}
            onDrop={handlePdfDrop}
            onClick={() => pdfInputRef.current?.click()}
          >
            <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Arrastra PDFs aquí o haz clic para seleccionar
            </p>
            <p className="text-xs text-muted-foreground mt-1">PDF (máx. 10MB cada uno)</p>
          </div>
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handlePdfFiles(e.target.files)}
          />
          {pdfAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {pdfAttachments.map((pdf, idx) => (
                <Badge key={idx} variant="outline" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {pdf.filename}
                  <button
                    type="button"
                    onClick={() =>
                      setPdfAttachments((prev) => prev.filter((p) => p.filename !== pdf.filename))
                    }
                    className="ml-1 hover:bg-secondary-foreground/20 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={sendEmailMutation.isPending}
          className="w-full"
          size="lg"
        >
          <Send className="mr-2 h-4 w-4" />
          {sendEmailMutation.isPending ? "Enviando..." : "Enviar Email"}
        </Button>
      </CardContent>
    </Card>
  );
}
