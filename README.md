# REFS - Recipe Extraction For Shorts

Extract recipes from TikTok, YouTube Shorts, and Instagram Reels instantly. No more pausing and rewinding videos to write down recipes!

![REFS Screenshot](https://via.placeholder.com/800x400?text=REFS+Screenshot)

## Features

- **Multi-platform support** - Works with TikTok, YouTube Shorts, and Instagram Reels
- **AI-powered transcription** - Uses advanced AI to analyze video content and extract recipes
- **Structured output** - Get organized recipes with ingredients, instructions, and tips
- **Copy to clipboard** - Easily copy the full recipe in a formatted text layout
- **Beautiful dark UI** - Modern, responsive design that works on any device

## Prerequisites

Before running REFS, make sure you have:

1. **Node.js** (v18 or higher)
   - Download from [nodejs.org](https://nodejs.org/)

2. **yt-dlp** - Required for downloading videos from social platforms
   ```bash
   # Windows (using winget)
   winget install yt-dlp

   # Windows (using Chocolatey)
   choco install yt-dlp

   # macOS (using Homebrew)
   brew install yt-dlp

   # Linux
   sudo apt install yt-dlp
   # or
   pip install yt-dlp
   ```

3. **Gemini API Key** (free)
   - Get your API key at [Google AI Studio](https://aistudio.google.com/apikey)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/EvD123123/refs.git
   cd refs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_api_key_here
   PORT=3000
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. Find a cooking video on TikTok, YouTube Shorts, or Instagram Reels
2. Copy the video URL
3. Paste it into REFS
4. Click "Extract Recipe"
5. Wait a moment while the AI analyzes the video
6. View your complete recipe with ingredients and instructions!

## Supported Platforms

| Platform | URL Format |
|----------|------------|
| TikTok | `https://www.tiktok.com/@user/video/...` |
| YouTube Shorts | `https://www.youtube.com/shorts/...` or `https://youtu.be/...` |
| Instagram Reels | `https://www.instagram.com/reel/...` |

## API Endpoints

### POST /api/extract

Extract a recipe from a video URL.

**Request Body:**
```json
{
  "url": "https://www.tiktok.com/@user/video/1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "recipe": {
    "title": "Recipe Name",
    "description": "Brief description",
    "prepTime": "10 minutes",
    "cookTime": "30 minutes",
    "servings": "4",
    "ingredients": [...],
    "instructions": [...],
    "notes": [...]
  }
}
```

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T17:30:00.000Z"
}
```

## Project Structure

```
refs/
├── server.js          # Express server and API routes
├── gemini.js          # AI integration for video analysis
├── video.js           # Video download using yt-dlp
├── package.json       # Project dependencies
├── .env               # Environment variables (not in repo)
├── .gitignore         # Git ignore file
└── public/            # Frontend assets
    ├── index.html     # Main HTML page
    ├── styles.css     # CSS styling
    └── app.js         # Frontend JavaScript
```

## Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **AI**: Google Gemini API (video analysis and transcription)
- **Video Download**: yt-dlp

## Deployment

### Deploy to Render.com (Free)

1. **Fork or push this repo to your GitHub account**

2. **Go to [Render.com](https://render.com)** and sign up/login

3. **Create a new Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Render will auto-detect the `render.yaml` configuration

4. **Add Environment Variable**
   - In the Render dashboard, go to "Environment"
   - Add: `GEMINI_API_KEY` = your Gemini API key
   
5. **Deploy**
   - Click "Create Web Service"
   - Wait for the build to complete (~2-3 minutes)
   - Your app will be live at `https://refs.onrender.com`

> **Note**: Free tier services spin down after 15 minutes of inactivity. First request after idle may take ~30 seconds.

## Troubleshooting

### "yt-dlp is not installed"
Make sure yt-dlp is installed and available in your system PATH. Run `yt-dlp --version` to verify.

### "GEMINI_API_KEY is not configured"
Make sure you've created a `.env` file with your Gemini API key.

### Video download fails
- Some videos may be private or region-restricted
- Very long videos may exceed the file size limit
- Try updating yt-dlp: `yt-dlp -U`

### Recipe extraction is inaccurate
- Works best with videos that clearly state ingredients and steps
- Background music or poor audio quality may affect accuracy
- Videos in languages other than English may have reduced accuracy

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
