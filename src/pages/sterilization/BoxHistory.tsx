import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  History, 
  Box,
  Loader2,
  ArrowLeft,
  User,
  Calendar,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Thermometer,
  Package,
  Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BoxDetails {
  id: string;
  name: string;
  box_code: string;
  status: string;
  current_step: string | null;
  last_sterilized_at: string | null;
  service_name?: string;
  sterilization_type?: string;
}

interface WorkflowLogEntry {
  id: string;
  from_step: string | null;
  to_step: string;
  performed_by: string;
  performer_name?: string;
  created_at: string;
  notes: string | null;
  validation_result: string | null;
  sterilization_type: string | null;
}

interface CycleEntry {
  id: string;
  cycle_number: number;
  status: string;
  temperature: number | null;
  pressure: number | null;
  duration_minutes: number | null;
  started_at: string;
  completed_at: string | null;
  result: string | null;
}

const STEP_LABELS: Record<string, { label: string; color: string }> = {
  reception: { label: 'Réception', color: 'bg-slate-500' },
  pre_disinfection: { label: 'Pré-désinfection', color: 'bg-blue-500' },
  cleaning: { label: 'Nettoyage', color: 'bg-cyan-500' },
  conditioning: { label: 'Conditionnement', color: 'bg-indigo-500' },
  sterilization: { label: 'Stérilisation', color: 'bg-violet-500' },
  control: { label: 'Contrôle', color: 'bg-amber-500' },
  storage: { label: 'Stockage', color: 'bg-emerald-500' },
  distribution: { label: 'Distribution', color: 'bg-teal-500' },
};

const BoxHistory = () => {
  const { boxId } = useParams<{ boxId: string }>();
  const { toast } = useToast();
  
  const [box, setBox] = useState<BoxDetails | null>(null);
  const [workflowLog, setWorkflowLog] = useState<WorkflowLogEntry[]>([]);
  const [cycles, setCycles] = useState<CycleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (boxId) {
      fetchBoxHistory();
    }
  }, [boxId]);

  const fetchBoxHistory = async () => {
    try {
      // Fetch box details
      const { data: boxData, error: boxError } = await supabase
        .from('instrument_boxes')
        .select(`
          id, name, box_code, status, current_step, last_sterilized_at, sterilization_type,
          service:services!instrument_boxes_service_id_fkey(name)
        `)
        .eq('id', boxId)
        .single();

      if (boxError) throw boxError;

      setBox({
        ...boxData,
        service_name: (boxData.service as any)?.name,
      });

      // Fetch workflow log
      const { data: logData, error: logError } = await supabase
        .from('sterilization_workflow_log')
        .select('*')
        .eq('box_id', boxId)
        .order('created_at', { ascending: false });

      if (logError) throw logError;

      // Get performer names
      if (logData && logData.length > 0) {
        const performerIds = [...new Set(logData.map(l => l.performed_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', performerIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

        setWorkflowLog(logData.map(l => ({
          ...l,
          performer_name: profileMap.get(l.performed_by) || 'Inconnu',
        })));
      }

      // Fetch sterilization cycles
      const { data: cycleBoxes, error: cycleBoxesError } = await supabase
        .from('sterilization_cycle_boxes')
        .select('cycle_id, result')
        .eq('box_id', boxId);

      if (cycleBoxesError) throw cycleBoxesError;

      if (cycleBoxes && cycleBoxes.length > 0) {
        const cycleIds = cycleBoxes.map(cb => cb.cycle_id);
        const resultMap = new Map(cycleBoxes.map(cb => [cb.cycle_id, cb.result]));

        const { data: cyclesData, error: cyclesError } = await supabase
          .from('sterilization_cycles')
          .select('*')
          .in('id', cycleIds)
          .order('started_at', { ascending: false });

        if (cyclesError) throw cyclesError;

        setCycles((cyclesData || []).map(c => ({
          ...c,
          result: resultMap.get(c.id) || null,
        })));
      }
    } catch (error) {
      console.error('Error fetching box history:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger l\'historique', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const getStepBadge = (step: string | null) => {
    if (!step) return <Badge variant="secondary">Inconnu</Badge>;
    const stepInfo = STEP_LABELS[step] || { label: step, color: 'bg-slate-500' };
    return <Badge className={`${stepInfo.color} text-white`}>{stepInfo.label}</Badge>;
  };

  const getCycleStatusBadge = (status: string, result: string | null) => {
    if (result === 'failed') {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Échoué</Badge>;
    }
    if (result === 'passed') {
      return <Badge className="bg-emerald-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Réussi</Badge>;
    }
    if (status === 'in_progress') {
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-600"><Clock className="w-3 h-3 mr-1" /> En cours</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!box) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <Box className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">Boîte non trouvée</p>
          <Button variant="outline" asChild className="mt-4">
            <Link to="/sterilization"><ArrowLeft className="w-4 h-4 mr-2" /> Retour</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/sterilization"><ArrowLeft className="w-4 h-4" /></Link>
              </Button>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <History className="w-7 h-7 text-primary" />
                Historique
              </h1>
            </div>
            <p className="text-muted-foreground">
              Traçabilité complète de la boîte {box.name}
            </p>
          </div>
        </div>

        {/* Box Info */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                <Package className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Nom</p>
                  <p className="font-semibold">{box.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Code</p>
                  <p className="font-mono text-sm">{box.box_code}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Étape actuelle</p>
                  {getStepBadge(box.current_step)}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Dernière stérilisation</p>
                  <p className="text-sm">
                    {box.last_sterilized_at 
                      ? format(new Date(box.last_sterilized_at), 'dd/MM/yyyy HH:mm', { locale: fr })
                      : 'Jamais'
                    }
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Workflow Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Journal du workflow
              </CardTitle>
              <CardDescription>{workflowLog.length} entrée(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {workflowLog.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Aucun historique</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-4">
                    {workflowLog.map((entry, index) => (
                      <div key={entry.id} className="relative flex gap-4 pl-10">
                        <div className={`absolute left-2 w-4 h-4 rounded-full ${
                          entry.validation_result === 'failed' ? 'bg-destructive' : 'bg-primary'
                        } ring-4 ring-background`} />
                        <div className="flex-1 bg-muted/30 rounded-lg p-3">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {getStepBadge(entry.from_step)}
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            {getStepBadge(entry.to_step)}
                            {entry.validation_result && (
                              <Badge variant={entry.validation_result === 'passed' ? 'default' : 'destructive'}>
                                {entry.validation_result === 'passed' ? 'Validé' : 'Échec'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" /> {entry.performer_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                            </span>
                          </div>
                          {entry.notes && (
                            <p className="mt-2 text-sm text-muted-foreground italic">
                              "{entry.notes}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sterilization Cycles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Thermometer className="w-5 h-5" />
                Cycles de stérilisation
              </CardTitle>
              <CardDescription>{cycles.length} cycle(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {cycles.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Aucun cycle</p>
              ) : (
                <div className="space-y-3">
                  {cycles.map(cycle => (
                    <div key={cycle.id} className="bg-muted/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">Cycle #{cycle.cycle_number}</span>
                        {getCycleStatusBadge(cycle.status, cycle.result)}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        {cycle.temperature && (
                          <span className="flex items-center gap-1">
                            <Thermometer className="w-3 h-3" /> {cycle.temperature}°C
                          </span>
                        )}
                        {cycle.pressure && (
                          <span>Pression: {cycle.pressure} bar</span>
                        )}
                        {cycle.duration_minutes && (
                          <span>Durée: {cycle.duration_minutes} min</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(cycle.started_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default BoxHistory;
