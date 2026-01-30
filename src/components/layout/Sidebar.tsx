import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Archive, 
  Box, 
  Plus, 
  Users, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  FileText,
  FolderOpen,
  Shield,
  Bell,
  QrCode
} from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { isAdmin, profile, signOut } = useAuth();
  const location = useLocation();

  const mainNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Plus, label: 'New Archive', path: '/archives/new' },
    { icon: Archive, label: 'Archives List', path: '/archives' },
    { icon: Box, label: 'Boxes', path: '/boxes' },
    { icon: QrCode, label: 'Scanner QR', path: '/scan' },
  ];

  const adminNavItems = [
    { icon: Shield, label: 'Admin Dashboard', path: '/admin' },
    { icon: Users, label: 'Users & Roles', path: '/admin/users' },
    { icon: Stethoscope, label: 'Doctors', path: '/admin/doctors' },
    { icon: FileText, label: 'Operations', path: '/admin/operations' },
    { icon: FolderOpen, label: 'File Types', path: '/admin/file-types' },
    { icon: Settings, label: 'System Settings', path: '/admin/settings' },
    { icon: Bell, label: 'Notifications', path: '/admin/notifications' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside 
      className={cn(
        "h-screen flex flex-col transition-all duration-300 ease-in-out",
        "bg-sidebar border-r border-sidebar-border",
        collapsed ? "w-20" : "w-64"
      )}
      style={{ background: 'var(--gradient-sidebar)' }}
    >
      {/* Logo Area */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Archive className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-sidebar-foreground">MedicStore</span>
          </div>
        )}
        {collapsed && (
          <div className="w-full flex justify-center">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Archive className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* User Profile */}
      <div className={cn(
        "p-4 border-b border-sidebar-border",
        collapsed && "flex justify-center"
      )}>
        <div className={cn(
          "flex items-center gap-3",
          collapsed && "flex-col"
        )}>
          <div className="w-10 h-10 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary font-semibold">
            {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {isAdmin ? 'Administrator' : 'User'}
              </p>
            </div>
          )}
          <NotificationBell />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {/* Main Navigation */}
        <div className="mb-4">
          {!collapsed && (
            <p className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
              Main Menu
            </p>
          )}
          {mainNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "sidebar-nav-item",
                isActive(item.path) && "active",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </div>

        {/* Admin Navigation */}
        {isAdmin && (
          <div className="pt-4 border-t border-sidebar-border">
            {!collapsed && (
              <p className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                Administration
              </p>
            )}
            {adminNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "sidebar-nav-item",
                  isActive(item.path) && "active",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={signOut}
          className={cn(
            "sidebar-nav-item w-full text-destructive/80 hover:text-destructive hover:bg-destructive/10",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        
        {!collapsed && (
          <div className="mt-4 text-center">
            <p className="text-xs text-sidebar-foreground/40">
              MedicStore Dev By Belbra_Med
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
