import { 
  TextractClient, 
  DetectDocumentTextCommand 
} from '@aws-sdk/client-textract';

const textract = new TextractClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Extract text from PDF or image in S3
export async function extractTextFromS3(
  bucket: string, 
  key: string
): Promise<string> {
  const command = new DetectDocumentTextCommand({
    Document: {
      S3Object: { Bucket: bucket, Name: key },
    },
  });
  
  const response = await textract.send(command);
  
  return response.Blocks
    ?.filter(block => block.BlockType === 'LINE')
    .map(block => block.Text)
    .join('\n') || '';
}

// Extract text from local file buffer
export async function extractTextFromBuffer(
  fileBuffer: Buffer
): Promise<string> {
  const command = new DetectDocumentTextCommand({
    Document: {
      Bytes: fileBuffer,
    },
  });
  
  const response = await textract.send(command);
  
  return response.Blocks
    ?.filter(block => block.BlockType === 'LINE')
    .map(block => block.Text)
    .join('\n') || '';
}
