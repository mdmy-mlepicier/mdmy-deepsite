/**
 * DeepSite Server
 * 
 * This is the main server file for the DeepSite application - a web-based tool that allows users to 
 * generate and deploy websites using AI models through Hugging Face's inference API.
 * 
 * The server provides:
 * - Authentication with Hugging Face OAuth
 * - AI-powered HTML generation via the Hugging Face Inference API
 * - Website deployment to Hugging Face Spaces
 * - Remix functionality for existing DeepSite projects
 */

// Core dependencies
import express from "express";  // Web framework for Node.js
import path from "path";  // Utilities for working with file paths
import { fileURLToPath } from "url";  // Converting file URLs to paths
import dotenv from "dotenv";  // Loading environment variables from .env file
import cookieParser from "cookie-parser";  // Parsing cookie headers and populating req.cookies
import bodyParser from "body-parser";  // Parsing incoming request bodies

// Hugging Face dependencies
import {
  createRepo,  // Creates a new Hugging Face repository
  uploadFiles,  // Uploads files to a Hugging Face repository
  whoAmI,  // Gets information about the authenticated user
  spaceInfo,  // Gets information about a Hugging Face space
  fileExists,  // Checks if a file exists in a Hugging Face repository
} from "@huggingface/hub";
import { InferenceClient } from "@huggingface/inference";  // Client for the Hugging Face Inference API

// Local dependencies
import checkUser from "./middlewares/checkUser.js";  // Middleware to check if user is authenticated
import { PROVIDERS } from "./utils/providers.js";  // Available AI providers configuration
import { COLORS } from "./utils/colors.js";  // Color palette for Space configuration

// Load environment variables from .env file
dotenv.config();

// Initialize Express application
const app = express();

// Store IP addresses for rate limiting anonymous users
const ipAddresses = new Map();

// Get current directory path (ES modules compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Application configuration constants
const PORT = process.env.APP_PORT || 3000;  // Server port
const REDIRECT_URI =
  process.env.REDIRECT_URI || `http://localhost:${PORT}/auth/login`;  // OAuth redirect URL
const MODEL_ID = "deepseek-ai/DeepSeek-V3-0324";  // Default AI model to use
const MAX_REQUESTS_PER_IP = 2;  // Rate limiting for unauthenticated users

// Middleware configuration
app.use(cookieParser());  // Parse cookies from requests
app.use(bodyParser.json());  // Parse JSON request bodies
app.use(express.static(path.join(__dirname, "dist")));  // Serve static files from 'dist' directory

/**
 * Generates the "Made with DeepSite" attribution tag that's appended to generated websites
 * This attribution appears at the bottom of deployed sites with a link back to DeepSite
 * 
 * @param {string} repoId - Repository ID for the remix link
 * @returns {string} HTML for the attribution tag
 */
const getPTag = (repoId) => {
  return `<p style="border-radius: 8px; text-align: center; font-size: 12px; color: #fff; margin-top: 16px;position: fixed; left: 8px; bottom: 8px; z-index: 10; background: rgba(0, 0, 0, 0.8); padding: 4px 8px;">Made with <img src="https://enzostvs-deepsite.hf.space/logo.svg" alt="DeepSite Logo" style="width: 16px; height: 16px; vertical-align: middle;display:inline-block;margin-right:3px;filter:brightness(0) invert(1);"><a href="https://enzostvs-deepsite.hf.space" style="color: #fff;text-decoration: underline;" target="_blank" >DeepSite</a> - 🧬 <a href="https://enzostvs-deepsite.hf.space?remix=${repoId}" style="color: #fff;text-decoration: underline;" target="_blank" >Remix</a></p>`;
};

/**
 * Authentication Routes
 */

/**
 * GET /api/login - Initiates the Hugging Face OAuth flow
 * Returns a redirect URL to the Hugging Face OAuth authorization page
 */
app.get("/api/login", (_req, res) => {
  const redirectUrl = `https://huggingface.co/oauth/authorize?client_id=${process.env.OAUTH_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=openid%20profile%20write-repos%20manage-repos%20inference-api&prompt=consent&state=1234567890`;
  res.status(200).send({
    ok: true,
    redirectUrl,
  });
});

