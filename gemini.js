import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';
import { basename } from 'path';

// API keys for rotation (fallback when one is rate-limited)
function getApiKeys() {
    const keys = [];
    if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
    if (process.env.GEMINI_API_KEY_2) keys.push(process.env.GEMINI_API_KEY_2);
    return keys;
}

/**
 * Attempts to generate content with a specific API key
 */
async function tryWithKey(apiKey, mimeType, base64Video, prompt) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
        {
            inlineData: {
                mimeType: mimeType,
                data: base64Video
            }
        },
        { text: prompt }
    ]);

    return result;
}

/**
 * Extracts a recipe from a video file using Gemini's multimodal capabilities
 * Implements API key rotation for rate limit handling
 * 
 * @param {string} videoPath - Path to the downloaded video file
 * @returns {Promise<object>} - Extracted recipe object
 */
export async function extractRecipe(videoPath) {
    const apiKeys = getApiKeys();

    if (apiKeys.length === 0) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    // Read the video file
    const videoData = readFileSync(videoPath);
    const base64Video = videoData.toString('base64');

    console.log('Video size:', (videoData.length / 1024 / 1024).toFixed(2), 'MB');

    // Determine MIME type based on extension
    const extension = basename(videoPath).split('.').pop().toLowerCase();
    const mimeTypes = {
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mkv': 'video/x-matroska',
        'mov': 'video/quicktime'
    };
    const mimeType = mimeTypes[extension] || 'video/mp4';

    // Craft the prompt for recipe extraction
    const prompt = `You are a professional recipe transcription assistant. Watch this cooking video carefully and extract the complete recipe.

IMPORTANT: All output must be family-friendly and appropriate for all ages. Use simple, clean language. Avoid any slang, vulgar terms, or inappropriate words.

Analyze the video and provide the recipe in the following JSON format. Be thorough and include all details mentioned:

{
    "title": "Recipe name",
    "description": "Brief family-friendly description of the dish",
    "prepTime": "Preparation time if mentioned (e.g., '10 minutes')",
    "cookTime": "Cooking time if mentioned (e.g., '30 minutes')", 
    "totalTime": "Total time if mentioned",
    "servings": "Number of servings if mentioned",
    "difficulty": "Easy/Medium/Hard based on the recipe",
    "ingredients": [
        {
            "item": "Ingredient name",
            "amount": "Quantity",
            "unit": "Unit of measurement",
            "notes": "Any special notes (optional, diced, room temperature, etc.)"
        }
    ],
    "instructions": [
        {
            "step": 1,
            "instruction": "Detailed step instruction",
            "tip": "Any tips mentioned for this step (optional)"
        }
    ],
    "notes": ["Any additional tips, substitutions, or notes mentioned"],
    "tags": ["cuisine type", "dietary info like vegetarian/vegan", "meal type"]
}

Important guidelines:
- Use clean, family-friendly language throughout
- If a measurement is approximate or not clearly stated, make your best estimate based on visual cues
- Include ALL ingredients mentioned, even garnishes
- Capture the exact cooking techniques and temperatures mentioned
- If something is unclear in the video, note it in the relevant field
- Return ONLY valid JSON, no additional text

Watch the video and extract the recipe:`;

    // Try each API key until one works
    let lastError = null;

    for (let i = 0; i < apiKeys.length; i++) {
        const keyNum = i + 1;
        console.log(`Trying API key ${keyNum} of ${apiKeys.length}...`);

        try {
            const result = await tryWithKey(apiKeys[i], mimeType, base64Video, prompt);
            const response = await result.response;
            const text = response.text();

            // Parse the JSON response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No valid JSON found in response');
            }

            const recipe = JSON.parse(jsonMatch[0]);
            console.log(`Success with API key ${keyNum}`);
            return recipe;

        } catch (error) {
            console.log(`API key ${keyNum} failed:`, error.message);
            lastError = error;

            // If it's a rate limit error and we have more keys, try next
            if (error.message.includes('429') || error.message.includes('quota')) {
                console.log('Rate limit hit, trying next key...');
                continue;
            }

            // For non-rate-limit errors, still try other keys
            continue;
        }
    }

    // All keys failed
    throw lastError || new Error('All API keys failed');
}

