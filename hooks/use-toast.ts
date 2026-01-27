import { useState, useCallback } from "react"

interface ToastProps {
  title: string
  description?: string
  variant?: "default" | "destructive"
}

export function useToast() {
  const toast = useCallback(({ title, description, variant }: ToastProps) => {
    console.log(`[Toast] ${variant === "destructive" ? "❌" : "ℹ️"} ${title}: ${description}`)
    // For now, we just log to console. 
    // In a real app, this would trigger a global toast state.
  }, [])

  return {
    toast,
  }
}