/**
 * GET /auth/login - OAuth callback endpoint
 * Processes the authorization code from Hugging Face
 * Exchanges code for an access token and sets cookie
 */
app.get("/auth/login", async (req, res) => {
  const { code } = req.query;

  // Redirect to home if no code is provided
  if (!code) {
    return res.redirect(302, "/");
  }
  
  // Create Basic Auth header for token exchange
  const Authorization = `Basic ${Buffer.from(
    `${process.env.OAUTH_CLIENT_ID}:${process.env.OAUTH_CLIENT_SECRET}`
  ).toString("base64")}`;

  // Exchange the authorization code for an access token
  const request_auth = await fetch("https://huggingface.co/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const response = await request_auth.json();

  // Redirect to home if token exchange failed
  if (!response.access_token) {
    return res.redirect(302, "/");
  }

  // Set the access token as a cookie
  res.cookie("hf_token", response.access_token, {
    httpOnly: false,
    secure: true,
    sameSite: "none",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  // Redirect to the application home page
  return res.redirect(302, "/");
});

/**
 * GET /auth/logout - Logs the user out by clearing the auth cookie
 */
app.get("/auth/logout", (req, res) => {
  res.clearCookie("hf_token", {
    httpOnly: false,
    secure: true,
    sameSite: "none",
  });
  return res.redirect(302, "/");
});

/**
 * GET /api/@me - Returns the authenticated user's information
 * Requires authentication via the checkUser middleware
 */
app.get("/api/@me", checkUser, async (req, res) => {
  let { hf_token } = req.cookies;

  // Special case for local development mode
  if (process.env.HF_TOKEN && process.env.HF_TOKEN !== "") {
    return res.send({
      preferred_username: "local-use",
      isLocalUse: true,
    });
  }

  try {
    // Get user info from Hugging Face using the token
    const request_user = await fetch("https://huggingface.co/oauth/userinfo", {
      headers: {
        Authorization: `Bearer ${hf_token}`,
      },
    });

    const user = await request_user.json();
    res.send(user);
  } catch (err) {
    // If token is invalid, clear it and return 401
    res.clearCookie("hf_token", {
      httpOnly: false,
      secure: true,
      sameSite: "none",
    });
    res.status(401).send({
      ok: false,
      message: err.message,
    });
  }
});

/**
 * POST /api/deploy - Deploys a generated website to Hugging Face Spaces
 * Requires authentication via the checkUser middleware
 * 
 * Request body:
 * - html: The HTML content to deploy
 * - title: The title of the website (used to generate repo name)
 * - path: Optional existing path to update
 * - prompts: Array of prompts used to generate the site
 */
app.post("/api/deploy", checkUser, async (req, res) => {
  const { html, title, path, prompts } = req.body;
  // Validate required fields
  if (!html || (!path && !title)) {
    return res.status(400).send({
      ok: false,
      message: "Missing required fields",
    });
  }

  let { hf_token } = req.cookies;
  // Use environment token if set (for local development)
  if (process.env.HF_TOKEN && process.env.HF_TOKEN !== "") {
    hf_token = process.env.HF_TOKEN;
  }

  try {
    // Setup repo configuration
    const repo = {
      type: "space",
      name: path ?? "",
    };

    let readme;
    let newHtml = html;

    // If no path provided, create a new space
    if (!path || path === "") {
      // Get username for the repo ID
      const { name: username } = await whoAmI({ accessToken: hf_token });
      
      // Create a URL-friendly title for the repo name
      const newTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .split("-")
        .filter(Boolean)
        .join("-")
        .slice(0, 96);

      const repoId = `${username}/${newTitle}`;
      repo.name = repoId;

      // Create the new repository
      await createRepo({
        repo,
        accessToken: hf_token,
      });
      
      // Generate random colors for Space styling
      const colorFrom = COLORS[Math.floor(Math.random() * COLORS.length)];
      const colorTo = COLORS[Math.floor(Math.random() * COLORS.length)];
      
      // Create HF Space README with metadata
      readme = `---
title: ${newTitle}
emoji: 🐳
colorFrom: ${colorFrom}
colorTo: ${colorTo}
sdk: static
pinned: false
tags:
  - deepsite
---

Check out the configuration reference at https://huggingface.co/docs/hub/spaces-config-reference`;
    }

    // Add attribution tag to the HTML
    newHtml = html.replace(/<\/body>/, `${getPTag(repo.name)}</body>`);
    
    // Create file objects for uploading
    const file = new Blob([newHtml], { type: "text/html" });
    file.name = "index.html"; // Add name property to the Blob

    // Create a file with the prompts used to generate the site
    const newPrompts = ``.concat(prompts.map((prompt) => prompt).join("\n"));
    const promptFile = new Blob([newPrompts], { type: "text/plain" });
    promptFile.name = "prompts.txt"; // Add name property to the Blob

    const files = [file, promptFile];
    
    // Add README file if creating a new space
    if (readme) {
      const readmeFile = new Blob([readme], { type: "text/markdown" });
      readmeFile.name = "README.md"; // Add name property to the Blob
      files.push(readmeFile);
    }
    
    // Upload files to Hugging Face Space
    await uploadFiles({
      repo,
      files,
      accessToken: hf_token,
    });
    
    return res.status(200).send({ ok: true, path: repo.name });
  } catch (err) {
    return res.status(500).send({
      ok: false,
      message: err.message,
    });
  }
});

/**
 * POST /api/ask-ai - Generates HTML content using AI
 * 
 * Request body:
 * - prompt: The user's prompt for HTML generation
 * - html: Optional existing HTML to update
 * - previousPrompt: Optional previous prompt for context
 * - provider: AI provider to use (or "auto")
 * 
 * Returns a streamed response with the generated HTML
 */
app.post("/api/ask-ai", async (req, res) => {
  const { prompt, html, previousPrompt, provider } = req.body;
  // Validate required field
  if (!prompt) {
    return res.status(400).send({
      ok: false,
      message: "Missing required fields",
    });
  }

  let { hf_token } = req.cookies;
  let token = hf_token;

  // Use environment token if set
  if (process.env.HF_TOKEN && process.env.HF_TOKEN !== "") {
    token = process.env.HF_TOKEN;
  }

  // Get client IP address for rate limiting
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.socket.remoteAddress ||
    req.ip ||
    "0.0.0.0";

  // Rate limiting for unauthenticated users
  if (!token) {
    ipAddresses.set(ip, (ipAddresses.get(ip) || 0) + 1);
    if (ipAddresses.get(ip) > MAX_REQUESTS_PER_IP) {
      return res.status(429).send({
        ok: false,
        openLogin: true,
        message: "Log In to continue using the service",
      });
    }

    token = process.env.DEFAULT_HF_TOKEN;
  }

  // Set up response headers for streaming
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Initialize inference client for AI communication
  const client = new InferenceClient(token);
  let completeResponse = "";

  // Calculate approximate token usage for context limit checks
  let TOKENS_USED = prompt?.length;
  if (previousPrompt) TOKENS_USED += previousPrompt.length;
  if (html) TOKENS_USED += html.length;

  // Select provider - either user choice or default
  const DEFAULT_PROVIDER = PROVIDERS.novita;
  const selectedProvider =
    provider === "auto"
      ? DEFAULT_PROVIDER
      : PROVIDERS[provider] ?? DEFAULT_PROVIDER;

  // Check if context is too large for the selected provider
  if (provider !== "auto" && TOKENS_USED >= selectedProvider.max_tokens) {
    return res.status(400).send({
      ok: false,
      openSelectProvider: true,
      message: `Context is too long. ${selectedProvider.name} allow ${selectedProvider.max_tokens} max tokens.`,
    });
  }

  try {
    // Start streaming AI response
    const chatCompletion = client.chatCompletionStream({
      model: MODEL_ID,
      provider: selectedProvider.id,
      messages: [
        // System prompt to define the task
        {
          role: "system",
          content: `ONLY USE HTML, CSS AND JAVASCRIPT. If you want to use ICON make sure to import the library first. Try to create the best UI possible by using only HTML, CSS and JAVASCRIPT. Use as much as you can TailwindCSS for the CSS, if you can't do something with TailwindCSS, then use custom CSS (make sure to import <script src="https://cdn.tailwindcss.com"></script> in the head). Also, try to ellaborate as much as you can, to create something unique. ALWAYS GIVE THE RESPONSE INTO A SINGLE HTML FILE`,
        },
        // Include previous prompt if provided
        ...(previousPrompt
          ? [
              {
                role: "user",
                content: previousPrompt,
              },
            ]
          : []),
        // Include existing HTML if provided
        ...(html
          ? [
              {
                role: "assistant",
                content: `The current code is: ${html}.`,
              },
            ]
          : []),
        // The current prompt
        {
          role: "user",
          content: prompt,
        },
      ],
      // SambaNova provider doesn't support max_tokens parameter
      ...(selectedProvider.id !== "sambanova"
        ? {
            max_tokens: selectedProvider.max_tokens,
          }
        : {}),
    });

    // Process the streaming response
    while (true) {
      const { done, value } = await chatCompletion.next();
      if (done) {
        break;
      }
      const chunk = value.choices[0]?.delta?.content;
      if (chunk) {
        if (provider !== "sambanova") {
          // Stream chunk to client
          res.write(chunk);
          completeResponse += chunk;

          // End if we've completed the HTML
          if (completeResponse.includes("</html>")) {
            break;
          }
        } else {
          // Special handling for SambaNova provider
          let newChunk = chunk;
          if (chunk.includes("</html>")) {
            // Replace everything after the last </html> tag with an empty string
            newChunk = newChunk.replace(/<\/html>[\s\S]*/, "</html>");
          }
          completeResponse += newChunk;
          res.write(newChunk);
          if (newChunk.includes("</html>")) {
            break;
          }
        }
      }
    }
    // End the response stream
    res.end();
  } catch (error) {
    // Handle payment-related errors
    if (error.message.includes("exceeded your monthly included credits")) {
      return res.status(402).send({
        ok: false,
        openProModal: true,
        message: error.message,
      });
    }
    
    // Handle general errors
    if (!res.headersSent) {
      res.status(500).send({
        ok: false,
        message:
          error.message || "An error occurred while processing your request.",
      });
    } else {
      // Otherwise end the stream
      res.end();
    }
  }
});

/**
 * GET /api/remix/:username/:repo - Fetches content from an existing DeepSite project for remixing
 * 
 * Path parameters:
 * - username: Owner of the space
 * - repo: Name of the space
 * 
 * Returns the HTML content of the space and metadata
 */
app.get("/api/remix/:username/:repo", async (req, res) => {
  const { username, repo } = req.params;
  const { hf_token } = req.cookies;

  // Use user token or fall back to default
  let token = hf_token || process.env.DEFAULT_HF_TOKEN;

  if (process.env.HF_TOKEN && process.env.HF_TOKEN !== "") {
    token = process.env.HF_TOKEN;
  }

  const repoId = `${username}/${repo}`;

  // URL to fetch the raw HTML file
  const url = `https://huggingface.co/spaces/${repoId}/raw/main/index.html`;
  try {
    // Get space info to verify access and type
    const space = await spaceInfo({
      name: repoId,
      accessToken: token,
      additionalFields: ["author"],
    });

    // Verify space is public and using static SDK
    if (!space || space.sdk !== "static" || space.private) {
      return res.status(404).send({
        ok: false,
        message: "Space not found",
      });
    }

    // Fetch the HTML content
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(404).send({
        ok: false,
        message: "Space not found",
      });
    }
    
    let html = await response.text();
    // Remove the attribution tag
    html = html.replace(getPTag(repoId), "");

    let user = null;

    // Get user info if authenticated
    if (token) {
      const request_user = await fetch(
        "https://huggingface.co/oauth/userinfo",
        {
          headers: {
            Authorization: `Bearer ${hf_token}`,
          },
        }
      )
        .then((res) => res.json())
        .catch(() => null);

      user = request_user;
    }

    res.status(200).send({
      ok: true,
      html,
      isOwner: space.author === user?.preferred_username,
      path: repoId,
    });
  } catch (error) {
    return res.status(500).send({
      ok: false,
      message: error.message,
    });
  }
});

/**
 * Catch-all route for single-page application
 * Serves the main index.html file for all other routes
 */
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

/**
 * Start the server
 */
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
