import { supabase } from '@/lib/supabase';

// Connection retry utility with exponential backoff
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain error types
      if (error.code === '42P01' || error.code === '42501') {
        throw error;
      }
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.warn(`Retrying database operation (attempt ${attempt + 2}/${maxRetries + 1}) after ${delay}ms`);
    }
  }
  
  throw lastError;
};

// Health check for database connection
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    return !error;
  } catch {
    return false;
  }
};

// Graceful query with fallback
export const safeQuery = async <T>(
  queryFn: () => Promise<{ data: T | null; error: any }> | { data: T | null; error: any },
  fallbackValue: T
): Promise<{ data: T; error: any }> => {
  try {
    const queryResult = queryFn();
    const result = await (queryResult instanceof Promise ? queryResult : Promise.resolve(queryResult));
    return {
      data: result.data || fallbackValue,
      error: result.error
    };
  } catch (error) {
    console.warn('Database query failed, using fallback:', error);
    return {
      data: fallbackValue,
      error: null // Don't propagate error when using fallback
    };
  }
};