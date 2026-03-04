"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useSettingsPanel } from "@/hooks/useSettingsPanel";
import { useDialog } from "@/hooks/useDialog";
import {
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  Leaf,
  Layers,
  Brain,
  User,
  Key,
  Coins,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getPlanDisplayName, PRO_MONTHLY_CREDITS, hasFeature } from "@/lib/plans";

const CARD_INNER = "rounded-lg bg-background/50 border border-border/50";
const LABEL_CLASS = "text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80";

type SettingsSection = "general" | "api-keys" | "garden" | "rlm" | "ai-features" | "billing";

const SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: "general", label: "General", icon: <User className="w-4 h-4" /> },
  { id: "api-keys", label: "API Keys", icon: <Key className="w-4 h-4" /> },
  { id: "garden", label: "Knowledge Garden", icon: <Leaf className="w-4 h-4" /> },
  { id: "rlm", label: "RLM", icon: <Layers className="w-4 h-4" /> },
  { id: "ai-features", label: "AI Features", icon: <Sparkles className="w-4 h-4" /> },
  { id: "billing", label: "Créditos", icon: <Coins className="w-4 h-4" /> },
];

function AddCreditsButton() {
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const { showDialog } = useDialog();

  const handleAddCredits = async () => {
    if (amount < 5) {
      showDialog({ title: "Error", description: "Mínimo 5 USD", type: "error" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/create-top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      if (data.data?.url) window.location.href = data.data.url;
      else showDialog({ title: "Error", description: "No se recibió URL de pago", type: "error" });
    } catch (e) {
      showDialog({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo iniciar el pago",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={5}
          step={1}
          value={amount}
          onChange={(e) => setAmount(Math.max(5, Number(e.target.value) || 5))}
          className="h-8 w-20 text-xs"
        />
        <span className="text-xs text-muted-foreground">USD</span>
      </div>
      <Button variant="outline" size="sm" className="text-xs w-fit" onClick={handleAddCredits} disabled={loading}>
        {loading ? "Redirigiendo…" : "Añadir créditos"}
      </Button>
    </div>
  );
}

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

export function SettingsPanel() {
  const { open, setOpen } = useSettingsPanel();
  const { showDialog } = useDialog();
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");

  const user = useQuery(api.users.users.getCurrentUser);
  const gardenSettings = useQuery(api.users.settings.getGardenSettings);
  const rlmSettings = useQuery(api.users.settings.getRlmSettings);
  const aiFeatureDefaults = useQuery(api.users.settings.getAiFeatureDefaults);
  const kbs = useQuery(api.knowledge_garden.knowledgeBases.list);

  const updateGardenSettings = useMutation(api.users.settings.updateGardenSettings);
  const updateRlmSettings = useMutation(api.users.settings.updateRlmSettings);
  const updateAiFeatureDefaults = useMutation(api.users.settings.updateAiFeatureDefaults);

  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [validating, setValidating] = useState<Record<string, boolean>>({});
  const [userKeys, setUserKeys] = useState<UserApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);

  useEffect(() => {
    async function loadKeys() {
      try {
        const res = await fetch("/api/user/api-keys");
        if (res.ok) {
          const data = await res.json();
          setUserKeys(data.keys || []);
        }
      } catch (e) {
        console.error("Error loading keys:", e);
      } finally {
        setKeysLoading(false);
      }
    }
    if (open) loadKeys();
  }, [open]);

  const handleSaveKey = async (providerId: string) => {
    if (!apiKeys[providerId]?.trim()) {
      showDialog({ title: "Error", description: "Ingresa una API key válida", type: "error" });
      return;
    }
    setValidating((p) => ({ ...p, [providerId]: true }));
    try {
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, apiKey: apiKeys[providerId] }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      setApiKeys((p) => ({ ...p, [providerId]: "" }));
      const keysRes = await fetch("/api/user/api-keys");
      if (keysRes.ok) setUserKeys((await keysRes.json()).keys || []);
      showDialog({ title: "Éxito", description: `API Key de ${providerId} guardada`, type: "success" });
    } catch (e) {
      showDialog({
        title: "Error",
        description: e instanceof Error ? e.message : "Error desconocido",
        type: "error",
      });
    } finally {
      setValidating((p) => ({ ...p, [providerId]: false }));
    }
  };

  const handleDeleteKey = async (providerId: string) => {
    showDialog({
      title: "Eliminar API Key",
      description: `¿Eliminar la API key de ${providerId}?`,
      type: "confirm",
      confirmText: "Eliminar",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/user/api-keys?provider=${providerId}`, { method: "DELETE" });
          if (!res.ok) throw new Error("Failed to delete");
          const keysRes = await fetch("/api/user/api-keys");
          if (keysRes.ok) setUserKeys((await keysRes.json()).keys || []);
          showDialog({ title: "Éxito", description: "API Key eliminada", type: "success" });
        } catch (e) {
          showDialog({
            title: "Error",
            description: e instanceof Error ? e.message : "Error",
            type: "error",
          });
        }
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-[720px] w-[95vw] flex flex-col p-0 gap-0 overflow-hidden bg-background border rounded-xl shadow-xl h-[85vh] [&>button]:absolute [&>button]:right-4 [&>button]:top-4"
      >
        <div className="flex items-center shrink-0 px-6 py-4 border-b border-border/50">
          <DialogTitle className="text-lg font-semibold tracking-tight">Configuración</DialogTitle>
        </div>

        {/* Card container: sidebar + content */}
        <div className="flex flex-1 min-h-0 rounded-b-xl overflow-hidden">
          {/* Left sidebar nav */}
          <nav className="shrink-0 w-[180px] border-r border-border/50 bg-muted/20 flex flex-col py-2">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors rounded-none border-l-2 border-transparent",
                  activeSection === section.id
                    ? "bg-primary/10 text-primary border-primary font-medium"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                {section.icon}
                <span>{section.label}</span>
              </button>
            ))}
          </nav>

          {/* Right content */}
          <ScrollArea className="flex-1">
            <div className="p-6 pb-10">
              {/* General */}
              {activeSection === "general" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Plan</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={user?.plan === "pro" ? "default" : "secondary"}>
                        {getPlanDisplayName(user?.plan)}
                      </Badge>
                    </div>
                    {user?.plan === "pro" && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {PRO_MONTHLY_CREDITS.toLocaleString()} créditos incluidos este mes (renovación automática).
                      </p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Saldo</h3>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                      <span className="text-sm text-muted-foreground">Créditos disponibles</span>
                      <span className="text-sm font-bold tabular-nums">{user?.balanceCredits ?? 0}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {!hasFeature(user?.plan, "credits")
                        ? "Usa tus propias API keys o añade créditos para usar modelos."
                        : "El uso descuenta de tu saldo. Añade créditos cuando quieras."}
                    </p>
                  </div>
                </div>
              )}

              {/* API Keys */}
              {activeSection === "api-keys" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-1">API Keys de IA</h3>
                    <p className="text-xs text-muted-foreground">Claves por proveedor (AWS Secrets Manager)</p>
                  </div>
                  {keysLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground py-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs">Cargando…</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {PROVIDERS.map((provider) => {
                        const userKey = userKeys.find((k) => k.modelId === provider.id);
                        const hasKey = userKey?.hasKey;
                        const isValid = userKey?.isValid;
                        const isValidating = validating[provider.id];
                        const show = showKeys[provider.id];
                        return (
                          <div key={provider.id} className={`p-3 ${CARD_INNER} space-y-2`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Image src={provider.icon} alt={provider.name} width={18} height={18} className="rounded" />
                                <span className="text-xs font-medium">{provider.name}</span>
                              </div>
                              {hasKey && (
                                <Badge variant={isValid ? "default" : "destructive"} className="text-[10px]">
                                  {isValid ? <CheckCircle className="w-2.5 h-2.5 mr-0.5" /> : <XCircle className="w-2.5 h-2.5 mr-0.5" />}
                                  {isValid ? "Válida" : "Inválida"}
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-1.5">
                              <div className="flex-1 relative">
                                <Input
                                  type={show ? "text" : "password"}
                                  placeholder={hasKey ? "••••••••" : "sk-..."}
                                  value={apiKeys[provider.id] || ""}
                                  onChange={(e) => setApiKeys((p) => ({ ...p, [provider.id]: e.target.value }))}
                                  className="h-8 text-xs pr-8"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowKeys((p) => ({ ...p, [provider.id]: !p[provider.id] }))}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                  {show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                              </div>
                              <Button
                                size="sm"
                                className="h-8 text-xs"
                                disabled={!apiKeys[provider.id] || isValidating}
                                onClick={() => handleSaveKey(provider.id)}
                              >
                                {isValidating ? <Loader2 className="w-3 h-3 animate-spin" /> : hasKey ? "Actualizar" : "Guardar"}
                              </Button>
                              {hasKey && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleDeleteKey(provider.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Knowledge Garden */}
              {activeSection === "garden" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Knowledge Garden</h3>
                    <p className="text-xs text-muted-foreground">Alimenta tu jardín con respuestas valiosas</p>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                    <span className="text-sm">Feed the Garden</span>
                    <Switch
                      checked={gardenSettings?.isActive ?? false}
                      onCheckedChange={(v) => updateGardenSettings({ isActive: v })}
                      className="scale-90 data-[state=checked]:bg-emerald-500"
                    />
                  </div>
                  {gardenSettings?.isActive && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs">Modo</Label>
                        <Select
                          value={gardenSettings.feedMode}
                          onValueChange={(v: "manual" | "assisted" | "automatic") => updateGardenSettings({ feedMode: v })}
                        >
                          <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual" className="text-xs">Manual</SelectItem>
                            <SelectItem value="assisted" className="text-xs">Assisted</SelectItem>
                            <SelectItem value="automatic" className="text-xs">Automatic</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {kbs && kbs.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs">KB por defecto</Label>
                          <Select
                            value={gardenSettings.defaultKbId ?? "none"}
                            onValueChange={(v) =>
                              updateGardenSettings({ defaultKbId: v === "none" ? undefined : (v as Id<"knowledgeBases">) })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/50">
                              <SelectValue placeholder="Ninguno" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">Ninguno</SelectItem>
                              {kbs.map((kb) => (
                                <SelectItem key={kb._id} value={kb._id} className="text-xs">
                                  {kb.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* RLM */}
              {activeSection === "rlm" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-1">RLM (Reasoning)</h3>
                    <p className="text-xs text-muted-foreground">Modo de razonamiento y presupuesto</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Modo</Label>
                    <Select
                      value={rlmSettings?.mode ?? "simple"}
                      onValueChange={(v: "simple" | "full") => updateRlmSettings({ mode: v })}
                    >
                      <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simple" className="text-xs">Simple</SelectItem>
                        <SelectItem value="full" className="text-xs">Full (planner → workers)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Token budget</Label>
                    <Input
                      type="number"
                      min={1000}
                      max={128000}
                      step={1000}
                      defaultValue={rlmSettings?.tokenBudget ?? 16000}
                      key={rlmSettings?.tokenBudget ?? 16000}
                      onBlur={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!isNaN(n) && n >= 1000 && n <= 128000) updateRlmSettings({ tokenBudget: n });
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                    <span className="text-sm">Cache</span>
                    <Switch
                      checked={rlmSettings?.enableCache ?? true}
                      onCheckedChange={(v) => updateRlmSettings({ enableCache: v })}
                      className="scale-90"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                    <span className="text-sm">Reasoning summary</span>
                    <Switch
                      checked={rlmSettings?.enableReasoning ?? false}
                      onCheckedChange={(v) => updateRlmSettings({ enableReasoning: v })}
                      className="scale-90"
                    />
                  </div>
                </div>
              )}

              {/* AI Features */}
              {activeSection === "ai-features" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Features de IA (por defecto)</h3>
                    <p className="text-xs text-muted-foreground">Opciones por defecto para nuevas conversaciones</p>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Extended Thinking</span>
                    </div>
                    <Switch
                      checked={aiFeatureDefaults?.thinkingEnabled ?? false}
                      onCheckedChange={(v) => updateAiFeatureDefaults({ thinkingEnabled: v })}
                      className="scale-90"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">RLM Full por defecto</span>
                    </div>
                    <Switch
                      checked={aiFeatureDefaults?.rlmForceFullByDefault ?? false}
                      onCheckedChange={(v) => updateAiFeatureDefaults({ rlmForceFullByDefault: v })}
                      className="scale-90"
                    />
                  </div>
                </div>
              )}

              {/* Billing / Créditos */}
              {activeSection === "billing" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Créditos</h3>
                    <p className="text-xs text-muted-foreground">
                      {hasFeature(user?.plan, "credits")
                        ? "Añade créditos para usar modelos con tu plan."
                        : "Añade créditos para desbloquear Pay As You Go o suscríbete a Pro."}
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 mb-4">
                    <span className="text-sm">Saldo actual</span>
                    <span className="text-sm font-bold tabular-nums">{user?.balanceCredits ?? 0} créditos</span>
                  </div>
                  <AddCreditsButton />
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
