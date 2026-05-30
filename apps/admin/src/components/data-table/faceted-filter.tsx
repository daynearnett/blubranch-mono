import { useState } from "react";
import type { Column } from "@tanstack/react-table";
import { Check, ListFilter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

interface DataTableFacetedFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  options?: { label: string; value: string }[];
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options: providedOptions,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const [search, setSearch] = useState("");
  const facets = column.getFacetedUniqueValues();
  const selectedValues = new Set(
    (column.getFilterValue() as string[]) ?? []
  );

  const options =
    providedOptions ??
    Array.from(facets.keys())
      .filter((v) => v != null && v !== "")
      .map((value) => ({ label: String(value), value: String(value) }))
      .sort((a, b) => a.label.localeCompare(b.label));

  const filtered = search
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const toggle = (value: string) => {
    const next = new Set(selectedValues);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    const arr = Array.from(next);
    column.setFilterValue(arr.length ? arr : undefined);
  };

  const clear = () => {
    column.setFilterValue(undefined);
    setSearch("");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <ListFilter className="mr-2 h-3.5 w-3.5" />
          {title}
          {selectedValues.size > 0 && (
            <Badge
              variant="secondary"
              className="ml-2 rounded-sm px-1 font-normal"
            >
              {selectedValues.size}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 p-0">
        <div className="p-2">
          <Input
            placeholder={`Search ${title.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-64 overflow-y-auto px-1 pb-1">
          {filtered.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No results
            </div>
          ) : (
            filtered.map((option) => {
              const isSelected = selectedValues.has(option.value);
              const count = facets.get(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => toggle(option.value)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <span className="truncate">{option.label}</span>
                  {count != null && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {count}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
        {selectedValues.size > 0 && (
          <div className="border-t p-1">
            <button
              onClick={clear}
              className="flex w-full items-center justify-center gap-1 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
