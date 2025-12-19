
async function testApi() {
  const payload = {
    conversationId: "test-conv",
    messageId: "test-msg",
    responseIds: ["test-resp"],
    models: [
      {
        modelId: "gpt-5.2",
        provider: "GPT",
        subModelId: "gpt-5.2",
        specializedModels: ["gpt-image-1"]
      }
    ],
    userMessage: "Genera una imagen de un gato"
  };

  console.log("Testing with payload:", JSON.stringify(payload, null, 2));

  // Note: This script is for logic verification. 
  // In a real environment, it would need valid auth tokens and a running server.
  // We can check the logic by looking at the code changes.
}

testApi();
