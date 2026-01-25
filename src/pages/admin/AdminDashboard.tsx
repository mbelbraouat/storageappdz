import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import StatsCard from '@/components/ui/StatsCard';
import { 
  Shield, 
  Users, 
  Stethoscope, 
  FileText, 
  FolderOpen,
  Activity,
  TrendingUp,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';

interface AdminStats {
  totalUsers: number;
  adminUsers: number;
  totalDoctors: number;
  totalOperations: number;
  totalFileTypes: number;
}

interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  details: any;
  created_at: string;
  user: { full_name: string } | null;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    adminUsers: 0,
    totalDoctors: 0,
    totalOperations: 0,
    totalFileTypes: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [usersRes, adminsRes, doctorsRes, operationsRes, fileTypesRes, activityRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
        supabase.from('doctors').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('operation_actes').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('file_types').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('activity_log')
          .select(`
            id,
            action,
            entity_type,
            details,
            created_at,
            user:profiles!activity_log_user_id_fkey(full_name)
          `)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      setStats({
        totalUsers: usersRes.count || 0,
        adminUsers: adminsRes.count || 0,
        totalDoctors: doctorsRes.count || 0,
        totalOperations: operationsRes.count || 0,
        totalFileTypes: fileTypesRes.count || 0,
      });

      setRecentActivity(activityRes.data as any || []);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create': return <TrendingUp className="w-4 h-4 text-success" />;
      case 'update': return <Activity className="w-4 h-4 text-info" />;
      case 'delete': return <Activity className="w-4 h-4 text-destructive" />;
      default: return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <AppLayout requireAdmin>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Shield className="w-7 h-7 text-primary" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            System overview and management controls
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatsCard
            title="Total Users"
            value={stats.totalUsers}
            icon={Users}
            variant="primary"
          />
          <StatsCard
            title="Administrators"
            value={stats.adminUsers}
            icon={Shield}
          />
          <StatsCard
            title="Doctors"
            value={stats.totalDoctors}
            icon={Stethoscope}
          />
          <StatsCard
            title="Operations"
            value={stats.totalOperations}
            icon={FileText}
          />
          <StatsCard
            title="File Types"
            value={stats.totalFileTypes}
            icon={FolderOpen}
          />
        </div>

        {/* Recent Activity */}
        <div className="card-stats">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Recent Activity
          </h2>
          
          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Loading...</p>
          ) : recentActivity.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div 
                  key={activity.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-accent/30"
                >
                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center">
                    {getActionIcon(activity.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{activity.user?.full_name || 'System'}</span>
                      {' '}
                      <span className="text-muted-foreground">
                        {activity.action}d a {activity.entity_type}
                      </span>
                      {activity.details?.patient_name && (
                        <span className="font-medium"> - {activity.details.patient_name}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {format(new Date(activity.created_at), 'MMM d, HH:mm')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <a href="/admin/users" className="card-stats hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Users & Roles</h3>
                <p className="text-sm text-muted-foreground">Manage user accounts and permissions</p>
              </div>
            </div>
          </a>
          
          <a href="/admin/doctors" className="card-stats hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-success" />
              </div>
              <div>
                <h3 className="font-semibold">Doctors</h3>
                <p className="text-sm text-muted-foreground">Manage doctor records</p>
              </div>
            </div>
          </a>
          
          <a href="/admin/operations" className="card-stats hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-info" />
              </div>
              <div>
                <h3 className="font-semibold">Operations</h3>
                <p className="text-sm text-muted-foreground">Manage operation types</p>
              </div>
            </div>
          </a>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
