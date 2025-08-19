// netlify/functions/news-api.js - Serverless function for GNews API
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
    // Get API key from environment variables (now using GNews API key)
    const GNEWS_API_KEY = process.env.GNEWS_API_KEY;
    
    console.log('Environment check:', {
      hasGNewsApiKey: !!GNEWS_API_KEY,
      keyLength: GNEWS_API_KEY ? GNEWS_API_KEY.length : 0
    });
    
    if (!GNEWS_API_KEY) {
      console.error('GNews API key not found in environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'GNews API key not configured' })
      };
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    console.log('Query parameters:', queryParams);
    
    const { 
      country = 'us', 
      category = 'health', 
      max = '50',
      q: searchQuery,
      page = '1'
    } = queryParams;

    // Build GNews API URL
    let gnewsApiUrl = `https://gnews.io/api/v4/top-headlines`;
    
    // Add parameters
    const params = new URLSearchParams();
    params.append('apikey', GNEWS_API_KEY);
    params.append('lang', 'en');
    
    if (searchQuery) {
      // Use search endpoint for queries
      gnewsApiUrl = `https://gnews.io/api/v4/search`;
      params.append('q', `${searchQuery} health`);
    } else {
      params.append('country', country);
      params.append('category', category);
    }
    
    params.append('max', Math.min(parseInt(max), 100).toString()); // GNews max is 100
    
    gnewsApiUrl += '?' + params.toString();

    console.log('Fetching news from GNews:', gnewsApiUrl.replace(GNEWS_API_KEY, '[API_KEY_HIDDEN]'));

    // Make request to GNews API with proper headers
    const response = await fetch(gnewsApiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'HealthBell-App/1.0',
        'Accept': 'application/json'
      }
    });

    console.log('GNews API response status:', response.status);
    console.log('GNews API response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GNews API Error Response:', errorText);
      
      // Try to parse error as JSON
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.message || errorJson.error || errorText;
      } catch (e) {
        // Keep original error text if not JSON
      }
      
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to fetch news from GNews API',
          details: errorDetails,
          status: response.status
        })
      };
    }

    const data = await response.json();
    console.log('GNews API response data structure:', {
      totalArticles: data.totalArticles,
      articlesCount: data.articles ? data.articles.length : 0
    });

    // Transform GNews response to match NewsAPI format for compatibility
    const transformedData = {
      status: 'ok',
      totalResults: data.totalArticles || 0,
      articles: data.articles || []
    };

    // Filter out articles with missing content
    if (transformedData.articles) {
      const originalCount = transformedData.articles.length;
      transformedData.articles = transformedData.articles.filter(article => 
        article.title && 
        article.description && 
        article.url &&
        article.source
      ).map(article => ({
        // Transform GNews format to NewsAPI-like format
        title: article.title,
        description: article.description,
        url: article.url,
        urlToImage: article.image,
        publishedAt: article.publishedAt,
        source: {
          name: article.source.name
        },
        content: article.content
      }));
      console.log(`Filtered articles: ${originalCount} -> ${transformedData.articles.length}`);
    }

    console.log('Successfully processed GNews data');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(transformedData)
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