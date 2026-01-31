import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Box, 
  Wrench, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Loader2,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Droplets,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type SterilizationStatus = 'dirty' | 'cleaning' | 'ready_for_sterilization' | 'sterilizing' | 'sterile' | 'in_use';

interface InstrumentBox {
  id: string;
  name: string;
  box_code: string;
  description: string | null;
  status: SterilizationStatus;
  last_sterilized_at: string | null;
  next_sterilization_due: string | null;
  is_active: boolean;
  created_at: string;
}

interface Instrument {
  id: string;
  name: string;
  instrument_code: string;
  description: string | null;
  box_id: string | null;
  status: SterilizationStatus;
  condition: string;
  is_active: boolean;
  created_at: string;
  box?: InstrumentBox | null;
}

interface SterilizationCycle {
  id: string;
  cycle_number: number;
  machine_id: string | null;
  started_at: string;
  completed_at: string | null;
  temperature: number | null;
  pressure: number | null;
  duration_minutes: number | null;
  status: string;
  operator_id: string;
  notes: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<SterilizationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  dirty: { label: 'Sale', color: 'bg-destructive/10 text-destructive', icon: <AlertCircle className="w-3 h-3" /> },
  cleaning: { label: 'Nettoyage', color: 'bg-info/10 text-info', icon: <Droplets className="w-3 h-3" /> },
  ready_for_sterilization: { label: 'Prêt', color: 'bg-warning/10 text-warning', icon: <Clock className="w-3 h-3" /> },
  sterilizing: { label: 'En cours', color: 'bg-primary/10 text-primary', icon: <Zap className="w-3 h-3" /> },
  sterile: { label: 'Stérile', color: 'bg-success/10 text-success', icon: <CheckCircle2 className="w-3 h-3" /> },
  in_use: { label: 'En utilisation', color: 'bg-muted text-muted-foreground', icon: <Wrench className="w-3 h-3" /> },
};

