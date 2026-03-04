"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectUrl?: string;
}

/**
 * Modal de acceso que redirige a la página principal de DISI (/),
 * donde está el AuthPanel con nuestro flujo (Google + email/código).
 * No usa componentes de Clerk para mantener una sola experiencia de login.
 */
export function AuthModal({ isOpen, onClose, redirectUrl = "/" }: AuthModalProps) {
  const router = useRouter();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const goToAuth = () => {
    onClose();
    router.push(redirectUrl);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-background/5 backdrop-blur-sm cursor-pointer"
          />

          <div
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="relative pointer-events-auto w-full max-w-md rounded-2xl border border-border/50 bg-card shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="auth-modal-title" className="sr-only">
                Iniciar sesión en DISI
              </h2>

              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center space-y-4 pt-2">
                <p className="text-foreground font-medium">
                  Iniciar sesión en DISI
                </p>
                <p className="text-sm text-muted-foreground">
                  Usa la página de acceso para continuar con Google o con tu correo.
                </p>
                <button
                  type="button"
                  onClick={goToAuth}
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                >
                  Ir a la página de acceso
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
