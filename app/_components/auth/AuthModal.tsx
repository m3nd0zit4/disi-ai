import { useEffect } from "react";
import { SignIn } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectUrl?: string;
}

export function AuthModal({ isOpen, onClose, redirectUrl = "/" }: AuthModalProps) {
  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-background/5 backdrop-blur-sm cursor-pointer"
          />

          {/* Modal Container */}
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
              className="relative pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Visually Hidden Title for Accessibility */}
              <h2 id="auth-modal-title" className="sr-only">Sign In to DISI</h2>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute -top-2 -right-2 z-[102] p-2 rounded-full bg-background border border-border/50 text-muted-foreground hover:text-foreground transition-colors shadow-lg"
              >
                <X className="w-4 h-4" />
              </button>

              <SignIn 
                appearance={{
                  elements: {
                    rootBox: "w-full shadow-2xl rounded-2xl overflow-hidden",
                    card: "shadow-none border border-border/50 bg-card/50 backdrop-blur-xl",
                    headerTitle: "text-foreground",
                    headerSubtitle: "text-muted-foreground",
                    socialButtonsBlockButton: "bg-background/50 border-border/50 text-foreground hover:bg-background/80",
                    dividerLine: "bg-border/50",
                    dividerText: "text-muted-foreground",
                    formFieldLabel: "text-foreground",
                    formFieldInput: "bg-background/50 border-border/50 text-foreground",
                    footer: "hidden",
                    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
                  },
                  layout: {
                    socialButtonsPlacement: "top",
                    showOptionalFields: false,
                  }
                }}
                fallbackRedirectUrl="/"
              />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
