import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Thermometer, 
  Box, 
  Wrench, 
  ScanLine,
  History,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Package,
  Activity,
  ArrowRight,
  Sparkles,
  FlaskConical,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Shield
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface InstrumentStats {
  total: number;
  byStatus: Record<string, number>;
  byCondition: Record<string, number>;
}

interface BoxStats {
  total: number;
  sterile: number;
  inProgress: number;
  dirty: number;
  expiringCount: number;
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
  notes: string | null;
}

interface InstrumentBox {
  id: string;
  name: string;
  box_code: string;
  status: string;
  current_step: string | null;
  last_sterilized_at: string | null;
  next_sterilization_due: string | null;
  instrument_count: number;
}

const STEP_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  reception: { label: 'Réception', icon: <Package className="w-4 h-4" />, color: 'bg-slate-500' },
  pre_disinfection: { label: 'Pré-désinfection', icon: <Sparkles className="w-4 h-4" />, color: 'bg-blue-500' },
  cleaning: { label: 'Nettoyage', icon: <Sparkles className="w-4 h-4" />, color: 'bg-cyan-500' },
  conditioning: { label: 'Conditionnement', icon: <Package className="w-4 h-4" />, color: 'bg-indigo-500' },
  sterilization: { label: 'Stérilisation', icon: <Thermometer className="w-4 h-4" />, color: 'bg-violet-500' },
  control: { label: 'Contrôle', icon: <CheckCircle2 className="w-4 h-4" />, color: 'bg-amber-500' },
  storage: { label: 'Stockage', icon: <Box className="w-4 h-4" />, color: 'bg-emerald-500' },
  distribution: { label: 'Distribution', icon: <ArrowRight className="w-4 h-4" />, color: 'bg-teal-500' },
};

const STATUS_COLORS: Record<string, string> = {
  dirty: 'bg-red-500/10 text-red-600 border-red-200',
  cleaning: 'bg-blue-500/10 text-blue-600 border-blue-200',
  ready_for_sterilization: 'bg-amber-500/10 text-amber-600 border-amber-200',
  sterilizing: 'bg-violet-500/10 text-violet-600 border-violet-200',
  sterile: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  in_use: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
};

