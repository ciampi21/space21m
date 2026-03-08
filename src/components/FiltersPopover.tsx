import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Filter, X } from "lucide-react"
import { POST_STATUSES, POST_TYPES, PLATFORMS, PostStatus, PostType, PlatformType } from "@/types"
import { useTranslation } from "react-i18next"

interface FiltersPopoverProps {
  filters: {
    status?: PostStatus[]
    type?: PostType[]
    platform?: PlatformType[]
  }
  onFiltersChange: (filters: any) => void
}

export function FiltersPopover({ filters, onFiltersChange }: FiltersPopoverProps) {
  const { t } = useTranslation()
  
  // Count active filters
  const activeFiltersCount = [
    filters.status?.length,
    filters.type?.length,
    filters.platform?.length
  ].filter(Boolean).length

  const handleStatusChange = (value: string) => {
    onFiltersChange({
      ...filters,
      status: value === 'all' ? undefined : [value as PostStatus]
    })
  }

  const handleTypeChange = (value: string) => {
    onFiltersChange({
      ...filters,
      type: value === 'all' ? undefined : [value as PostType]
    })
  }

  const handlePlatformChange = (value: string) => {
    onFiltersChange({
      ...filters,
      platform: value === 'all' ? undefined : [value as PlatformType]
    })
  }

  const clearAllFilters = () => {
    onFiltersChange({})
  }

  const removeStatusFilter = () => {
    const newFilters = { ...filters }
    delete newFilters.status
    onFiltersChange(newFilters)
  }

  const removeTypeFilter = () => {
    const newFilters = { ...filters }
    delete newFilters.type
    onFiltersChange(newFilters)
  }

  const removePlatformFilter = () => {
    const newFilters = { ...filters }
    delete newFilters.platform
    onFiltersChange(newFilters)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <Filter className="h-4 w-4" />
            <span>{t('workspace.filters')}</span>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1.5 flex items-center justify-center text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">{t('workspace.filters')}</h4>
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-7 text-xs"
                >
                  {t('workspace.clearAll')}
                </Button>
              )}
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                {t('workspace.status')}
              </label>
              <Select
                value={filters.status?.[0] || 'all'}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('workspace.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('workspace.all')}</SelectItem>
                  {Object.entries(POST_STATUSES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                {t('workspace.type')}
              </label>
              <Select
                value={filters.type?.[0] || 'all'}
                onValueChange={handleTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('workspace.type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('workspace.all')}</SelectItem>
                  {Object.entries(POST_TYPES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Platform Filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                {t('workspace.platform')}
              </label>
              <Select
                value={filters.platform?.[0] || 'all'}
                onValueChange={handlePlatformChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('workspace.platform')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('workspace.all')}</SelectItem>
                  {Object.entries(PLATFORMS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filters Chips */}
      {filters.status && (
        <Badge variant="secondary" className="gap-1 h-9 px-3">
          <span className="text-xs">{t('workspace.status')}: {POST_STATUSES[filters.status[0]]?.label}</span>
          <button
            onClick={removeStatusFilter}
            className="ml-1 hover:bg-muted rounded-full p-0.5 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {filters.type && (
        <Badge variant="secondary" className="gap-1 h-9 px-3">
          <span className="text-xs">{t('workspace.type')}: {POST_TYPES[filters.type[0]]?.label}</span>
          <button
            onClick={removeTypeFilter}
            className="ml-1 hover:bg-muted rounded-full p-0.5 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {filters.platform && (
        <Badge variant="secondary" className="gap-1 h-9 px-3">
          <span className="text-xs">{t('workspace.platform')}: {PLATFORMS[filters.platform[0]]?.label}</span>
          <button
            onClick={removePlatformFilter}
            className="ml-1 hover:bg-muted rounded-full p-0.5 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
    </div>
  )
}
