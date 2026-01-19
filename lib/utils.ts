import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function adjustAlpha(color: string, newAlpha: number): string {
  if (!color || color === 'transparent') return color;

  // Handle hex
  if (color.startsWith('#')) {
    let r, g, b;
    if (color.length === 4) {
      r = parseInt(color[1] + color[1], 16);
      g = parseInt(color[2] + color[2], 16);
      b = parseInt(color[3] + color[3], 16);
    } else if (color.length === 7 || color.length === 9) {
      r = parseInt(color.substring(1, 3), 16);
      g = parseInt(color.substring(3, 5), 16);
      b = parseInt(color.substring(5, 7), 16);
    } else {
      return color; // Unrecognized hex format
    }
    return `rgba(${r}, ${g}, ${b}, ${newAlpha})`;
  }

  // Handle rgba/hsla
  if (color.includes('rgba') || color.includes('hsla')) {
    return color.replace(/[\d.]+\)$/g, `${newAlpha})`);
  }

  // Handle rgb/hsl
  if (color.startsWith('rgb(')) {
    return color.replace('rgb', 'rgba').replace(')', `, ${newAlpha})`);
  }
  if (color.startsWith('hsl(')) {
    return color.replace('hsl', 'hsla').replace(')', `, ${newAlpha})`);
  }

  return color;
}
