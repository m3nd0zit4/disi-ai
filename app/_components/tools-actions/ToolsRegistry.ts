import { 
  Globe, 
  Code, 
  Image as ImageIcon, 
  Monitor, 
  FileSearch, 
  Map, 
  Twitter, 
  FlaskConical, 
  Server, 
  Braces 
} from "lucide-react";

export interface ToolDefinition {
  id: string;
  label: string;
  icon: any;
  description: string;
  providerIds: {
    gemini?: string;
    openai?: string;
    claude?: string;
    grok?: string;
    deepseek?: string;
  };
}

export const TOOLS_REGISTRY: ToolDefinition[] = [
  {
    id: "webSearch",
    label: "Web Search",
    icon: Globe,
    description: "Search the internet for real-time information",
    providerIds: {
      gemini: "googleSearch",
      openai: "webSearch",
      claude: "webSearch",
      grok: "webSearch",
    }
  },
  {
    id: "codeExecution",
    label: "Code Execution",
    icon: Code,
    description: "Execute code snippets (Python, etc.)",
    providerIds: {
      gemini: "codeExecution",
      openai: "codeInterpreter",
      claude: "textEditor", // Mapping text editor/analysis to code execution bucket for simplicity, or keep separate?
      grok: "codeExecution",
    }
  },
  {
    id: "imageGeneration",
    label: "Image Gen",
    icon: ImageIcon,
    description: "Generate images from text",
    providerIds: {
      gemini: "imageGeneration", // Via capabilities
      openai: "imageGeneration",
      grok: "imageGeneration", // Via model capability
    }
  },
  {
    id: "computerUse",
    label: "Computer Use",
    icon: Monitor,
    description: "Control computer interface",
    providerIds: {
      gemini: "computerUse",
      openai: "computerUse",
      claude: "computerUse",
    }
  },
  {
    id: "fileSearch",
    label: "File Search",
    icon: FileSearch,
    description: "Search through uploaded documents",
    providerIds: {
      gemini: "fileSearch",
      openai: "fileSearch",
      grok: "documentSearch", // Mapped from documentSearch
    }
  },
  {
    id: "googleMaps",
    label: "Google Maps",
    icon: Map,
    description: "Access location data and maps",
    providerIds: {
      gemini: "googleMaps",
    }
  },
  {
    id: "xSearch",
    label: "X Search",
    icon: Twitter,
    description: "Search X (Twitter) posts and trends",
    providerIds: {
      grok: "xSearch",
    }
  },
  {
    id: "deepResearch",
    label: "Deep Research",
    icon: FlaskConical,
    description: "Autonomous deep research agent",
    providerIds: {
      gemini: "deepResearch", // Agent
    }
  },
  {
    id: "mcp",
    label: "MCP",
    icon: Server,
    description: "Connect to Model Context Protocol servers",
    providerIds: {
      openai: "mcp",
      claude: "mcp",
      grok: "mcp",
    }
  },
  {
    id: "functionCalling",
    label: "Functions",
    icon: Braces,
    description: "Call custom defined functions",
    providerIds: {
      gemini: "functionCalling",
      openai: "functionCalling",
      claude: "functionCalling",
      grok: "functionCalling", // implied
      deepseek: "functionCalling",
    }
  }
];
