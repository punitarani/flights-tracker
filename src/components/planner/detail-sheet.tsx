"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface DetailSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * Detail sheet component
 * Slides in from left (desktop) or top (mobile) to show additional details
 */
export function DetailSheet({
  open,
  onClose,
  title,
  children,
}: DetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="left" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle>{title}</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>
        <div className="space-y-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
