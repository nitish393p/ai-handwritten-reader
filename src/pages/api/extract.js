import { promises as fs } from "fs";
import formidable from "formidable";
import sharp from "sharp";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: {
    bodyParser: false,
  },
};

const FORM_FILE_FIELDS = ["file", "image", "document"];

function normalizeFormFile(fileField) {
  if (!fileField) return undefined;
  if (Array.isArray(fileField)) {
    return fileField[0];
  }
  return fileField;
}

async function parseMultipartRequest(req) {
  const form = formidable({
    multiples: false,
    keepExtensions: false,
    maxFileSize: 25 * 1024 * 1024,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
}

async function cleanImage(buffer) {
  return sharp(buffer).grayscale().normalize().png().toBuffer();
}

const LANGUAGE_PROMPTS = {
  auto: "Extract the handwritten text from this document. Detect the language automatically and respond only with the transcribed text.",
  en: "Extract and transcribe the handwritten text in English. Respond with the best English transcription.",
  hi: "Extract and transcribe the handwritten text in Hindi using Devanagari script.",
  mr: "Extract and transcribe the handwritten text in Marathi using Devanagari script.",
  es: "Extract and transcribe the handwritten text in Spanish. Respond in Spanish.",
};

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";
}

async function extractTextFromImage(imageBuffer, language) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const base64Image = imageBuffer.toString("base64");

  const prompt = LANGUAGE_PROMPTS[language] ?? LANGUAGE_PROMPTS.auto;

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Image,
              mimeType: "image/png",
            },
          },
        ],
      },
    ],
  });

  const { response } = result;
  if (!response) {
    throw new Error("No response received from Gemini");
  }

  const text = response.text();
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return text.trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  let uploadedFile;

  try {
    const { fields, files } = await parseMultipartRequest(req);

    for (const field of FORM_FILE_FIELDS) {
      if (files?.[field]) {
        uploadedFile = normalizeFormFile(files[field]);
        break;
      }
    }

    if (!uploadedFile?.filepath) {
      // Fall back to first file if named differently.
      if (files) {
        const firstFileKey = Object.keys(files)[0];
        uploadedFile = normalizeFormFile(files[firstFileKey]);
      }
    }

    if (!uploadedFile?.filepath) {
      res.status(400).json({ error: "No image file uploaded" });
      return;
    }

    const originalBuffer = await fs.readFile(uploadedFile.filepath);
    const cleanedBuffer = await cleanImage(originalBuffer);
    const languageField = fields?.language;
    const languageValue = Array.isArray(languageField) ? languageField[0] : languageField;
    const language = typeof languageValue === "string" ? languageValue.toLowerCase() : "auto";
    const text = await extractTextFromImage(cleanedBuffer, language);

    res.status(200).json({ text });
  } catch (error) {
    console.error("/api/extract error", error);
    res.status(500).json({ error: error.message ?? "Unexpected error" });
  } finally {
    // Ensure temp file removed
    if (uploadedFile?.filepath) {
      try {
        await fs.unlink(uploadedFile.filepath);
      } catch (unlinkError) {
        console.warn("Failed to remove temp file", unlinkError);
      }
    }
  }
}

