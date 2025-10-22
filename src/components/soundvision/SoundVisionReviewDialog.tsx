import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SoundVisionFile } from '@/hooks/useSoundVisionFiles';
import { useSoundVisionFileReviews } from '@/hooks/useSoundVisionFileReviews';
import { StarRating } from './StarRating';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface SoundVisionReviewDialogProps {
  file: SoundVisionFile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserRole: string | null;
}

export const SoundVisionReviewDialog = ({ file, open, onOpenChange, currentUserRole }: SoundVisionReviewDialogProps) => {
  const {
    reviews,
    currentUserReview,
    userId,
    isLoading,
    createReview,
    updateReview,
    deleteReview,
  } = useSoundVisionFileReviews(file.id);

  const [rating, setRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState('');

  const isSaving = createReview.isPending || updateReview.isPending;
  const isDeleting = deleteReview.isPending;
  const isManagement = currentUserRole === 'admin' || currentUserRole === 'management';
  const canLeaveNewReview = isManagement || file.hasDownloaded;
  const hasExistingReview = Boolean(currentUserReview);
  const canInteractWithForm = !!userId && (hasExistingReview || canLeaveNewReview);

  useEffect(() => {
    if (!open) return;
    if (currentUserReview) {
      setRating(currentUserReview.rating);
      setReviewText(currentUserReview.review ?? '');
    } else {
      setRating(0);
      setReviewText('');
    }
  }, [currentUserReview, open]);

  const reviewStats = useMemo(() => {
    const count = reviews.length;
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return {
      count,
      average: count > 0 ? total / count : null,
    };
  }, [reviews]);

  const averageText = useMemo(() => {
    if (reviewStats.count > 0 && reviewStats.average !== null) {
      return `${reviewStats.average.toFixed(1)} / 5 · ${reviewStats.count} ${
        reviewStats.count === 1 ? 'reseña' : 'reseñas'
      }`;
    }

    if (file.ratings_count > 0 && file.average_rating !== null) {
      return `${file.average_rating.toFixed(1)} / 5 · ${file.ratings_count} ${
        file.ratings_count === 1 ? 'reseña' : 'reseñas'
      }`;
    }

    return 'Sin reseñas registradas';
  }, [file.average_rating, file.ratings_count, reviewStats]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId) {
      toast.error('Debes iniciar sesión para dejar una reseña.');
      return;
    }

    if (!canLeaveNewReview && !hasExistingReview) {
      toast.error('Descarga el archivo antes de dejar una reseña.');
      return;
    }

    if (rating < 1) {
      toast.error('Selecciona una valoración entre 1 y 5 estrellas.');
      return;
    }

    const payload = {
      rating,
      review: reviewText.trim() ? reviewText.trim() : undefined,
    };

    try {
      if (currentUserReview) {
        await updateReview.mutateAsync({
          reviewId: currentUserReview.id,
          rating: payload.rating,
          review: payload.review,
        });
      } else {
        await createReview.mutateAsync(payload);
      }
    } catch (error) {
      console.error('Error saving review', error);
    }
  };

  const handleDelete = async () => {
    if (!currentUserReview) return;
    try {
      await deleteReview.mutateAsync(currentUserReview.id);
    } catch (error) {
      console.error('Error deleting review', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reseñas para {file.file_name}</DialogTitle>
          <DialogDescription>
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm">
                <StarRating value={reviewStats.average ?? file.average_rating ?? 0} readOnly />
                <span className="text-muted-foreground">{averageText}</span>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Tu valoración</p>
                {currentUserReview && (
                  <Badge variant="secondary">Última actualización {formatDistanceToNow(new Date(currentUserReview.updated_at), { addSuffix: true, locale: es })}</Badge>
                )}
              </div>
              <StarRating value={rating} onChange={setRating} readOnly={!canInteractWithForm || isSaving || isDeleting} size="lg" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="soundvision-review-text">
                Comentarios (opcional)
              </label>
              <Textarea
                id="soundvision-review-text"
                placeholder="Comparte detalles útiles sobre este archivo..."
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
                disabled={!canInteractWithForm || isSaving || isDeleting}
                rows={4}
              />
              {!userId && (
                <p className="text-xs text-muted-foreground">Inicia sesión para dejar una reseña.</p>
              )}
              {userId && !hasExistingReview && !canLeaveNewReview && (
                <p className="text-xs text-muted-foreground">Descarga el archivo para poder dejar una reseña.</p>
              )}
            </div>
            <DialogFooter className="flex items-center justify-between gap-4">
              {currentUserReview ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-destructive"
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  <span className="ml-2">Eliminar reseña</span>
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={!canInteractWithForm || isSaving || isDeleting}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {currentUserReview ? 'Actualizar reseña' : 'Publicar reseña'}
              </Button>
            </DialogFooter>
          </form>

          <div className="space-y-3">
            <p className="text-sm font-medium">Todas las reseñas</p>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay reseñas para este archivo.</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {review.reviewer
                            ? `${review.reviewer.first_name ?? ''} ${review.reviewer.last_name ?? ''}`.trim() || 'Usuario'
                            : 'Usuario'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(review.updated_at), { addSuffix: true, locale: es })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StarRating value={review.rating} readOnly size="sm" />
                        {review.is_initial && <Badge variant="outline">Inicial</Badge>}
                      </div>
                    </div>
                    {review.review && (
                      <p className="text-sm text-muted-foreground whitespace-pre-line">{review.review}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
