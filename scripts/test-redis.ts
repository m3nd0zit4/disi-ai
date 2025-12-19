import { config } from "dotenv";
import IORedis from "ioredis";
import { resolve } from "path";

// Load env vars
const envPath = resolve(process.cwd(), ".env.local");
console.log(`Loading env from ${envPath}`);
config({ path: envPath });

async function testConnection() {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.error("❌ REDIS_URL is not defined in environment");
    return;
  }

  // Mask password for logging
  const maskedUrl = redisUrl.replace(/:([^:@]+)@/, ":****@");
  console.log(`Attempting to connect to: ${maskedUrl}`);
  
  const isSecure = redisUrl.startsWith("rediss://");
  console.log(`Secure connection (TLS): ${isSecure}`);

  try {
    const connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: 3,
      family: 0,
      tls: isSecure ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 5000,
    });

    connection.on("error", (err) => {
      console.error("Redis Client Error:", err.message);
    });

    console.log("Pinging Redis...");
    const result = await connection.ping();
    console.log(`✅ Redis Ping Result: ${result}`);
    
    await connection.quit();
    console.log("Connection closed.");
    
  } catch (error) {
    console.error("❌ Failed to connect to Redis:", error);
  }
}

testConnection();
