"use client";

import { useState } from "react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { logoFont } from "@/app/fonts";

const TITLE = "AI para quien crea";

type EmailFlowMode = "sign_in" | "sign_up";

function isIdentifierNotFound(err: unknown): boolean {
  const e = err as { errors?: Array<{ code?: string }> };
  return e?.errors?.[0]?.code === "form_identifier_not_found";
}

function getClerkErrorMessage(err: unknown): string {
  const e = err as { errors?: Array<{ longMessage?: string; message?: string }>; message?: string };
  const first = e?.errors?.[0];
  if (first?.longMessage) return first.longMessage;
  if (first?.message) return first.message;
  if (e?.message) return e.message;
  return err instanceof Error ? err.message : "";
}

function getVerificationErrorMessage(
  status: string,
  missingFields?: string[]
): string {
  if (status === "missing_requirements") {
    if (missingFields?.length) {
      return `Clerk pide más datos: ${missingFields.join(", ")}. Revisa en Clerk Dashboard → User & authentication que el registro con email no exija campos extra (nombre, contraseña, etc.).`;
    }
    return "El registro pide datos adicionales en Clerk. En Clerk Dashboard → User & authentication desactiva «Password» y otros campos obligatorios para registro solo con email, o usa «Usar otro correo».";
  }
  return "Código incorrecto o expirado.";
}

