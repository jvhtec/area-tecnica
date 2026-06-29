
// Singleton API Service class
export class ApiService {
  private static instance: ApiService;
  
  private constructor() {}
  
  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }
  
  async get<T>(url: string): Promise<T> {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error(`GET request failed for ${url}:`, error);
      throw error;
    }
  }
  
  async post<T>(url: string, data: unknown): Promise<T> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error(`POST request failed for ${url}:`, error);
      throw error;
    }
  }
  
  async put<T>(url: string, data: unknown): Promise<T> {
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error(`PUT request failed for ${url}:`, error);
      throw error;
    }
  }
  
  async delete<T>(url: string): Promise<T> {
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error(`DELETE request failed for ${url}:`, error);
      throw error;
    }
  }
}
