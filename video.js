import { spawn } from 'child_process';
import { mkdirSync, existsSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Temp directory for downloaded videos
const TEMP_DIR = join(__dirname, 'temp');

// yt-dlp executable path detection
// Checks: Render bin dir -> Windows user profile -> system PATH
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
    return 'yt-dlp';  // Fallback to PATH
}

const YTDLP_PATH = getYtdlpPath();

// Ensure temp directory exists
if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Downloads a video from a URL using yt-dlp
 * 
 * @param {string} url - The video URL (TikTok, YouTube Shorts, Instagram)
 * @returns {Promise<string>} - Path to the downloaded video file
 */
export function downloadVideo(url) {
    return new Promise((resolve, reject) => {
        const videoId = randomUUID();
        const outputTemplate = join(TEMP_DIR, `${videoId}.%(ext)s`);

        // yt-dlp arguments
        const args = [
            url,
            '-o', outputTemplate,
            '--no-playlist',
            '--max-filesize', '50M',
            '-f', 'best[ext=mp4]/best',
            '--no-warnings',
            '--quiet'
        ];

        console.log('Starting video download...');

        const ytdlp = spawn(YTDLP_PATH, args);

        let stderr = '';

        ytdlp.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ytdlp.on('close', (code) => {
            if (code !== 0) {
                console.error('yt-dlp error:', stderr);
                reject(new Error(`Failed to download video. Make sure yt-dlp is installed and the URL is valid.`));
                return;
            }

            // Find the downloaded file
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
                reject(new Error('yt-dlp is not installed. Please install it: winget install yt-dlp'));
            } else {
                reject(err);
            }
        });
    });
}

/**
 * Removes a video file from the temp directory
 * 
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
