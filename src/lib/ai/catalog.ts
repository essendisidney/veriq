export const AI_CATEGORIES = [
  "foundation_model",
  "coding_assistant",
  "chatbot",
  "agent",
  "inference",
  "other",
] as const;

export type AiCategory = (typeof AI_CATEGORIES)[number];

export type AiDef = {
  id: string;
  name: string;
  category: AiCategory;
  processesData: boolean;
  html: string[];
  packages: string[];
};

export const AI_CATALOG: AiDef[] = [
  {
    id: "openai",
    name: "OpenAI",
    category: "foundation_model",
    processesData: true,
    html: ["api.openai.com", "cdn.openai.com", "chatgpt.com"],
    packages: ["openai", "@ai-sdk/openai", "@openai/agents"],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    category: "foundation_model",
    processesData: true,
    html: ["api.anthropic.com", "claude.ai"],
    packages: ["@anthropic-ai/sdk", "@ai-sdk/anthropic"],
  },
  {
    id: "google-gemini",
    name: "Google Gemini",
    category: "foundation_model",
    processesData: true,
    html: ["generativelanguage.googleapis.com", "gemini.google.com"],
    packages: ["@google/generative-ai", "@ai-sdk/google"],
  },
  {
    id: "xai",
    name: "xAI",
    category: "foundation_model",
    processesData: true,
    html: ["api.x.ai"],
    packages: ["@ai-sdk/xai"],
  },
  {
    id: "mistral",
    name: "Mistral",
    category: "foundation_model",
    processesData: true,
    html: ["api.mistral.ai"],
    packages: ["@mistralai/mistralai", "@ai-sdk/mistral"],
  },
  {
    id: "groq",
    name: "Groq",
    category: "inference",
    processesData: true,
    html: ["api.groq.com"],
    packages: ["groq-sdk", "@ai-sdk/groq"],
  },
  {
    id: "vercel-ai",
    name: "Vercel AI SDK",
    category: "inference",
    processesData: true,
    html: [],
    packages: ["ai", "@ai-sdk/react"],
  },
  {
    id: "langchain",
    name: "LangChain",
    category: "agent",
    processesData: true,
    html: [],
    packages: ["langchain", "@langchain/core", "@langchain/openai"],
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    category: "inference",
    processesData: true,
    html: ["huggingface.co", "hf.co"],
    packages: ["@huggingface/inference", "huggingface-hub"],
  },
  {
    id: "cohere",
    name: "Cohere",
    category: "foundation_model",
    processesData: true,
    html: ["api.cohere.ai", "cohere.com"],
    packages: ["cohere-ai"],
  },
  {
    id: "replicate",
    name: "Replicate",
    category: "inference",
    processesData: true,
    html: ["replicate.com", "api.replicate.com"],
    packages: ["replicate"],
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    category: "coding_assistant",
    processesData: true,
    html: ["copilot.github.com", "github.com/features/copilot", "githubcopilot.com"],
    packages: ["@github/copilot"],
  },
];

export const AI_CATEGORY_LABELS: Record<AiCategory, string> = {
  foundation_model: "Foundation model",
  coding_assistant: "Coding assistant",
  chatbot: "Chatbot",
  agent: "Agent framework",
  inference: "Inference / SDK",
  other: "Other",
};
