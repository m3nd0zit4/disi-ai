import {
    SecretsManagerClient,
    GetSecretValueCommand,
    PutSecretValueCommand,
    CreateSecretCommand,
    DeleteSecretCommand
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    }
});


// * Save the API key for a user in AWS Secrets Manager

export async function storeUserApiKey(
    userId: string,
    provider: string,
    apiKey: string
): Promise<string> {
    const secretName = `disi/users/${userId}/${provider}`;

    const secretData = JSON.stringify({
        apiKey,
        provider,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    })

    try {
        //? try actualize if exists
        await client.send(
            new PutSecretValueCommand({
                SecretId: secretName,
                SecretString: secretData,
            })
        );
        return `API key updated for ${provider} - user ${userId}`;
    } catch (error: any) {
        //? create if not exists
        if(error.name === 'ResourceNotFoundException') {
            await client.send(
                new CreateSecretCommand({
                    Name: secretName,
                    SecretString: secretData,
                    Description: `API key for ${provider} - user ${userId}`,
                })
            )
            console.log(`API key created for ${provider} - user ${userId}`);
        } else {
            console.error(`Error storing API key`, error);
            throw error;
        }
    }
    
    return secretName;
}


// * Get the API key for a user from AWS Secrets Manager

export async function getUserApiKey(
  userId: string,
  provider: string
): Promise<string | null> {
  const secretName = `disi/users/${userId}/${provider}`;
  
  try {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    
    if (!response.SecretString) {
      return null;
    }

    const secret = JSON.parse(response.SecretString);
    return secret.apiKey || null;
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      // Secret not found - this is normal
      return null;
    }
    console.error(`Error fetching API key:`, error);
    return null;
  }
}


// * Delete the API key for a user from AWS Secrets Manager

export async function deleteUserApiKey(
  userId: string,
  provider: string
): Promise<boolean> {
  const secretName = `disi/users/${userId}/${provider}`;
  
  try {
    await client.send(
      new DeleteSecretCommand({ 
        SecretId: secretName,
        ForceDeleteWithoutRecovery: true // Eliminar inmediatamente sin periodo de recuperación
      })
    );
    console.log(`API key deleted for ${provider} - user ${userId}`);
    return true;
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      return true;
    }
    console.error(`Error deleting API key:`, error);
    return false;
  }
}


// * Validate API key (Calling to the provider)

export async function validateApiKey(
  provider: string,
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const { getAIService } = await import("./aiServices");
    const service = getAIService(provider, apiKey);
    
    const isValid = await service.validateApiKey();
    
    return { valid: isValid };
  } catch (error) {
    console.error(`Error validating API key for ${provider}:`, error);
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}
 