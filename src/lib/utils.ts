
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts a color name to its corresponding Tailwind CSS class name.
 * @param color The color name to convert
 * @returns The corresponding Tailwind CSS class name or an empty string if no match is found
 */
export function colorToClassName(color: string | null | undefined): string {
  if (!color) return "";
  
  const colorMap: Record<string, string> = {
    // Primary colors
    "red": "bg-red-100 text-red-800 border-red-200",
    "blue": "bg-blue-100 text-blue-800 border-blue-200",
    "green": "bg-green-100 text-green-800 border-green-200",
    "yellow": "bg-yellow-100 text-yellow-800 border-yellow-200",
    "purple": "bg-purple-100 text-purple-800 border-purple-200",
    "pink": "bg-pink-100 text-pink-800 border-pink-200",
    "indigo": "bg-indigo-100 text-indigo-800 border-indigo-200",
    "orange": "bg-orange-100 text-orange-800 border-orange-200",
    "teal": "bg-teal-100 text-teal-800 border-teal-200",
    "cyan": "bg-cyan-100 text-cyan-800 border-cyan-200",
    "lime": "bg-lime-100 text-lime-800 border-lime-200",
    "emerald": "bg-emerald-100 text-emerald-800 border-emerald-200",
    "amber": "bg-amber-100 text-amber-800 border-amber-200",
    "fuchsia": "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
    "sky": "bg-sky-100 text-sky-800 border-sky-200",
    "violet": "bg-violet-100 text-violet-800 border-violet-200",
    "rose": "bg-rose-100 text-rose-800 border-rose-200",
    "gray": "bg-gray-100 text-gray-800 border-gray-200",
    
    // Add more colors as needed
  };
  
  const normalizedColor = color.toLowerCase().trim();
  
  return colorMap[normalizedColor] || "";
}
