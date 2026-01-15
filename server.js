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

        res.json({
            success: true,
            recipe
        });

    } catch (error) {
        console.error('Error processing video:', error);

        // Clean up video if it exists
        if (videoPath) {
            await cleanupVideo(videoPath).catch(() => {});
        }

        res.status(500).json({
            success: false,
            error: error.message || 'Failed to extract recipe from video'
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`REFS server running at http://localhost:${PORT}`);
});
