
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function colorToClassName(color: string | undefined): string | undefined {
  if (!color) return undefined;
  
  const colorMap: Record<string, string> = {
    red: "bg-red-100 border-red-500 text-red-700",
    blue: "bg-blue-100 border-blue-500 text-blue-700",
    green: "bg-green-100 border-green-500 text-green-700",
    yellow: "bg-yellow-100 border-yellow-500 text-yellow-700",
    purple: "bg-purple-100 border-purple-500 text-purple-700",
    pink: "bg-pink-100 border-pink-500 text-pink-700",
    indigo: "bg-indigo-100 border-indigo-500 text-indigo-700",
    orange: "bg-orange-100 border-orange-500 text-orange-700",
    gray: "bg-gray-100 border-gray-500 text-gray-700",
    teal: "bg-teal-100 border-teal-500 text-teal-700",
  };

  return colorMap[color.toLowerCase()];
}
