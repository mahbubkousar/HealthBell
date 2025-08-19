// netlify/functions/news-api.js - Serverless function for News API
exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
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
    console.error('Method not allowed:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get API key from environment variables
    const NEWS_API_KEY = process.env.NEWS_API_KEY;
    
    console.log('Environment check:', {
      hasNewsApiKey: !!NEWS_API_KEY,
      keyLength: NEWS_API_KEY ? NEWS_API_KEY.length : 0
    });
    
    if (!NEWS_API_KEY) {
      console.error('News API key not found in environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'News API key not configured' })
      };
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    console.log('Query parameters:', queryParams);
    
    const { 
      country = 'us', 
      category = 'health', 
      pageSize = '50',
      q: searchQuery,
      page = '1'
    } = queryParams;

    // Build News API URL
    let newsApiUrl = `https://newsapi.org/v2/top-headlines`;
    
    // Add parameters
    const params = new URLSearchParams();
    params.append('apiKey', NEWS_API_KEY);
    
    if (searchQuery) {
      params.append('q', searchQuery);
    } else {
      params.append('country', country);
      params.append('category', category);
    }
    
    params.append('pageSize', Math.min(parseInt(pageSize), 100).toString()); // NewsAPI max is 100
    params.append('page', page);
    
    newsApiUrl += '?' + params.toString();

    console.log('Fetching news from:', newsApiUrl.replace(NEWS_API_KEY, '[API_KEY_HIDDEN]'));

    // Make request to News API with proper headers
    const response = await fetch(newsApiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'HealthBell-App/1.0',
        'Accept': 'application/json'
      }
    });

    console.log('News API response status:', response.status);
    console.log('News API response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('News API Error Response:', errorText);
      
      // Try to parse error as JSON
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.message || errorText;
      } catch (e) {
        // Keep original error text if not JSON
      }
      
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to fetch news from NewsAPI',
          details: errorDetails,
          status: response.status
        })
      };
    }

    const data = await response.json();
    console.log('News API response data structure:', {
      status: data.status,
      totalResults: data.totalResults,
      articlesCount: data.articles ? data.articles.length : 0
    });

    // Validate response
    if (data.status !== 'ok') {
      console.error('News API returned non-ok status:', data);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'News API returned error status',
          details: data.message || data.code || 'Unknown error',
          newsApiStatus: data.status
        })
      };
    }

    // Filter out articles with removed content
    if (data.articles) {
      const originalCount = data.articles.length;
      data.articles = data.articles.filter(article => 
        article.title && 
        article.title !== "[Removed]" &&
        article.description && 
        article.description !== "[Removed]" &&
        article.url &&
        article.source
      );
      console.log(`Filtered articles: ${originalCount} -> ${data.articles.length}`);
    }

    console.log('Successfully processed news data');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('Function error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};