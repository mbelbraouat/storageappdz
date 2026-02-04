import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Thermometer, 
  Plus, 
  Loader2,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Box,
  Gauge,
  Timer,
  Calendar
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SterilizationCycle {
  id: string;
  cycle_number: number;
  status: string;
  machine_id: string | null;
  temperature: number | null;
  pressure: number | null;
  duration_minutes: number | null;
  operator_id: string;
  operator_name?: string;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  boxes_count?: number;
}

interface InstrumentBox {
  id: string;
  name: string;
  box_code: string;
  status: string;
  current_step: string | null;
}

const SterilizationCycles = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [cycles, setCycles] = useState<SterilizationCycle[]>([]);
  const [availableBoxes, setAvailableBoxes] = useState<InstrumentBox[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewCycleDialog, setShowNewCycleDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // New cycle form
  const [cycleForm, setCycleForm] = useState({
    machineId: '',
    temperature: 134,
    pressure: 2.1,
    durationMinutes: 18,
    notes: '',
    selectedBoxes: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch cycles with operator info
      const { data: cyclesData, error: cyclesError } = await supabase
        .from('sterilization_cycles')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (cyclesError) throw cyclesError;

      // Get operator names
      if (cyclesData && cyclesData.length > 0) {
        const operatorIds = [...new Set(cyclesData.map(c => c.operator_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', operatorIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

        // Get box counts for each cycle
        const { data: cycleBoxes } = await supabase
          .from('sterilization_cycle_boxes')
          .select('cycle_id');

        const boxCountMap = new Map<string, number>();
        cycleBoxes?.forEach(cb => {
          boxCountMap.set(cb.cycle_id, (boxCountMap.get(cb.cycle_id) || 0) + 1);
        });

        setCycles(cyclesData.map(c => ({
          ...c,
          operator_name: profileMap.get(c.operator_id) || 'Inconnu',
          boxes_count: boxCountMap.get(c.id) || 0,
        })));
      } else {
        setCycles([]);
      }

      // Fetch available boxes for new cycle (conditioning step)
      const { data: boxes } = await supabase
        .from('instrument_boxes')
        .select('id, name, box_code, status, current_step')
        .eq('is_active', true)
        .eq('current_step', 'conditioning');

      setAvailableBoxes(boxes || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCycle = async () => {
    if (cycleForm.selectedBoxes.length === 0) {
      toast({ title: 'Erreur', description: 'Sélectionnez au moins une boîte', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      // Get next cycle number
      const { data: lastCycle } = await supabase
        .from('sterilization_cycles')
        .select('cycle_number')
        .order('cycle_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextCycleNumber = (lastCycle?.cycle_number || 0) + 1;

      // Create cycle
      const { data: newCycle, error: cycleError } = await supabase
        .from('sterilization_cycles')
        .insert({
          cycle_number: nextCycleNumber,
          operator_id: user!.id,
          machine_id: cycleForm.machineId || null,
          temperature: cycleForm.temperature,
          pressure: cycleForm.pressure,
          duration_minutes: cycleForm.durationMinutes,
          notes: cycleForm.notes || null,
          status: 'in_progress',
        })
        .select()
        .single();

      if (cycleError) throw cycleError;

      // Add boxes to cycle
      const boxInserts = cycleForm.selectedBoxes.map(boxId => ({
        cycle_id: newCycle.id,
        box_id: boxId,
      }));

      const { error: boxesError } = await supabase
        .from('sterilization_cycle_boxes')
        .insert(boxInserts);

      if (boxesError) throw boxesError;

      // Update boxes status
      const { error: updateError } = await supabase
        .from('instrument_boxes')
        .update({ 
          current_step: 'sterilization',
          status: 'sterilizing',
        })
        .in('id', cycleForm.selectedBoxes);

      if (updateError) throw updateError;

      toast({ title: 'Cycle démarré', description: `Cycle #${nextCycleNumber} lancé avec ${cycleForm.selectedBoxes.length} boîte(s)` });
      setShowNewCycleDialog(false);
      setCycleForm({
        machineId: '',
        temperature: 134,
        pressure: 2.1,
        durationMinutes: 18,
        notes: '',
        selectedBoxes: [],
      });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteCycle = async (cycle: SterilizationCycle, success: boolean) => {
    try {
      const { error: cycleError } = await supabase
        .from('sterilization_cycles')
        .update({
          status: success ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', cycle.id);

      if (cycleError) throw cycleError;

      // Get boxes in this cycle
      const { data: cycleBoxes } = await supabase
        .from('sterilization_cycle_boxes')
        .select('box_id')
        .eq('cycle_id', cycle.id);

      if (cycleBoxes && cycleBoxes.length > 0) {
        const boxIds = cycleBoxes.map(cb => cb.box_id);

        // Update boxes based on success/failure
        const { error: boxesError } = await supabase
          .from('instrument_boxes')
          .update({ 
            current_step: success ? 'control' : 'reception',
            status: success ? 'ready_for_sterilization' : 'dirty',
            last_sterilized_at: success ? new Date().toISOString() : null,
          })
          .in('id', boxIds);

        if (boxesError) throw boxesError;

        // Update cycle boxes result
        await supabase
          .from('sterilization_cycle_boxes')
          .update({ result: success ? 'passed' : 'failed' })
          .eq('cycle_id', cycle.id);
      }

      toast({ 
        title: success ? 'Cycle terminé' : 'Cycle échoué',
        description: success ? 'Les boîtes passent au contrôle' : 'Les boîtes retournent en réception',
        variant: success ? 'default' : 'destructive',
      });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  const toggleBoxSelection = (boxId: string) => {
    setCycleForm(prev => ({
      ...prev,
      selectedBoxes: prev.selectedBoxes.includes(boxId)
        ? prev.selectedBoxes.filter(id => id !== boxId)
        : [...prev.selectedBoxes, boxId],
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30"><Clock className="w-3 h-3 mr-1" /> En cours</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Terminé</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30"><XCircle className="w-3 h-3 mr-1" /> Échoué</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Thermometer className="w-7 h-7 text-primary" />
              Cycles de Stérilisation
            </h1>
            <p className="text-muted-foreground mt-1">
              Suivi des cycles autoclave avec paramètres et traçabilité
            </p>
          </div>
          <Button onClick={() => setShowNewCycleDialog(true)} className="gap-2" disabled={availableBoxes.length === 0}>
            <Plus className="w-4 h-4" />
            Nouveau cycle
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Play className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{cycles.filter(c => c.status === 'in_progress').length}</p>
                  <p className="text-xs text-muted-foreground">En cours</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{cycles.filter(c => c.status === 'completed').length}</p>
                  <p className="text-xs text-muted-foreground">Terminés</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{cycles.filter(c => c.status === 'failed').length}</p>
                  <p className="text-xs text-muted-foreground">Échoués</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Box className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{availableBoxes.length}</p>
                  <p className="text-xs text-muted-foreground">Boîtes prêtes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cycles List */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des cycles</CardTitle>
            <CardDescription>Derniers cycles de stérilisation effectués</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </div>
            ) : cycles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Thermometer className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucun cycle de stérilisation</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cycles.map(cycle => (
                  <div 
                    key={cycle.id} 
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary">
                        #{cycle.cycle_number}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusBadge(cycle.status)}
                          <span className="text-sm text-muted-foreground">
                            {cycle.boxes_count} boîte(s)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {cycle.temperature && (
                            <span className="flex items-center gap-1">
                              <Thermometer className="w-3 h-3" /> {cycle.temperature}°C
                            </span>
                          )}
                          {cycle.pressure && (
                            <span className="flex items-center gap-1">
                              <Gauge className="w-3 h-3" /> {cycle.pressure} bar
                            </span>
                          )}
                          {cycle.duration_minutes && (
                            <span className="flex items-center gap-1">
                              <Timer className="w-3 h-3" /> {cycle.duration_minutes} min
                            </span>
                          )}
                          {cycle.machine_id && (
                            <span>Machine: {cycle.machine_id}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        <p className="flex items-center gap-1 justify-end">
                          <User className="w-3 h-3" /> {cycle.operator_name}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(cycle.started_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                        </p>
                      </div>
                      {cycle.status === 'in_progress' && (
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                            onClick={() => handleCompleteCycle(cycle, true)}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Succès
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-destructive border-destructive hover:bg-destructive/10"
                            onClick={() => handleCompleteCycle(cycle, false)}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Échec
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* New Cycle Dialog */}
        <Dialog open={showNewCycleDialog} onOpenChange={setShowNewCycleDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouveau cycle de stérilisation</DialogTitle>
              <DialogDescription>
                Configurez les paramètres et sélectionnez les boîtes à stériliser
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Température (°C)</Label>
                  <Input
                    type="number"
                    value={cycleForm.temperature}
                    onChange={(e) => setCycleForm({ ...cycleForm, temperature: parseInt(e.target.value) || 134 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pression (bar)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={cycleForm.pressure}
                    onChange={(e) => setCycleForm({ ...cycleForm, pressure: parseFloat(e.target.value) || 2.1 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Durée (minutes)</Label>
                  <Input
                    type="number"
                    value={cycleForm.durationMinutes}
                    onChange={(e) => setCycleForm({ ...cycleForm, durationMinutes: parseInt(e.target.value) || 18 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ID Machine (optionnel)</Label>
                  <Input
                    value={cycleForm.machineId}
                    onChange={(e) => setCycleForm({ ...cycleForm, machineId: e.target.value })}
                    placeholder="Ex: AUTOCLAVE-01"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={cycleForm.notes}
                  onChange={(e) => setCycleForm({ ...cycleForm, notes: e.target.value })}
                  placeholder="Notes sur le cycle..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Boîtes à stériliser ({cycleForm.selectedBoxes.length} sélectionnée(s))</Label>
                {availableBoxes.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Aucune boîte prête pour la stérilisation (étape conditionnement requise)
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                    {availableBoxes.map(box => (
                      <div
                        key={box.id}
                        onClick={() => toggleBoxSelection(box.id)}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          cycleForm.selectedBoxes.includes(box.id)
                            ? 'bg-primary/10 border border-primary/30'
                            : 'bg-muted/30 hover:bg-muted/50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          cycleForm.selectedBoxes.includes(box.id)
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-muted-foreground/30'
                        }`}>
                          {cycleForm.selectedBoxes.includes(box.id) && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{box.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{box.box_code}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewCycleDialog(false)} disabled={isSaving}>
                Annuler
              </Button>
              <Button 
                onClick={handleStartCycle} 
                disabled={isSaving || cycleForm.selectedBoxes.length === 0}
                className="gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Démarrer le cycle
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default SterilizationCycles;
