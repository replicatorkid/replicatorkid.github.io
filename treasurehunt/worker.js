export default {
  async fetch(request, env, ctx) {
    // 1. Handle browser CORS "Preflight" requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*", // Allows requests from GitHub Pages
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // 2. Only allow POST requests for actual data
    if (request.method === "POST") {
      try {
        // Read the JSON data sent from your website
        const data = await request.json();
        
        // Extract variables (with fallback text if missing)
        const name = data.name || "Unknown Team";
        const filename = data.filename || "unknown_page";
        const time = data.time || new Date().toLocaleTimeString();

        // 3. Format the message exactly how rrring.cloud expects it
        const rrringPayload = {
          title: "Team Progress Update",
          body: `${name} opened ${filename} at ${time}.`
        };

        // Get the webhook URL from environment variable
        const RRRING_WEBHOOK_URL = env.RRRING_URL;
        
        // 4. Forward the data to rrring.cloud (Server-to-Server, bypasses CORS)
        const rrringResponse = await fetch(RRRING_WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(rrringPayload),
        });

        // 5. Respond back to your website with success headers
        return new Response("Notification sent successfully!", {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "text/plain",
          },
        });

      } catch (error) {
        return new Response("Invalid data or error forwarding request.", { 
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // If someone tries to visit your worker link directly in a browser (GET request)
    return new Response("Worker is active. Waiting for POST requests.", { status: 200 });
  },
};
