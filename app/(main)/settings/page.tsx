"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, CheckCircle, XCircle, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useDialog } from "@/hooks/useDialog";

const PROVIDERS = [
  { id: "GPT", name: "OpenAI", icon: "/icons/gpt-claro.svg", docsUrl: "https://platform.openai.com/api-keys" },
  { id: "Claude", name: "Anthropic", icon: "/icons/claude.svg", docsUrl: "https://console.anthropic.com/settings/keys" },
  { id: "Gemini", name: "Google AI", icon: "/icons/gemini.svg", docsUrl: "https://aistudio.google.com/app/apikey" },
  { id: "Grok", name: "xAI", icon: "/icons/grok-claro.svg", docsUrl: "https://console.x.ai" },
  { id: "DeepSeek", name: "DeepSeek", icon: "/icons/deepseek.svg", docsUrl: "https://platform.deepseek.com/api_keys" },
];

interface UserApiKey {
  modelId: string;
  hasKey: boolean;
  isValid: boolean;
}

export default function SettingsPage() {
  const user = useQuery(api.users.users.getCurrentUser);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [validating, setValidating] = useState<Record<string, boolean>>({});
  const [userKeys, setUserKeys] = useState<UserApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const { showDialog } = useDialog();

  // Load user API keys
  useEffect(() => {
    async function loadKeys() {
      try {
        const response = await fetch("/api/user/api-keys");
        if (response.ok) {
          const data = await response.json();
          setUserKeys(data.keys || []);
        }
      } catch (error) {
        console.error("Error loading keys:", error);
      } finally {
        setLoading(false);
      }
    }
    loadKeys();
  }, []);

  const handleSaveKey = async (providerId: string) => {
    if (!apiKeys[providerId]?.trim()) {
      showDialog({
        title: "Error",
        description: "Por favor ingresa una API key válida",
        type: "error"
      });
      return;
    }

    setValidating((prev) => ({ ...prev, [providerId]: true }));
    
    try {
      const response = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          apiKey: apiKeys[providerId],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save key");
      }

      // Clear input and refresh list
      setApiKeys((prev) => ({ ...prev, [providerId]: "" }));
      
      // Reload keys
      const keysResponse = await fetch("/api/user/api-keys");
      if (keysResponse.ok) {
        const data = await keysResponse.json();
        setUserKeys(data.keys || []);
      }

      showDialog({
        title: "Éxito",
        description: `API Key de ${providerId} guardada correctamente`,
        type: "success"
      });
      
    } catch (error) {
      showDialog({
        title: "Error",
        description: `Error: ${error instanceof Error ? error.message : "Desconocido"}`,
        type: "error"
      });
    } finally {
      setValidating((prev) => ({ ...prev, [providerId]: false }));
    }
  };

  const handleDeleteKey = async (providerId: string) => {
    showDialog({
      title: "Eliminar API Key",
      description: `¿Seguro que quieres eliminar la API key de ${providerId}?`,
      type: "confirm",
      confirmText: "Eliminar",
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/user/api-keys?provider=${providerId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            throw new Error("Failed to delete");
          }

          // Reload keys
          const keysResponse = await fetch("/api/user/api-keys");
          if (keysResponse.ok) {
            const data = await keysResponse.json();
            setUserKeys(data.keys || []);
          }
          
          showDialog({
            title: "Éxito",
            description: "API Key eliminada",
            type: "success"
          });
        } catch (error) {
          showDialog({
            title: "Error",
            description: `Error al eliminar: ${error instanceof Error ? error.message : "Desconocido"}`,
            type: "error"
          });
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="container max-w-4xl py-8 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground">Gestiona tus API keys y preferencias</p>
      </div>

      {/* Plan Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Plan Actual
            <Badge variant={user?.plan === "pro" ? "default" : "secondary"}>
              {user?.plan?.toUpperCase() || "FREE"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {user?.plan === "free" ? (
            <Alert>
              <AlertDescription>
                <p className="font-semibold mb-2">🔑 Plan FREE: Usa tus propias API keys</p>
                <p className="text-sm mb-3">
                  Configura tus API keys abajo para comenzar a usar DISI. Pagarás directamente a los proveedores de IA.
                </p>
                <Button onClick={() => window.location.href = "/upgrade"}>
                  Actualizar a PRO ($29/mes)
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Con PRO: 10,000 mensajes/mes sin gestionar API keys
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertDescription>
                <p className="font-semibold mb-2">✨ Plan PRO Activo</p>
                <p className="text-sm">
                  Tienes 10,000 mensajes/mes incluidos. Puedes usar tus propias keys para mensajes ilimitados.
                </p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* API Keys Section */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys de IA</CardTitle>
          <CardDescription>
            Configura tus claves de API para cada proveedor. Las guardamos de forma segura en AWS Secrets Manager.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {PROVIDERS.map((provider) => {
            const userKey = userKeys.find(k => k.modelId === provider.id);
            const hasKey = userKey?.hasKey;
            const isValid = userKey?.isValid;
            const isValidating = validating[provider.id];
            const show = showKeys[provider.id];

            return (
              <div key={provider.id} className="space-y-3 pb-6 border-b last:border-b-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Image 
                      src={provider.icon} 
                      alt={provider.name} 
                      width={24}
                      height={24}
                      className="w-6 h-6" 
                    />
                    <div>
                      <Label className="text-base">{provider.name}</Label>
                      <p className="text-xs text-muted-foreground">
                        <a 
                          href={provider.docsUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          Obtener API Key →
                        </a>
                      </p>
                    </div>
                  </div>
                  
                  {hasKey && (
                    <Badge variant={isValid ? "default" : "destructive"}>
                      {isValid ? (
                        <><CheckCircle className="w-3 h-3 mr-1" /> Válida</>
                      ) : (
                        <><XCircle className="w-3 h-3 mr-1" /> Inválida</>
                      )}
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      type={show ? "text" : "password"}
                      placeholder={hasKey ? "••••••••••••••••" : "sk-..."}
                      value={apiKeys[provider.id] || ""}
                      onChange={(e) => setApiKeys({
                        ...apiKeys,
                        [provider.id]: e.target.value
                      })}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeys({ ...showKeys, [provider.id]: !show })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  <Button
                    onClick={() => handleSaveKey(provider.id)}
                    disabled={!apiKeys[provider.id] || isValidating}
                  >
                    {isValidating ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Validando</>
                    ) : hasKey ? (
                      "Actualizar"
                    ) : (
                      "Guardar"
                    )}
                  </Button>
                  
                  {hasKey && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDeleteKey(provider.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Alert>
        <AlertDescription className="text-xs">
         Tus API keys se almacenan encriptadas en AWS Secrets Manager. Nunca las compartimos ni las usamos fuera de tus peticiones.
        </AlertDescription>
      </Alert>
    </div>
  );
}