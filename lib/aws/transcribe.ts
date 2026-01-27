import { 
  TranscribeClient, 
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  MediaFormat,
  LanguageCode
} from '@aws-sdk/client-transcribe';

const transcribe = new TranscribeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  // Use environment credentials if available, otherwise rely on IAM role/default provider
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

// Transcribe audio file from S3
export async function transcribeAudio(
  bucket: string,
  key: string,
  languageCode: string = 'en-US'
): Promise<string> {
  const jobName = `transcribe-${Date.now()}`;
  
  // Start transcription job
  await transcribe.send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      Media: {
        MediaFileUri: `s3://${bucket}/${key}`,
      },
      MediaFormat: detectFormat(key) as MediaFormat,
      LanguageCode: languageCode as LanguageCode,
    })
  );
  
  // Poll for completion
  let status = 'IN_PROGRESS';
  let attempts = 0;
  const maxAttempts = parseInt(process.env.TRANSCRIBE_MAX_ATTEMPTS || '60'); // Default 5 minutes
  const pollInterval = parseInt(process.env.TRANSCRIBE_POLL_INTERVAL || '5000'); // Default 5s
  
  while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    
    const job = await transcribe.send(
      new GetTranscriptionJobCommand({ 
        TranscriptionJobName: jobName 
      })
    );
    
    status = job.TranscriptionJob?.TranscriptionJobStatus || 'FAILED';
    attempts++;
  }
  
  if (status !== 'COMPLETED') {
    throw new Error(`Transcription failed with status: ${status}`);
  }
  
  // Get transcript
  const job = await transcribe.send(
    new GetTranscriptionJobCommand({ 
      TranscriptionJobName: jobName 
    })
  );
  
  const transcriptUri = job.TranscriptionJob?.Transcript?.TranscriptFileUri;
  
  if (!transcriptUri) {
    throw new Error('No transcript URI found');
  }
  
  const response = await fetch(transcriptUri);
  const data = await response.json();
  
  return data.results.transcripts[0].transcript;
}

function detectFormat(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'mp3': return 'mp3';
    case 'mp4': return 'mp4';
    case 'wav': return 'wav';
    case 'flac': return 'flac';
    default: return 'mp3';
  }
}
