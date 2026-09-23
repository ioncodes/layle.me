import { useEffect, useRef, useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface Props {
  src: string;
  alt: string;
  label: string;
  width: number;
  height: number;
}

export default function ImagePreview({ src, alt, label, width, height }: Props) {
  const [open, setOpen] = useState(false);
  const link = useRef<HTMLAnchorElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const restoringFocus = useRef(false);

  function cancelClose() {
    clearTimeout(timer.current);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function leave() {
    cancelClose();
    timer.current = setTimeout(() => {
      if (document.activeElement !== link.current && !content.current?.contains(document.activeElement)) {
        setOpen(false);
      }
    }, 180);
  }

  function returnFocus() {
    restoringFocus.current = true;
    link.current?.focus({ preventScroll: true });
    restoringFocus.current = false;
  }

  function blur(event: React.FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (next !== link.current && !content.current?.contains(next)) setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <a
          ref={link}
          href={src}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="underline decoration-dashed underline-offset-4"
          onPointerEnter={(event) => {
            if (event.pointerType === "touch") return;
            cancelClose();
            setOpen(true);
          }}
          onPointerLeave={leave}
          onFocus={() => { if (!restoringFocus.current) setOpen(true); }}
          onBlur={blur}
          onKeyDown={(event) => {
            if (open && event.key === "Tab" && !event.shiftKey) {
              event.preventDefault();
              content.current?.querySelector<HTMLAnchorElement>("a")?.focus();
            }
          }}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            cancelClose();
            setOpen(true);
          }}
        >
          {label}
        </a>
      </PopoverTrigger>
      <PopoverContent
        ref={content}
        aria-label={label}
        side="top"
        sideOffset={8}
        collisionPadding={12}
        className="w-[min(26rem,calc(100vw-24px))] p-2"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={returnFocus}
        onInteractOutside={(event) => {
          if (event.target === link.current) event.preventDefault();
        }}
        onPointerEnter={cancelClose}
        onPointerLeave={leave}
        onBlur={blur}
        onKeyDown={(event) => {
          if (event.key === "Tab" && event.shiftKey && event.target === content.current?.querySelector("a")) {
            event.preventDefault();
            returnFocus();
          }
        }}
      >
        <a href={src} target="_blank" rel="noreferrer" aria-label="Open full-size photo">
          <img src={src} alt={alt} width={width} height={height} className="m-0 max-h-[min(65dvh,calc(var(--radix-popover-content-available-height)-4rem))] w-full rounded-sm object-contain" />
        </a>
        <div className="mt-2 flex items-center justify-between gap-4 text-sm">
          <a href={src} target="_blank" rel="noreferrer" className="underline underline-offset-4">Open full size</a>
          <button type="button" className="cursor-pointer rounded px-2 py-1 hover:bg-muted" onClick={() => { returnFocus(); setOpen(false); }}>Close</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
