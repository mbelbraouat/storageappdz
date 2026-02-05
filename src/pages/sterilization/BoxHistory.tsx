import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Wrench,
  Sparkles,
  Droplets,
  ClipboardCheck,
  Truck,
  Archive,
  AlertTriangle,
  FlaskConical
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BoxDetails {
  id: string;
  name: string;
  box_code: string;
  status: string;
  current_step: string | null;
  last_sterilized_at: string | null;
  next_sterilization_due: string | null;
  service_name?: string;
  sterilization_type?: string;
  technique_name?: string;
}

interface InstrumentInfo {
  id: string;
  name: string;
  instrument_code: string;
  status: string;
  condition: string;
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
  operator_name?: string;
}

const STEP_INFO: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string; description: string }> = {
  reception: { 
    label: 'Réception', 
    icon: <Package className="w-4 h-4" />, 
    color: 'text-slate-600',
    bgColor: 'bg-slate-500',
    description: 'Réception des boîtes sales provenant des services'
  },
  pre_disinfection: { 
    label: 'Pré-désinfection', 
    icon: <Droplets className="w-4 h-4" />, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-500',
    description: 'Immersion dans une solution détergente-désinfectante'
  },
  cleaning: { 
    label: 'Nettoyage', 
    icon: <Sparkles className="w-4 h-4" />, 
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-500',
    description: 'Nettoyage mécanique ou manuel pour éliminer les souillures'
  },
  conditioning: { 
    label: 'Conditionnement', 
    icon: <Archive className="w-4 h-4" />, 
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-500',
    description: 'Vérification, emballage et préparation pour stérilisation'
  },
  sterilization: { 
    label: 'Stérilisation', 
    icon: <Thermometer className="w-4 h-4" />, 
    color: 'text-violet-600',
    bgColor: 'bg-violet-500',
    description: 'Passage en autoclave selon le type de stérilisation choisi'
  },
  control: { 
    label: 'Contrôle', 
    icon: <ClipboardCheck className="w-4 h-4" />, 
    color: 'text-amber-600',
    bgColor: 'bg-amber-500',
    description: 'Validation des indicateurs biologiques et chimiques'
  },
  storage: { 
    label: 'Stockage', 
    icon: <Box className="w-4 h-4" />, 
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500',
    description: 'Stockage en zone propre en attente de distribution'
  },
  distribution: { 
    label: 'Distribution', 
    icon: <Truck className="w-4 h-4" />, 
    color: 'text-teal-600',
    bgColor: 'bg-teal-500',
    description: 'Distribution vers les services demandeurs'
  },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  dirty: { label: 'Sale', color: 'bg-red-500/10 text-red-600 border-red-200' },
  cleaning: { label: 'Nettoyage', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  ready_for_sterilization: { label: 'Prêt stérilisation', color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  sterilizing: { label: 'En stérilisation', color: 'bg-violet-500/10 text-violet-600 border-violet-200' },
  sterile: { label: 'Stérile', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  in_use: { label: 'En utilisation', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-200' },
};

const CONDITION_LABELS: Record<string, { label: string; color: string }> = {
  good: { label: 'Bon état', color: 'text-emerald-600' },
  fair: { label: 'État correct', color: 'text-amber-600' },
  poor: { label: 'Usé', color: 'text-orange-600' },
  damaged: { label: 'Endommagé', color: 'text-red-600' },
};

const BoxHistory = () => {
  const { boxId } = useParams<{ boxId: string }>();
  const { toast } = useToast();
  
  const [box, setBox] = useState<BoxDetails | null>(null);
  const [instruments, setInstruments] = useState<InstrumentInfo[]>([]);
  const [workflowLog, setWorkflowLog] = useState<WorkflowLogEntry[]>([]);
  const [cycles, setCycles] = useState<CycleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');

  useEffect(() => {
    if (boxId) {
      fetchBoxHistory();
    }
  }, [boxId]);

  const fetchBoxHistory = async () => {
    try {
      // Fetch box details with technique
      const { data: boxData, error: boxError } = await supabase
        .from('instrument_boxes')
        .select(`
          id, name, box_code, status, current_step, last_sterilized_at, 
          next_sterilization_due, sterilization_type,
          service:services!instrument_boxes_service_id_fkey(name),
          technique:sterilization_techniques!instrument_boxes_technique_id_fkey(name)
        `)
        .eq('id', boxId)
        .single();

      if (boxError) throw boxError;

      setBox({
        ...boxData,
        service_name: (boxData.service as any)?.name,
        technique_name: (boxData.technique as any)?.name,
      });

      // Fetch instruments in this box
      const { data: instrumentsData } = await supabase
        .from('instruments')
        .select('id, name, instrument_code, status, condition')
        .eq('box_id', boxId)
        .eq('is_active', true)
        .order('name');

      setInstruments(instrumentsData || []);

      // Fetch workflow log with performer names
      const { data: logData, error: logError } = await supabase
        .from('sterilization_workflow_log')
        .select('*')
        .eq('box_id', boxId)
        .order('created_at', { ascending: false });

      if (logError) throw logError;

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
          .select('*, operator_id')
          .in('id', cycleIds)
          .order('started_at', { ascending: false });

        if (cyclesError) throw cyclesError;

        if (cyclesData && cyclesData.length > 0) {
          const operatorIds = [...new Set(cyclesData.map(c => c.operator_id))];
          const { data: operatorProfiles } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', operatorIds);

          const operatorMap = new Map(operatorProfiles?.map(p => [p.user_id, p.full_name]) || []);

          setCycles(cyclesData.map(c => ({
            ...c,
            result: resultMap.get(c.id) || null,
            operator_name: operatorMap.get(c.operator_id) || 'Inconnu',
          })));
        }
      }
    } catch (error) {
      console.error('Error fetching box history:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger l\'historique', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const getStepBadge = (step: string | null, size: 'sm' | 'md' = 'md') => {
    if (!step) return <Badge variant="secondary">Inconnu</Badge>;
    const stepInfo = STEP_INFO[step] || { label: step, bgColor: 'bg-slate-500', icon: null };
    return (
      <Badge className={`${stepInfo.bgColor} text-white ${size === 'sm' ? 'text-[10px] px-1.5 py-0' : ''}`}>
        {size === 'md' && stepInfo.icon}
        <span className={size === 'md' ? 'ml-1' : ''}>{stepInfo.label}</span>
      </Badge>
    );
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

  const getExpiryStatus = () => {
    if (!box?.last_sterilized_at || box.status !== 'sterile') return null;
    const daysSince = differenceInDays(new Date(), new Date(box.last_sterilized_at));
    const daysRemaining = 30 - daysSince;
    
    if (daysRemaining <= 0) {
      return { status: 'expired', label: 'Périmé', color: 'text-red-600 bg-red-500/10' };
    }
    if (daysRemaining <= 3) {
      return { status: 'critical', label: `${daysRemaining}j restants`, color: 'text-red-600 bg-red-500/10' };
    }
    if (daysRemaining <= 7) {
      return { status: 'warning', label: `${daysRemaining}j restants`, color: 'text-amber-600 bg-amber-500/10' };
    }
    return { status: 'ok', label: `${daysRemaining}j restants`, color: 'text-emerald-600 bg-emerald-500/10' };
  };

  const expiryStatus = getExpiryStatus();

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
                Traçabilité Complète
              </h1>
            </div>
            <p className="text-muted-foreground ml-9">
              Historique détaillé de la boîte <span className="font-semibold">{box.name}</span>
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/sterilization" className="gap-2">
              <Thermometer className="w-4 h-4" />
              Workflow
            </Link>
          </Button>
        </div>

        {/* Box Info Card - Enhanced */}
        <Card className="overflow-hidden border-2 border-primary/20">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                <Package className="w-10 h-10 text-primary" />
              </div>
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Nom</p>
                  <p className="font-bold text-lg">{box.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Code</p>
                  <p className="font-mono text-lg">{box.box_code}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Étape actuelle</p>
                  {getStepBadge(box.current_step)}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Statut</p>
                  <Badge variant="outline" className={STATUS_LABELS[box.status]?.color}>
                    {STATUS_LABELS[box.status]?.label}
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Additional Info Row */}
            <div className="mt-4 pt-4 border-t border-primary/10 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Service</p>
                <p className="text-sm font-medium">{box.service_name || 'Non assigné'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Technique</p>
                <p className="text-sm font-medium">{box.technique_name || box.sterilization_type || 'Standard'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Dernière stérilisation</p>
                <p className="text-sm font-medium">
                  {box.last_sterilized_at 
                    ? format(new Date(box.last_sterilized_at), 'dd/MM/yyyy HH:mm', { locale: fr })
                    : 'Jamais'
                  }
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Péremption</p>
                {expiryStatus ? (
                  <Badge variant="outline" className={expiryStatus.color}>
                    {expiryStatus.status === 'expired' && <AlertTriangle className="w-3 h-3 mr-1" />}
                    {expiryStatus.label}
                  </Badge>
                ) : (
                  <p className="text-sm text-muted-foreground">N/A</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="timeline" className="gap-2">
              <History className="w-4 h-4" /> Timeline
            </TabsTrigger>
            <TabsTrigger value="instruments" className="gap-2">
              <Wrench className="w-4 h-4" /> Instruments ({instruments.length})
            </TabsTrigger>
            <TabsTrigger value="cycles" className="gap-2">
              <FlaskConical className="w-4 h-4" /> Cycles ({cycles.length})
            </TabsTrigger>
          </TabsList>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  Journal du workflow
                </CardTitle>
                <CardDescription>
                  Chaque étape avec l'opérateur responsable
                </CardDescription>
              </CardHeader>
              <CardContent>
                {workflowLog.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Aucun historique enregistré</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="sterilization-timeline">
                      {workflowLog.map((entry, index) => (
                        <div key={entry.id} className="sterilization-timeline-item">
                          <div 
                            className={`sterilization-timeline-dot ${
                              entry.validation_result === 'failed' 
                                ? 'bg-destructive' 
                                : entry.to_step === 'storage' 
                                ? 'bg-emerald-500' 
                                : 'bg-primary'
                            }`} 
                          />
                          <div className="bg-muted/30 rounded-xl p-4 hover:bg-muted/50 transition-colors">
                            {/* Step transition */}
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              {getStepBadge(entry.from_step, 'sm')}
                              <ArrowRight className="w-4 h-4 text-muted-foreground" />
                              {getStepBadge(entry.to_step)}
                              {entry.validation_result && (
                                <Badge 
                                  variant={entry.validation_result === 'passed' ? 'default' : 'destructive'}
                                  className={entry.validation_result === 'passed' ? 'bg-emerald-500' : ''}
                                >
                                  {entry.validation_result === 'passed' ? (
                                    <><CheckCircle2 className="w-3 h-3 mr-1" /> Validé</>
                                  ) : (
                                    <><XCircle className="w-3 h-3 mr-1" /> Échec</>
                                  )}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Step description */}
                            {entry.to_step && STEP_INFO[entry.to_step] && (
                              <p className="text-sm text-muted-foreground mb-3 italic">
                                {STEP_INFO[entry.to_step].description}
                              </p>
                            )}
                            
                            {/* Meta info */}
                            <div className="flex flex-wrap items-center gap-4 text-sm">
                              <span className="flex items-center gap-1.5 font-medium">
                                <User className="w-4 h-4 text-primary" />
                                {entry.performer_name}
                              </span>
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <Calendar className="w-4 h-4" />
                                {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: fr })})
                              </span>
                            </div>
                            
                            {/* Notes */}
                            {entry.notes && (
                              <div className="mt-3 p-3 bg-background/50 rounded-lg border border-border/50">
                                <p className="text-sm">
                                  <span className="font-medium text-muted-foreground">Note:</span> {entry.notes}
                                </p>
                              </div>
                            )}
                            
                            {/* Sterilization type if relevant */}
                            {entry.to_step === 'sterilization' && entry.sterilization_type && (
                              <div className="mt-2">
                                <Badge variant="outline" className="text-xs">
                                  Type: {entry.sterilization_type}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Instruments Tab */}
          <TabsContent value="instruments" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-primary" />
                  Instruments dans cette boîte
                </CardTitle>
                <CardDescription>
                  {instruments.length} instrument(s) associé(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {instruments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Aucun instrument dans cette boîte</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {instruments.map((instrument) => (
                      <div 
                        key={instrument.id}
                        className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                          <Wrench className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{instrument.name}</p>
                          <p className="text-sm text-muted-foreground font-mono">{instrument.instrument_code}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <Badge variant="outline" className={STATUS_LABELS[instrument.status]?.color}>
                            {STATUS_LABELS[instrument.status]?.label}
                          </Badge>
                          <p className={`text-xs ${CONDITION_LABELS[instrument.condition]?.color || 'text-muted-foreground'}`}>
                            {CONDITION_LABELS[instrument.condition]?.label || instrument.condition}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cycles Tab */}
          <TabsContent value="cycles" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-primary" />
                  Cycles de stérilisation
                </CardTitle>
                <CardDescription>
                  Historique des passages en autoclave
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cycles.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Aucun cycle enregistré</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cycles.map(cycle => (
                      <div key={cycle.id} className="bg-muted/30 rounded-xl p-5 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                              <FlaskConical className="w-5 h-5 text-violet-600" />
                            </div>
                            <div>
                              <p className="font-bold text-lg">Cycle #{cycle.cycle_number}</p>
                              <p className="text-xs text-muted-foreground">
                                Opérateur: {cycle.operator_name}
                              </p>
                            </div>
                          </div>
                          {getCycleStatusBadge(cycle.status, cycle.result)}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          {cycle.temperature && (
                            <div className="p-3 bg-background/50 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Température</p>
                              <p className="font-semibold flex items-center gap-1">
                                <Thermometer className="w-4 h-4 text-red-500" />
                                {cycle.temperature}°C
                              </p>
                            </div>
                          )}
                          {cycle.pressure && (
                            <div className="p-3 bg-background/50 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Pression</p>
                              <p className="font-semibold">{cycle.pressure} bar</p>
                            </div>
                          )}
                          {cycle.duration_minutes && (
                            <div className="p-3 bg-background/50 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Durée</p>
                              <p className="font-semibold flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {cycle.duration_minutes} min
                              </p>
                            </div>
                          )}
                          <div className="p-3 bg-background/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Date</p>
                            <p className="font-semibold text-sm">
                              {format(new Date(cycle.started_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default BoxHistory;
