import { Bold, Italic, List, ListOrdered, CheckSquare, Code, Table, Minus, Hash, Link } from 'lucide-react';

interface EditorContextMenuProps {
  position: { x: number; y: number };
  onClose: () => void;
  onAction: (action: string) => void;
}

function EditorContextMenu({ position, onClose, onAction }: EditorContextMenuProps) {
  const menuItems = [
    { icon: Bold, label: 'Kalın (Bold)', action: 'bold' },
    { icon: Italic, label: 'İtalik', action: 'italic' },
    { divider: true },
    { icon: Hash, label: 'Başlık Ekle', action: 'heading' },
    { icon: Link, label: 'Bağlantı Ekle', action: 'link' },
    { divider: true },
    { icon: CheckSquare, label: 'Checkbox Listesi', action: 'checklist' },
    { icon: List, label: 'Madde İşaretli Liste', action: 'bulletlist' },
    { icon: ListOrdered, label: 'Numaralı Liste', action: 'numberedlist' },
    { divider: true },
    { icon: Table, label: 'Tablo Ekle', action: 'table' },
    { icon: Code, label: 'Kod Bloğu', action: 'codeblock' },
    { icon: Minus, label: 'Yatay Çizgi', action: 'horizontalrule' }
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-obsidian-bg-secondary border border-obsidian-border rounded-md shadow-lg py-1 min-w-[200px]"
        style={{ left: position.x, top: position.y }}
      >
        {menuItems.map((item, index) => {
          if (item.divider) {
            return <div key={index} className="border-t border-obsidian-border my-1" />;
          }
          
          const Icon = item.icon!;
          return (
            <button
              key={item.action}
              className="flex items-center px-3 py-1.5 hover:bg-obsidian-bg-tertiary w-full text-left text-sm"
              onClick={() => {
                onAction(item.action!);
                onClose();
              }}
            >
              <Icon size={14} className="mr-2" />
              {item.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

export default EditorContextMenu;