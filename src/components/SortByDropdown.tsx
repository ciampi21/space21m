import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowDownUp } from "lucide-react"
import { useTranslation } from "react-i18next"

interface SortByDropdownProps {
  value: string
  onChange: (value: string) => void
}

export function SortByDropdown({ value, onChange }: SortByDropdownProps) {
  const { t } = useTranslation()

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px] h-9">
        <div className="flex items-center gap-2">
          <ArrowDownUp className="h-4 w-4" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="newest">{t('workspace.sortByNewest')}</SelectItem>
        <SelectItem value="oldest">{t('workspace.sortByOldest')}</SelectItem>
        <SelectItem value="scheduled">{t('workspace.sortByScheduled')}</SelectItem>
        <SelectItem value="created">{t('workspace.sortByCreated')}</SelectItem>
      </SelectContent>
    </Select>
  )
}
