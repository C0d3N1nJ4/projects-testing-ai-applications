export interface ModelRequest {
  system: string;
  user: string;
}

export interface ModelResult {
  text: string;
  provider: string;
  model: string;
}

export interface ModelProvider {
  generate(request: ModelRequest): Promise<ModelResult>;
}