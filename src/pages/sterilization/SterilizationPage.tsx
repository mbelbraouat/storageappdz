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
  Search,
  Loader2,
  ScanLine,
  Building2,
  BarChart3,
  QrCode
} from 'lucide-react';
import BoxCard, { 
  type InstrumentBox, 
  type SterilizationStatus, 
  type SterilizationType,
  STATUS_LABELS,
  STERILIZATION_TYPES
} from '@/components/sterilization/BoxCard';
import WorkflowPanel from '@/components/sterilization/WorkflowPanel';
import AssignmentPanel from '@/components/sterilization/AssignmentPanel';
import StockOverview from '@/components/sterilization/StockOverview';
import QRCodeGenerator from '@/components/boxes/QRCodeGenerator';

interface Instrument {
  id: string;
  name: string;
  instrument_code: string;
  description: string | null;
  box_id: string | null;
  status: SterilizationStatus;
  condition: string;
  is_active: boolean;
}

interface Service {
  id: string;
  name: string;
  code: string;
}

const SterilizationPage = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [boxes, setBoxes] = useState<InstrumentBox[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('workflow');
  const [statusFilter, setStatusFilter] = useState<SterilizationStatus | 'all'>('all');
  
  // Dialogs
  const [showBoxDialog, setShowBoxDialog] = useState(false);
  const [showInstrumentDialog, setShowInstrumentDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [editingBox, setEditingBox] = useState<InstrumentBox | null>(null);
  const [editingInstrument, setEditingInstrument] = useState<Instrument | null>(null);
  const [selectedBoxForQR, setSelectedBoxForQR] = useState<InstrumentBox | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form data
  const [boxForm, setBoxForm] = useState({ 
    name: '', 
    boxCode: '', 
    description: '',
    serviceId: '',
    sterilizationType: 'vapeur' as SterilizationType
  });
  const [instrumentForm, setInstrumentForm] = useState({ 
    name: '', instrumentCode: '', description: '', boxId: '', condition: 'good' 
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [boxesRes, instrumentsRes, servicesRes] = await Promise.all([
        supabase
          .from('instrument_boxes')
          .select('*, service:services!instrument_boxes_service_id_fkey(name, code), assigned_service:services!instrument_boxes_assigned_service_id_fkey(name, code)')
          .eq('is_active', true)
          .order('name'),
        supabase.from('instruments').select('*').eq('is_active', true).order('name'),
        supabase.from('services').select('*').eq('is_active', true).order('name'),
      ]);

      if (boxesRes.error) throw boxesRes.error;
      if (instrumentsRes.error) throw instrumentsRes.error;
      if (servicesRes.error) throw servicesRes.error;

      setBoxes((boxesRes.data as unknown as InstrumentBox[]) || []);
      setInstruments((instrumentsRes.data as unknown as Instrument[]) || []);
      setServices(servicesRes.data || []);
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
      setBoxForm({ 
        name: box.name, 
        boxCode: box.box_code, 
        description: box.description || '',
        serviceId: box.service_id || '',
        sterilizationType: box.sterilization_type || 'vapeur'
      });
    } else {
      setEditingBox(null);
      setBoxForm({ name: '', boxCode: '', description: '', serviceId: '', sterilizationType: 'vapeur' });
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
        service_id: boxForm.serviceId || null,
        sterilization_type: boxForm.sterilizationType,
      };

      if (editingBox) {
        const { error } = await supabase.from('instrument_boxes').update(data).eq('id', editingBox.id);
        if (error) throw error;
        toast({ title: 'Boîte mise à jour' });
      } else {
        const { error } = await supabase.from('instrument_boxes').insert({
          ...data,
          current_step: 'reception',
          status: 'dirty',
        });
        if (error) throw error;
        toast({ title: 'Boîte créée', description: 'N\'oubliez pas de générer le code-barres' });
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
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'sterile') {
        updates.last_sterilized_at = new Date().toISOString();
        updates.current_step = 'storage';
      }
      if (newStatus === 'dirty') {
        updates.current_step = 'reception';
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

  const handleShowQR = (box: InstrumentBox) => {
    setSelectedBoxForQR(box);
    setShowQRDialog(true);
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

  // Filters
  const filteredBoxes = boxes.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.box_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sterileBoxes = boxes.filter(b => b.status === 'sterile' && !b.assigned_service_id);

  const getInstrumentCount = (boxId: string) => 
    instruments.filter(i => i.box_id === boxId).length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Thermometer className="w-7 h-7 text-primary" />
              Stérilisation
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestion du workflow de stérilisation des instruments
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenInstrumentDialog()} className="gap-2">
              <Wrench className="w-4 h-4" />
              <span className="hidden sm:inline">Nouvel instrument</span>
            </Button>
            <Button onClick={() => handleOpenBoxDialog()} className="gap-2">
              <Plus className="w-4 h-4" />
              Nouvelle boîte
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="workflow" className="gap-2">
              <ScanLine className="w-4 h-4" /> Workflow
            </TabsTrigger>
            <TabsTrigger value="stock" className="gap-2">
              <BarChart3 className="w-4 h-4" /> Stock
            </TabsTrigger>
            <TabsTrigger value="boxes" className="gap-2">
              <Box className="w-4 h-4" /> Boîtes
            </TabsTrigger>
            <TabsTrigger value="assignments" className="gap-2">
              <Building2 className="w-4 h-4" /> Affectations
            </TabsTrigger>
          </TabsList>

          {/* Workflow Tab */}
          <TabsContent value="workflow" className="mt-6">
            <WorkflowPanel onBoxProcessed={fetchData} />
          </TabsContent>

          {/* Stock Tab */}
          <TabsContent value="stock" className="mt-6">
            <StockOverview boxes={boxes} />
          </TabsContent>

          {/* Boxes Tab */}
          <TabsContent value="boxes" className="mt-4">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une boîte..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SterilizationStatus | 'all')}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([status, info]) => (
                    <SelectItem key={status} value={status}>
                      <span className="flex items-center gap-2">
                        {info.icon} {info.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </div>
            ) : filteredBoxes.length === 0 ? (
              <div className="bg-card border rounded-lg text-center py-12">
                <Box className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">Aucune boîte d'instruments</p>
                <Button variant="outline" className="mt-4" onClick={() => handleOpenBoxDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer une boîte
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBoxes.map(box => (
                  <BoxCard
                    key={box.id}
                    box={box}
                    isAdmin={isAdmin}
                    onEdit={handleOpenBoxDialog}
                    onDelete={handleDeleteBox}
                    onStatusChange={handleUpdateBoxStatus}
                    onShowQR={handleShowQR}
                    instrumentCount={getInstrumentCount(box.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="mt-6">
            <AssignmentPanel 
              sterileBoxes={sterileBoxes} 
              onAssignmentChange={fetchData} 
            />
          </TabsContent>
        </Tabs>

        {/* Box Dialog */}
        <Dialog open={showBoxDialog} onOpenChange={setShowBoxDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingBox ? 'Modifier la boîte' : 'Nouvelle boîte d\'instruments'}</DialogTitle>
              <DialogDescription>
                {editingBox ? 'Modifiez les informations' : 'Créez une nouvelle boîte pour la stérilisation'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nom de la boîte *</Label>
                <Input
                  value={boxForm.name}
                  onChange={(e) => setBoxForm({ ...boxForm, name: e.target.value })}
                  placeholder="Ex: Boîte Chirurgie Générale"
                />
              </div>
              <div className="space-y-2">
                <Label>Code boîte * (pour scan)</Label>
                <Input
                  value={boxForm.boxCode}
                  onChange={(e) => setBoxForm({ ...boxForm, boxCode: e.target.value.toUpperCase() })}
                  placeholder="Ex: BOX-001"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Service d'appartenance</Label>
                <Select 
                  value={boxForm.serviceId || 'none'} 
                  onValueChange={(v) => setBoxForm({ ...boxForm, serviceId: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} ({service.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type de stérilisation par défaut</Label>
                <Select 
                  value={boxForm.sterilizationType} 
                  onValueChange={(v) => setBoxForm({ ...boxForm, sterilizationType: v as SterilizationType })}
                >
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
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={boxForm.description}
                  onChange={(e) => setBoxForm({ ...boxForm, description: e.target.value })}
                  placeholder="Contenu, usage..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBoxDialog(false)}>Annuler</Button>
              <Button onClick={handleSaveBox} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingBox ? 'Mettre à jour' : 'Créer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Instrument Dialog */}
        <Dialog open={showInstrumentDialog} onOpenChange={setShowInstrumentDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingInstrument ? 'Modifier l\'instrument' : 'Nouvel instrument'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input
                  value={instrumentForm.name}
                  onChange={(e) => setInstrumentForm({ ...instrumentForm, name: e.target.value })}
                  placeholder="Ex: Pince hémostatique"
                />
              </div>
              <div className="space-y-2">
                <Label>Code instrument *</Label>
                <Input
                  value={instrumentForm.instrumentCode}
                  onChange={(e) => setInstrumentForm({ ...instrumentForm, instrumentCode: e.target.value.toUpperCase() })}
                  placeholder="Ex: INST-001"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Boîte d'appartenance <span className="text-destructive">*</span></Label>
                <Select 
                  value={instrumentForm.boxId} 
                  onValueChange={(v) => setInstrumentForm({ ...instrumentForm, boxId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une boîte (obligatoire)" />
                  </SelectTrigger>
                  <SelectContent>
                    {boxes.map((box) => (
                      <SelectItem key={box.id} value={box.id}>{box.name} ({box.box_code})</SelectItem>
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
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={instrumentForm.description}
                  onChange={(e) => setInstrumentForm({ ...instrumentForm, description: e.target.value })}
                  placeholder="Description de l'instrument"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInstrumentDialog(false)}>Annuler</Button>
              <Button onClick={handleSaveInstrument} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingInstrument ? 'Mettre à jour' : 'Créer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* QR Code Dialog */}
        <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                Code-barres
              </DialogTitle>
              <DialogDescription>
                Imprimez ou téléchargez le code-barres
              </DialogDescription>
            </DialogHeader>
            {selectedBoxForQR && (
              <QRCodeGenerator
                boxId={selectedBoxForQR.id}
                boxName={selectedBoxForQR.name}
                boxNumber={null}
                location={selectedBoxForQR.box_code}
                size={180}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default SterilizationPage;
