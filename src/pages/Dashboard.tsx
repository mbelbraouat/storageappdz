import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import StatsCard from '@/components/ui/StatsCard';
import CapacityIndicator from '@/components/ui/CapacityIndicator';
import { Button } from '@/components/ui/button';
import { 
  Archive, 
  Box, 
  Users, 
  Plus, 
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';

interface DashboardStats {
  totalArchives: number;
  totalBoxes: number;
  fullBoxes: number;
  freeBoxes: number;
}

interface RecentArchive {
  id: string;
  patient_full_name: string;
  admission_id: string;
  created_at: string;
  box: { name: string } | null;
  creator: { full_name: string } | null;
}

interface BoxInfo {
  id: string;
  name: string;
  current_count: number;
  max_capacity: number;
  shelf: string;
  column_position: string;
  side: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalArchives: 0,
    totalBoxes: 0,
    fullBoxes: 0,
    freeBoxes: 0,
  });
  const [recentArchives, setRecentArchives] = useState<RecentArchive[]>([]);
  const [recentBoxes, setRecentBoxes] = useState<BoxInfo[]>([]);
  const [almostFullBoxes, setAlmostFullBoxes] = useState<BoxInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'archives' },
        () => fetchDashboardData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch archives count
      const { count: archivesCount } = await supabase
        .from('archives')
        .select('*', { count: 'exact', head: true });

      // Fetch boxes
      const { data: boxes } = await supabase
        .from('archive_boxes')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      const fullBoxes = boxes?.filter(b => b.current_count >= b.max_capacity).length || 0;
      const freeBoxes = boxes?.filter(b => b.current_count < b.max_capacity).length || 0;
      const almostFull = boxes?.filter(b => b.current_count >= b.max_capacity * 0.8 && b.current_count < b.max_capacity) || [];

      setStats({
        totalArchives: archivesCount || 0,
        totalBoxes: boxes?.length || 0,
        fullBoxes,
        freeBoxes,
      });

      setRecentBoxes(boxes?.slice(0, 5) || []);
      setAlmostFullBoxes(almostFull.slice(0, 3));

      // Fetch recent archives with related data
      const { data: archives } = await supabase
        .from('archives')
        .select(`
          id,
          patient_full_name,
          admission_id,
          created_at,
          created_by,
          box:archive_boxes(name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch creator profiles separately
      if (archives && archives.length > 0) {
        const creatorIds = [...new Set(archives.map(a => a.created_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', creatorIds);
        
        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
        const archivesWithCreators = archives.map(a => ({
          ...a,
          creator: { full_name: profileMap.get(a.created_by) || 'Unknown' }
        }));
        setRecentArchives(archivesWithCreators as any);
      } else {
        setRecentArchives([]);
      }

      setRecentArchives(archives as any || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
              {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'User'}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your medical archives today.
            </p>
          </div>
          <Button onClick={() => navigate('/archives/new')} className="gap-2">
            <Plus className="w-4 h-4" />
            New Archive
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <StatsCard
            title="Total Archives"
            value={stats.totalArchives}
            icon={Archive}
            variant="primary"
          />
          <StatsCard
            title="Total Boxes"
            value={stats.totalBoxes}
            icon={Box}
          />
          <StatsCard
            title="Free Boxes"
            value={stats.freeBoxes}
            icon={CheckCircle2}
            variant="success"
          />
          <StatsCard
            title="Full Boxes"
            value={stats.fullBoxes}
            icon={AlertTriangle}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Archives */}
          <div className="lg:col-span-2 card-stats">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Recent Archives</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/archives')}
                className="gap-1 text-primary"
              >
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            
            {recentArchives.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No archives yet. Create your first archive!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentArchives.map((archive) => (
                  <div 
                    key={archive.id}
                    className="flex items-center gap-4 p-4 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/archives/${archive.id}`)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Archive className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {archive.patient_full_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ID: {archive.admission_id} • Box: {archive.box?.name || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(archive.created_at), 'MMM d, HH:mm')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        by {archive.creator?.full_name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Box Status */}
          <div className="space-y-6">
            {/* Almost Full Boxes Warning */}
            {almostFullBoxes.length > 0 && (
              <div className="card-stats border-l-4 border-l-warning">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  <h3 className="font-semibold text-foreground">Almost Full</h3>
                </div>
                <div className="space-y-3">
                  {almostFullBoxes.map((box) => (
                    <div key={box.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{box.name}</span>
                        <span className="text-muted-foreground">
                          {box.shelf}, {box.column_position}
                        </span>
                      </div>
                      <CapacityIndicator 
                        current={box.current_count} 
                        max={box.max_capacity} 
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Boxes */}
            <div className="card-stats">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Recent Boxes</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/boxes')}
                  className="gap-1 text-primary text-xs"
                >
                  View All <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
              
              {recentBoxes.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No boxes created yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentBoxes.slice(0, 4).map((box) => (
                    <div 
                      key={box.id}
                      className="p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => navigate('/boxes')}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{box.name}</span>
                        <span className={`status-badge ${
                          box.current_count >= box.max_capacity 
                            ? 'status-badge-danger' 
                            : 'status-badge-success'
                        }`}>
                          {box.current_count >= box.max_capacity ? 'Full' : 'Available'}
                        </span>
                      </div>
                      <CapacityIndicator 
                        current={box.current_count} 
                        max={box.max_capacity}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
