import { 
  BedrockRuntimeClient, 
  InvokeModelCommand 
} from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Generate embedding using Titan
export async function generateEmbedding(text: string): Promise<number[]> {
  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-embed-text-v1',
    body: JSON.stringify({ inputText: text }),
  });
  
  const response = await bedrock.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  
  return result.embedding; // 1536 dimensions
}

// Query LLM using Claude
export async function queryLLM(
  prompt: string, 
  context?: string
): Promise<string> {
  const content = context 
    ? `Context:\n${context}\n\nQuestion: ${prompt}`
    : prompt;
  
  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content,
      }],
    }),
  });
  
  const response = await bedrock.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  
  return result.content[0].text;
}

// Query using cheaper Haiku model
export async function queryLLMCheap(
  prompt: string,
  context?: string
): Promise<string> {
  const content = context 
    ? `Context:\n${context}\n\nQuestion: ${prompt}`
    : prompt;
  
  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content,
      }],
    }),
  });
  
  const response = await bedrock.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  
  return result.content[0].text;
}
