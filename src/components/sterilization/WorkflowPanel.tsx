import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  ScanLine, 
  ArrowRight, 
  CheckCircle2, 
  Package,
  Loader2,
  AlertTriangle,
  Droplets,
  Sparkles,
  Thermometer,
  ClipboardCheck,
  Archive,
  Truck,
  RotateCcw,
  Clock,
  User,
  History
} from 'lucide-react';
import { 
  type InstrumentBox, 
  type SterilizationStep, 
  type SterilizationType,
  STEP_LABELS, 
  STERILIZATION_TYPES,
  STATUS_LABELS 
} from './BoxCard';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface WorkflowPanelProps {
  onBoxProcessed: () => void;
}

interface WorkflowLogEntry {
  id: string;
  from_step: SterilizationStep | null;
  to_step: SterilizationStep;
  performed_by: string;
  sterilization_type: SterilizationType | null;
  validation_result: 'passed' | 'failed' | null;
  notes: string | null;
  created_at: string;
  performer_name?: string;
}

const STEP_ICONS: Record<SterilizationStep, React.ReactNode> = {
  reception: <Package className="w-5 h-5" />,
  pre_disinfection: <Droplets className="w-5 h-5" />,
  cleaning: <Sparkles className="w-5 h-5" />,
  conditioning: <Archive className="w-5 h-5" />,
  sterilization: <Thermometer className="w-5 h-5" />,
  control: <ClipboardCheck className="w-5 h-5" />,
  storage: <Archive className="w-5 h-5" />,
  distribution: <Truck className="w-5 h-5" />,
};

const STEP_DESCRIPTIONS: Record<SterilizationStep, string> = {
  reception: 'Réception des boîtes sales provenant des services',
  pre_disinfection: 'Immersion dans une solution détergente-désinfectante',
  cleaning: 'Nettoyage mécanique ou manuel pour éliminer les souillures',
  conditioning: 'Vérification, emballage et préparation pour stérilisation',
  sterilization: 'Passage en autoclave selon le type de stérilisation choisi',
  control: 'Validation des indicateurs biologiques et chimiques',
  storage: 'Stockage en zone propre en attente de distribution',
  distribution: 'Distribution vers les services demandeurs',
};

const STEP_ORDER: SterilizationStep[] = [
  'reception',
  'pre_disinfection',
  'cleaning',
  'conditioning',
  'sterilization',
  'control',
  'storage',
  'distribution',
];