const InstrumentisteDashboard = () => {
  const { user, profile, isInstrumentiste, isAdmin } = useAuth();
  const { toast } = useToast();
  const scanInputRef = useRef<HTMLInputElement>(null);

  const [instrumentStats, setInstrumentStats] = useState<InstrumentStats>({ total: 0, byStatus: {}, byCondition: {} });
  const [boxStats, setBoxStats] = useState<BoxStats>({ total: 0, sterile: 0, inProgress: 0, dirty: 0, expiringCount: 0 });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [boxesInProgress, setBoxesInProgress] = useState<InstrumentBox[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scanCode, setScanCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    scanInputRef.current?.focus();

    const channel = supabase
      .channel('instrumentiste-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'instrument_boxes' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'instruments' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sterilization_workflow_log' }, fetchDashboardData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch instruments stats
      const { data: instruments } = await supabase
        .from('instruments')
        .select('status, condition')
        .eq('is_active', true);

      if (instruments) {
        const byStatus: Record<string, number> = {};
        const byCondition: Record<string, number> = {};
        instruments.forEach(inst => {
          byStatus[inst.status] = (byStatus[inst.status] || 0) + 1;
          byCondition[inst.condition || 'unknown'] = (byCondition[inst.condition || 'unknown'] || 0) + 1;
        });
        setInstrumentStats({ total: instruments.length, byStatus, byCondition });
      }

      // Fetch boxes stats
      const { data: boxes } = await supabase
        .from('instrument_boxes')
        .select('id, name, box_code, status, current_step, last_sterilized_at, next_sterilization_due')
        .eq('is_active', true);

      if (boxes) {
        const now = new Date();
        const expiringCount = boxes.filter(b => {
          if (!b.last_sterilized_at) return false;
          const daysSince = differenceInDays(now, new Date(b.last_sterilized_at));
          return daysSince >= 23 && b.status === 'sterile';
        }).length;

        setBoxStats({
          total: boxes.length,
          sterile: boxes.filter(b => b.status === 'sterile').length,
          inProgress: boxes.filter(b => ['cleaning', 'ready_for_sterilization', 'sterilizing'].includes(b.status)).length,
          dirty: boxes.filter(b => b.status === 'dirty').length,
          expiringCount,
        });

        // Get boxes not sterile for quick access
        const inProgress = boxes
          .filter(b => b.status !== 'sterile')
          .slice(0, 8);

        // Get instrument counts
        const boxIds = inProgress.map(b => b.id);
        const { data: instrumentCounts } = await supabase
          .from('instruments')
          .select('box_id')
          .in('box_id', boxIds)
          .eq('is_active', true);

        const countMap: Record<string, number> = {};
        instrumentCounts?.forEach(i => {
          if (i.box_id) countMap[i.box_id] = (countMap[i.box_id] || 0) + 1;
        });

        setBoxesInProgress(inProgress.map(b => ({
          ...b,
          instrument_count: countMap[b.id] || 0,
        })));
      }

      // Fetch recent activity with user names
      const { data: activity } = await supabase
        .from('sterilization_workflow_log')
        .select(`
          id, from_step, to_step, performed_by, created_at, notes,
          instrument_boxes!sterilization_workflow_log_box_id_fkey(name, box_code)
        `)
        .order('created_at', { ascending: false })
        .limit(15);

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
          notes: a.notes,
        })));
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
        toast({ title: 'Boîte trouvée', description: `${box.name} - Redirection...` });
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
    if (e.key === 'Enter') handleScan();
  };

  const availabilityPercent = boxStats.total > 0 
    ? (boxStats.sterile / boxStats.total) * 100 
    : 0;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header with glassmorphism effect */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6 border border-primary/20">
          <div className="absolute inset-0 bg-grid-pattern opacity-5" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-primary/20 backdrop-blur-sm flex items-center justify-center">
                  <Wrench className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Interface Instrumentiste
                  </h1>
                  <p className="text-muted-foreground">
                    Bienvenue, {profile?.full_name || 'Instrumentiste'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  <Shield className="w-3 h-3 mr-1" />
                  {isAdmin ? 'Administrateur' : 'Instrumentiste'}
                </Badge>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
                  <Activity className="w-3 h-3 mr-1" />
                  Module Stérilisation
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild className="gap-2 bg-background/50 backdrop-blur-sm">
                <Link to="/sterilization/instruments">
                  <Wrench className="w-4 h-4" />
                  Instruments
                </Link>
              </Button>
              <Button asChild className="gap-2 shadow-lg shadow-primary/20">
                <Link to="/sterilization">
                  <ScanLine className="w-4 h-4" />
                  Workflow
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Scan Bar - Enhanced */}
        <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 shadow-lg shadow-primary/5">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center animate-pulse-subtle">
                  <ScanLine className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Scan Rapide</p>
                  <p className="text-xs text-muted-foreground">Douchette ou saisie manuelle</p>
                </div>
              </div>
              <div className="flex flex-1 gap-2 w-full sm:w-auto">
                <div className="relative flex-1">
                  <Input
                    ref={scanInputRef}
                    placeholder="Scanner le code-barres de la boîte..."
                    value={scanCode}
                    onChange={(e) => setScanCode(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    className="pl-4 font-mono text-lg h-12 border-primary/30 focus:border-primary bg-background/80"
                  />
                </div>
                <Button 
                  onClick={handleScan} 
                  disabled={isScanning || !scanCode.trim()}
                  size="lg"
                  className="px-8 shadow-lg"
                >
                  {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Scanner'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid - Enhanced with gradients */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-5 h-28 bg-muted/20" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-emerald-200/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-3xl font-bold text-emerald-600">{boxStats.sterile}</p>
                <p className="text-sm text-muted-foreground">Boîtes stériles</p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-amber-200/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Clock className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-amber-600">{boxStats.inProgress}</p>
                <p className="text-sm text-muted-foreground">En cours</p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-red-200/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-red-600">{boxStats.dirty}</p>
                <p className="text-sm text-muted-foreground">À traiter</p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-blue-200/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Wrench className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-blue-600">{instrumentStats.total}</p>
                <p className="text-sm text-muted-foreground">Instruments</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Expiring Alert */}
        {boxStats.expiringCount > 0 && (
          <Card className="border-l-4 border-l-amber-500 bg-amber-500/5">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-700">Péremption proche</p>
                <p className="text-sm text-muted-foreground">
                  {boxStats.expiringCount} boîte(s) approchent de leur date de péremption (30 jours)
                </p>
              </div>
              <Button variant="outline" asChild className="border-amber-300 text-amber-700 hover:bg-amber-50">
                <Link to="/sterilization/expiring">Voir détails</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Availability Progress */}
        <Card className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-primary" />
                <span className="font-semibold">Taux de disponibilité</span>
              </div>
              <span className={`text-2xl font-bold ${availabilityPercent >= 70 ? 'text-emerald-600' : availabilityPercent >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                {availabilityPercent.toFixed(0)}%
              </span>
            </div>
            <div className="relative h-4 bg-muted rounded-full overflow-hidden">
              <div 
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                  availabilityPercent >= 70 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                  availabilityPercent >= 40 ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                  'bg-gradient-to-r from-red-400 to-red-600'
                }`}
                style={{ width: `${availabilityPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {boxStats.sterile} boîtes stériles disponibles sur {boxStats.total} au total
            </p>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Boxes in Progress */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Box className="w-5 h-5 text-primary" />
                Boîtes à traiter
              </CardTitle>
              <CardDescription>Accès rapide aux boîtes en cours de processus</CardDescription>
            </CardHeader>
            <CardContent>
              {boxesInProgress.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500/50" />
                  <p>Toutes les boîtes sont stériles !</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {boxesInProgress.map((box) => (
                    <div 
                      key={box.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all cursor-pointer group"
                      onClick={() => window.location.href = `/sterilization/history/${box.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          box.current_step ? STEP_LABELS[box.current_step]?.color : 'bg-slate-500'
                        }/20`}>
                          {box.current_step && STEP_LABELS[box.current_step]?.icon}
                        </div>
                        <div>
                          <p className="font-medium group-hover:text-primary transition-colors">
                            {box.name}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {box.box_code} • {box.instrument_count} instruments
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={STATUS_COLORS[box.status]}>
                          {box.current_step ? STEP_LABELS[box.current_step]?.label : box.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Activité récente
              </CardTitle>
              <CardDescription>Dernières opérations du service</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[350px] pr-4">
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune activité récente
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 to-transparent" />
                    <div className="space-y-4">
                      {recentActivity.map((activity, index) => (
                        <div 
                          key={activity.id} 
                          className="relative flex gap-4 pl-10 animate-fade-in"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className={`absolute left-2 w-4 h-4 rounded-full ring-4 ring-background ${
                            activity.to_step === 'storage' ? 'bg-emerald-500' :
                            activity.to_step === 'reception' ? 'bg-slate-500' :
                            'bg-primary'
                          }`} />
                          <div className="flex-1 bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{activity.box_name}</span>
                              <span className="text-xs text-muted-foreground font-mono">
                                {activity.box_code}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs mb-2">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {activity.from_step ? STEP_LABELS[activity.from_step]?.label : 'Début'}
                              </Badge>
                              <ArrowRight className="w-3 h-3 text-muted-foreground" />
                              <Badge className={`text-[10px] px-1.5 py-0 ${STEP_LABELS[activity.to_step]?.color}`}>
                                {STEP_LABELS[activity.to_step]?.label}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" /> {activity.performer_name}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: fr })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="hover:shadow-lg transition-all cursor-pointer group" onClick={() => window.location.href = '/sterilization'}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <ScanLine className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Workflow</p>
                <p className="text-xs text-muted-foreground">Processus complet</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-all cursor-pointer group" onClick={() => window.location.href = '/sterilization/instruments'}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <Wrench className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold">Instruments</p>
                <p className="text-xs text-muted-foreground">Gestion complète</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-all cursor-pointer group" onClick={() => window.location.href = '/sterilization/cycles'}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
                <FlaskConical className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <p className="font-semibold">Cycles</p>
                <p className="text-xs text-muted-foreground">Autoclave</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-all cursor-pointer group" onClick={() => window.location.href = '/sterilization/expiring'}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold">Péremptions</p>
                <p className="text-xs text-muted-foreground">Alertes</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default InstrumentisteDashboard;
