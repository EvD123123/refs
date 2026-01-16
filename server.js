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
const MAX_RECENT = 10;

// Recipe cache configuration
const recipeCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 50;

/**
 * Normalize URL for cache key (removes query params and lowercases)
 */
function normalizeUrl(url) {
    return url.split('?')[0].toLowerCase();
}

/**
 * Get recipe from cache if it exists and hasn't expired
 * @param {string} url - Video URL
 * @returns {object|null} - Cached recipe or null
 */
function getCachedRecipe(url) {
    const key = normalizeUrl(url);
    const cached = recipeCache.get(key);

    if (!cached) return null;

    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
        recipeCache.delete(key);
        return null;
    }

    console.log(`Cache hit for: ${url}`);
    return cached.recipe;
}

/**
 * Add recipe to cache
 * @param {string} url - Video URL
 * @param {object} recipe - Extracted recipe
 */
function cacheRecipe(url, recipe) {
    const key = normalizeUrl(url);

    // Evict oldest entries if cache is full
    if (recipeCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = recipeCache.keys().next().value;
        recipeCache.delete(oldestKey);
    }

    recipeCache.set(key, {
        recipe,
        timestamp: Date.now()
    });

    console.log(`Cached recipe for: ${url} (cache size: ${recipeCache.size})`);
}

/**
 * Clean up expired cache entries (runs periodically)
 */
function cleanupCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of recipeCache.entries()) {
        if (now - value.timestamp > CACHE_TTL_MS) {
            recipeCache.delete(key);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`Cleaned ${cleaned} expired cache entries`);
    }
}

// Run cache cleanup every hour
setInterval(cleanupCache, 60 * 60 * 1000);

