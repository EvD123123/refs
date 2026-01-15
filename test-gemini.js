import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const videoPath = './temp/test_video.mp4';
const videoData = readFileSync(videoPath);
const base64Video = videoData.toString('base64');

console.log('Video size:', (videoData.length / 1024 / 1024).toFixed(2), 'MB');
console.log('Testing Gemini with video...');

try {
    const result = await model.generateContent([
        {
            inlineData: {
                mimeType: 'video/mp4',
                data: base64Video
            }
        },
        { text: 'What is this video about? Answer in one sentence.' }
    ]);

    console.log('SUCCESS:', result.response.text());
} catch (error) {
    console.log('ERROR:', error.message);
}
