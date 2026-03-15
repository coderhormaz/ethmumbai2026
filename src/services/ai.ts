import axios from 'axios';
import { config } from '../config';

export interface ProxyCredentials {
  api_key?: string;
  api_endpoint?: string;
}

/**
 * Forward a chat completion request to the AI provider.
 * Uses per-proxy API key if available, falls back to global key.
 */
export async function proxyChatCompletion(body: any, creds?: ProxyCredentials) {
  // Determine which API key to use: proxy-specific > global
  const apiKey = (creds?.api_key && creds.api_key.length > 5)
    ? creds.api_key
    : config.aiProviderApiKey;

  const apiEndpoint = (creds?.api_endpoint && creds.api_endpoint.startsWith('http'))
    ? creds.api_endpoint
    : config.aiProviderUrl;

  const requestedModel = typeof body?.model === 'string' ? body.model.trim() : '';

  if (!apiKey) {
    throw new Error('No API key configured. The seller needs to add their AI provider API key.');
  }

  if (!requestedModel && !config.demoUpstreamModel) {
    throw new Error('Missing required field: model');
  }

  const upstreamBody = {
    ...body,
    model: config.demoUpstreamModel || requestedModel,
  };

  try {
    const response = await axios.post(apiEndpoint, upstreamBody, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://chainagent.eth',
        'X-Title': 'ChainAgent Proxy',
      },
      timeout: 120_000,
    });

    return response.data;
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const upstream = error.response.data;

      // Handle specific error cases with clear messages
      if (status === 401 || status === 403) {
        throw new Error(
          `Invalid API key. The seller's API key was rejected by the provider. ` +
          `Status: ${status}. Please check the API key in your proxy settings.`
        );
      }
      if (status === 402) {
        throw new Error(
          `API provider requires payment. The seller's account may have insufficient credits. ` +
          `Please add credits to your AI provider account.`
        );
      }
      if (status === 429) {
        throw new Error(
          `Rate limit exceeded on the AI provider. Please try again in a moment.`
        );
      }

      throw new Error(
        `Upstream AI error (${status}): ${JSON.stringify(upstream)}`
      );
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new Error(
        `Cannot connect to AI provider at ${apiEndpoint}. Check the endpoint URL.`
      );
    }

    if (error.code === 'ECONNABORTED') {
      throw new Error(`AI provider timed out at ${apiEndpoint}.`);
    }

    throw error;
  }
}
