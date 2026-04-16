import { Avatar, AvatarFallback, AvatarBadge } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-primary text-primary-foreground",
  manager: "bg-info text-info-foreground",
  account_executive: "bg-warning text-warning-foreground",
  recruiter: "bg-secondary text-secondary-foreground",
};

interface UserAvatarProps {
  firstName: string;
  lastName: string;
  role: string;
  isActive?: boolean;
  size?: "sm" | "default" | "lg" | "xl";
  className?: string;
}

export function UserAvatar({
  firstName,
  lastName,
  role,
  isActive = true,
  size = "default",
  className,
}: UserAvatarProps) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const colorClass = ROLE_COLORS[role] ?? ROLE_COLORS.recruiter;

  const sizeClass = size === "xl" ? "size-16 text-xl" : "";

  return (
    <Avatar
      size={size === "xl" ? "lg" : size}
      className={cn(sizeClass, className)}
    >
      <AvatarFallback className={cn(colorClass, size === "xl" && "text-xl")}>
        {initials}
      </AvatarFallback>
      {!isActive && (
        <AvatarBadge className="bg-muted-foreground" />
      )}
    </Avatar>
  );
}
