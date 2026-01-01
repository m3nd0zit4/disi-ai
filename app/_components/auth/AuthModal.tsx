"use client";

import { SignIn } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";

interface AuthModalProps {
  isOpen: boolean;
}

export function AuthModal({ isOpen }: AuthModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/5 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="relative"
            >
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
                redirectUrl="/"
              />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
