# HealthBell Netlify Deployment Guide

This guide provides step-by-step instructions for deploying the HealthBell application to Netlify with working Gemini AI and News API functionality.

## 📋 Prerequisites

- Git repository with your HealthBell code
- Netlify account (free tier is sufficient)
- API keys:
  - Gemini API Key: `AIzaSyAWb08i-s9reNQ6_WxJSSDTOIC69YAEFwQ`
  - News API Key: `8a7e86793d054c198f6919d7ff21bafe`
- Firebase project configured

## 🚀 Step-by-Step Deployment

### 1. Prepare Your Repository

Make sure your project includes these files (already created):
- `netlify/functions/gemini-api.js` - Serverless function for Gemini AI
- `netlify/functions/news-api.js` - Serverless function for News API
- `netlify.toml` - Netlify configuration file
- Updated frontend files using functions instead of direct API calls

### 2. Create New Netlify Site

1. **Login to Netlify**: Go to [netlify.com](https://netlify.com) and sign in
2. **New Site**: Click "New site from Git"
3. **Connect Repository**: 
   - Choose your Git provider (GitHub, GitLab, Bitbucket)
   - Authorize Netlify if needed
   - Select your HealthBell repository

### 3. Configure Build Settings

When setting up the site, use these settings:

- **Base directory**: Leave empty (root directory)
- **Build command**: Leave empty (static site)
- **Publish directory**: Leave empty or set to `.` (root directory)

Click "Deploy site" to continue.

### 4. Configure Environment Variables

⚠️ **CRITICAL STEP** - Without this, your APIs won't work!

1. Go to your site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Click **Add variable** and add the following:

| Variable Name | Value |
|---------------|-------|
| `GEMINI_API_KEY` | `AIzaSyAWb08i-s9reNQ6_WxJSSDTOIC69YAEFwQ` |
| `NEWS_API_KEY` | `8a7e86793d054c198f6919d7ff21bafe` |

4. Click **Save** for each variable

### 5. Trigger Redeploy

After adding environment variables:
1. Go to **Deploys** tab
2. Click **Trigger deploy** → **Deploy site**
3. Wait for deployment to complete

### 6. Verify Functions Are Working

After deployment, check if functions are properly deployed:

1. Go to **Functions** tab in your Netlify dashboard
2. You should see:
   - `gemini-api`
   - `news-api`
3. Both should show "Active" status

### 7. Test Your Application

Visit your deployed site URL and test:

1. **Symptom Analyzer**: 
   - Go to the symptom analyzer page
   - Try asking a health question
   - Should get AI responses (may take a few seconds on first load)

2. **Health News**:
   - Go to the health news page  
   - Should load health articles
   - Try searching and filtering

## 🔧 Troubleshooting

### Functions Not Working

If APIs still don't work after deployment:

1. **Check Function Logs**:
   - Go to Netlify dashboard → Functions
   - Click on the function name
   - Check logs for errors

2. **Verify Environment Variables**:
   - Site settings → Environment variables
   - Make sure both API keys are set correctly

3. **Check Network Tab**:
   - Open browser DevTools → Network
   - Look for 404 or 500 errors on function calls
   - Function URLs should be: `/.netlify/functions/gemini-api` and `/.netlify/functions/news-api`

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| 404 on function calls | Redeploy site after adding environment variables |
| Functions not appearing | Check `netlify.toml` is in root directory |
| API key errors | Verify environment variables are set correctly |
| CORS errors | Functions include CORS headers, should be resolved |

### Function URLs

Your functions will be available at:
- Gemini AI: `https://your-site-name.netlify.app/.netlify/functions/gemini-api`
- News API: `https://your-site-name.netlify.app/.netlify/functions/news-api`

## 📁 File Structure

Your deployed project should have this structure:

```
HealthBell/
├── netlify/
│   └── functions/
│       ├── gemini-api.js
│       └── news-api.js
├── assets/
│   ├── symptom-analyzer.js (updated)
│   ├── health-news.js (updated)
│   └── ... (other files)
├── netlify.toml
├── firebase-config.js
├── index.html
└── ... (other HTML/CSS files)
```

## 🔒 Security Notes

- API keys are now server-side only and not exposed to users
- Functions run in Netlify's secure environment
- CORS headers are properly configured
- No sensitive data in frontend code

## 🔄 Future Updates

When making changes:

1. **Code Changes**: Push to your Git repository, Netlify will auto-deploy
2. **Environment Variables**: Can be updated in Netlify dashboard without redeployment
3. **Function Changes**: Require redeployment (automatic on Git push)

## 📞 Support

If you encounter issues:

1. Check Netlify function logs
2. Verify all environment variables are set
3. Ensure `netlify.toml` is properly configured
4. Test functions directly via URL

## ✅ Deployment Checklist

- [ ] Repository connected to Netlify
- [ ] Environment variables added (`GEMINI_API_KEY`, `NEWS_API_KEY`)
- [ ] Site redeployed after adding environment variables
- [ ] Functions showing as "Active" in dashboard
- [ ] Symptom analyzer working (getting AI responses)
- [ ] Health news loading articles
- [ ] Firebase authentication working
- [ ] All features tested on live site

---

**Your HealthBell application should now be fully functional on Netlify with working APIs!** 🎉