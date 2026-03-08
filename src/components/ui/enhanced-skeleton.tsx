import { cn } from "@/lib/utils"

interface EnhancedSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "card" | "text" | "avatar" | "button"
}

function EnhancedSkeleton({
  className,
  variant = "default",
  ...props
}: EnhancedSkeletonProps) {
  const variantStyles = {
    default: "animate-pulse rounded-md bg-muted",
    card: "animate-pulse rounded-lg bg-gradient-to-br from-muted to-muted/50 p-4",
    text: "animate-pulse rounded bg-muted h-4",
    avatar: "animate-pulse rounded-full bg-muted",
    button: "animate-pulse rounded-md bg-muted h-10"
  }

  return (
    <div
      className={cn(variantStyles[variant], className)}
      {...props}
    />
  )
}

export { EnhancedSkeleton }