const WorkflowPanel = ({ onBoxProcessed }: WorkflowPanelProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const scanInputRef = useRef<HTMLInputElement>(null);

  const [scanCode, setScanCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedBox, setScannedBox] = useState<InstrumentBox | null>(null);
  const [selectedType, setSelectedType] = useState<SterilizationType>('vapeur');
  const [validationResult, setValidationResult] = useState<'passed' | 'failed' | null>(null);
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowLogEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showFailedDialog, setShowFailedDialog] = useState(false);
  const [recentBoxes, setRecentBoxes] = useState<InstrumentBox[]>([]);

  // Focus on scan input when panel opens
  useEffect(() => {
    scanInputRef.current?.focus();
    fetchRecentBoxes();
  }, []);

  const fetchRecentBoxes = async () => {
    try {
      const { data } = await supabase
        .from('instrument_boxes')
        .select('*, service:services!instrument_boxes_service_id_fkey(name, code)')
        .eq('is_active', true)
        .neq('status', 'sterile')
        .order('updated_at', { ascending: false })
        .limit(5);
      
      if (data) {
        setRecentBoxes(data as unknown as InstrumentBox[]);
      }
    } catch (error) {
      console.error('Error fetching recent boxes:', error);
    }
  };

  const fetchWorkflowHistory = async (boxId: string) => {
    setIsLoadingHistory(true);
    try {
      const { data: logs, error } = await supabase
        .from('sterilization_workflow_log')
        .select('*')
        .eq('box_id', boxId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Fetch performer names
      if (logs && logs.length > 0) {
        const performerIds = [...new Set(logs.map(l => l.performed_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', performerIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
        
        setWorkflowHistory(logs.map(log => ({
          ...log,
          performer_name: profileMap.get(log.performed_by) || 'Inconnu',
        })) as WorkflowLogEntry[]);
      } else {
        setWorkflowHistory([]);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleScan = async () => {
    if (!scanCode.trim()) return;

    setIsScanning(true);
    try {
      const { data: box, error } = await supabase
        .from('instrument_boxes')
        .select('*, service:services!instrument_boxes_service_id_fkey(name, code), assigned_service:services!instrument_boxes_assigned_service_id_fkey(name, code)')
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
        setScanCode('');
        return;
      }

      setScannedBox(box as unknown as InstrumentBox);
      setSelectedType((box.sterilization_type as SterilizationType) || 'vapeur');
      fetchWorkflowHistory(box.id);
      toast({ title: 'Boîte scannée', description: box.name });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectRecentBox = (box: InstrumentBox) => {
    setScannedBox(box);
    setSelectedType((box.sterilization_type as SterilizationType) || 'vapeur');
    fetchWorkflowHistory(box.id);
    setScanCode(box.box_code);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  const getNextStep = (currentStep: SterilizationStep | null): SterilizationStep => {
    if (!currentStep) return 'reception';
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex === -1 || currentIndex >= STEP_ORDER.length - 1) return 'reception';
    return STEP_ORDER[currentIndex + 1];
  };

  const getStatusForStep = (step: SterilizationStep): string => {
    switch (step) {
      case 'reception':
        return 'dirty';
      case 'pre_disinfection':
      case 'cleaning':
        return 'cleaning';
      case 'conditioning':
        return 'ready_for_sterilization';
      case 'sterilization':
        return 'sterilizing';
      case 'control':
      case 'storage':
        return 'sterile';
      case 'distribution':
        return 'in_use';
      default:
        return 'dirty';
    }
  };

  const handleAdvanceStep = async () => {
    if (!scannedBox || !user) return;

    // Control step requires validation result
    if (scannedBox.current_step === 'sterilization' && !validationResult) {
      toast({
        title: 'Validation requise',
        description: 'Indiquez si le contrôle est passé ou échoué',
        variant: 'destructive',
      });
      return;
    }

    // If validation failed, show dialog
    if (scannedBox.current_step === 'sterilization' && validationResult === 'failed') {
      setShowFailedDialog(true);
      return;
    }

    await processStepAdvance();
  };

  const processStepAdvance = async (forceReset = false) => {
    if (!scannedBox || !user) return;

    setIsProcessing(true);
    try {
      let nextStep: SterilizationStep;
      let newStatus: string;

      if (forceReset) {
        // Failed control - restart from reception
        nextStep = 'reception';
        newStatus = 'dirty';
      } else {
        nextStep = getNextStep(scannedBox.current_step);
        newStatus = getStatusForStep(nextStep);
      }

      // Update box
      const updateData: Record<string, unknown> = {
        current_step: nextStep,
        status: newStatus,
        sterilization_type: selectedType,
        updated_at: new Date().toISOString(),
      };

      if (nextStep === 'storage') {
        updateData.last_sterilized_at = new Date().toISOString();
      }

      if (forceReset) {
        updateData.assigned_service_id = null;
        updateData.assigned_bloc = null;
      }

      const { error: updateError } = await supabase
        .from('instrument_boxes')
        .update(updateData)
        .eq('id', scannedBox.id);

      if (updateError) throw updateError;

      // Log workflow transition
      const { error: logError } = await supabase
        .from('sterilization_workflow_log')
        .insert({
          box_id: scannedBox.id,
          from_step: scannedBox.current_step,
          to_step: nextStep,
          performed_by: user.id,
          sterilization_type: selectedType,
          validation_result: scannedBox.current_step === 'sterilization' ? validationResult : null,
          notes: forceReset 
            ? `Contrôle échoué - Retour en réception. ${notes.trim() || ''}`
            : (notes.trim() || null),
        });

      if (logError) throw logError;

      const message = forceReset 
        ? `${scannedBox.name} → Retour en réception (contrôle échoué)`
        : `${scannedBox.name} → ${STEP_LABELS[nextStep].label}`;

      toast({
        title: forceReset ? 'Boîte renvoyée' : 'Étape validée',
        description: message,
        variant: forceReset ? 'destructive' : 'default',
      });

      // Reset for next scan
      resetPanel();
      onBoxProcessed();
      fetchRecentBoxes();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      setShowFailedDialog(false);
    }
  };

  const handleResetBox = async () => {
    if (!scannedBox || !user) return;

    setIsProcessing(true);
    try {
      const { error: updateError } = await supabase
        .from('instrument_boxes')
        .update({
          current_step: 'reception',
          status: 'dirty',
          assigned_service_id: null,
          assigned_bloc: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scannedBox.id);

      if (updateError) throw updateError;

      // Log reset
      await supabase.from('sterilization_workflow_log').insert({
        box_id: scannedBox.id,
        from_step: scannedBox.current_step,
        to_step: 'reception',
        performed_by: user.id,
        notes: 'Réception après utilisation - Nouveau cycle de stérilisation',
      });

      toast({ title: 'Boîte réceptionnée', description: 'Nouveau cycle de stérilisation démarré' });
      resetPanel();
      onBoxProcessed();
      fetchRecentBoxes();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetPanel = () => {
    setScannedBox(null);
    setScanCode('');
    setValidationResult(null);
    setNotes('');
    setShowHistory(false);
    setWorkflowHistory([]);
    scanInputRef.current?.focus();
  };

  const currentStepIndex = scannedBox?.current_step 
    ? STEP_ORDER.indexOf(scannedBox.current_step) + 1 
    : 0;
  const progressPercent = (currentStepIndex / STEP_ORDER.length) * 100;

  return (
    <>
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Workflow Card */}
        <Card className="lg:col-span-2 border-2 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ScanLine className="w-5 h-5 text-primary" />
              Workflow de Stérilisation
            </CardTitle>
            <CardDescription>
              Scannez le code-barres d'une boîte pour avancer dans le processus
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Scan Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={scanInputRef}
                  placeholder="Scanner ou saisir le code boîte..."
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  className="pl-10 font-mono text-lg h-12"
                  disabled={isScanning || !!scannedBox}
                />
              </div>
              <Button 
                onClick={handleScan} 
                disabled={isScanning || !scanCode.trim() || !!scannedBox}
                size="lg"
                className="px-6"
              >
                {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Rechercher'}
              </Button>
            </div>

            {/* Scanned Box Info */}
            {scannedBox && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                {/* Box Header */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 to-transparent rounded-lg border">
                  <div>
                    <h3 className="font-semibold text-xl">{scannedBox.name}</h3>
                    <p className="text-sm text-muted-foreground font-mono">{scannedBox.box_code}</p>
                    {scannedBox.service && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Service: {scannedBox.service.name}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className={`${STATUS_LABELS[scannedBox.status].color} text-sm`}>
                      {STATUS_LABELS[scannedBox.status].icon}
                      <span className="ml-1">{STATUS_LABELS[scannedBox.status].label}</span>
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowHistory(!showHistory)}
                      className="text-xs"
                    >
                      <History className="w-3 h-3 mr-1" />
                      Historique
                    </Button>
                  </div>
                </div>

                {/* Current Step Description */}
                {scannedBox.current_step && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
                      {STEP_ICONS[scannedBox.current_step]}
                      <span>Étape actuelle: {STEP_LABELS[scannedBox.current_step].label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {STEP_DESCRIPTIONS[scannedBox.current_step]}
                    </p>
                  </div>
                )}

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progression du cycle</span>
                    <span className="font-medium">{currentStepIndex}/{STEP_ORDER.length} étapes</span>
                  </div>
                  <Progress value={progressPercent} className="h-3" />
                </div>

                {/* Steps Visual */}
                <div className="grid grid-cols-4 gap-2">
                  {STEP_ORDER.map((step, index) => {
                    const isCompleted = scannedBox.current_step 
                      ? STEP_ORDER.indexOf(scannedBox.current_step) > index
                      : false;
                    const isCurrent = scannedBox.current_step === step;
                    const isNext = getNextStep(scannedBox.current_step) === step;

                    return (
                      <div
                        key={step}
                        className={`flex flex-col items-center p-2 rounded-lg text-center transition-all ${
                          isCurrent 
                            ? 'bg-primary text-primary-foreground shadow-lg scale-105' 
                            : isCompleted 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                              : isNext 
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-2 border-dashed border-amber-500/50'
                                : 'bg-muted/50 text-muted-foreground'
                        }`}
                      >
                        <div className={`p-1.5 rounded-full mb-1 ${isCurrent ? 'bg-primary-foreground/20' : ''}`}>
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            STEP_ICONS[step]
                          )}
                        </div>
                        <span className="text-[10px] font-medium leading-tight">
                          {STEP_LABELS[step].label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <Separator />

                {/* Sterilization Type Selection */}
                {(!scannedBox.current_step || STEP_ORDER.indexOf(scannedBox.current_step) < 4) && (
                  <div className="space-y-2">
                    <Label className="text-base font-medium">Type de stérilisation</Label>
                    <Select value={selectedType} onValueChange={(v) => setSelectedType(v as SterilizationType)}>
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STERILIZATION_TYPES).map(([type, label]) => (
                          <SelectItem key={type} value={type}>
                            <div className="flex items-center gap-2">
                              <Thermometer className="w-4 h-4" />
                              {label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Control Validation */}
                {scannedBox.current_step === 'sterilization' && (
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                    <Label className="text-base font-medium">Contrôle de stérilisation</Label>
                    <p className="text-sm text-muted-foreground">
                      Vérifiez les indicateurs biologiques et chimiques avant de valider
                    </p>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant={validationResult === 'passed' ? 'default' : 'outline'}
                        className={`flex-1 h-12 ${validationResult === 'passed' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                        onClick={() => setValidationResult('passed')}
                      >
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Conforme
                      </Button>
                      <Button
                        type="button"
                        variant={validationResult === 'failed' ? 'destructive' : 'outline'}
                        className="flex-1 h-12"
                        onClick={() => setValidationResult('failed')}
                      >
                        <AlertTriangle className="w-5 h-5 mr-2" />
                        Non conforme
                      </Button>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label className="font-medium">Notes / Observations (optionnel)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Remarques, numéro de lot, observations..."
                    className="h-20 resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={resetPanel}
                    disabled={isProcessing}
                    className="h-12"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Annuler
                  </Button>
                  
                  {scannedBox.current_step === 'distribution' ? (
                    <Button
                      onClick={handleResetBox}
                      disabled={isProcessing}
                      className="flex-1 h-12 text-base"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      ) : (
                        <Package className="w-5 h-5 mr-2" />
                      )}
                      Réceptionner (nouveau cycle)
                    </Button>
                  ) : (
                    <Button
                      onClick={handleAdvanceStep}
                      disabled={isProcessing || (scannedBox.current_step === 'sterilization' && !validationResult)}
                      className="flex-1 h-12 text-base bg-gradient-to-r from-primary to-primary/80"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      ) : (
                        <ArrowRight className="w-5 h-5 mr-2" />
                      )}
                      Valider → {STEP_LABELS[getNextStep(scannedBox.current_step)].label}
                    </Button>
                  )}
                </div>

                {/* Workflow History */}
                {showHistory && (
                  <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Historique récent
                    </h4>
                    {isLoadingHistory ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    ) : workflowHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Aucun historique disponible
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {workflowHistory.map((log) => (
                          <div key={log.id} className="flex items-start gap-3 text-sm p-2 bg-background rounded">
                            <div className="flex-shrink-0 mt-0.5">
                              {log.validation_result === 'failed' 
                                ? <AlertTriangle className="w-4 h-4 text-destructive" />
                                : <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {log.from_step && (
                                  <>
                                    <span className="text-muted-foreground">{STEP_LABELS[log.from_step]?.label || log.from_step}</span>
                                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                  </>
                                )}
                                <span className="font-medium">{STEP_LABELS[log.to_step]?.label || log.to_step}</span>
                                {log.validation_result && (
                                  <Badge variant={log.validation_result === 'passed' ? 'default' : 'destructive'} className="text-[10px]">
                                    {log.validation_result === 'passed' ? 'Conforme' : 'Non conforme'}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <Clock className="w-3 h-3" />
                                {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                                <User className="w-3 h-3 ml-1" />
                                {log.performer_name}
                              </div>
                              {log.notes && (
                                <p className="text-xs text-muted-foreground mt-1 italic">
                                  "{log.notes}"
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Boxes Sidebar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Boîtes en cours
            </CardTitle>
            <CardDescription className="text-xs">
              Boîtes en cours de traitement
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentBoxes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune boîte en traitement
              </p>
            ) : (
              <div className="space-y-2">
                {recentBoxes.map((box) => (
                  <button
                    key={box.id}
                    onClick={() => handleSelectRecentBox(box)}
                    disabled={!!scannedBox}
                    className={`w-full p-3 rounded-lg border text-left transition-colors hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed ${
                      scannedBox?.id === box.id ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{box.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{box.box_code}</p>
                      </div>
                      <Badge variant="outline" className={`${STATUS_LABELS[box.status].color} text-[10px]`}>
                        {STATUS_LABELS[box.status].label}
                      </Badge>
                    </div>
                    {box.current_step && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        {STEP_ICONS[box.current_step]}
                        <span>{STEP_LABELS[box.current_step].label}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Failed Control Dialog */}
      <AlertDialog open={showFailedDialog} onOpenChange={setShowFailedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Contrôle de stérilisation échoué
            </AlertDialogTitle>
            <AlertDialogDescription>
              Le contrôle de stérilisation a échoué. La boîte sera renvoyée à l'étape de réception 
              pour recommencer le cycle de stérilisation complet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => processStepAdvance(true)}
              disabled={isProcessing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Renvoyer en réception
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default WorkflowPanel;