const SterilizationPage = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [boxes, setBoxes] = useState<InstrumentBox[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [cycles, setCycles] = useState<SterilizationCycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('boxes');
  
  // Dialogs
  const [showBoxDialog, setShowBoxDialog] = useState(false);
  const [showInstrumentDialog, setShowInstrumentDialog] = useState(false);
  const [showCycleDialog, setShowCycleDialog] = useState(false);
  const [editingBox, setEditingBox] = useState<InstrumentBox | null>(null);
  const [editingInstrument, setEditingInstrument] = useState<Instrument | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form data
  const [boxForm, setBoxForm] = useState({ name: '', boxCode: '', description: '' });
  const [instrumentForm, setInstrumentForm] = useState({ 
    name: '', instrumentCode: '', description: '', boxId: '', condition: 'good' 
  });
  const [cycleForm, setCycleForm] = useState({
    machineId: '',
    temperature: '',
    pressure: '',
    durationMinutes: '',
    notes: '',
    selectedBoxes: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [boxesRes, instrumentsRes, cyclesRes] = await Promise.all([
        supabase.from('instrument_boxes').select('*').eq('is_active', true).order('name'),
        supabase.from('instruments').select('*, box:instrument_boxes(*)').eq('is_active', true).order('name'),
        supabase.from('sterilization_cycles').select('*').order('created_at', { ascending: false }).limit(50),
      ]);

      if (boxesRes.error) throw boxesRes.error;
      if (instrumentsRes.error) throw instrumentsRes.error;
      if (cyclesRes.error) throw cyclesRes.error;

      setBoxes((boxesRes.data as unknown as InstrumentBox[]) || []);
      setInstruments((instrumentsRes.data as unknown as Instrument[]) || []);
      setCycles((cyclesRes.data as unknown as SterilizationCycle[]) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Box handlers
  const handleOpenBoxDialog = (box?: InstrumentBox) => {
    if (box) {
      setEditingBox(box);
      setBoxForm({ name: box.name, boxCode: box.box_code, description: box.description || '' });
    } else {
      setEditingBox(null);
      setBoxForm({ name: '', boxCode: '', description: '' });
    }
    setShowBoxDialog(true);
  };

  const handleSaveBox = async () => {
    if (!boxForm.name.trim() || !boxForm.boxCode.trim()) {
      toast({ title: 'Erreur', description: 'Nom et code requis', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const data = {
        name: boxForm.name.trim(),
        box_code: boxForm.boxCode.trim(),
        description: boxForm.description.trim() || null,
      };

      if (editingBox) {
        const { error } = await supabase.from('instrument_boxes').update(data).eq('id', editingBox.id);
        if (error) throw error;
        toast({ title: 'Boîte mise à jour' });
      } else {
        const { error } = await supabase.from('instrument_boxes').insert(data);
        if (error) throw error;
        toast({ title: 'Boîte créée' });
      }

      setShowBoxDialog(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBox = async (box: InstrumentBox) => {
    if (!confirm(`Supprimer la boîte "${box.name}" ?`)) return;
    try {
      const { error } = await supabase.from('instrument_boxes').update({ is_active: false }).eq('id', box.id);
      if (error) throw error;
      toast({ title: 'Boîte supprimée' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  const handleUpdateBoxStatus = async (box: InstrumentBox, newStatus: SterilizationStatus) => {
    try {
      const updates: Partial<InstrumentBox> = { status: newStatus };
      if (newStatus === 'sterile') {
        updates.last_sterilized_at = new Date().toISOString();
      }

      const { error } = await supabase.from('instrument_boxes').update(updates).eq('id', box.id);
      if (error) throw error;

      // Log movement
      if (user) {
        await supabase.from('instrument_movements').insert({
          box_id: box.id,
          action: 'status_change',
          from_status: box.status,
          to_status: newStatus,
          performed_by: user.id,
        });
      }

      toast({ title: 'Statut mis à jour' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  // Instrument handlers
  const handleOpenInstrumentDialog = (instrument?: Instrument) => {
    if (instrument) {
      setEditingInstrument(instrument);
      setInstrumentForm({
        name: instrument.name,
        instrumentCode: instrument.instrument_code,
        description: instrument.description || '',
        boxId: instrument.box_id || '',
        condition: instrument.condition || 'good',
      });
    } else {
      setEditingInstrument(null);
      setInstrumentForm({ name: '', instrumentCode: '', description: '', boxId: '', condition: 'good' });
    }
    setShowInstrumentDialog(true);
  };

  const handleSaveInstrument = async () => {
    if (!instrumentForm.name.trim() || !instrumentForm.instrumentCode.trim()) {
      toast({ title: 'Erreur', description: 'Nom et code requis', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const data = {
        name: instrumentForm.name.trim(),
        instrument_code: instrumentForm.instrumentCode.trim(),
        description: instrumentForm.description.trim() || null,
        box_id: instrumentForm.boxId || null,
        condition: instrumentForm.condition,
      };

      if (editingInstrument) {
        const { error } = await supabase.from('instruments').update(data).eq('id', editingInstrument.id);
        if (error) throw error;
        toast({ title: 'Instrument mis à jour' });
      } else {
        const { error } = await supabase.from('instruments').insert(data);
        if (error) throw error;
        toast({ title: 'Instrument créé' });
      }

      setShowInstrumentDialog(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Cycle handlers
  const handleStartCycle = async () => {
    if (cycleForm.selectedBoxes.length === 0) {
      toast({ title: 'Erreur', description: 'Sélectionnez au moins une boîte', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      // Get next cycle number
      const { data: maxCycle } = await supabase
        .from('sterilization_cycles')
        .select('cycle_number')
        .order('cycle_number', { ascending: false })
        .limit(1);
      
      const nextCycleNumber = (maxCycle?.[0]?.cycle_number || 0) + 1;

      const { data: cycle, error: cycleError } = await supabase.from('sterilization_cycles').insert({
        cycle_number: nextCycleNumber,
        machine_id: cycleForm.machineId || null,
        temperature: cycleForm.temperature ? parseFloat(cycleForm.temperature) : null,
        pressure: cycleForm.pressure ? parseFloat(cycleForm.pressure) : null,
        duration_minutes: cycleForm.durationMinutes ? parseInt(cycleForm.durationMinutes) : null,
        notes: cycleForm.notes || null,
        operator_id: user!.id,
        status: 'in_progress',
      }).select().single();

      if (cycleError) throw cycleError;

      // Link boxes to cycle
      const cycleBoxes = cycleForm.selectedBoxes.map(boxId => ({
        cycle_id: cycle.id,
        box_id: boxId,
      }));

      const { error: linkError } = await supabase.from('sterilization_cycle_boxes').insert(cycleBoxes);
      if (linkError) throw linkError;

      // Update box statuses
      await supabase
        .from('instrument_boxes')
        .update({ status: 'sterilizing' })
        .in('id', cycleForm.selectedBoxes);

      toast({ title: 'Cycle démarré', description: `Cycle #${nextCycleNumber}` });
      setShowCycleDialog(false);
      setCycleForm({ machineId: '', temperature: '', pressure: '', durationMinutes: '', notes: '', selectedBoxes: [] });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteCycle = async (cycle: SterilizationCycle) => {
    try {
      // Update cycle
      const { error: cycleError } = await supabase
        .from('sterilization_cycles')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', cycle.id);
      if (cycleError) throw cycleError;

      // Get boxes in cycle
      const { data: cycleBoxes } = await supabase
        .from('sterilization_cycle_boxes')
        .select('box_id')
        .eq('cycle_id', cycle.id);

      if (cycleBoxes && cycleBoxes.length > 0) {
        const boxIds = cycleBoxes.map(cb => cb.box_id);
        await supabase
          .from('instrument_boxes')
          .update({ status: 'sterile', last_sterilized_at: new Date().toISOString() })
          .in('id', boxIds);
      }

      toast({ title: 'Cycle terminé', description: 'Les boîtes sont maintenant stériles.' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  // Filters
  const filteredBoxes = boxes.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.box_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredInstruments = instruments.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.instrument_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const readyBoxes = boxes.filter(b => b.status === 'ready_for_sterilization');

  return (
    <AppLayout requireAdmin>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Thermometer className="w-7 h-7 text-primary" />
              Gestion de la Stérilisation
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérez les instruments, boîtes et cycles de stérilisation
            </p>
          </div>
          {readyBoxes.length > 0 && (
            <Button onClick={() => setShowCycleDialog(true)} className="gap-2">
              <Play className="w-4 h-4" />
              Démarrer un cycle ({readyBoxes.length} prêtes)
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="card-stats">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="boxes" className="gap-2">
              <Box className="w-4 h-4" /> Boîtes
            </TabsTrigger>
            <TabsTrigger value="instruments" className="gap-2">
              <Wrench className="w-4 h-4" /> Instruments
            </TabsTrigger>
            <TabsTrigger value="cycles" className="gap-2">
              <Thermometer className="w-4 h-4" /> Cycles
            </TabsTrigger>
          </TabsList>

          {/* Boxes Tab */}
          <TabsContent value="boxes" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button onClick={() => handleOpenBoxDialog()} className="gap-2">
                <Plus className="w-4 h-4" /> Nouvelle boîte
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-8">Chargement...</div>
            ) : filteredBoxes.length === 0 ? (
              <div className="card-stats text-center py-12">
                <Box className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">Aucune boîte d'instruments</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBoxes.map(box => {
                  const statusInfo = STATUS_LABELS[box.status];
                  return (
                    <div key={box.id} className="card-stats">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{box.name}</h3>
                          <p className="text-xs text-muted-foreground">{box.box_code}</p>
                        </div>
                        <span className={`status-badge ${statusInfo.color} gap-1`}>
                          {statusInfo.icon}
                          {statusInfo.label}
                        </span>
                      </div>

                      {box.description && (
                        <p className="text-sm text-muted-foreground mb-3">{box.description}</p>
                      )}

                      {box.last_sterilized_at && (
                        <p className="text-xs text-muted-foreground mb-3">
                          Dernière stérilisation: {format(new Date(box.last_sterilized_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t">
                        <Select
                          value={box.status}
                          onValueChange={(v: SterilizationStatus) => handleUpdateBoxStatus(box, v)}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dirty">Sale</SelectItem>
                            <SelectItem value="cleaning">Nettoyage</SelectItem>
                            <SelectItem value="ready_for_sterilization">Prêt</SelectItem>
                            <SelectItem value="sterile">Stérile</SelectItem>
                            <SelectItem value="in_use">En utilisation</SelectItem>
                          </SelectContent>
                        </Select>

                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenBoxDialog(box)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteBox(box)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Instruments Tab */}
          <TabsContent value="instruments" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button onClick={() => handleOpenInstrumentDialog()} className="gap-2">
                <Plus className="w-4 h-4" /> Nouvel instrument
              </Button>
            </div>

            {filteredInstruments.length === 0 ? (
              <div className="card-stats text-center py-12">
                <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">Aucun instrument</p>
              </div>
            ) : (
              <div className="card-stats overflow-hidden p-0">
                <table className="table-medical">
                  <thead>
                    <tr>
                      <th>Instrument</th>
                      <th>Code</th>
                      <th>Boîte</th>
                      <th>État</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInstruments.map(instrument => {
                      const statusInfo = STATUS_LABELS[instrument.status];
                      return (
                        <tr key={instrument.id}>
                          <td className="font-medium">{instrument.name}</td>
                          <td className="text-muted-foreground">{instrument.instrument_code}</td>
                          <td>{instrument.box?.name || '-'}</td>
                          <td className="capitalize">{instrument.condition}</td>
                          <td>
                            <span className={`status-badge ${statusInfo.color} gap-1`}>
                              {statusInfo.icon}
                              {statusInfo.label}
                            </span>
                          </td>
                          <td>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleOpenInstrumentDialog(instrument)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Cycles Tab */}
          <TabsContent value="cycles" className="mt-4">
            {cycles.length === 0 ? (
              <div className="card-stats text-center py-12">
                <Thermometer className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">Aucun cycle de stérilisation</p>
              </div>
            ) : (
              <div className="card-stats overflow-hidden p-0">
                <table className="table-medical">
                  <thead>
                    <tr>
                      <th>Cycle</th>
                      <th>Machine</th>
                      <th>Température</th>
                      <th>Durée</th>
                      <th>Statut</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cycles.map(cycle => (
                      <tr key={cycle.id}>
                        <td className="font-medium">#{cycle.cycle_number}</td>
                        <td>{cycle.machine_id || '-'}</td>
                        <td>{cycle.temperature ? `${cycle.temperature}°C` : '-'}</td>
                        <td>{cycle.duration_minutes ? `${cycle.duration_minutes} min` : '-'}</td>
                        <td>
                          <span className={`status-badge ${
                            cycle.status === 'completed' ? 'status-badge-success' : 'status-badge-warning'
                          }`}>
                            {cycle.status === 'completed' ? 'Terminé' : 'En cours'}
                          </span>
                        </td>
                        <td>{format(new Date(cycle.started_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</td>
                        <td>
                          {cycle.status === 'in_progress' && (
                            <Button size="sm" onClick={() => handleCompleteCycle(cycle)} className="gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Terminer
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Box Dialog */}
      <Dialog open={showBoxDialog} onOpenChange={setShowBoxDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingBox ? 'Modifier la boîte' : 'Nouvelle boîte'}</DialogTitle>
            <DialogDescription>
              Entrez les informations de la boîte d'instruments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                value={boxForm.name}
                onChange={(e) => setBoxForm({ ...boxForm, name: e.target.value })}
                placeholder="Ex: Boîte Chirurgie A"
              />
            </div>
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input
                value={boxForm.boxCode}
                onChange={(e) => setBoxForm({ ...boxForm, boxCode: e.target.value })}
                placeholder="Ex: CHIR-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={boxForm.description}
                onChange={(e) => setBoxForm({ ...boxForm, description: e.target.value })}
                placeholder="Description optionnelle..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBoxDialog(false)}>Annuler</Button>
            <Button onClick={handleSaveBox} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingBox ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Instrument Dialog */}
      <Dialog open={showInstrumentDialog} onOpenChange={setShowInstrumentDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingInstrument ? 'Modifier l\'instrument' : 'Nouvel instrument'}</DialogTitle>
            <DialogDescription>
              Entrez les informations de l'instrument.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                value={instrumentForm.name}
                onChange={(e) => setInstrumentForm({ ...instrumentForm, name: e.target.value })}
                placeholder="Ex: Pince hémostatique"
              />
            </div>
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input
                value={instrumentForm.instrumentCode}
                onChange={(e) => setInstrumentForm({ ...instrumentForm, instrumentCode: e.target.value })}
                placeholder="Ex: PINCE-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Boîte d'appartenance</Label>
              <Select
                value={instrumentForm.boxId}
                onValueChange={(v) => setInstrumentForm({ ...instrumentForm, boxId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucune boîte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucune boîte</SelectItem>
                  {boxes.map(box => (
                    <SelectItem key={box.id} value={box.id}>{box.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>État</Label>
              <Select
                value={instrumentForm.condition}
                onValueChange={(v) => setInstrumentForm({ ...instrumentForm, condition: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Bon état</SelectItem>
                  <SelectItem value="worn">Usé</SelectItem>
                  <SelectItem value="damaged">Endommagé</SelectItem>
                  <SelectItem value="needs_repair">À réparer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={instrumentForm.description}
                onChange={(e) => setInstrumentForm({ ...instrumentForm, description: e.target.value })}
                placeholder="Description optionnelle..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInstrumentDialog(false)}>Annuler</Button>
            <Button onClick={handleSaveInstrument} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingInstrument ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cycle Dialog */}
      <Dialog open={showCycleDialog} onOpenChange={setShowCycleDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Démarrer un cycle de stérilisation</DialogTitle>
            <DialogDescription>
              Sélectionnez les boîtes à stériliser et entrez les paramètres.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Boîtes à stériliser *</Label>
              <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                {readyBoxes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune boîte prête pour la stérilisation</p>
                ) : (
                  readyBoxes.map(box => (
                    <label key={box.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cycleForm.selectedBoxes.includes(box.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCycleForm({ ...cycleForm, selectedBoxes: [...cycleForm.selectedBoxes, box.id] });
                          } else {
                            setCycleForm({ ...cycleForm, selectedBoxes: cycleForm.selectedBoxes.filter(id => id !== box.id) });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{box.name} ({box.box_code})</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Machine</Label>
                <Input
                  value={cycleForm.machineId}
                  onChange={(e) => setCycleForm({ ...cycleForm, machineId: e.target.value })}
                  placeholder="Ex: Autoclave-01"
                />
              </div>
              <div className="space-y-2">
                <Label>Durée (min)</Label>
                <Input
                  type="number"
                  value={cycleForm.durationMinutes}
                  onChange={(e) => setCycleForm({ ...cycleForm, durationMinutes: e.target.value })}
                  placeholder="Ex: 20"
                />
              </div>
              <div className="space-y-2">
                <Label>Température (°C)</Label>
                <Input
                  type="number"
                  value={cycleForm.temperature}
                  onChange={(e) => setCycleForm({ ...cycleForm, temperature: e.target.value })}
                  placeholder="Ex: 134"
                />
              </div>
              <div className="space-y-2">
                <Label>Pression (bar)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={cycleForm.pressure}
                  onChange={(e) => setCycleForm({ ...cycleForm, pressure: e.target.value })}
                  placeholder="Ex: 2.1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={cycleForm.notes}
                onChange={(e) => setCycleForm({ ...cycleForm, notes: e.target.value })}
                placeholder="Notes optionnelles..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCycleDialog(false)}>Annuler</Button>
            <Button onClick={handleStartCycle} disabled={isSaving || cycleForm.selectedBoxes.length === 0}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Play className="w-4 h-4 mr-2" />
              Démarrer le cycle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default SterilizationPage;
