import { Download, Trash2, MapPin, User, Calendar, Star as StarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useDeleteSoundVisionFile, useDownloadSoundVisionFile, SoundVisionFile } from '@/hooks/useSoundVisionFiles';
import { canDeleteSoundVisionFiles } from '@/utils/permissions';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { StarRating } from './StarRating';
import { SoundVisionReviewDialog } from './SoundVisionReviewDialog';

interface SoundVisionFilesListProps {
  files: SoundVisionFile[];
}

export const SoundVisionFilesList = ({ files }: SoundVisionFilesListProps) => {
  const [selectedFile, setSelectedFile] = useState<SoundVisionFile | null>(null);
  const { data: profile } = useQuery({
    queryKey: ['current-user-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      return data;
    },
  });
  
  const deleteFile = useDeleteSoundVisionFile();
  const downloadFile = useDownloadSoundVisionFile();

  const canDelete = canDeleteSoundVisionFiles(profile?.role);
  const isManagement = useMemo(
    () => profile?.role === 'admin' || profile?.role === 'management',
    [profile?.role]
  );

  useEffect(() => {
    if (!selectedFile) return;
    const updated = files.find((file) => file.id === selectedFile.id);
    if (updated && updated !== selectedFile) {
      setSelectedFile(updated);
    }
  }, [files, selectedFile]);

  const canOpenReviews = (file: SoundVisionFile) =>
    isManagement || file.hasDownloaded || file.hasReviewed;

  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg mb-2">No se encontraron archivos</p>
        <p className="text-sm">Intenta ajustar los filtros de búsqueda</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
      {/* Mobile View - Cards */}
      <div className="md:hidden space-y-3">
        {files.map((file) => (
          <div key={file.id} className="border rounded-lg p-4 space-y-3">
            <div className="space-y-1">
              <p className="font-medium">{file.file_name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>
                  {file.venue?.name} - {file.venue?.city}, {file.venue?.country}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-3 w-3" />
                <span>
                  {file.uploader?.first_name} {file.uploader?.last_name}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>
                  {formatDistanceToNow(new Date(file.uploaded_at), {
                    addSuffix: true,
                    locale: es,
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <StarRating value={file.average_rating ?? 0} readOnly size="sm" />
                {file.ratings_count > 0 ? (
                  <span className="text-muted-foreground">
                    {(file.average_rating ?? 0).toFixed(1)} · {file.ratings_count}{' '}
                    {file.ratings_count === 1 ? 'reseña' : 'reseñas'}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Sin reseñas</span>
                )}
              </div>
              {file.hasReviewed && file.current_user_review && (
                <div className="text-xs text-emerald-600 font-medium">
                  Tu valoración: {file.current_user_review.rating} ⭐
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={file.hasReviewed ? 'secondary' : 'outline'}
                onClick={() => setSelectedFile(file)}
                className="flex-1"
                disabled={!canOpenReviews(file)}
                title={!canOpenReviews(file) ? 'Descarga el archivo para poder valorarlo.' : undefined}
              >
                <StarIcon className="h-4 w-4 mr-1" />
                Reseñas
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadFile.mutate(file)}
                disabled={downloadFile.isPending}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-1" />
                Descargar
              </Button>
              {!canOpenReviews(file) && (
                <p className="w-full text-xs text-muted-foreground">
                  Descarga el archivo para poder dejar una reseña.
                </p>
              )}
              {canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Eliminar archivo</AlertDialogTitle>
                      <AlertDialogDescription>
                        ¿Seguro que quieres eliminar "{file.file_name}"? Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteFile.mutate(file.id)}>
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop View - Table */}
      <div className="hidden md:block border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recinto</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Nombre del archivo</TableHead>
              <TableHead>Subido por</TableHead>
              <TableHead>Valoración</TableHead>
              <TableHead>Fecha de subida</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => (
              <TableRow key={file.id}>
                <TableCell className="font-medium">{file.venue?.name}</TableCell>
                <TableCell>
                  {file.venue?.city}, {file.venue?.country}
                </TableCell>
                <TableCell className="font-mono text-sm">{file.file_name}</TableCell>
                <TableCell>
                  {file.uploader?.first_name} {file.uploader?.last_name}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <StarRating value={file.average_rating ?? 0} readOnly size="sm" />
                    {file.ratings_count > 0 ? (
                      <span className="text-sm text-muted-foreground">
                        {(file.average_rating ?? 0).toFixed(1)} · {file.ratings_count}{' '}
                        {file.ratings_count === 1 ? 'reseña' : 'reseñas'}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Sin reseñas</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {formatDistanceToNow(new Date(file.uploaded_at), {
                    addSuffix: true,
                    locale: es,
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end flex-wrap">
                    <Button
                      size="sm"
                      variant={file.hasReviewed ? 'secondary' : 'outline'}
                      onClick={() => setSelectedFile(file)}
                      disabled={!canOpenReviews(file)}
                      title={!canOpenReviews(file) ? 'Descarga el archivo para poder valorarlo.' : undefined}
                    >
                      <StarIcon className="h-4 w-4 mr-1" />
                      Reseñas
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadFile.mutate(file)}
                      disabled={downloadFile.isPending}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Descargar
                    </Button>
                    {!canOpenReviews(file) && (
                      <p className="text-xs text-muted-foreground w-full text-right">
                        Descarga el archivo para poder dejar una reseña.
                      </p>
                    )}
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar archivo</AlertDialogTitle>
                            <AlertDialogDescription>
                              ¿Seguro que quieres eliminar "{file.file_name}"? Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteFile.mutate(file.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {selectedFile && (
        <SoundVisionReviewDialog
          file={selectedFile}
          open={Boolean(selectedFile)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedFile(null);
            }
          }}
          currentUserRole={profile?.role ?? null}
        />
      )}
    </>
  );
};
