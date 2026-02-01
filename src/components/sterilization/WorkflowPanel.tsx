import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Truck
} from 'lucide-react';
import { 
  type InstrumentBox, 
  type SterilizationStep, 
  type SterilizationType,
  STEP_LABELS, 
  STERILIZATION_TYPES,
  STATUS_LABELS 
} from './BoxCard';

interface WorkflowPanelProps {
  onBoxProcessed: () => void;
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

  // Focus on scan input when panel opens
  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  const handleScan = async () => {
    if (!scanCode.trim()) return;

    setIsScanning(true);
    try {
      // Try to find box by code
      const { data: box, error } = await supabase
        .from('instrument_boxes')
        .select('*, service:services!instrument_boxes_service_id_fkey(name, code), assigned_service:services!instrument_boxes_assigned_service_id_fkey(name, code)')
        .eq('box_code', scanCode.trim())
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
      toast({ title: 'Boîte scannée', description: box.name });
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

    setIsProcessing(true);
    try {
      const nextStep = getNextStep(scannedBox.current_step);
      const newStatus = getStatusForStep(nextStep);

      // Update box
      const updateData: Record<string, unknown> = {
        current_step: nextStep,
        status: newStatus,
        sterilization_type: selectedType,
      };

      if (nextStep === 'storage') {
        updateData.last_sterilized_at = new Date().toISOString();
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
          notes: notes.trim() || null,
        });

      if (logError) throw logError;

      toast({
        title: 'Étape validée',
        description: `${scannedBox.name} → ${STEP_LABELS[nextStep].label}`,
      });

      // Reset for next scan
      setScannedBox(null);
      setScanCode('');
      setValidationResult(null);
      setNotes('');
      scanInputRef.current?.focus();
      onBoxProcessed();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
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
        })
        .eq('id', scannedBox.id);

      if (updateError) throw updateError;

      // Log reset
      await supabase.from('sterilization_workflow_log').insert({
        box_id: scannedBox.id,
        from_step: scannedBox.current_step,
        to_step: 'reception',
        performed_by: user.id,
        notes: 'Réinitialisation du cycle',
      });

      toast({ title: 'Boîte réinitialisée', description: 'Nouveau cycle de stérilisation' });
      setScannedBox(null);
      setScanCode('');
      onBoxProcessed();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const currentStepIndex = scannedBox?.current_step 
    ? STEP_ORDER.indexOf(scannedBox.current_step) + 1 
    : 0;
  const progressPercent = (currentStepIndex / STEP_ORDER.length) * 100;

  return (
    <Card className="border-2 border-primary/20">
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
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 font-mono"
              disabled={isScanning || !!scannedBox}
            />
          </div>
          <Button 
            onClick={handleScan} 
            disabled={isScanning || !scanCode.trim() || !!scannedBox}
          >
            {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Rechercher'}
          </Button>
        </div>

        {/* Scanned Box Info */}
        {scannedBox && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            {/* Box Header */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <h3 className="font-semibold text-lg">{scannedBox.name}</h3>
                <p className="text-sm text-muted-foreground font-mono">{scannedBox.box_code}</p>
              </div>
              <Badge variant="outline" className={STATUS_LABELS[scannedBox.status].color}>
                {STATUS_LABELS[scannedBox.status].icon}
                <span className="ml-1">{STATUS_LABELS[scannedBox.status].label}</span>
              </Badge>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progression</span>
                <span className="font-medium">{currentStepIndex}/{STEP_ORDER.length}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>

            {/* Steps Visual */}
            <div className="grid grid-cols-4 gap-2">
              {STEP_ORDER.map((step, index) => {
                const isCompleted = scannedBox.current_step 
                  ? STEP_ORDER.indexOf(scannedBox.current_step) >= index
                  : false;
                const isCurrent = scannedBox.current_step === step;
                const isNext = getNextStep(scannedBox.current_step) === step;

                return (
                  <div
                    key={step}
                    className={`flex flex-col items-center p-2 rounded-lg text-center transition-colors ${
                      isCurrent 
                        ? 'bg-primary text-primary-foreground' 
                        : isCompleted 
                          ? 'bg-emerald-500/10 text-emerald-600' 
                          : isNext 
                            ? 'bg-amber-500/10 text-amber-600 border-2 border-dashed border-amber-500/50'
                            : 'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <div className={`p-1.5 rounded-full mb-1 ${isCurrent ? 'bg-primary-foreground/20' : ''}`}>
                      {isCompleted && !isCurrent ? (
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

            {/* Sterilization Type Selection (shown during early steps) */}
            {(!scannedBox.current_step || STEP_ORDER.indexOf(scannedBox.current_step) < 3) && (
              <div className="space-y-2">
                <Label>Type de stérilisation</Label>
                <Select value={selectedType} onValueChange={(v) => setSelectedType(v as SterilizationType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STERILIZATION_TYPES).map(([type, label]) => (
                      <SelectItem key={type} value={type}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Control Validation (shown after sterilization step) */}
            {scannedBox.current_step === 'sterilization' && (
              <div className="space-y-2">
                <Label>Résultat du contrôle</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={validationResult === 'passed' ? 'default' : 'outline'}
                    className={validationResult === 'passed' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                    onClick={() => setValidationResult('passed')}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Conforme
                  </Button>
                  <Button
                    type="button"
                    variant={validationResult === 'failed' ? 'destructive' : 'outline'}
                    onClick={() => setValidationResult('failed')}
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Non conforme
                  </Button>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observations, remarques..."
                className="h-20"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setScannedBox(null);
                  setScanCode('');
                  setValidationResult(null);
                  setNotes('');
                }}
                disabled={isProcessing}
              >
                Annuler
              </Button>
              
              {scannedBox.current_step === 'distribution' ? (
                <Button
                  onClick={handleResetBox}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Package className="w-4 h-4 mr-2" />
                  )}
                  Réceptionner (nouveau cycle)
                </Button>
              ) : (
                <Button
                  onClick={handleAdvanceStep}
                  disabled={isProcessing || (scannedBox.current_step === 'sterilization' && !validationResult)}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="w-4 h-4 mr-2" />
                  )}
                  Passer à: {STEP_LABELS[getNextStep(scannedBox.current_step)].label}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkflowPanel;
