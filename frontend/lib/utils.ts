import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string, fmt = "MMM d, yyyy") {
  return format(new Date(iso), fmt);
}

export function formatRelativeTime(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function formatFileSize(kb: number) {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function truncate(str: string, len: number) {
  if (str.length <= len) return str;
  return str.slice(0, len) + "…";
}

export function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}
