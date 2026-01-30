import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import DashboardStats from '@/components/dashboard/DashboardStats';
import CapacityIndicator from '@/components/ui/CapacityIndicator';
import { Button } from '@/components/ui/button';
import { 
  Archive, 
  Box, 
  Plus, 
  ArrowRight,
  Clock,
  AlertTriangle,
  QrCode
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RecentArchive {
  id: string;
  patient_full_name: string;
  admission_id: string;
  archive_number: number | null;
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
      // Fetch boxes
      const { data: boxes } = await supabase
        .from('archive_boxes')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      const almostFull = boxes?.filter(b => b.current_count >= b.max_capacity * 0.8 && b.current_count < b.max_capacity) || [];

      setRecentBoxes(boxes?.slice(0, 5) || []);
      setAlmostFullBoxes(almostFull.slice(0, 3));

      // Fetch recent archives with related data
      const { data: archives } = await supabase
        .from('archives')
        .select(`
          id,
          patient_full_name,
          admission_id,
          archive_number,
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
          creator: { full_name: profileMap.get(a.created_by) || 'Inconnu' }
        }));
        setRecentArchives(archivesWithCreators as any);
      } else {
        setRecentArchives([]);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
              {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'Utilisateur'}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Voici ce qui se passe avec vos archives médicales aujourd'hui.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/scan')} className="gap-2">
              <QrCode className="w-4 h-4" />
              Scanner
            </Button>
            <Button onClick={() => navigate('/archives/new')} className="gap-2">
              <Plus className="w-4 h-4" />
              Nouvelle Archive
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <DashboardStats />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Archives */}
          <div className="lg:col-span-2 card-stats">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Archives récentes</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/archives')}
                className="gap-1 text-primary"
              >
                Voir tout <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            
            {recentArchives.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucune archive. Créez votre première archive!</p>
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
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground truncate">
                          {archive.patient_full_name}
                        </p>
                        {archive.archive_number && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            #{archive.archive_number}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        ID: {archive.admission_id} • Box: {archive.box?.name || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(archive.created_at), 'dd MMM, HH:mm', { locale: fr })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        par {archive.creator?.full_name || 'Inconnu'}
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
                  <h3 className="font-semibold text-foreground">Presque pleines</h3>
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
                <h3 className="font-semibold text-foreground">Boxes récentes</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/boxes')}
                  className="gap-1 text-primary text-xs"
                >
                  Voir tout <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
              
              {recentBoxes.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Aucune box créée.
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
                          {box.current_count >= box.max_capacity ? 'Pleine' : 'Disponible'}
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
