# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based AI drawing application that integrates with Google's Gemini API to enable collaborative drawing with AI. The app allows users to sketch and prompt, with Gemini bringing drawings to life through AI generation.

## Commands

**Development:**
```bash
npm install          # Install dependencies
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

**Setup:**
1. Install dependencies: `npm install`
2. Set `GEMINI_API_KEY` in `.env.local` file
3. Run: `npm run dev`

## Architecture

**Tech Stack:**
- React 19 with TypeScript
- Vite build tool
- Google Gemini AI API (@google/genai)
- Tailwind CSS for styling
- Lucide React for icons

**Project Structure:**
- `index.tsx` - Application entry point, renders Home component
- `Home.tsx` - Main application component containing all drawing and AI functionality
- `index.html` - HTML template with import maps for CDN dependencies
- `vite.config.ts` - Vite configuration with environment variable handling

**Key Dependencies:**
- `@google/genai` - Gemini AI API integration
- `react` & `react-dom` - React framework
- `lucide-react` - Icon components
- `@tailwindcss/browser` - Tailwind CSS via CDN

**Configuration:**
- Environment variables are loaded via Vite and exposed as `process.env.GEMINI_API_KEY`
- Path alias `@` configured to resolve to project root
- TypeScript configured for React JSX with ES2022 target

**AI Integration:**
- Uses Google Gemini API with configurable model selection
- Supports image generation from sketches and text prompts
- Error handling with custom parseError function for API responses