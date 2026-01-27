import "server-only";
import {
    SecretsManagerClient,
    GetSecretValueCommand,
    PutSecretValueCommand,
    CreateSecretCommand,
    DeleteSecretCommand,
    RestoreSecretCommand,
    ResourceExistsException
} from "@aws-sdk/client-secrets-manager";

let _client: SecretsManagerClient | null = null;

function getSecretsManagerClient() {
  if (!_client) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId) {
      throw new Error("Missing AWS_ACCESS_KEY_ID environment variable");
    }

    if (!secretAccessKey) {
      throw new Error("Missing AWS_SECRET_ACCESS_KEY environment variable");
    }

    _client = new SecretsManagerClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return _client;
}

const client = getSecretsManagerClient();


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

    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
        try {
            //? try actualize if exists
            await client.send(
                new PutSecretValueCommand({
                    SecretId: secretName,
                    SecretString: secretData,
                })
            );
            return secretName;
        } catch (error: unknown) {
            //? create if not exists
            if(error && typeof error === 'object' && 'name' in error && error.name === 'ResourceNotFoundException') {
                try {
                    await client.send(
                        new CreateSecretCommand({
                            Name: secretName,
                            SecretString: secretData,
                            Description: `API key for ${provider} - user ${userId}`,
                        })
                    );
                    console.log(`API key created for ${provider} - user ${userId}`);
                    return secretName;
                } catch (createError: unknown) {
                    // Handle race condition: another request created the secret concurrently
                    if (createError instanceof ResourceExistsException) {
                        // Retry the update now that the secret exists
                        await client.send(
                            new PutSecretValueCommand({
                                SecretId: secretName,
                                SecretString: secretData,
                            })
                        );
                        return secretName;
                    }
                    throw createError;
                }
            } else if (error && typeof error === 'object' && 'name' in error && error.name === 'InvalidRequestException') {
                // Check if it's marked for deletion
                const errorMessage = (error as { message?: string }).message || "";
                if (errorMessage.includes("marked for deletion")) {
                     try {
                        console.log(`Restoring secret ${secretName}...`);
                        await client.send(new RestoreSecretCommand({ SecretId: secretName }));
                        
                        // Retry the update after restore
                        await client.send(
                            new PutSecretValueCommand({
                                SecretId: secretName,
                                SecretString: secretData,
                            })
                        );
                        return secretName;
                     } catch (restoreError) {
                         console.error("Error restoring secret:", restoreError);
                         throw restoreError;
                     }
                }
                throw error;
            } else {
                // For other errors, check if we should retry
                attempt++;
                if (attempt >= maxAttempts) {
                    console.error(`Error storing API key after ${maxAttempts} attempts:`, error);
                    throw error;
                }
                // Exponential backoff: 500ms, 1000ms, 2000ms
                const delay = 500 * Math.pow(2, attempt - 1);
                console.log(`Retrying storeUserApiKey in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw new Error("Failed to store API key after max attempts");
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
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error) {
        if (error.name === 'ResourceNotFoundException') {
            // Secret not found - this is normal
            return null;
        }
        if (error.name === 'InvalidRequestException') {
             // Check if it's marked for deletion
             const errorMessage = (error as { message?: string }).message || "";
             if (errorMessage.includes("marked for deletion")) {
                 // Treat as not found
                 return null;
             }
        }
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
        SecretId: secretName
        // Uses default recovery window (7-30 days) for safety
      })
    );
    console.log(`API key deleted for ${provider} - user ${userId}`);
    return true;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ResourceNotFoundException') {
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
 