export interface ImageGenerationRequest {
  prompt: string;
  model: string;
  n?: number;
  size?: string;
  quality?: string;
  output_format?: string;
  output_compression?: number;
}

export interface ImageGenerationResponse {
  created: number;
  data: {
    b64_json: string;
    revised_prompt: string;
    url: null;
  }[];
}
