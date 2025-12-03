/**
 * API helper functions
 */

/**
 * Extracts data from axios response
 * @param promise - Axios request promise
 * @returns Promise resolving to response data
 */
export async function handleApiResponse<T>(promise: Promise<any>): Promise<T> {
  try {
    const response = await promise;
    return response.data;
  } catch (error: any) {
    // Extract error message from response
    const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Unknown error occurred';
    
    // Check for rate limit/quota errors
    if (errorMessage.includes('quota') || errorMessage.includes('rate limit') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('API quota exceeded. Please try switching to a different model (e.g., OpenAI) or wait a moment and try again.');
    }
    
    // Check for API key errors
    if (errorMessage.includes('API key') || errorMessage.includes('authentication') || errorMessage.includes('401') || errorMessage.includes('403')) {
      throw new Error('API authentication failed. Please check your API keys.');
    }
    
    throw new Error(errorMessage);
  }
}

