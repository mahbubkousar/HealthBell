// netlify/functions/gemini-api.js - Serverless function for Gemini API
exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const { message } = JSON.parse(event.body);
    
    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message is required' })
      };
    }

    // Get API key from environment variables
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Gemini API key not configured' })
      };
    }

    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    // System prompt for medical symptom analysis
    const SYSTEM_PROMPT = `You are HealthBell AI, a medical symptom analyzer assistant. You provide helpful, accurate, and empathetic responses about health symptoms while following these guidelines:

1. ALWAYS remind users that you are not a replacement for professional medical advice
2. For serious symptoms, ALWAYS recommend seeking immediate medical attention
3. Ask clarifying questions to better understand symptoms
4. Provide general information about possible causes and when to see a doctor
5. Be empathetic and reassuring while being medically responsible
6. Do not provide specific diagnoses or prescribe treatments
7. Focus on symptom assessment, general health information, and when to seek medical care
8. If symptoms sound emergency-related, emphasize seeking immediate medical attention

Keep responses concise but informative, and always maintain a caring, professional tone.`;

    // Prepare request body for Gemini API
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `${SYSTEM_PROMPT}\n\nUser Query: ${message}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    // Make request to Gemini API
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to get response from AI service',
          details: errorText
        })
      };
    }

    const data = await response.json();

    // Extract response text
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          text: data.candidates[0].content.parts[0].text
        })
      };
    } else {
      console.error('Unexpected Gemini API response:', data);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid response from AI service',
          details: 'No valid response received'
        })
      };
    }

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};