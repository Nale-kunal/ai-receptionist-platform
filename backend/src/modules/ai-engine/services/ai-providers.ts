/**
 * AI Engine Provider Implementations
 *
 * Implements Mock and OpenAI providers without using the OpenAI SDK library.
 */

import type { IAiProvider } from '../interfaces/ai-engine.interfaces';
import type {
  AiMessage,
  AiToolDefinition,
  AiProviderResponse,
  AiToolCall,
} from '../types/ai-engine.types';
import { AiProviderUnavailableError } from '../errors/ai-engine.errors';

// --------------------------------------------------------------------------
// OpenAI Provider (Pure HTTP endpoint)
// --------------------------------------------------------------------------

export class OpenAiProvider implements IAiProvider {
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || 'mock-key';
  }

  public async generateResponse(
    messages: AiMessage[],
    tools: AiToolDefinition[],
    options?: {
      model?: string;
      temperature?: number;
      responseFormat?: 'text' | 'json';
    },
  ): Promise<AiProviderResponse> {
    const model = options?.model || 'gpt-4o-mini';
    const temperature = options?.temperature ?? 0.7;

    const body: Record<string, unknown> = {
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.name ? { name: m.name } : {}),
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
        ...(m.toolCalls
          ? {
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: tc.arguments,
                },
              })),
            }
          : {}),
      })),
      temperature,
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    if (options?.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI HTTP Error ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as any;
      const choice = data.choices?.[0]?.message;
      if (!choice) {
        throw new Error('OpenAI returned an empty response.');
      }

      const toolCalls: AiToolCall[] | undefined = choice.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

      return {
        content: choice.content || null,
        toolCalls,
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        model: data.model || model,
        provider: 'openai',
      };
    } catch (error: any) {
      throw new AiProviderUnavailableError('openai', error.message);
    }
  }
}

// --------------------------------------------------------------------------
// Mock Provider (Pattern matching for tests and offline/local execution)
// --------------------------------------------------------------------------

export class MockAiProvider implements IAiProvider {
  private customResponses: Array<{
    matcher: (messages: AiMessage[]) => boolean;
    response: Partial<AiProviderResponse> | (() => Partial<AiProviderResponse>);
  }> = [];

  public addMockResponse(
    matcher: (messages: AiMessage[]) => boolean,
    response: Partial<AiProviderResponse> | (() => Partial<AiProviderResponse>),
  ): void {
    this.customResponses.push({ matcher, response });
  }

  public clearMockResponses(): void {
    this.customResponses = [];
  }

  public async generateResponse(
    messages: AiMessage[],
    tools: AiToolDefinition[],
    options?: {
      model?: string;
      temperature?: number;
      responseFormat?: 'text' | 'json';
    },
  ): Promise<AiProviderResponse> {
    // Check custom responses first
    for (const item of this.customResponses) {
      if (item.matcher(messages)) {
        const resp = typeof item.response === 'function' ? item.response() : item.response;
        return {
          content: resp.content !== undefined ? resp.content : 'Mock response',
          toolCalls: resp.toolCalls,
          usage: resp.usage || { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
          model: options?.model || 'mock-model',
          provider: 'mock',
        };
      }
    }

    const lastMessage = messages[messages.length - 1];
    const text = lastMessage?.content || '';

    // Simulate transient provider failure
    if (text.toLowerCase().includes('fail_transient')) {
      throw new Error('Transient provider failure');
    }

    // Default patterns for natural responses
    let content = 'Hello! I am your dental receptionist. How can I help you?';
    let toolCalls: AiToolCall[] | undefined;
    let intent = 'Greeting';
    let entities: Record<string, unknown> = {};

    if (text.toLowerCase().includes('book') || text.toLowerCase().includes('appointment')) {
      intent = 'BookAppointment';
      entities = { date: '2026-07-17', time: '10:00', doctorName: 'Dr. Smith' };
      toolCalls = [
        {
          id: 'call_123',
          name: 'bookAppointment',
          arguments: JSON.stringify(entities),
        },
      ];
      content = 'Sure, booking your appointment.';
    } else if (text.toLowerCase().includes('available') || text.toLowerCase().includes('check')) {
      intent = 'CheckAvailability';
      entities = { date: '2026-07-17', doctorName: 'Dr. Smith' };
      toolCalls = [
        {
          id: 'call_456',
          name: 'checkAvailability',
          arguments: JSON.stringify(entities),
        },
      ];
      content = 'Checking availability for tomorrow.';
    } else if (text.toLowerCase().includes('hours') || text.toLowerCase().includes('open')) {
      intent = 'BusinessHours';
      toolCalls = [
        {
          id: 'call_789',
          name: 'getClinicInformation',
          arguments: JSON.stringify({}),
        },
      ];
      content = 'Let me check the business hours.';
    } else if (text.toLowerCase().includes('goodbye') || text.toLowerCase().includes('bye')) {
      intent = 'Goodbye';
      content = 'Goodbye! Have a nice day!';
    }

    if (options?.responseFormat === 'json') {
      content = JSON.stringify({
        reply: content,
        intent,
        entities,
        confidence: 0.95,
      });
    }

    return {
      content,
      toolCalls,
      usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
      model: options?.model || 'mock-model',
      provider: 'mock',
    };
  }
}