// Default example recipes (pre-extracted for demonstration)
const defaultRecipes = [
    {
        id: 'example-tiktok',
        url: 'https://www.tiktok.com/@recipes/video/7328434260006784264?lang=en',
        title: 'Viral Strawberry Peanut Butter Chocolate Bark',
        description: 'A delightful and easy-to-make dessert featuring fresh strawberries topped with creamy peanut butter and rich chocolate.',
        isExample: true,
        extractedAt: new Date().toISOString(),
        recipe: {
            title: 'Viral Strawberry Peanut Butter Chocolate Bark',
            description: 'A delightful and easy-to-make dessert featuring fresh strawberries topped with creamy peanut butter and rich chocolate, then frozen to create a delicious bark. A perfect treat for any occasion!',
            prepTime: '15 minutes',
            cookTime: '0 minutes',
            totalTime: '35 minutes',
            servings: '8-10',
            difficulty: 'Easy',
            ingredients: [
                { item: 'Strawberries', amount: '2', unit: 'cups', notes: 'sliced' },
                { item: 'Semi-sweet chocolate chips', amount: '1', unit: 'cup', notes: '' },
                { item: 'Olive oil', amount: '1', unit: 'teaspoon', notes: '' },
                { item: 'Creamy peanut butter', amount: '3/4', unit: 'cup', notes: 'melted' },
                { item: 'Flaky sea salt', amount: '1/4', unit: 'teaspoon', notes: 'or to taste' }
            ],
            instructions: [
                { step: 1, instruction: 'Line a baking sheet with parchment paper. Arrange the sliced strawberries evenly on the parchment paper, covering the surface in a single layer.' },
                { step: 2, instruction: 'In a microwave-safe bowl, combine the chocolate chips and olive oil. Microwave in 30-second intervals, stirring after each, until smooth and fully melted.' },
                { step: 3, instruction: 'Melt the peanut butter separately in a microwave-safe bowl for about 30-60 seconds, or until smooth and pourable. Pour the melted peanut butter over the strawberries, spreading it gently to cover them as much as possible.' },
                { step: 4, instruction: 'Next, pour the melted chocolate over the peanut butter layer. Gently spread the chocolate to create an even top layer.' },
                { step: 5, instruction: 'Sprinkle the flaky sea salt evenly over the chocolate layer.' },
                { step: 6, instruction: 'Place the baking sheet in the freezer for at least 20 minutes, or until the bark is completely firm.' },
                { step: 7, instruction: 'Once frozen, remove the bark from the freezer. Lift it off the parchment paper and break or cut it into desired pieces. Serve immediately and enjoy!' }
            ],
            notes: [
                'Store any leftover bark in an airtight container in the freezer.',
                'For variations, try different berries, nuts, or chocolate types.'
            ],
            tags: ['Dessert', 'No-bake', 'Vegetarian', 'Snack', 'Easy']
        }
    },
    {
        id: 'example-instagram',
        url: 'https://www.instagram.com/reels/DTdKH7PD8ZX/',
        title: 'Clay Pot Spicy Tomato Chutney',
        description: 'A flavorful and spicy South Indian chutney made with tomatoes, green chilies, and onions.',
        isExample: true,
        extractedAt: new Date().toISOString(),
        recipe: {
            title: 'Clay Pot Spicy Tomato Chutney',
            description: 'A flavorful and spicy South Indian chutney made with tomatoes, green chilies, and onions, cooked and mashed in a traditional clay pot, then tempered to perfection. Perfect as an accompaniment for dosa or idli.',
            prepTime: '5 minutes',
            cookTime: '20 minutes',
            totalTime: '25 minutes',
            servings: '4-6',
            difficulty: 'Easy',
            ingredients: [
                { item: 'Water', amount: '2', unit: 'cups', notes: 'or enough to cover vegetables' },
                { item: 'Small Onions', amount: '10-12', unit: 'pieces', notes: 'peeled' },
                { item: 'Green Chilies', amount: '5-7', unit: 'pieces', notes: 'slit lengthwise, adjust to taste' },
                { item: 'Tomatoes', amount: '3-4', unit: 'medium', notes: 'sliced' },
                { item: 'Garlic Cloves', amount: '4-5', unit: 'cloves', notes: 'sliced' },
                { item: 'Salt', amount: '1', unit: 'teaspoon', notes: 'or to taste' },
                { item: 'Cooking Oil', amount: '1', unit: 'tablespoon', notes: 'for tempering' },
                { item: 'Mustard Seeds', amount: '1/2', unit: 'teaspoon', notes: '' },
                { item: 'Curry Leaves', amount: '1', unit: 'sprig', notes: '' },
                { item: 'Coriander Leaves', amount: '1/4', unit: 'cup', notes: 'fresh, chopped for garnish' }
            ],
            instructions: [
                { step: 1, instruction: 'Add water to a clay pot and bring it to a boil over medium heat.' },
                { step: 2, instruction: 'Carefully add the small onions, green chilies, and sliced tomatoes to the boiling water.' },
                { step: 3, instruction: 'Add the sliced garlic cloves and salt to the pot. Stir gently.' },
                { step: 4, instruction: 'Cook the ingredients over medium heat for about 10-15 minutes, stirring occasionally, until all the vegetables are soft and tender, and the mixture has slightly reduced.' },
                { step: 5, instruction: 'Remove the clay pot from the heat. Using a wooden masher or the back of a spoon, thoroughly mash all the cooked vegetables directly in the pot until you achieve a rustic, chunky chutney consistency.' },
                { step: 6, instruction: 'Scoop out the mashed vegetable mixture into a separate clean bowl. Then, pour any remaining liquid from the clay pot over the mashed vegetables in the bowl.' },
                { step: 7, instruction: 'Place the empty clay pot back on the stove over medium heat. Add cooking oil.' },
                { step: 8, instruction: 'Once the oil is hot, add mustard seeds and curry leaves. Allow them to splutter and turn fragrant for a few seconds.' },
                { step: 9, instruction: 'Carefully pour the chutney mixture from the bowl back into the clay pot with the tempering.' },
                { step: 10, instruction: 'Add the chopped fresh coriander leaves and stir everything well to combine the tempering with the chutney.' },
                { step: 11, instruction: 'Cook for another 1-2 minutes, stirring occasionally, allowing the flavors to meld and the chutney to heat through.' },
                { step: 12, instruction: 'Serve the hot Clay Pot Spicy Tomato Chutney immediately with dosa, idli, or other South Indian breakfast items.' }
            ],
            notes: [
                'Adjust the number of green chilies to your preferred spice level.',
                'Using a clay pot adds an authentic flavor, but a regular heavy-bottomed pot can also be used.',
                'The consistency of the chutney can be adjusted by adding more or less cooking liquid when pouring into the bowl.'
            ],
            tags: ['Indian', 'South Indian', 'Vegetarian', 'Chutney', 'Side Dish', 'Spicy']
        }
    },
    {
        id: 'example-youtube',
        url: 'https://www.youtube.com/shorts/F7aYYjLOOAg',
        title: 'Garlic Lemon Chicken',
        description: 'A quick and delicious garlic lemon chicken recipe perfect for a weeknight meal.',
        isExample: true,
        extractedAt: new Date().toISOString(),
        recipe: {
            title: 'Garlic Lemon Chicken',
            description: 'A quick and delicious garlic lemon chicken recipe that\'s perfect for a weeknight meal. Tender chicken thighs are marinated in a savory sauce, pan-fried with onions and garlic, and finished with fresh lemon and cilantro for a vibrant flavor.',
            prepTime: 'Approximately 8-11 minutes',
            cookTime: 'Approximately 9-12 minutes',
            totalTime: '20 minutes',
            servings: '2-4',
            difficulty: 'Easy',
            ingredients: [
                { item: 'Chicken thigh', amount: 'Approximately 1-1.5', unit: 'lbs', notes: 'Boneless, skinless, cut into bite-sized pieces' },
                { item: 'Soy sauce', amount: '2', unit: 'tbsp', notes: null },
                { item: 'Dark soy sauce', amount: '1', unit: 'tbsp', notes: null },
                { item: 'Oyster sauce', amount: '1', unit: 'tbsp', notes: null },
                { item: 'Black pepper', amount: 'To taste', unit: null, notes: 'Freshly ground' },
                { item: 'Honey', amount: '1', unit: 'tbsp', notes: null },
                { item: 'Cornstarch', amount: '1-2', unit: 'tbsp', notes: null },
                { item: 'Red onion', amount: '1', unit: null, notes: 'Medium, sliced' },
                { item: 'Garlic', amount: '4-6', unit: 'cloves', notes: 'Minced' },
                { item: 'Lemon', amount: '1', unit: null, notes: 'Sliced or cut into wedges' },
                { item: 'Cilantro', amount: 'Small bunch', unit: null, notes: 'Fresh, chopped' }
            ],
            instructions: [
                { step: 1, instruction: 'Place the cut chicken thighs in a mixing bowl. Add soy sauce, dark soy sauce, oyster sauce, black pepper, honey, and cornstarch. Massage well to ensure the chicken is evenly coated with the marinade.' },
                { step: 2, instruction: 'Heat a pan over medium-high heat. Add the marinated chicken and pan-fry for 6 to 7 minutes, stirring occasionally, until the chicken is cooked through and lightly browned.' },
                { step: 3, instruction: 'Add the sliced red onion and minced garlic to the pan with the chicken. Sauté for another 2 to 3 minutes until the onions start to soften and the garlic is fragrant.' },
                { step: 4, instruction: 'Stir in the fresh lemon slices/wedges and chopped cilantro. Continue to sauté on high heat for another 1 to 2 minutes, allowing the flavors to meld.' },
                { step: 5, instruction: 'Serve hot, optionally with steamed rice.' }
            ],
            notes: [
                'The dish pairs well with white rice, topped with black sesame seeds.',
                'Adjust the amount of garlic and lemon to your personal preference for a stronger or milder flavor.'
            ],
            tags: ['Asian-inspired', 'chicken', 'main course', 'quick meal']
        }
    }
];

const recentRecipes = [];

/**
 * Adds a recipe to recent recipes list (prevents duplicates by URL)
 * @param {string} url - Original video URL
 * @param {object} recipe - Extracted recipe data
 */
function addToRecentRecipes(url, recipe) {
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

        // Check cache first
        const cachedRecipe = getCachedRecipe(url);
        if (cachedRecipe) {
            // Add to recent recipes (for display purposes)
            addToRecentRecipes(url, cachedRecipe);

            return res.json({
                success: true,
                recipe: cachedRecipe,
                url,
                cached: true
            });
        }

        // Download the video
        videoPath = await downloadVideo(url);
        console.log(`Video downloaded: ${videoPath}`);

        // Extract recipe using Gemini
        const recipe = await extractRecipe(videoPath);
        console.log('Recipe extracted successfully');

        // Clean up the video file
        await cleanupVideo(videoPath);

        // Cache the recipe for future requests
        cacheRecipe(url, recipe);

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
 * Returns the recently extracted recipes plus default examples
 */
app.get('/api/recent', (req, res) => {
    // Combine user recipes with default examples
    // Default examples are always shown at the end
    const allRecipes = [...recentRecipes, ...defaultRecipes];

    res.json({
        success: true,
        recipes: allRecipes
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
