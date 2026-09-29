"use client"

import * as React from "react"
import Link from "next/link"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import { toast } from "sonner"
import { z } from "zod"

import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  GripVerticalIcon,
  EllipsisVerticalIcon,
  Columns3Icon,
  ChevronDownIcon,
  ChevronsLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
  ExternalLinkIcon,
} from "lucide-react"

export const recentLeadSchema = z.object({
  id: z.number(),
  reference: z.string(),
  buyerName: z.string(),
  company: z.string().nullable(),
  catalogueName: z.string(),
  totalQuantity: z.number(),
  status: z.string(),
  createdAt: z.string(),
})

export type RecentLeadRow = z.infer<typeof recentLeadSchema>

const statusStyles: Record<string, string> = {
  new: "border-amber-200 bg-amber-50 text-amber-700",
  contacted: "border-blue-200 bg-blue-50 text-blue-700",
  qualified: "border-violet-200 bg-violet-50 text-violet-700",
  won: "border-emerald-200 bg-emerald-50 text-emerald-700",
  lost: "border-slate-200 bg-slate-50 text-slate-600",
  spam: "border-red-200 bg-red-50 text-red-700",
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function DragHandle({ id }: { id: number }) {
  const { attributes, listeners } = useSortable({
    id,
  })
  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:bg-transparent"
    >
      <GripVerticalIcon className="size-3 text-muted-foreground" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

const columns: ColumnDef<RecentLeadRow>[] = [
  {
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  },
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "reference",
    header: "Reference",
    cell: ({ row }) => <LeadCellViewer lead={row.original} />,
    enableHiding: false,
  },
  {
    accessorKey: "buyerName",
    header: "Buyer",
    cell: ({ row }) => (
      <div className="min-w-32">
        <p className="font-medium">{row.original.buyerName}</p>
        {row.original.company && (
          <p className="text-xs text-muted-foreground">{row.original.company}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "catalogueName",
    header: "Catalogue",
    cell: ({ row }) => (
      <Badge variant="outline" className="max-w-48 px-1.5 text-muted-foreground">
        <span className="truncate">{row.original.catalogueName}</span>
      </Badge>
    ),
  },
  {
    accessorKey: "totalQuantity",
    header: () => <div className="w-full text-right">Units</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {row.original.totalQuantity.toLocaleString("en-IN")}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={statusStyles[row.original.status] ?? "px-1.5 text-muted-foreground"}
      >
        {formatStatus(row.original.status)}
      </Badge>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Received",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="flex size-8 text-muted-foreground data-open:bg-muted"
              size="icon"
            />
          }
        >
          <EllipsisVerticalIcon />
          <span className="sr-only">Open menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            render={<Link href={`/admin/leads/${row.original.reference}`} />}
          >
            Open lead
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              navigator.clipboard.writeText(row.original.reference)
              toast.success("Reference copied")
            }}
          >
            Copy reference
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

function DraggableRow({ row }: { row: Row<RecentLeadRow> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })
  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

export function DataTable({ data: initialData }: { data: RecentLeadRow[] }) {
  const [data, setData] = React.useState(() => initialData)
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )
  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  )
  // TanStack Table's API is not React Compiler compatible; this component
  // simply opts out of auto-memoization.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }

  return (
    <div className="flex w-full flex-col justify-start gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Recent leads</h2>
          <p className="text-sm text-muted-foreground">
            The latest buyer enquiries across all catalogues.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" />}
            >
              <Columns3Icon data-icon="inline-start" />
              <span className="hidden lg:inline">Columns</span>
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link
            href="/admin/leads"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            View all
          </Link>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <DndContext
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
          sensors={sensors}
          id={sortableId}
        >
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="**:data-[slot=table-cell]:first:w-8">
              {table.getRowModel().rows?.length ? (
                <SortableContext
                  items={dataIds}
                  strategy={verticalListSortingStrategy}
                >
                  {table.getRowModel().rows.map((row) => (
                    <DraggableRow key={row.id} row={row} />
                  ))}
                </SortableContext>
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No leads yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">
              Rows per page
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value))
              }}
              items={[10, 20].map((pageSize) => ({
                label: `${pageSize}`,
                value: `${pageSize}`,
              }))}
            >
              <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                <SelectValue
                  placeholder={table.getState().pagination.pageSize}
                />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {[10, 20].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeftIcon />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRightIcon />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 lg:flex"
              size="icon"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRightIcon />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function LeadCellViewer({ lead }: { lead: RecentLeadRow }) {
  const isMobile = useIsMobile()
  return (
    <Drawer swipeDirection={isMobile ? "down" : "right"}>
      <DrawerTrigger
        render={
          <Button
            variant="link"
            className="w-fit px-0 text-left font-medium text-foreground"
          />
        }
      >
        {lead.reference}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{lead.reference}</DrawerTitle>
          <DrawerDescription>
            Enquiry from {lead.buyerName} for {lead.catalogueName}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={statusStyles[lead.status] ?? "text-muted-foreground"}
            >
              {formatStatus(lead.status)}
            </Badge>
            <span className="text-muted-foreground">{formatDate(lead.createdAt)}</span>
          </div>
          <Separator />
          <dl className="grid gap-3">
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <dt className="text-muted-foreground">Buyer</dt>
              <dd className="font-medium">{lead.buyerName}</dd>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <dt className="text-muted-foreground">Company</dt>
              <dd className="font-medium">{lead.company || "Not provided"}</dd>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <dt className="text-muted-foreground">Catalogue</dt>
              <dd className="font-medium">{lead.catalogueName}</dd>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <dt className="text-muted-foreground">Units requested</dt>
              <dd className="font-medium tabular-nums">
                {lead.totalQuantity.toLocaleString("en-IN")}
              </dd>
            </div>
          </dl>
        </div>
        <DrawerFooter>
          <Link
            href={`/admin/leads/${lead.reference}`}
            className={buttonVariants()}
          >
            <ExternalLinkIcon data-icon="inline-start" /> Open lead
          </Link>
          <DrawerClose render={<Button variant="outline" />}>Close</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
