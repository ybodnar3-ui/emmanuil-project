import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Up to two uppercase initials from a full name (fallback "?"). */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function PersonAvatar({
  fullName,
  photoUrl,
  className,
}: {
  fullName: string;
  photoUrl?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-10", className)}>
      {photoUrl ? <AvatarImage src={photoUrl} alt={fullName} /> : null}
      <AvatarFallback>{initials(fullName)}</AvatarFallback>
    </Avatar>
  );
}
