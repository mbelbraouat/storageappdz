import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Thermometer, 
  Box, 
  Wrench, 
  ScanLine,
  BarChart3,
  Building2,
  History,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Package,
  ListChecks,
  Activity
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';

interface StatsData {
  totalBoxes: number;
  sterileBoxes: number;
  inProgressBoxes: number;
  dirtyBoxes: number;
  totalInstruments: number;
  actionsToday: number;
}

interface RecentActivity {
  id: string;
  box_name: string;
  box_code: string;
  from_step: string | null;
  to_step: string;
  performed_by: string;
  performer_name: string;
  created_at: string;
}

const STEP_LABELS: Record<string, string> = {
  reception: 'Réception',
  pre_disinfection: 'Pré-désinfection',
  cleaning: 'Nettoyage',
  conditioning: 'Conditionnement',
  sterilization: 'Stérilisation',
  control: 'Contrôle',
  storage: 'Stockage',
  distribution: 'Distribution',
};

const SterilizationDashboard = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const scanInputRef = useRef<HTMLInputElement>(null);

  const [stats, setStats] = useState<StatsData>({
    totalBoxes: 0,
    sterileBoxes: 0,
    inProgressBoxes: 0,
    dirtyBoxes: 0,
    totalInstruments: 0,
    actionsToday: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scanCode, setScanCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    // Focus on scan input
    scanInputRef.current?.focus();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('sterilization-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'instrument_boxes' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sterilization_workflow_log' }, fetchDashboardData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch box stats
      const { data: boxes } = await supabase
        .from('instrument_boxes')
        .select('status')
        .eq('is_active', true);

      // Fetch instruments count
      const { count: instrumentsCount } = await supabase
        .from('instruments')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Fetch today's actions
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: actionsCount } = await supabase
        .from('sterilization_workflow_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      // Fetch recent activity with profile names
      const { data: activity } = await supabase
        .from('sterilization_workflow_log')
        .select(`
          id,
          from_step,
          to_step,
          performed_by,
          created_at,
          instrument_boxes!sterilization_workflow_log_box_id_fkey(name, box_code)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (activity && activity.length > 0) {
        const performerIds = [...new Set(activity.map(a => a.performed_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', performerIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

        setRecentActivity(activity.map(a => ({
          id: a.id,
          box_name: (a.instrument_boxes as any)?.name || 'Inconnu',
          box_code: (a.instrument_boxes as any)?.box_code || '',
          from_step: a.from_step,
          to_step: a.to_step,
          performed_by: a.performed_by,
          performer_name: profileMap.get(a.performed_by) || 'Inconnu',
          created_at: a.created_at,
        })));
      }

      if (boxes) {
        setStats({
          totalBoxes: boxes.length,
          sterileBoxes: boxes.filter(b => b.status === 'sterile').length,
          inProgressBoxes: boxes.filter(b => ['cleaning', 'ready_for_sterilization', 'sterilizing'].includes(b.status)).length,
          dirtyBoxes: boxes.filter(b => b.status === 'dirty').length,
          totalInstruments: instrumentsCount || 0,
          actionsToday: actionsCount || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScan = async () => {
    if (!scanCode.trim()) return;

    setIsScanning(true);
    try {
      const { data: box, error } = await supabase
        .from('instrument_boxes')
        .select('id, name, box_code')
        .eq('box_code', scanCode.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (!box) {
        toast({
          title: 'Boîte non trouvée',
          description: `Aucune boîte avec le code "${scanCode}"`,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Boîte trouvée', description: `${box.name} - Redirection vers le workflow...` });
        // Navigate to sterilization page with workflow tab
        window.location.href = `/sterilization?tab=workflow&code=${box.box_code}`;
      }
      setScanCode('');
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsScanning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  const availabilityPercent = stats.totalBoxes > 0 
    ? (stats.sterileBoxes / stats.totalBoxes) * 100 
    : 0;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Thermometer className="w-7 h-7 text-primary" />
              Dashboard Stérilisation
            </h1>
            <p className="text-muted-foreground mt-1">
              Bienvenue, {profile?.full_name || 'Utilisateur'} - Vue d'ensemble du service
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/sterilization/instruments" className="gap-2">
                <Wrench className="w-4 h-4" />
                Instruments
              </Link>
            </Button>
            <Button asChild>
              <Link to="/sterilization" className="gap-2">
                <ScanLine className="w-4 h-4" />
                Workflow
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick Scan Bar */}
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex items-center gap-2 text-primary">
                <ScanLine className="w-6 h-6" />
                <span className="font-semibold">Scan rapide</span>
              </div>
              <div className="flex flex-1 gap-2 w-full sm:w-auto">
                <div className="relative flex-1">
                  <Input
                    ref={scanInputRef}
                    placeholder="Scanner ou saisir le code boîte (douchette)..."
                    value={scanCode}
                    onChange={(e) => setScanCode(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    className="pl-4 font-mono text-lg h-12"
                  />
                </div>
                <Button 
                  onClick={handleScan} 
                  disabled={isScanning || !scanCode.trim()}
                  size="lg"
                  className="px-8"
                >
                  {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Scanner'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center sm:text-left">
              💡 Connectez une douchette USB et scannez directement les codes-barres
            </p>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 h-24 bg-muted/20" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <p className="text-2xl font-bold">{stats.totalBoxes}</p>
                <p className="text-xs text-muted-foreground">Boîtes totales</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-2xl font-bold text-emerald-600">{stats.sterileBoxes}</p>
                <p className="text-xs text-muted-foreground">Stériles</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <p className="text-2xl font-bold text-amber-600">{stats.inProgressBoxes}</p>
                <p className="text-xs text-muted-foreground">En cours</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center mb-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                </div>
                <p className="text-2xl font-bold text-destructive">{stats.dirtyBoxes}</p>
                <p className="text-xs text-muted-foreground">À traiter</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-2">
                  <Wrench className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-blue-600">{stats.totalInstruments}</p>
                <p className="text-xs text-muted-foreground">Instruments</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mb-2">
                  <Activity className="w-5 h-5 text-violet-600" />
                </div>
                <p className="text-2xl font-bold text-violet-600">{stats.actionsToday}</p>
                <p className="text-xs text-muted-foreground">Actions aujourd'hui</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Availability Progress */}
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">Taux de disponibilité</span>
              <span className="text-lg font-bold text-emerald-600">{availabilityPercent.toFixed(0)}%</span>
            </div>
            <Progress value={availabilityPercent} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.sterileBoxes} boîtes stériles sur {stats.totalBoxes} au total
            </p>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="w-5 h-5 text-primary" />
              Activité récente
            </CardTitle>
            <CardDescription>
              Dernières opérations effectuées
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune activité récente
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div 
                    key={activity.id} 
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Box className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {activity.box_name}
                          <span className="text-muted-foreground font-mono ml-2 text-xs">
                            {activity.box_code}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.from_step ? STEP_LABELS[activity.from_step] : 'Début'} → {STEP_LABELS[activity.to_step]}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {activity.performer_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/sterilization'}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <ScanLine className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Workflow Stérilisation</p>
                <p className="text-sm text-muted-foreground">Traiter les boîtes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/sterilization/instruments'}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Wrench className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold">Liste Instruments</p>
                <p className="text-sm text-muted-foreground">Gérer les instruments</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/admin/sterilization-techniques'}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <ListChecks className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold">Techniques</p>
                <p className="text-sm text-muted-foreground">Configurer les méthodes</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default SterilizationDashboard;
