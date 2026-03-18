import { PlusCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface SidebarProps {
  onNavigate: (view: string) => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const location = useLocation();
  const menuItems = [
    { id: 'new', label: 'New Request', icon: PlusCircle, path: '/new' },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-[#0072BC]">Permit Manager</h1>
        <p className="text-xs text-gray-500 mt-1">Ontivity Solutions</p>
      </div>

      <nav className="flex-1 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                isActive
                  ? 'bg-[#0072BC] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
