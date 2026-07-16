/**
 * AI Provider Factory
 *
 * Instantiates the correct AI Provider implementation.
 */

import type { IAiProvider } from '../interfaces/ai-engine.interfaces';
import { OpenAiProvider, MockAiProvider } from './ai-providers';
import { PROVIDER_OPENAI, PROVIDER_MOCK } from '../constants/ai-engine.constants';

export class AiProviderFactory {
  private readonly mockProvider: MockAiProvider;

  constructor(mockProvider?: MockAiProvider) {
    this.mockProvider = mockProvider || new MockAiProvider();
  }

  public getProvider(providerName: string, apiKey?: string): IAiProvider {
    switch (providerName.toLowerCase()) {
      case PROVIDER_OPENAI:
        return new OpenAiProvider(apiKey);
      case PROVIDER_MOCK:
        return this.mockProvider;
      default:
        // Default fallback to mock provider for safety
        return this.mockProvider;
    }
  }
}
