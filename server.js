import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { extractRecipe } from './gemini.js';
import { downloadVideo, cleanupVideo } from './video.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// In-memory storage for recent recipes (stores last 10, no duplicates)
const recentRecipes = [];
const MAX_RECENT = 10;

/**
 * Adds a recipe to recent recipes list (prevents duplicates by URL)
 * @param {string} url - Original video URL
 * @param {object} recipe - Extracted recipe data
 */
function addToRecentRecipes(url, recipe) {
    // Normalize URL for comparison (remove query params)
    const normalizeUrl = (u) => u.split('?')[0].toLowerCase();
    const normalizedUrl = normalizeUrl(url);

    // Remove any existing entry with same URL (prevent duplicates)
    const existingIndex = recentRecipes.findIndex(
        entry => normalizeUrl(entry.url) === normalizedUrl
    );
    if (existingIndex !== -1) {
        recentRecipes.splice(existingIndex, 1);
    }

    // Store only essential data to reduce memory (not full recipe object)
    const entry = {
        id: Date.now().toString(),
        url,
        title: recipe.title || 'Untitled Recipe',
        description: (recipe.description || '').substring(0, 150),
        recipe,  // Full recipe for viewing
        extractedAt: new Date().toISOString()
    };

    // Add to beginning of array
    recentRecipes.unshift(entry);

    // Keep only last 10
    if (recentRecipes.length > MAX_RECENT) {
        recentRecipes.pop();
    }
}

/**
 * POST /api/extract
 * Extracts a recipe from a short-form video URL
 * 
 * Request body:
 *   - url: string (TikTok, YouTube Shorts, or Instagram Reel URL)
 * 
 * Response:
 *   - success: boolean
 *   - recipe: object (title, ingredients, instructions, etc.)
 *   - error: string (if success is false)
 */
app.post('/api/extract', async (req, res) => {
    const { url } = req.body;

    // Validate URL
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'Please provide a video URL'
        });
    }

    // Validate URL format
    const supportedPlatforms = [
        'tiktok.com',
        'youtube.com/shorts',
        'youtu.be',
        'instagram.com/reel',
        'instagram.com/p'
    ];

    const isSupported = supportedPlatforms.some(platform => url.includes(platform));
    if (!isSupported) {
        return res.status(400).json({
            success: false,
            error: 'Unsupported platform. Please use TikTok, YouTube Shorts, or Instagram Reels'
        });
    }

    let videoPath = null;

    try {
        console.log(`Processing video: ${url}`);

        // Download the video
        videoPath = await downloadVideo(url);
        console.log(`Video downloaded: ${videoPath}`);

        // Extract recipe using Gemini
        const recipe = await extractRecipe(videoPath);
        console.log('Recipe extracted successfully');

        // Clean up the video file
        await cleanupVideo(videoPath);

        // Add to recent recipes
        addToRecentRecipes(url, recipe);

        res.json({
            success: true,
            recipe,
            url
        });

    } catch (error) {
        console.error('Error processing video:', error);

        // Clean up video if it exists
        if (videoPath) {
            await cleanupVideo(videoPath).catch(() => { });
        }

        res.status(500).json({
            success: false,
            error: error.message || 'Failed to extract recipe from video'
        });
    }
});

/**
 * GET /api/recent
 * Returns the 3 most recently extracted recipes
 */
app.get('/api/recent', (req, res) => {
    res.json({
        success: true,
        recipes: recentRecipes
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`REFS server running at http://localhost:${PORT}`);
});
