// Unified interface for chat completion across different providers
export interface UnifiedChatCompletionParams {
  model: string;
  messages: unknown; // Allow flexible message formats for compatibility
}

export interface UnifiedChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      images?: Array<{
        type: 'image_url';
        image_url: { url: string };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface RotatingApiClientOptions {
  maxRetries?: number;
  retryDelay?: number;
}

// Constants for better maintainability
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;
const _RETRYABLE_STATUS_CODES = new Set([401, 429, 503]); // Reserved for future use

export interface ApiError extends Error {
  status?: number;
  code?: number;
}

export abstract class RotatingApiClient<T> {
  protected client?: T;
  protected readonly createClientFn: (apiKey: string) => T;
  protected readonly options: Required<RotatingApiClientOptions>;
  protected readonly apiKey: string;

  constructor(apiKey: string, createClientFn: (apiKey: string) => T, options: RotatingApiClientOptions = {}) {
    this.apiKey = apiKey.trim();
    this.createClientFn = createClientFn;
    this.options = {
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      retryDelay: options.retryDelay ?? DEFAULT_RETRY_DELAY,
    };

    this.initializeClient();
  }

  protected initializeClient(): void {
    const apiKey = this.apiKey;

    if (apiKey) {
      try {
        this.client = this.createClientFn(apiKey);
      } catch (error) {
        console.error('[RotatingApiClient] Client initialization failed:', error);
        throw error;
      }
    }
  }

  protected isRetryableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const apiError = error as ApiError;
    const status = apiError.status || apiError.code;

    // Retry on 401 (unauthorized), 429 (rate limit), 503 (service unavailable), and 5xx errors
    return status === 401 || status === 429 || status === 503 || (status >= 500 && status < 600);
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async executeWithRetry<R>(operation: (client: T) => Promise<R>): Promise<R> {
    if (!this.client) {
      throw new Error('Client not initialized - no valid API key provided');
    }

    let lastError: unknown;

    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      try {
        return await operation(this.client);
      } catch (error) {
        lastError = error;

        const isLastAttempt = attempt === this.options.maxRetries - 1;

        if (!this.isRetryableError(error) || isLastAttempt) {
          break;
        }

        // Regular retry with delay
        await this.delay(this.options.retryDelay * (attempt + 1));
      }
    }

    throw lastError;
  }
}
