# AI Handwritten Reader

AI Handwritten Reader is a Next.js application that cleans handwritten images, extracts text with Gemini, and lets you summarize or rewrite the results.

## Features

- 📸 Upload handwritten images or capture directly from a mobile camera.
- 🧼 Image preprocessing with `sharp` (grayscale + normalize).
- 🤖 Text extraction powered by **Gemini 2.5 Flash**.
- 📝 Summarize or rewrite the extracted text using Gemini.
- 💾 Export results to `.txt` or beautifully formatted `.pdf` files.
- 🌐 Language hints for extraction: Auto, English, Hindi, Marathi, Spanish.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

## Environment Variables

Create a `.env.local` file and add your Gemini API key:

```bash
GEMINI_API_KEY=your-google-gemini-api-key
```

Restart the dev server after updating environment variables.

## Tech Stack

- [Next.js 16 (App Router + Turbopack)](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai)
- [sharp](https://www.npmjs.com/package/sharp)
- [jspdf](https://www.npmjs.com/package/jspdf) & [file-saver](https://www.npmjs.com/package/file-saver)
- [formidable](https://www.npmjs.com/package/formidable)

## Scripts

```bash
npm run dev     # start dev server
npm run build   # create production build
npm run start   # run production server
npm run lint    # run ESLint
```

## License

This project is licensed under the MIT License.
