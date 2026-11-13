import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
interface AppSheetProps {
  open: boolean; title: string; description: string; children: ReactNode;
  footer?: ReactNode; busy?: boolean; onClose(): void;
}
export default function AppSheet({ open, title, description, children, footer, busy = false, onClose }: AppSheetProps) {
  return <Drawer open={open} onOpenChange={value => { if (!value && !busy) onClose(); }} dismissible={!busy} shouldScaleBackground={false} repositionInputs>
    <DrawerContent className="app-sheet">
      <header className="sheet-heading"><div><DrawerTitle className="sheet-title">{title}</DrawerTitle><DrawerDescription className="sheet-description">{description}</DrawerDescription></div><button type="button" className="circle-button" aria-label="关闭" onClick={onClose} disabled={busy}><X size={20}/></button></header>
      <div className="sheet-scroll" data-vaul-no-drag>{children}</div>
      {footer && <footer className="sheet-action">{footer}</footer>}
    </DrawerContent>
  </Drawer>;
}
