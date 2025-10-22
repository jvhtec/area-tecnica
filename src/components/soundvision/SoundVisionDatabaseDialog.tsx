import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SoundVisionFileUploader } from './SoundVisionFileUploader';
import { SoundVisionFilesList } from './SoundVisionFilesList';
import { SoundVisionSearchFilters } from './SoundVisionSearchFilters';
import { useSoundVisionFiles } from '@/hooks/useSoundVisionFiles';
import { Loader2 } from 'lucide-react';

export const SoundVisionDatabaseDialog = () => {
  const [activeTab, setActiveTab] = useState('browse');
  const [searchTerm, setSearchTerm] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [fileType, setFileType] = useState('');

  const { data: files, isLoading } = useSoundVisionFiles({
    searchTerm: searchTerm || undefined,
    city: city && city !== 'all' ? city : undefined,
    country: country && country !== 'all' ? country : undefined,
    stateRegion: stateRegion && stateRegion !== 'all' ? stateRegion : undefined,
    fileType: fileType && fileType !== 'all' ? fileType : undefined,
  });

  const handleClearFilters = () => {
    setSearchTerm('');
    setCity('');
    setCountry('');
    setStateRegion('');
    setFileType('');
  };

  const handleUploadComplete = () => {
    setActiveTab('browse');
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">SoundVision File Database</h1>
        <p className="text-muted-foreground mt-2">
          Upload, browse, and download venue-specific SoundVision files
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="browse">Browse Files</TabsTrigger>
          <TabsTrigger value="upload">Upload New File</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4 mt-4">
          <SoundVisionSearchFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            city={city}
            onCityChange={setCity}
            country={country}
            onCountryChange={setCountry}
            stateRegion={stateRegion}
            onStateRegionChange={setStateRegion}
            fileType={fileType}
            onFileTypeChange={setFileType}
            onClearFilters={handleClearFilters}
          />

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <SoundVisionFilesList files={files || []} />
          )}
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <SoundVisionFileUploader onUploadComplete={handleUploadComplete} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
