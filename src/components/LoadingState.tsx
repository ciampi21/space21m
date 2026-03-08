import { EnhancedSkeleton } from "@/components/ui/enhanced-skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface LoadingStateProps {
  type?: "dashboard" | "posts" | "profile" | "workspace"
}

export function LoadingState({ type = "dashboard" }: LoadingStateProps) {
  if (type === "dashboard") {
    return (
      <div className="space-y-6 fade-in-up">
        {/* Stats Cards Loading */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="elegant-card">
              <CardHeader className="space-y-3">
                <EnhancedSkeleton variant="text" className="w-20" />
                <EnhancedSkeleton variant="text" className="w-16 h-8" />
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Content Loading */}
        <div className="space-y-4">
          <EnhancedSkeleton variant="text" className="w-48 h-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="elegant-card">
                <CardContent className="p-6 space-y-4">
                  <EnhancedSkeleton variant="text" className="w-full h-32" />
                  <EnhancedSkeleton variant="text" className="w-3/4" />
                  <EnhancedSkeleton variant="text" className="w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (type === "posts") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 fade-in-up">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="elegant-card">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center space-x-3">
                <EnhancedSkeleton variant="avatar" className="w-8 h-8" />
                <EnhancedSkeleton variant="text" className="w-24" />
              </div>
              <EnhancedSkeleton variant="text" className="w-full h-32" />
              <div className="space-y-2">
                <EnhancedSkeleton variant="text" className="w-full" />
                <EnhancedSkeleton variant="text" className="w-3/4" />
              </div>
              <div className="flex justify-between items-center">
                <EnhancedSkeleton variant="button" className="w-20" />
                <EnhancedSkeleton variant="text" className="w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 fade-in-up">
      <EnhancedSkeleton variant="text" className="w-48 h-8" />
      <EnhancedSkeleton variant="card" className="w-full h-96" />
    </div>
  )
}