export function AuthPanel() {
  const { resolvedTheme } = useTheme();
  const { signIn, isLoaded: signInLoaded, setActive } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [emailAddressId, setEmailAddressId] = useState<string | null>(null);
  const [emailFlowMode, setEmailFlowMode] = useState<EmailFlowMode>("sign_in");

  const isLoaded = signInLoaded && signUpLoaded;

  const handleGoogle = async () => {
    if (!signIn || !isLoaded) return;
    setError("");
    setLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al continuar con Google");
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn || !isLoaded || !email.trim()) return;
    setError("");
    setLoading(true);
    setEmailFlowMode("sign_in");
    try {
      const res = await signIn.create({ identifier: email.trim() });
      if (res.status === "needs_first_factor") {
        const firstFactor = res.supportedFirstFactors?.find(
          (f) => f.strategy === "email_code"
        ) as { strategy: "email_code"; emailAddressId: string } | undefined;
        if (firstFactor) {
          await signIn.prepareFirstFactor({
            strategy: "email_code",
            emailAddressId: firstFactor.emailAddressId,
          });
          setEmailAddressId(firstFactor.emailAddressId);
          setEmailSent(true);
          setShowCodeInput(false);
        } else {
          setError("Revisa tu correo para continuar.");
          setEmailSent(true);
        }
      } else if (res.status === "complete") {
        await setActive?.({ session: res.createdSessionId });
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      if (isIdentifierNotFound(err)) {
        try {
          if (!signUp) {
            setError("No se pudo crear la cuenta. Intenta de nuevo.");
            setLoading(false);
            return;
          }
          await signUp.create({
            emailAddress: email.trim(),
            firstName: "Usuario",
            lastName: "",
          });
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          setEmailFlowMode("sign_up");
          setEmailAddressId(null);
          setEmailSent(true);
          setShowCodeInput(false);
        } catch (signUpErr) {
          setError(
            signUpErr instanceof Error ? signUpErr.message : "Error al enviar el correo"
          );
        }
      } else {
        setError(err instanceof Error ? err.message : "Error al enviar el correo");
      }
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setError("");
    setLoading(true);
    try {
      if (emailFlowMode === "sign_up" && signUp && email.trim()) {
        try {
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        } catch (prepareErr) {
          const msg = prepareErr instanceof Error ? prepareErr.message : String(prepareErr);
          if (msg.includes("already been verified") || msg.includes("already verified")) {
            await signUp.create({ emailAddress: email.trim() });
            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          } else {
            throw prepareErr;
          }
        }
      } else if (emailFlowMode === "sign_in" && signIn && emailAddressId) {
        await signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId,
        });
      }
      setLoading(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al reenviar el correo"
      );
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !code.trim()) return;
    setError("");
    setLoading(true);
    const codeValue = code.trim().replace(/\s/g, "");
    try {
      if (emailFlowMode === "sign_up") {
        if (!signUp) {
          setError("Sesión de registro expirada. Haz clic en «Usar otro correo» e introduce de nuevo tu correo.");
          setLoading(false);
          return;
        }
        const res = await signUp.attemptEmailAddressVerification({ code: codeValue });
        const sessionId: string | null | undefined =
          (res as { createdSessionId?: string | null }).createdSessionId ??
          res.createdSessionId;
        if ((res.status === "complete" || res.status === "missing_requirements") && typeof sessionId === "string") {
          await setActive?.({ session: sessionId });
          // Breve pausa para que el navegador persista la cookie antes de navegar (evita llegar a /onboarding sin sesión)
          await new Promise((r) => setTimeout(r, 400));
          window.location.replace("/onboarding");
          return;
        } else {
          const missing = (res as { missingFields?: string[] }).missingFields;
          setError(getVerificationErrorMessage(res.status ?? "", missing));
        }
      } else {
        if (!signIn) {
          setError("Sesión expirada. Haz clic en «Usar otro correo» e inténtalo de nuevo.");
          setLoading(false);
          return;
        }
        const res = await signIn.attemptFirstFactor({
          strategy: "email_code",
          code: codeValue,
        });
        const sessionId = res.createdSessionId;
        if (res.status === "complete" && typeof sessionId === "string") {
          await setActive?.({ session: sessionId });
          router.push("/");
          router.refresh();
        } else {
          setError(getVerificationErrorMessage(res.status ?? ""));
        }
      }
    } catch (err) {
      const msg = getClerkErrorMessage(err);
      setError(msg || "Error al verificar el código");
    }
    setLoading(false);
  };

  const backToEmail = () => {
    setEmailSent(false);
    setShowCodeInput(false);
    setCode("");
    setError("");
    setEmailAddressId(null);
    setEmailFlowMode("sign_in");
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <h1 className={logoFont.className + " text-3xl sm:text-5xl text-foreground tracking-tight mb-2"}> Disi </h1>
      <h1
        className="text-3xl sm:text-4xl font-serif text-foreground text-center mb-8 tracking-tight"
        style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
      >
        {TITLE}
      </h1>

      <div className="w-full max-w-[400px] rounded-2xl bg-card border border-border p-6 shadow-xl">
        {!emailSent ? (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 h-12 rounded-xl bg-muted border border-border text-foreground font-medium hover:bg-accent transition-colors disabled:opacity-50"
            >
              <GoogleIcon />
              Continuar con Google
            </button>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">O</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Introduce tu correo"
                required
                className="w-full h-12 px-4 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                autoComplete="email"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Continuar con email
              </button>
            </form>
          </>
        ) : !showCodeInput ? (
          <div className="space-y-6">
            <div className="flex justify-center">
              <MailboxIcon />
            </div>
            <p className="text-center text-foreground text-sm">
              Para continuar, revisa el código enviado a
            </p>
            <p className="text-center text-foreground font-semibold break-all">
              {email}
            </p>
            <div className="space-y-4 pt-2">
              <p className="text-center text-muted-foreground text-sm">
                ¿Entrando desde otro navegador?{" "}
                <button
                  type="button"
                  onClick={() => setShowCodeInput(true)}
                  className="text-primary hover:text-primary/90 underline font-medium"
                >
                  Introducir código de verificación
                </button>
              </p>
              <p className="text-center text-muted-foreground text-sm">
                ¿No ves el correo en tu bandeja?{" "}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  className="text-primary hover:text-primary/90 underline font-medium disabled:opacity-50"
                >
                  Reenviar
                </button>
              </p>
            </div>
            <button
              type="button"
              onClick={backToEmail}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Usar otro correo
            </button>
          </div>
        ) : (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <h2 className="text-foreground font-medium text-sm">
              ¿Tienes un código de verificación?
            </h2>
            <p className="text-muted-foreground text-sm">
              Introduce el código enviado a{" "}
              <span className="text-foreground font-medium">{email}</span>
            </p>
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
              <p className="text-foreground/90 text-xs">
                Si no recibes el correo, revisa spam o correo no deseado y asegúrate de
                que los correos de DISI no estén bloqueados.
              </p>
            </div>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Introduce el código de verificación"
              required
              className="w-full h-12 px-4 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
              autoComplete="one-time-code"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Verificar correo
            </button>
            <p className="text-center text-muted-foreground text-sm">
              ¿No ves el correo en tu bandeja?{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="text-primary hover:text-primary/90 underline font-medium disabled:opacity-50"
              >
                Reenviar
              </button>
            </p>
            <button
              type="button"
              onClick={backToEmail}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Usar otro correo
            </button>
          </form>
        )}

        {error && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {/* CAPTCHA sigue el tema del sistema */}
        <div id="clerk-captcha" data-cl-theme={isDark ? "dark" : "light"} data-cl-size="normal" data-cl-language="es" className="min-h-0 overflow-hidden" aria-hidden />
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground max-w-[400px]">
        Al continuar, aceptas la{" "}
        <Link
          href="/privacy"
          className="underline hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          Política de privacidad
        </Link>{" "}
        de DISI.
      </p>
    </div>
  );
}

function MailboxIcon() {
  return (
    <svg
      className="w-12 h-12 text-primary"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
