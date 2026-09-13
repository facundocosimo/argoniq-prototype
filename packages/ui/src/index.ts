/**
 * Shared components, patterns, and brand assets. Import the common stylesheet
 * from `@argoniq/ui/styles.css`; tenant variations use design tokens.
 */

// ── lib ──────────────────────────────────────────────────────────────────────
export { cn } from './lib/cn.js';

// ── brand ────────────────────────────────────────────────────────────────────
// Shared ArgonIQ logomark and wordmark.
export { Logo, LogoMark, type LogoProps, type LogoMarkProps } from './brand/logo.js';

// ── primitives ───────────────────────────────────────────────────────────────
export { Button, buttonVariants, type ButtonProps } from './primitives/button.js';
export { IconButton, iconButtonVariants, type IconButtonProps } from './primitives/icon-button.js';
export { Kbd } from './primitives/kbd.js';
export { Avatar, type AvatarProps } from './primitives/avatar.js';
export { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from './primitives/tooltip.js';
export { Input, type InputProps } from './primitives/input.js';
export { Textarea, type TextareaProps } from './primitives/textarea.js';
export { Select, type SelectProps } from './primitives/select.js';
export { Combobox, type ComboboxProps, type ComboboxOption } from './primitives/combobox.js';
export { Label, type LabelProps } from './primitives/label.js';
export {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  type CardProps,
} from './primitives/card.js';
export { Heading, Text, type HeadingProps, type TextProps } from './primitives/typography.js';
export { Stack, Inline, type StackProps, type InlineProps } from './primitives/layout.js';
export { StatusDot, type StatusDotProps } from './primitives/status-dot.js';
export { Spinner, type SpinnerProps } from './primitives/spinner.js';
export {
  Skeleton,
  TableSkeleton,
  CardSkeleton,
  type SkeletonProps,
  type TableSkeletonProps,
  type CardSkeletonProps,
} from './primitives/skeleton.js';
export { EmptyState, type EmptyStateProps } from './primitives/empty-state.js';
export { ErrorState, type ErrorStateProps } from './primitives/error-state.js';
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  type DialogContentProps,
} from './primitives/dialog.js';
export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  useFormField,
  useZodForm,
} from './primitives/form.js';
export {
  TextField,
  TextareaField,
  SelectField,
  ComboboxField,
  SwitchField,
  FieldGrid,
  type SelectOption,
} from './patterns/form-fields.js';
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './primitives/dropdown.js';

// ── patterns ─────────────────────────────────────────────────────────────────
export {
  SafetyZoneIndicator,
  type SafetyZoneIndicatorProps,
} from './patterns/safety-zone-indicator.js';
export { ConfidenceText, type ConfidenceTextProps } from './patterns/confidence-text.js';
export { ConfidenceMeter, type ConfidenceMeterProps } from './patterns/confidence-meter.js';
export { SafetyZoneCallout, type SafetyZoneCalloutProps } from './patterns/safety-zone-callout.js';
export { DataTable, type DataTableProps, type DataTablePagination } from './patterns/data-table.js';
// Re-export the column type so feature code defines columns without importing the
// table engine directly (the app stays decoupled from @tanstack/react-table).
export type { ColumnDef } from './patterns/data-table.js';
export {
  CauseRankingList,
  type CauseRankingListProps,
  type RankedCauseView,
} from './patterns/cause-ranking.js';
export { AnswerView, type AnswerViewProps, type CitationView } from './patterns/answer-view.js';
export { Markdown } from './patterns/markdown.js';
export {
  CaseCard,
  type CaseCardProps,
  type CaseCardView,
  type CasePriority,
} from './patterns/case-card.js';
export { SymptomComposer, type SymptomComposerProps } from './patterns/symptom-composer.js';
export {
  AiDisclosure,
  AI_DISCLOSURE_STATEMENT,
  type AiDisclosureProps,
} from './patterns/ai-disclosure.js';
export {
  PageContainer,
  PageHeader,
  PageSection,
  type PageContainerProps,
  type PageHeaderProps,
  type PageSectionProps,
} from './patterns/page.js';
export * from './patterns/app-shell/index.js';
export * from './patterns/toast/index.js';
