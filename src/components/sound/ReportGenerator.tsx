import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { useJobSelection } from "@/hooks/useJobSelection";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

const reportSections = [
  {
    pageNumber: 1,
    title: "EQUIPAMIENTO",
    type: "text"
  },
  {
    pageNumber: 2,
    title: "SPL(A) Broadband",
    hasIsoView: true
  },
  {
    pageNumber: 3,
    title: "SPL(Z) 250-16k",
    hasIsoView: true
  },
  {
    pageNumber: 4,
    title: "SUBS SPL(Z) 32-80Hz",
    hasIsoView: false
  }
];

export const ReportGenerator = () => {
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [equipamiento, setEquipamiento] = useState("");
  const [images, setImages] = useState<{ [key: string]: File | null }>({});
  const [isoViewEnabled, setIsoViewEnabled] = useState<{ [key: string]: boolean }>({});

  const handleImageChange = (section: string, view: string, file: File | null) => {
    const key = `${section}-${view}`;
    setImages(prev => ({ ...prev, [key]: file }));
  };

  const toggleIsoView = (section: string) => {
    setIsoViewEnabled(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const addPageHeader = async (pdf: jsPDF, pageNumber: number, jobTitle: string, jobDate: string) => {
    return new Promise<void>((resolve) => {
      const pageWidth = pdf.internal.pageSize.getWidth();
      const logoPath = '/lovable-uploads/a2246e0e-373b-4091-9471-1a7c00fe82ed.png';
      
      // Purple header background
      pdf.setFillColor(125, 1, 1);
      pdf.rect(0, 0, pageWidth, 40, 'F');

      // White text for header
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.text("SOUNDVISION REPORT", pageWidth / 2, 15, { align: 'center' });

      // Job title and date
      pdf.setFontSize(14);
      pdf.text(jobTitle, pageWidth / 2, 25, { align: 'center' });
      pdf.text(jobDate, pageWidth / 2, 33, { align: 'center' });

      // Page number
      pdf.setFontSize(12);
      pdf.text(pageNumber.toString(), pageWidth - 10, 15, { align: 'right' });

      // Add the logo
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.src = logoPath;

      logo.onload = () => {
        const logoWidth = 30;
        const logoHeight = logoWidth * (logo.height / logo.width);
        const logoX = pageWidth - logoWidth - 10;
        const logoY = 5;

        try {
          pdf.addImage(logo, 'PNG', logoX, logoY, logoWidth, logoHeight);
        } catch (error) {
          console.error('Error adding header logo:', error);
        }
        resolve();
      };

      logo.onerror = () => {
        console.error('Failed to load header logo');
        resolve();
      };
    });
  };

  const generatePDF = async () => {
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "Please select a job before generating the report.",
        variant: "destructive",
      });
      return;
    }

    const selectedJob = jobs?.find(job => job.id === selectedJobId);
    const jobTitle = selectedJob?.title || "Unnamed_Job";
    const jobDate = selectedJob?.start_time 
      ? format(new Date(selectedJob.start_time), "MMMM dd, yyyy")
      : format(new Date(), "MMMM dd, yyyy");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const margin = 20;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (2 * margin);

    // Page 1: Equipment
    await addPageHeader(pdf, 1, jobTitle, jobDate);
    pdf.setFontSize(14);
    pdf.setTextColor(51, 51, 51);
    pdf.setFont(undefined, 'bold');
    pdf.text("EQUIPAMIENTO:", margin, margin + 45);
    pdf.setFont(undefined, 'normal');
    
    const equipLines = equipamiento.split('\n').filter(line => line.trim());
    let yPos = margin + 55;
    
    equipLines.forEach(line => {
      pdf.setFontSize(11);
      pdf.text(line.trim(), margin, yPos);
      yPos += 7;
    });

    // Add disclaimer text
    pdf.setFontSize(9);
    pdf.text("ALL PLOTS CALCULATED FOR 15º C / 70% REL HUMIDITY @ 0dbU INPUT LEVEL", margin, yPos + 10);

    // Image pages
    for (let i = 1; i < reportSections.length; i++) {
      const section = reportSections[i];
      pdf.addPage();
      await addPageHeader(pdf, section.pageNumber, jobTitle, jobDate);
      
      // Bold section title
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(51, 51, 51);
      pdf.text(section.title, margin, 50);
      pdf.setFont(undefined, 'normal');
      
      const topViewKey = `${section.title}-Top View`;
      if (images[topViewKey]) {
        await addImageToPDF(pdf, images[topViewKey], "Top View", margin, 60, contentWidth);
      }

      if (section.hasIsoView && isoViewEnabled[section.title]) {
        const isoViewKey = `${section.title}-ISO View`;
        if (images[isoViewKey]) {
          await addImageToPDF(pdf, images[isoViewKey], "ISO View", margin, 160, contentWidth);
        }
      }
    }

    // Add footer logo (Sector Pro)
    const footerLogo = new Image();
    footerLogo.crossOrigin = 'anonymous';
    footerLogo.src = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';
    
    footerLogo.onload = () => {
      pdf.setPage(pdf.getNumberOfPages());
      const logoWidth = 50;
      const logoHeight = logoWidth * (footerLogo.height / footerLogo.width);
      const xPosition = (pageWidth - logoWidth) / 2;
      const yPosition = pageHeight - 20;
      
      try {
        pdf.addImage(footerLogo, 'PNG', xPosition, yPosition - logoHeight, logoWidth, logoHeight);
        const blob = pdf.output('blob');
        const filename = `SoundVision_Report_${jobTitle.replace(/\s+/g, "_")}.pdf`;
        pdf.save(filename);
        toast({
          title: "Success",
          description: "Report generated successfully",
        });
      } catch (error) {
        console.error('Error adding footer logo:', error);
        const blob = pdf.output('blob');
        const filename = `SoundVision_Report_${jobTitle.replace(/\s+/g, "_")}.pdf`;
        pdf.save(filename);
        toast({
          title: "Success",
          description: "Report generated successfully (without logo)",
        });
      }
    };

    footerLogo.onerror = () => {
      console.error('Failed to load footer logo');
      const filename = `SoundVision_Report_${jobTitle.replace(/\s+/g, "_")}.pdf`;
      pdf.save(filename);
      toast({
        title: "Success",
        description: "Report generated successfully (without logo)",
      });
    };
  };

  const addImageToPDF = async (pdf: jsPDF, file: File, viewType: string, x: number, y: number, width: number) => {
    return new Promise<void>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imgData = e.target?.result as string;
        const height = width * 0.6; // Maintain aspect ratio
        pdf.addImage(imgData, "JPEG", x, y, width, height);
        resolve();
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">SoundVision Report Generator</CardTitle>
      </CardHeader>
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="jobSelect">Job</Label>
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a job" />
              </SelectTrigger>
              <SelectContent>
                {jobs?.map(job => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="equipamiento">Equipment List</Label>
            <Textarea
              id="equipamiento"
              value={equipamiento}
              onChange={(e) => setEquipamiento(e.target.value)}
              placeholder="24 L'ACOUSTICS K1 (MAIN ARRAYS)&#10;06 L'ACOUSTICS KARA (DOWNFILLS)"
              className="min-h-[96px] bg-background text-foreground"
            />
          </div>

          {reportSections.slice(1).map((section) => (
            <div key={section.title} className="space-y-2 pb-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{section.title}</Label>
                {section.hasIsoView && (
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id={`iso-${section.title}`}
                      checked={isoViewEnabled[section.title]}
                      onCheckedChange={() => toggleIsoView(section.title)}
                    />
                    <Label htmlFor={`iso-${section.title}`} className="text-xs">
                      Include ISO
                    </Label>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Top View</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(section.title, "Top View", e.target.files?.[0] || null)}
                    className="text-sm"
                  />
                </div>

                {section.hasIsoView && isoViewEnabled[section.title] && (
                  <div className="space-y-1">
                    <Label className="text-xs">ISO View</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageChange(section.title, "ISO View", e.target.files?.[0] || null)}
                      className="text-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}

          <Button onClick={generatePDF} className="w-full mt-4">
            Generate Report
          </Button>
        </CardContent>
      </ScrollArea>
    </Card>
  );
};
