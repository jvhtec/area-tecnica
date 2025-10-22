import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PostgrestError } from '@supabase/supabase-js';

export interface SoundVisionFileReview {
  id: string;
  file_id: string;
  reviewer_id: string;
  rating: number;
  review: string | null;
  is_initial: boolean;
  created_at: string;
  updated_at: string;
  reviewer?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    role: string | null;
  } | null;
}

interface ReviewsQueryResult {
  reviews: SoundVisionFileReview[];
  currentUserReview: SoundVisionFileReview | null;
  userId: string | null;
}

export const useSoundVisionFileReviews = (fileId: string | null | undefined) => {
  const queryClient = useQueryClient();

  const parseReviewErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === 'object') {
      const pgError = error as Partial<PostgrestError> & { message?: string };
      const message = pgError.message ?? '';
      if (
        (pgError.code && ['42501', 'P0001', '23514'].includes(pgError.code)) ||
        message.toLowerCase().includes('soundvision_file_downloads') ||
        message.toLowerCase().includes('row-level security')
      ) {
        return 'Debes descargar el archivo antes de dejar una reseña.';
      }
    }

    if (error instanceof Error && error.message) {
      if (error.message.toLowerCase().includes('descarga el archivo')) {
        return error.message;
      }
    }

    return fallback;
  };

  const query = useQuery<ReviewsQueryResult>({
    queryKey: ['soundvision-file-reviews', fileId],
    enabled: Boolean(fileId),
    queryFn: async () => {
      if (!fileId) {
        return { reviews: [], currentUserReview: null, userId: null };
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { reviews: [], currentUserReview: null, userId: null };
      }

      const { data, error } = await supabase
        .from('soundvision_file_reviews')
        .select(
          `id, file_id, reviewer_id, rating, review, is_initial, created_at, updated_at,
          reviewer:profiles(id, first_name, last_name, role)`
        )
        .eq('file_id', fileId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const reviews = (data ?? []).map((entry) => ({
        id: entry.id,
        file_id: entry.file_id,
        reviewer_id: entry.reviewer_id,
        rating: entry.rating,
        review: entry.review,
        is_initial: entry.is_initial,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
        reviewer: entry.reviewer ?? null,
      }));

      const currentUserReview = reviews.find((review) => review.reviewer_id === user.id) ?? null;

      return { reviews, currentUserReview, userId: user.id };
    },
  });

  const invalidateCaches = (fileIdToInvalidate?: string) => {
    if (!fileIdToInvalidate) return;
    queryClient.invalidateQueries({ queryKey: ['soundvision-file-reviews', fileIdToInvalidate] });
    queryClient.invalidateQueries({ queryKey: ['soundvision-files'] });
  };

  const createReview = useMutation({
    mutationFn: async ({ rating, review }: { rating: number; review?: string }) => {
      if (!fileId) throw new Error('Archivo no válido');

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Usuario no autenticado');

      const { error } = await supabase.from('soundvision_file_reviews').insert({
        file_id: fileId,
        reviewer_id: user.id,
        rating,
        review: review ?? null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      if (fileId) {
        invalidateCaches(fileId);
      }
      toast.success('Reseña guardada correctamente');
    },
    onError: (error) => {
      console.error('Error creating review:', error);
      toast.error(parseReviewErrorMessage(error, 'No se pudo guardar la reseña'));
    },
  });

  const updateReview = useMutation({
    mutationFn: async ({
      reviewId,
      rating,
      review,
    }: {
      reviewId: string;
      rating: number;
      review?: string;
    }) => {
      if (!fileId) throw new Error('Archivo no válido');

      const { error } = await supabase
        .from('soundvision_file_reviews')
        .update({
          rating,
          review: review ?? null,
        })
        .eq('id', reviewId);

      if (error) throw error;
    },
    onSuccess: () => {
      if (fileId) {
        invalidateCaches(fileId);
      }
      toast.success('Reseña actualizada correctamente');
    },
    onError: (error) => {
      console.error('Error updating review:', error);
      toast.error(parseReviewErrorMessage(error, 'No se pudo actualizar la reseña'));
    },
  });

  const deleteReview = useMutation({
    mutationFn: async (reviewId: string) => {
      if (!fileId) throw new Error('Archivo no válido');

      const { error } = await supabase
        .from('soundvision_file_reviews')
        .delete()
        .eq('id', reviewId);

      if (error) throw error;
    },
    onSuccess: () => {
      if (fileId) {
        invalidateCaches(fileId);
      }
      toast.success('Reseña eliminada correctamente');
    },
    onError: (error) => {
      console.error('Error deleting review:', error);
      toast.error(error.message || 'No se pudo eliminar la reseña');
    },
  });

  return {
    reviews: query.data?.reviews ?? [],
    currentUserReview: query.data?.currentUserReview ?? null,
    userId: query.data?.userId ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    createReview,
    updateReview,
    deleteReview,
    refetch: query.refetch,
    query,
  };
};
