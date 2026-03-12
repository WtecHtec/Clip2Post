# LLM Parameter Generation Prompt

Use this prompt with any advanced LLM (GPT-4, Claude 3.5, etc.) to generate perfectly formatted `shuo.json` data for the Kinetic Typography Engine.

---

## The Prompt

**Role**: You are a professional Video Editor and Motion Graphics Expert specializing in Kinetic Typography for short-form video (TikTok/Reels).

**Task**: Based on the provided script and audio timestamps, generate a JSON object for the "Kinetic Typography Engine".

**JSON Schema**:
```typescript
{
  captions: Array<{
    text: string;     // One short phrase or word per object
    startMs: number;  // Absolute start time in milliseconds
    endMs: number;    // Absolute end time in milliseconds
  }>;
  images?: Array<{
    src: string;      // Filename in public/ folder (e.g. "laugh.png")
    startMs: number;
    endMs: number;
    width?: number;   // Recommended 200-500
    inFlow?: boolean; // Set to true to push text aside
  }>;
  fontSize?: number;  // Recommended 80-140
  centeredStart?: boolean; // Set true for modern feel
  randomOrientation?: boolean; // Set true for high energy chaos
}
```

**Editorial Rules**:
1. **Break it down**: Keep captions short (1-4 words per entry) for high tension.
2. **Speed**: Ensure `startMs` matches the speaking speed. Use about 100-300ms gaps between words.
3. **Emphasis**: For key emotional moments, suggest inserting an image with `inFlow: true`.
4. **Style**: 
   - Use `randomOrientation: true` for aggressive, energetic scripts.
   - Use `centeredStart: true` for cleaner, minimalist ads.

**Example Input**:
"Hello everyone! Today we are testing a cool video engine. Look at this logo!" (Timestamps: 0s to 5s)

**Example Output**:
```json
{
  "captions": [
    {"text": "Hello", "startMs": 0, "endMs": 500},
    {"text": "everyone!", "startMs": 600, "endMs": 1200},
    {"text": "Today we are", "startMs": 1300, "endMs": 2000},
    {"text": "testing a", "startMs": 2100, "endMs": 2800},
    {"text": "cool engine.", "startMs": 2900, "endMs": 3800},
    {"text": "Look at this!", "startMs": 4000, "endMs": 5000}
  ],
  "images": [
    {
      "src": "logo.png",
      "width": 300,
      "startMs": 4000,
      "endMs": 5000,
      "inFlow": true
    }
  ],
  "fontSize": 110,
  "centeredStart": true,
  "randomOrientation": true
}
```

**Now, process this script:**
[INSERT YOUR SCRIPT HERE]
