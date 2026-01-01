import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useJobSelection } from "@/hooks/useJobSelection";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { fetchJobLogo } from "@/utils/pdf/logoUtils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FolderOpen, Check, X, Upload } from "lucide-react";
import { loadJsPDF } from "@/utils/pdf/lazyPdf";

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

// Filename mapping for auto-import
const FILENAME_MAPPING = {
  'ISO_A': { section: 'SPL(A) Broadband', view: 'ISO View' },
  'TOP_A': { section: 'SPL(A) Broadband', view: 'Top View' },
  'ISO_C': { section: 'SPL(Z) 250-16k', view: 'ISO View' },
  'TOP_C': { section: 'SPL(Z) 250-16k', view: 'Top View' },
  'SUB': { section: 'SUBS SPL(Z) 32-80Hz', view: 'Top View' }
};

type MappingResult = {
  found: { filename: string; section: string; view: string }[];
  missing: { filename: string; section: string; view: string }[];
};

export const ReportGenerator = () => {
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [reportSystem, setReportSystem] = useState<"LA" | "Turbo">("LA");
  const [equipamiento, setEquipamiento] = useState("");
  const [images, setImages] = useState<{ [key: string]: File | null }>({});
  const [isoViewEnabled, setIsoViewEnabled] = useState<{ [key: string]: boolean }>({});
  const [jobLogo, setJobLogo] = useState<string | undefined>(undefined);
  const [mappingResult, setMappingResult] = useState<MappingResult | null>(null);
  const [showMappingPreview, setShowMappingPreview] = useState(false);

  useEffect(() => {
    const loadJobLogo = async () => {
      if (selectedJobId) {
        try {
          const logoUrl = await fetchJobLogo(selectedJobId);
          setJobLogo(logoUrl);
          console.log("Job logo loaded:", logoUrl);
        } catch (error) {
          console.error("Error loading job logo:", error);
          setJobLogo(undefined);
        }
      } else {
        setJobLogo(undefined);
      }
    };

    loadJobLogo();
  }, [selectedJobId]);

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

  const handleFolderSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const found: { filename: string; section: string; view: string }[] = [];
    const missing: { filename: string; section: string; view: string }[] = [];
    const newImages: { [key: string]: File | null } = { ...images };
    const newIsoEnabled = { ...isoViewEnabled };

    // Check each expected filename
    Object.entries(FILENAME_MAPPING).forEach(([filename, mapping]) => {
      const matchingFile = Array.from(files).find(file => {
        const fileBaseName = file.name.toLowerCase().split('.')[0];
        return fileBaseName === filename.toLowerCase();
      });

      if (matchingFile) {
        found.push({ filename: matchingFile.name, section: mapping.section, view: mapping.view });
        const key = `${mapping.section}-${mapping.view}`;
        newImages[key] = matchingFile;
        
        // Auto-enable ISO view if ISO file is found
        if (mapping.view === 'ISO View') {
          newIsoEnabled[mapping.section] = true;
        }
      } else {
        missing.push({ filename: `${filename}.png`, section: mapping.section, view: mapping.view });
      }
    });

    setImages(newImages);
    setIsoViewEnabled(newIsoEnabled);
    setMappingResult({ found, missing });
    setShowMappingPreview(true);

    // Show toast with results
    toast({
      title: "Auto-mapping Complete",
      description: `Found ${found.length} files, ${missing.length} missing`,
    });

    // Reset the input
    event.target.value = '';
  };

  const clearAutoMapping = () => {
    setImages({});
    setIsoViewEnabled({});
    setMappingResult(null);
    setShowMappingPreview(false);
    toast({
      title: "Mapping Cleared",
      description: "All auto-mapped files have been cleared",
    });
  };

  const addPageHeader = async (pdf: jsPDF, pageNumber: number, jobTitle: string, jobDate: string) => {
    return new Promise<void>((resolve) => {
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      // Select the appropriate logo based on the report system
      const logoPath = reportSystem === "LA" 
        ? '/lovable-uploads/a2246e0e-373b-4091-9471-1a7c00fe82ed.png'
        : '/lovable-uploads/e78ab52e-aa81-4770-a6bb-f802a5ff651e.png';
      
      // Purple header background
      pdf.setFillColor(125, 1, 1);
      pdf.rect(0, 0, pageWidth, 40, 'F');

      // White text for header
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      
      // Use different header text based on selection
      const headerText = reportSystem === "LA" ? "SOUNDVISION REPORT" : "EASE FOCUS REPORT";
      pdf.text(headerText, pageWidth / 2, 15, { align: 'center' });

      // Job title and date
      pdf.setFontSize(14);
      pdf.text(jobTitle, pageWidth / 2, 25, { align: 'center' });
      pdf.text(jobDate, pageWidth / 2, 33, { align: 'center' });

      // Page number
      pdf.setFontSize(12);
      pdf.text(pageNumber.toString(), pageWidth - 10, 15, { align: 'right' });

      const promises = [];
      
      // Add the job logo if available (left-aligned, smaller)
      if (jobLogo) {
        promises.push(
          new Promise<void>((resolveLogo) => {
            const jobLogoImg = new Image();
            jobLogoImg.crossOrigin = 'anonymous';
            jobLogoImg.src = jobLogo;
            
            jobLogoImg.onload = () => {
              const logoHeight = 7.5; // 1/4 of original size
              const logoWidth = logoHeight * (jobLogoImg.width / jobLogoImg.height);
              const logoX = 10; // Left position
              const logoY = 5;
              
              try {
                pdf.addImage(jobLogoImg, 'PNG', logoX, logoY, logoWidth, logoHeight);
              } catch (error) {
                console.error('Error adding job logo:', error);
              }
              resolveLogo();
            };
            
            jobLogoImg.onerror = () => {
              console.error('Failed to load job logo');
              resolveLogo();
            };
          })
        );
      }

      // Add the standard logo (right-aligned)
      promises.push(
        new Promise<void>((resolveLogo) => {
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
            resolveLogo();
          };

          logo.onerror = () => {
            console.error('Failed to load header logo');
            resolveLogo();
          };
        })
      );

      Promise.all(promises).then(() => resolve());
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

    const jsPDF = await loadJsPDF();
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
        const filename = `${reportSystem === "LA" ? "SoundVision" : "EaseFocus"}_Report_${jobTitle.replace(/\s+/g, "_")}.pdf`;
        pdf.save(filename);
        toast({
          title: "Success",
          description: "Report generated successfully",
        });
      } catch (error) {
        console.error('Error adding footer logo:', error);
        const blob = pdf.output('blob');
        const filename = `${reportSystem === "LA" ? "SoundVision" : "EaseFocus"}_Report_${jobTitle.replace(/\s+/g, "_")}.pdf`;
        pdf.save(filename);
        toast({
          title: "Success",
          description: "Report generated successfully (without logo)",
        });
      }
    };

    footerLogo.onerror = () => {
      console.error('Failed to load footer logo');
      const filename = `${reportSystem === "LA" ? "SoundVision" : "EaseFocus"}_Report_${jobTitle.replace(/\s+/g, "_")}.pdf`;
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
    <Card className="w-full max-w-4xl mx-auto my-6">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          SoundVision Report Generator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Job Selection */}
          <div className="space-y-2">
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

          {/* Report System Selection */}
          <div className="space-y-2">
            <Label className="mb-2">Report System</Label>
            <RadioGroup 
              value={reportSystem}
              onValueChange={(value) => setReportSystem(value as "LA" | "Turbo")}
              className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="LA" id="r-la" />
                <Label htmlFor="r-la" className="cursor-pointer">L'Acoustics</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Turbo" id="r-turbo" />
                <Label htmlFor="r-turbo" className="cursor-pointer">Turbosound</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Equipment List */}
          <div className="space-y-2">
            <Label htmlFor="equipamiento">Equipment List</Label>
            <Textarea
              id="equipamiento"
              value={equipamiento}
              onChange={(e) => setEquipamiento(e.target.value)}
              placeholder="24 L'ACOUSTICS K1 (MAIN ARRAYS)&#10;06 L'ACOUSTICS KARA (DOWNFILLS)"
              className="min-h-[96px] bg-background text-foreground"
            />
          </div>

          {/* Auto-mapping section */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <Label className="text-sm font-medium">Auto-map Images from Folder</Label>
              {mappingResult && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAutoMapping}
                  className="text-xs w-full sm:w-auto"
                >
                  Clear Mapping
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Label htmlFor="folderSelect" className="cursor-pointer flex-1 sm:flex-initial">
                <div className="flex items-center justify-center sm:justify-start gap-2 px-3 py-2 border rounded-md hover:bg-background transition-colors">
                  <FolderOpen className="h-4 w-4" />
                  <span className="text-sm">Select Folder</span>
                </div>
              </Label>
              <input
                id="folderSelect"
                type="file"
                {...({ webkitdirectory: "" } as any)}
                multiple
                onChange={handleFolderSelection}
                className="hidden"
              />
            </div>

            <div className="text-xs text-muted-foreground">
              Expected files: ISO_A.png, TOP_A.png, ISO_C.png, TOP_C.png, SUB.png
            </div>

            {/* Mapping preview */}
            {showMappingPreview && mappingResult && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Mapping Results:</Label>
                <ScrollArea className="max-h-48">
                  <div className="space-y-1 pr-4">
                    {mappingResult.found.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                        <span className="font-mono text-xs break-all">{item.filename}</span>
                        <span className="text-muted-foreground flex-shrink-0">→</span>
                        <span className="text-xs">{item.section} ({item.view})</span>
                      </div>
                    ))}
                    {mappingResult.missing.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <X className="h-3 w-3 text-red-600 flex-shrink-0" />
                        <span className="font-mono text-muted-foreground text-xs break-all">{item.filename}</span>
                        <span className="text-muted-foreground flex-shrink-0">→</span>
                        <span className="text-muted-foreground text-xs">{item.section} ({item.view})</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Image Upload Sections */}
          <div className="space-y-4">
            {reportSections.slice(1).map((section) => {
              const topViewKey = `${section.title}-Top View`;
              const isoViewKey = `${section.title}-ISO View`;
              const hasTopImage = images[topViewKey];
              const hasIsoImage = images[isoViewKey];

              return (
                <div key={section.title} className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <Label className="text-sm font-medium">{section.title}</Label>
                    {section.hasIsoView && (
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id={`iso-${section.title}`}
                          checked={isoViewEnabled[section.title]}
                          onCheckedChange={() => toggleIsoView(section.title)}
                        />
                        <Label htmlFor={`iso-${section.title}`} className="text-xs cursor-pointer">
                          Include ISO View
                        </Label>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-medium">Top View</Label>
                        {hasTopImage && <Check className="h-3 w-3 text-green-600" />}
                      </div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageChange(section.title, "Top View", e.target.files?.[0] || null)}
                        className="text-sm"
                      />
                      {hasTopImage && (
                        <div className="text-xs text-muted-foreground">
                          📁 {hasTopImage.name}
                        </div>
                      )}
                    </div>

                    {section.hasIsoView && isoViewEnabled[section.title] && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs font-medium">ISO View</Label>
                          {hasIsoImage && <Check className="h-3 w-3 text-green-600" />}
                        </div>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageChange(section.title, "ISO View", e.target.files?.[0] || null)}
                          className="text-sm"
                        />
                        {hasIsoImage && (
                          <div className="text-xs text-muted-foreground">
                            📁 {hasIsoImage.name}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Generate Button */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={generatePDF} className="w-full">
              Generate Report
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
