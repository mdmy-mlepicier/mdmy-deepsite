---
title: DeepSite
emoji: 🐳
colorFrom: blue
colorTo: blue
sdk: docker
pinned: true
app_port: 5173
license: mit
short_description: Generate any website with AI in seconds
models:
  - deepseek-ai/DeepSeek-V3-0324
---

# DeepSite 🐳

![DeepSite Logo](./public/logo.svg)

## Overview

DeepSite is an innovative, AI-powered platform that lets you create and deploy stunning websites in seconds using natural language prompts. Built on DeepSeek's powerful language models, DeepSite bridges the gap between your ideas and functional web design, allowing anyone—regardless of technical background—to bring their web concepts to life.

**Key Features:**
- **AI-Powered Website Generation**: Turn text descriptions into complete, modern websites
- **One-Click Deployment**: Instantly publish your websites to Hugging Face Spaces
- **Multi-Provider Support**: Access powerful AI models from providers like Novita AI, Fireworks AI, and SambaNova
- **Remix Functionality**: Build upon existing DeepSite projects to accelerate development
- **Hugging Face Integration**: Seamless authentication and deployment using Hugging Face's infrastructure

## 🌟 Live Demo

Visit the live application at [https://enzostvs-deepsite.hf.space](https://enzostvs-deepsite.hf.space)

## 🏗️ Architecture

DeepSite follows a modern web application architecture with separate frontend and backend components:

### Frontend
- **React**: UI component library (v19)
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Monaco Editor**: Code editor for viewing and modifying generated HTML
- **Vite**: Build tool and development server

### Backend
- **Express.js**: Web server framework
- **Hugging Face Hub SDK**: Integration with Hugging Face repositories
- **Hugging Face Inference API**: Communication with AI models

### Infrastructure
- **Docker**: Containerization for consistent deployment
- **Hugging Face Spaces**: Hosting platform for both DeepSite itself and generated websites

## 🔄 Application Flow

1. **User Authentication**: Sign in with your Hugging Face account (optional, but enhances capabilities)
2. **Prompt Creation**: Describe the website you want to create using natural language
3. **AI Generation**: The system processes your prompt using advanced AI models
4. **Preview & Edit**: View, test, and optionally modify the generated code
5. **Deployment**: Publish your website directly to Hugging Face Spaces with one click
6. **Share & Remix**: Share your creation with others or build upon existing projects

## 💻 Tech Stack Details

### Frontend Libraries
- **React + React DOM**: Component-based UI development
- **React Icons**: Icon library
- **React Markdown**: Markdown rendering
- **React Toastify**: Toast notifications
- **Monaco Editor**: Code editor interface
- **TailwindCSS**: Styling framework

### Backend Technologies
- **Express**: Web framework handling API requests
- **@huggingface/hub**: Repo management on Hugging Face
- **@huggingface/inference**: AI model interaction
- **dotenv**: Environment variable management
- **cookie-parser**: Authentication token management
- **body-parser**: Request body parsing

### Development Tools
- **TypeScript**: Static typing
- **ESLint**: Code quality and style enforcement
- **Vite**: Build system and development server

## 🛠️ Project Structure

```
deepsite/
├── dist/                    # Compiled frontend assets
├── middlewares/             # Express middleware functions
│   └── checkUser.js         # Authentication middleware
├── public/                  # Static assets
│   ├── logo.svg             # DeepSite logo
│   └── providers/           # AI provider logos
├── src/                     # Frontend source code
│   ├── assets/              # Frontend assets
│   ├── components/          # React components
│   │   ├── App.tsx          # Main app component
│   │   ├── ask-ai/          # AI prompt interface
│   │   ├── deploy-button/   # Deployment UI
│   │   ├── header/          # App header
│   │   ├── load-button/     # Load/import functionality
│   │   ├── login/           # Authentication UI
│   │   └── preview/         # Website preview components
│   └── main.tsx             # React entry point
├── utils/                   # Shared utility functions
│   ├── colors.js            # Color configurations
│   ├── consts.ts            # Constant definitions
│   ├── providers.js         # AI provider configurations
│   └── types.ts             # TypeScript type definitions
├── server.js                # Express backend server
├── Dockerfile               # Container configuration
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite build configuration
```

## 🔧 Local Development

To run DeepSite locally:

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd deepsite
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file with the following variables:
   ```
   APP_PORT=3000
   OAUTH_CLIENT_ID=<your-huggingface-oauth-client-id>
   OAUTH_CLIENT_SECRET=<your-huggingface-oauth-client-secret>
   REDIRECT_URI=http://localhost:3000/auth/login
   DEFAULT_HF_TOKEN=<your-huggingface-token>
   ```

4. **Build the frontend**
   ```bash
   npm run build
   ```

5. **Start the server**
   ```bash
   npm start
   ```

6. **Open your browser** and navigate to `http://localhost:3000`

For more detailed instructions, check out [this discussion](https://huggingface.co/spaces/enzostvs/deepsite/discussions/74).

## 🔐 Authentication

DeepSite uses Hugging Face's OAuth for authentication, which provides:
- Secure access to Hugging Face services
- Permission to create and modify Spaces
- Access to the Inference API for AI model interaction

Unauthenticated users can still use DeepSite with limited functionality, but authentication is recommended for the full experience.

## 🚀 Deployment

DeepSite is designed to be deployed as a Docker container on Hugging Face Spaces. The included Dockerfile handles all necessary configuration.

## 🤝 Contributing

Contributions to DeepSite are welcome! Please feel free to submit issues or pull requests.

## 📄 License

DeepSite is released under the MIT License.