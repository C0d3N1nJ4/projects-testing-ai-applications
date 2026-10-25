import type { ModelProvider, ModelRequest, ModelResult } from './model-provider';

export class MockProvider implements ModelProvider {
  async generate(_request: ModelRequest): Promise<ModelResult> {
    return {
      provider: 'mock',
      model: 'fixture-v1',
      text: 'Open VPN settings, select your corporate VPN profile, '
        + 'and reconnect. If it fails, contact IT support. '
        + 'Never share your password.'
    };
  }
}