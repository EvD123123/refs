import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';
import { basename } from 'path';

/**
 * Extracts a recipe from a video file using Gemini's multimodal capabilities
 * 
 * @param {string} videoPath - Path to the downloaded video file
 * @returns {Promise<object>} - Extracted recipe object
 */
export async function extractRecipe(videoPath) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    // Initialize Gemini client (must be done after dotenv loads)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

    // Create the model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Craft the prompt for recipe extraction
    const prompt = `You are a professional recipe transcription assistant. Watch this cooking video carefully and extract the complete recipe.

Analyze the video and provide the recipe in the following JSON format. Be thorough and include all details mentioned:

{
    "title": "Recipe name",
    "description": "Brief description of the dish",
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
- If a measurement is approximate or not clearly stated, make your best estimate based on visual cues
- Include ALL ingredients mentioned, even garnishes
- Capture the exact cooking techniques and temperatures mentioned
- If something is unclear in the video, note it in the relevant field
- Return ONLY valid JSON, no additional text

Watch the video and extract the recipe:`;

    // Send to Gemini for analysis
    const result = await model.generateContent([
        {
            inlineData: {
                mimeType: mimeType,
                data: base64Video
            }
        },
        { text: prompt }
    ]);

    const response = await result.response;
    const text = response.text();

    // Parse the JSON response
    try {
        // Extract JSON from response (in case there's extra text)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON found in response');
        }

        const recipe = JSON.parse(jsonMatch[0]);
        return recipe;
    } catch (parseError) {
        console.error('Failed to parse recipe JSON:', parseError);
        console.error('Raw response:', text);
        throw new Error('Failed to parse recipe from video. The AI response was not in the expected format.');
    }
}
