import { spawn } from 'child_process';
import { mkdirSync, existsSync, unlinkSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Temp directory for downloaded videos
const TEMP_DIR = join(__dirname, 'temp');

// yt-dlp executable path detection
function getYtdlpPath() {
    const possiblePaths = [
        '/opt/render/project/.render/bin/yt-dlp',  // Render deployment
        join(process.env.USERPROFILE || '', 'yt-dlp.exe'),  // Windows local
        'yt-dlp'  // System PATH
    ];

    for (const path of possiblePaths) {
        if (path && existsSync(path)) {
            return path;
        }
    }
    return 'yt-dlp';
}

const YTDLP_PATH = getYtdlpPath();

// Ensure temp directory exists
if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Downloads a TikTok video using tikwm.com API as fallback
 * @param {string} url - TikTok video URL
 * @returns {Promise<string>} - Path to downloaded video
 */
async function downloadTikTokFallback(url) {
    console.log('Trying TikTok fallback (tikwm.com)...');

    try {
        // Call tikwm API
        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.code !== 0 || !data.data || !data.data.play) {
            throw new Error('TikTok API failed to get video URL');
        }

        const videoUrl = data.data.play;
        console.log('Got TikTok video URL from API');

        // Download the video
        const videoResponse = await fetch(videoUrl);
        if (!videoResponse.ok) {
            throw new Error('Failed to download video from TikTok API');
        }

        const videoBuffer = await videoResponse.arrayBuffer();
        const videoId = randomUUID();
        const videoPath = join(TEMP_DIR, `${videoId}.mp4`);

        writeFileSync(videoPath, Buffer.from(videoBuffer));
        console.log('TikTok video downloaded via fallback');

        return videoPath;
    } catch (error) {
        console.error('TikTok fallback error:', error);
        throw new Error('Failed to download TikTok video. Please try a different video.');
    }
}

/**
 * Downloads a video using yt-dlp
 * @param {string} url - Video URL
 * @returns {Promise<string>} - Path to downloaded video
 */
function downloadWithYtdlp(url) {
    return new Promise((resolve, reject) => {
        const videoId = randomUUID();
        const outputTemplate = join(TEMP_DIR, `${videoId}.%(ext)s`);

        const args = [
            url,
            '-o', outputTemplate,
            '--no-playlist',
            '--max-filesize', '25M',
            // Try to get best quality under 25MB, fallback to worst quality if needed
            '-f', 'best[filesize<25M][ext=mp4]/best[filesize<25M]/worst[ext=mp4]/worst',
            '--no-warnings',
            '--quiet'
        ];

        console.log('Starting video download with yt-dlp...');
        const ytdlp = spawn(YTDLP_PATH, args);

        let stderr = '';
        ytdlp.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ytdlp.on('close', (code) => {
            if (code !== 0) {
                console.error('yt-dlp error:', stderr);
                reject(new Error('yt-dlp failed'));
                return;
            }

            const files = readdirSync(TEMP_DIR);
            const downloadedFile = files.find(f => f.startsWith(videoId));

            if (!downloadedFile) {
                reject(new Error('Video download completed but file not found'));
                return;
            }

            resolve(join(TEMP_DIR, downloadedFile));
        });

        ytdlp.on('error', (err) => {
            if (err.code === 'ENOENT') {
                reject(new Error('yt-dlp is not installed'));
            } else {
                reject(err);
            }
        });
    });
}

/**
 * Downloads a video from a URL
 * Uses yt-dlp first, falls back to TikTok API for TikTok URLs
 * 
 * @param {string} url - The video URL
 * @returns {Promise<string>} - Path to the downloaded video file
 */
export async function downloadVideo(url) {
    const isTikTok = url.includes('tiktok.com');

    try {
        // Try yt-dlp first
        return await downloadWithYtdlp(url);
    } catch (error) {
        console.log('yt-dlp failed:', error.message);

        // If TikTok, try fallback API
        if (isTikTok) {
            return await downloadTikTokFallback(url);
        }

        // Provide a more helpful error message for file size issues
        if (error.message.includes('yt-dlp failed')) {
            throw new Error('Video is too large or too long. Maximum file size is 25MB (typically under 60 seconds). This limit exists because REFS runs on free infrastructure.');
        }

        // For other platforms, throw the original error
        throw new Error('Failed to download video. Make sure the URL is valid and the video is publicly accessible.');
    }
}

/**
 * Removes a video file from the temp directory
 * @param {string} videoPath - Path to the video file to delete
 */
export async function cleanupVideo(videoPath) {
    try {
        if (existsSync(videoPath)) {
            unlinkSync(videoPath);
            console.log('Cleaned up video file');
        }
    } catch (error) {
        console.error('Failed to cleanup video:', error);
    }
}

