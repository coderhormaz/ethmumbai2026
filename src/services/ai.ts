import axios from 'axios';
import { config } from '../config';

/**
 * Forward an OpenAI-compatible chat completion request to the seller's
 * upstream AI provider (OpenRouter by default, but works with any
 * provider that speaks the same schema).
 */
export async function proxyChatCompletion(body: any) {
  if (!config.aiProviderApiKey) {
    throw new Error('AI_PROVIDER_API_KEY is not configured.');
  }

  try {
    const response = await axios.post(config.aiProviderUrl, body, {
      headers: {
        Authorization: `Bearer ${config.aiProviderApiKey}`,
        'Content-Type': 'application/json',
        // OpenRouter-specific optional headers
        'HTTP-Referer': 'https://creditflow.eth',
        'X-Title': 'CreditFlow.eth Proxy',
      },
      timeout: 120_000, // 2 min timeout for long completions
    });

    return response.data;
  } catch (error: any) {
    if (error.response) {
      // Upstream provider returned an error — pass it through
      const upstream = error.response.data;
      throw new Error(
        `Upstream AI error (${error.response.status}): ${JSON.stringify(upstream)}`
      );
    }
    throw error;
  }
}
