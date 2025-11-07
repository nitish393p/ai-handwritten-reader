import { GoogleGenerativeAI } from "@google/generative-ai";

const ALLOWED_MODES = new Set(["summarize", "rewrite"]);

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";
}

async function processTextWithGemini(text, mode) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const systemPrompt =
    mode === "summarize"
      ? "Provide a concise summary of the following handwritten transcription. Return clear paragraphs."
      : "Rewrite the following handwritten transcription into polished, easy-to-read prose while preserving meaning.";

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${systemPrompt}\n\n---\n\n${text}`,
          },
        ],
      },
    ],
  });

  const { response } = result;
  if (!response) {
    throw new Error("No response received from Gemini");
  }

  const processedText = response.text();
  if (!processedText) {
    throw new Error("Gemini returned an empty response");
  }

  return processedText.trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const { text, mode } = req.body ?? {};

    if (typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Request must include non-empty 'text'" });
      return;
    }

    if (!ALLOWED_MODES.has(mode)) {
      res.status(400).json({ error: "Mode must be either 'summarize' or 'rewrite'" });
      return;
    }

    const processedText = await processTextWithGemini(text, mode);
    res.status(200).json({ text: processedText });
  } catch (error) {
    console.error("/api/summarize error", error);
    res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

