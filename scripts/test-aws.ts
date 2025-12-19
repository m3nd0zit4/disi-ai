import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { 
  SecretsManagerClient, 
  CreateSecretCommand,
  GetSecretValueCommand,
  DeleteSecretCommand
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ 
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }
});

async function testAWS() {
  try {
    console.log("Testing AWS Secrets Manager...");
    
    // Create test secret
    console.log("1. Creating test secret...");
    await client.send(
      new CreateSecretCommand({
        Name: "disi/test",
        SecretString: JSON.stringify({ test: "value", timestamp: Date.now() }),
      })
    );
    console.log(" Secret created successfully");
    
    // Read test secret
    console.log("2. Reading test secret...");
    const result = await client.send(
      new GetSecretValueCommand({ SecretId: "disi/test" })
    );
    console.log(" Secret retrieved:", result.SecretString);
    
    // Delete test secret
    console.log("3. Deleting test secret...");
    await client.send(
      new DeleteSecretCommand({ 
        SecretId: "disi/test",
        ForceDeleteWithoutRecovery: true 
      })
    );
    console.log(" Secret deleted successfully");
    
    console.log("\n AWS Secrets Manager is working correctly!");
    
  } catch (error) {
    console.error(" Error:", error);
    if (error instanceof Error) {
      console.error("Message:", error.message);
    }
  }
}

testAWS();