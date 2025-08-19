// netlify/functions/news-api.js - Serverless function for News API
exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get API key from environment variables
    const NEWS_API_KEY = process.env.NEWS_API_KEY;
    
    if (!NEWS_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'News API key not configured' })
      };
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const { 
      country = 'us', 
      category = 'health', 
      pageSize = '50',
      q: searchQuery,
      page = '1'
    } = queryParams;

    // Build News API URL
    let newsApiUrl = `https://newsapi.org/v2/top-headlines?apiKey=${NEWS_API_KEY}`;
    
    // Add parameters
    if (searchQuery) {
      newsApiUrl += `&q=${encodeURIComponent(searchQuery)}`;
    } else {
      newsApiUrl += `&country=${country}&category=${category}`;
    }
    
    newsApiUrl += `&pageSize=${pageSize}&page=${page}`;

    console.log('Fetching news from:', newsApiUrl.replace(NEWS_API_KEY, '[API_KEY]'));

    // Make request to News API
    const response = await fetch(newsApiUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('News API Error:', errorText);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to fetch news',
          details: errorText
        })
      };
    }

    const data = await response.json();

    // Validate response
    if (data.status !== 'ok') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'News API returned error',
          details: data.message || 'Unknown error'
        })
      };
    }

    // Filter out articles with removed content
    if (data.articles) {
      data.articles = data.articles.filter(article => 
        article.title && 
        article.title !== "[Removed]" &&
        article.description && 
        article.description !== "[Removed]"
      );
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };

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