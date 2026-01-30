import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import StatsCard from '@/components/ui/StatsCard';
import { Archive, Box, CheckCircle2, AlertTriangle, Lock, Users } from 'lucide-react';

interface Stats {
  totalArchives: number;
  totalBoxes: number;
  fullBoxes: number;
  freeBoxes: number;
  sealedBoxes: number;
  archivesThisMonth: number;
}

const DashboardStats = () => {
  const [stats, setStats] = useState<Stats>({
    totalArchives: 0,
    totalBoxes: 0,
    fullBoxes: 0,
    freeBoxes: 0,
    sealedBoxes: 0,
    archivesThisMonth: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('stats-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'archives' },
        () => fetchStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'archive_boxes' },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch archives count
      const { count: archivesCount } = await supabase
        .from('archives')
        .select('*', { count: 'exact', head: true });

      // Fetch this month's archives
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { count: monthlyArchives } = await supabase
        .from('archives')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString());

      // Fetch boxes
      const { data: boxes } = await supabase
        .from('archive_boxes')
        .select('current_count, max_capacity, status')
        .eq('is_active', true);

      const fullBoxes = boxes?.filter(b => b.current_count >= b.max_capacity).length || 0;
      const freeBoxes = boxes?.filter(b => b.current_count < b.max_capacity && b.status !== 'sealed').length || 0;
      const sealedBoxes = boxes?.filter(b => b.status === 'sealed').length || 0;

      setStats({
        totalArchives: archivesCount || 0,
        totalBoxes: boxes?.length || 0,
        fullBoxes,
        freeBoxes,
        sealedBoxes,
        archivesThisMonth: monthlyArchives || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="card-stats animate-pulse">
            <div className="h-20 bg-muted/50 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <StatsCard
        title="Total Archives"
        value={stats.totalArchives}
        icon={Archive}
        variant="primary"
      />
      <StatsCard
        title="Ce mois"
        value={stats.archivesThisMonth}
        icon={Users}
      />
      <StatsCard
        title="Total Boxes"
        value={stats.totalBoxes}
        icon={Box}
      />
      <StatsCard
        title="Disponibles"
        value={stats.freeBoxes}
        icon={CheckCircle2}
        variant="success"
      />
      <StatsCard
        title="Pleines"
        value={stats.fullBoxes}
        icon={AlertTriangle}
      />
      <StatsCard
        title="Scellées"
        value={stats.sealedBoxes}
        icon={Lock}
      />
    </div>
  );
};

export default DashboardStats;
