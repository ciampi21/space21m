import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconBgColor: string;
  iconColor: string;
  status?: "active" | "soon" | "new";
  onClick: () => void;
}

const ToolCard = ({
  title,
  description,
  icon: Icon,
  iconBgColor,
  iconColor,
  status = "active",
  onClick,
}: ToolCardProps) => {
  const isDisabled = status === "soon";

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        "group relative flex flex-col items-center p-6 rounded-2xl border bg-card text-card-foreground transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-1",
        isDisabled 
          ? "opacity-60 cursor-not-allowed" 
          : "hover:border-primary/30 cursor-pointer"
      )}
    >
      {/* Status Badge */}
      {status === "soon" && (
        <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">
          Em Breve
        </span>
      )}
      {status === "new" && (
        <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
          Novo
        </span>
      )}

      {/* Icon Container */}
      <div
        className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300",
          !isDisabled && "group-hover:scale-110"
        )}
        style={{ backgroundColor: iconBgColor }}
      >
        <Icon className="w-8 h-8" style={{ color: iconColor }} />
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-foreground mb-1 text-center">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground text-center line-clamp-2">
        {description}
      </p>
    </button>
  );
};

export default ToolCard;
